# Deployment Specification

## Overview

Production deployment uses a **promotion model**: code is automatically deployed to staging, manually tested, then promoted to production via GitHub releases. The same Docker images run in both environments—only configuration differs.

## Goals

1. **Zero-downtime deployments** - Rolling updates via ECS Fargate
2. **Image promotion** - Deploy tested staging images to production (no rebuild)
3. **GitHub-native workflow** - Releases trigger production deploys
4. **Safe rollbacks** - Re-deploy any previous release in minutes
5. **Environment isolation** - Separate databases, secrets, and infrastructure

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Push to main ─────► Build Images ─────► Deploy Staging                │
│                           │                    │                         │
│                           │                    ▼                         │
│                           │              staging.specboard.io            │
│                           │                                              │
│                           ▼                                              │
│                     ECR Repository                                       │
│                     :latest + :${sha}                                    │
│                           │                                              │
│   Create Release ─────────┼─────────► Deploy Production                 │
│   (manual)                │                    │                         │
│                           │                    ▼                         │
│                           │              specboard.io                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Environment Configuration

Configuration is injected at runtime via ECS task definitions, not baked into images:

```
Docker Image (identical for both environments)
     │
     ├── Staging ECS Task Definition
     │   ├── APP_ENV=staging
     │   ├── DB_HOST=staging-db.cluster-xxx.us-west-2.rds.amazonaws.com
     │   ├── REDIS_URL=redis://staging-redis:6379
     │   └── Secrets: staging/doc-platform/*
     │
     └── Production ECS Task Definition
         ├── APP_ENV=production
         ├── DB_HOST=prod-db.cluster-xxx.us-west-2.rds.amazonaws.com
         ├── REDIS_URL=redis://prod-redis:6379
         └── Secrets: production/doc-platform/*
```

## Deployment Flows

### Staging Deployment (Automatic)

Triggered on every push to `main`:

```
1. CI passes
2. Build Docker images (api, frontend, mcp)
3. Tag with :latest and :${git-sha}
4. Push to ECR
5. Run database migrations
6. cdk deploy (infrastructure changes)
7. Force ECS service update (pull new images)
```

### Production Deployment (Manual via Release)

Triggered by creating a GitHub release:

```
1. Get git SHA from release tag
2. Verify images exist in ECR for that SHA
3. Run database migrations against production
4. cdk deploy production stack
5. Force ECS service update
6. Health check verification
```

**Important**: No rebuild occurs. The exact images tested on staging are deployed to production.

### Rollback (Manual)

Two options for rolling back:

**Option A: Re-run previous release workflow**
```
GitHub → Actions → Select previous release workflow → Re-run
```

**Option B: Dedicated rollback workflow**
```
GitHub → Actions → "Production Rollback" → Run workflow
  → Enter release tag (e.g., v1.2.2)
  → Requires approval
  → Deploys that release's images (no migrations)
```

## Database Migrations

### Zero-Downtime Migration Rules

Migrations must be **backward-compatible** so old code continues working:

| Operation | Safe Approach |
|-----------|---------------|
| Add column | Add as `NULL` or with `DEFAULT` |
| Remove column | Deploy code that ignores it first, drop later |
| Rename column | Add new → migrate data → deploy new code → drop old |
| Add table | Always safe |
| Drop table | Deploy code that doesn't use it first |
| Add index | Use `CREATE INDEX CONCURRENTLY` |

### Migration Timing

```
Timeline:
─────────────────────────────────────────────────────────────►

1. Old code running with old schema
   │
2. Run migrations (additive changes only)
   │  Schema now has new columns/tables
   │  Old code still works (ignores new columns)
   │
3. ECS rolling deployment begins
   │  New containers start with new code
   │  Health checks pass
   │  Traffic shifts to new containers
   │  Old containers drain and terminate
   │
4. New code running with new schema
```

### Dangerous Migrations

For breaking changes, use a two-phase deployment:

**Phase 1**: Deploy code that works with both schemas
**Phase 2**: Run migration
**Phase 3**: Deploy code that only works with new schema

## Infrastructure Differences

| Resource | Staging | Production |
|----------|---------|------------|
| **Domain** | staging.specboard.io | specboard.io |
| **Database** | Single-AZ, t4g.micro | Multi-AZ, t4g.small+ |
| **Redis** | Single node, t4g.micro | Single node, t4g.micro |
| **ECS Tasks** | 1 per service | 2+ per service |
| **Backup Retention** | 1 day | 7 days |
| **Deletion Protection** | Off | On |
| **Secrets Path** | staging/doc-platform/* | production/doc-platform/* |

## CDK Multi-Environment Implementation

### Environment Configuration

```typescript
// infra/lib/environment-config.ts
export interface EnvironmentConfig {
  name: 'staging' | 'production';
  domain: string;
  subdomain?: string;
  database: {
    instanceClass: ec2.InstanceClass;
    instanceSize: ec2.InstanceSize;
    multiAz: boolean;
    backupRetention: number;
    deletionProtection: boolean;
  };
  ecs: {
    desiredCount: number;
    cpu: number;
    memory: number;
  };
  secretsPrefix: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  staging: {
    name: 'staging',
    domain: 'specboard.io',
    subdomain: 'staging',
    database: {
      instanceClass: ec2.InstanceClass.T4G,
      instanceSize: ec2.InstanceSize.MICRO,
      multiAz: false,
      backupRetention: 1,
      deletionProtection: false,
    },
    ecs: {
      desiredCount: 1,
      cpu: 256,
      memory: 512,
    },
    secretsPrefix: 'staging/doc-platform',
  },
  production: {
    name: 'production',
    domain: 'specboard.io',
    subdomain: undefined,  // apex domain
    database: {
      instanceClass: ec2.InstanceClass.T4G,
      instanceSize: ec2.InstanceSize.SMALL,
      multiAz: true,
      backupRetention: 7,
      deletionProtection: true,
    },
    ecs: {
      desiredCount: 2,
      cpu: 256,
      memory: 512,
    },
    secretsPrefix: 'production/doc-platform',
  },
};
```

### Stack Instantiation

```typescript
// infra/bin/app.ts
const app = new cdk.App();
const targetEnv = app.node.tryGetContext('env') || 'staging';
const config = environments[targetEnv];

new DocPlatformStack(app, `DocPlatform-${config.name}`, {
  config,
  env: { account: '...', region: 'us-west-2' },
});
```

## GitHub Workflows

### Production Deploy Workflow

```yaml
# .github/workflows/prod-deploy.yml
name: Production Deploy

on:
  release:
    types: [published]

concurrency:
  group: production-deploy
  cancel-in-progress: false  # Never cancel production deploys

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval

    steps:
      - name: Get release info
        run: |
          # Get the commit SHA this release points to
          RELEASE_SHA=$(gh release view ${{ github.event.release.tag_name }} \
            --json targetCommitish -q .targetCommitish)
          echo "DEPLOY_SHA=$RELEASE_SHA" >> $GITHUB_ENV

      - name: Verify images exist
        run: |
          # Check that images for this SHA exist in ECR
          for service in api frontend mcp; do
            aws ecr describe-images \
              --repository-name doc-platform/$service \
              --image-ids imageTag=${{ env.DEPLOY_SHA }}
          done

      - name: Run migrations
        uses: ./.github/workflows/_run-ecs-task.yml
        with:
          environment: production
          command: migrate

      - name: Deploy infrastructure
        uses: ./.github/workflows/_deploy-cdk.yml
        with:
          environment: production
          image-tag: ${{ env.DEPLOY_SHA }}

      - name: Force ECS deployment
        run: |
          for service in api frontend mcp; do
            aws ecs update-service \
              --cluster doc-platform-production \
              --service $service \
              --force-new-deployment
          done

      - name: Wait for healthy
        run: |
          aws ecs wait services-stable \
            --cluster doc-platform-production \
            --services api frontend mcp

      - name: Health check
        run: curl -f https://specboard.io/health
```

### Rollback Workflow

```yaml
# .github/workflows/prod-rollback.yml
name: Production Rollback

on:
  workflow_dispatch:
    inputs:
      release_tag:
        description: 'Release to rollback to (e.g., v1.2.2)'
        required: true
        type: string
      skip_migrations:
        description: 'Skip migrations (code-only rollback)'
        required: false
        type: boolean
        default: true

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Get release commit
        run: |
          RELEASE_SHA=$(gh release view ${{ inputs.release_tag }} \
            --json targetCommitish -q .targetCommitish)
          echo "DEPLOY_SHA=$RELEASE_SHA" >> $GITHUB_ENV

      - name: Verify images exist
        run: |
          for service in api frontend mcp; do
            aws ecr describe-images \
              --repository-name doc-platform/$service \
              --image-ids imageTag=${{ env.DEPLOY_SHA }}
          done

      # Note: Rollback typically skips migrations
      # If you need to run down migrations, do it manually first

      - name: Force ECS deployment
        run: |
          for service in api frontend mcp; do
            aws ecs update-service \
              --cluster doc-platform-production \
              --service $service \
              --force-new-deployment \
              --task-definition doc-platform-$service:${{ env.DEPLOY_SHA }}
          done

      - name: Wait for healthy
        run: |
          aws ecs wait services-stable \
            --cluster doc-platform-production \
            --services api frontend mcp
```

## Safety Features

### ECS Circuit Breaker

Already configured—deployment fails fast if new tasks are unhealthy:

```typescript
circuitBreaker: { rollback: true }
```

### Health Checks

All services have health check endpoints:
- API: `GET /health`
- Frontend: `GET /health`
- MCP: `GET /health`

ECS won't route traffic until health checks pass.

### ECR Image Retention

Keep enough images for rollback:

```typescript
lifecycleRules: [{
  maxImageCount: 10,  // Increased for production
  rulePriority: 1,
  description: 'Keep last 10 images for rollback',
}]
```

### RDS Point-in-Time Recovery

Production database can be restored to any point in time:

```typescript
backup: {
  retention: cdk.Duration.days(7),
}
```

### GitHub Environment Protection

Production deployments require approval:

```yaml
environment: production  # Configured in GitHub repo settings
```

## Monitoring Production Deploys

### CloudWatch Alarms

Same alarms as staging, but with production thresholds:
- CPU > 80% for 5 minutes
- Memory > 80% for 5 minutes
- HTTP 5xx > 10 in 5 minutes

### Deployment Notifications

GitHub Actions can post to Slack/Discord on deploy success/failure.

## First Production Deployment

Initial production setup requires:

1. **Create production secrets in AWS Secrets Manager**
   - `production/doc-platform/db-credentials`
   - `production/doc-platform/invite-keys`
   - `production/doc-platform/session-secret`

2. **Bootstrap production infrastructure**
   ```bash
   cd infra
   npx cdk deploy --context env=production --context bootstrap=true
   ```

3. **Run initial migrations**
   - Triggered automatically by first deploy

4. **Seed admin account**
   - Store superadmin password in secrets
   - Seeder runs on first deploy

5. **DNS propagation**
   - Route53 creates records automatically
   - ACM certificate validation may take a few minutes

## What We're NOT Doing

- **Blue-green databases** - Backward-compatible migrations are simpler
- **Canary deployments** - ECS rolling updates are sufficient for now
- **Multiple AWS accounts** - Single account with environment prefixes
- **Feature flags for deploys** - Just deploy and rollback if needed
- **Automated rollback on metrics** - Manual decision for now

## Future Considerations

- Add Slack/Discord notifications for deployments
- Consider canary deployments when traffic increases
- Add deployment dashboard (which version is where)
- Implement database migration dry-run in CI
