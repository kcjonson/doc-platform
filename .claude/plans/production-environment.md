# Production Environment

## Context

Builds on the work from PR #63 (stale, will be closed) and the deployment spec at `docs/specs/deployment.md` (from that PR). The spec's core architecture is sound — promotion model, release-triggered deploys, environment config — but the implementation needs to be rebuilt on top of the current main, which has diverged significantly (pipeline reordering, health check changes, auth middleware updates).

Also incorporates deployment reliability fixes discovered during the MCP health check deploy failure (2026-02-19), where a CDK-triggered ECS rolling update with stale images caused a 1+ hour stuck deployment.

**Reference:** PR #63 deployment spec for architecture decisions (image promotion, rollback, env config, WAF, etc.)

## Phase 1: Deployment Reliability (prerequisite)

Fix deployment failure modes before adding a production environment.

### 1.1 Reduce ALB target group deregistration delay

**Files:** `infra/lib/doc-platform-stack.ts`

All target groups (API, Frontend, MCP) use the default 300s deregistration delay. For services with `desiredCount: 1`, this adds 5 minutes per failed task cycle during rollbacks.

- Set `deregistrationDelay: cdk.Duration.seconds(30)` on all target groups
- 30s is enough for in-flight requests to complete

### 1.2 Verify ECS circuit breaker behavior

Investigate why rollbacks take hours instead of minutes:
- Check CloudFormation events during a rollback to see if circuit breaker triggers
- Check ECS deployment events to see task failure cycle timing
- Consider adding `deploymentAlarms` as a faster failure detection mechanism
- If circuit breaker is working but CloudFormation is slow to detect, add a CloudFormation timeout

### 1.3 Add CloudFormation deployment timeout

**Files:** `infra/lib/doc-platform-stack.ts`

ECS services in CloudFormation wait indefinitely for stabilization by default. Add explicit timeouts:

- Research: does CDK's `FargateService` support a deployment timeout property?
- Alternative: use `deploymentAlarms` with a CloudWatch alarm on ECS deployment failure metrics
- Goal: failed deployments should be detected in < 10 minutes, not hours

## Phase 2: Multi-Environment CDK Support

Refactor the CDK stack to support staging and production from the same code.

### 2.1 Create environment config

**New file:** `infra/lib/environment-config.ts`

Define per-environment settings (reference PR #63's `environment-config.ts`):

```typescript
interface EnvironmentConfig {
  name: 'staging' | 'production';
  stackName: string;
  domain: string;
  subdomain?: string;
  database: { instanceSize, multiAz, backupRetention, deletionProtection };
  ecs: { desiredCount, cpu, memory };
  secretsPrefix: string;
  waf: boolean;
}
```

Key differences between environments:
| Resource | Staging | Production |
|----------|---------|------------|
| Domain | staging.specboard.io | specboard.io |
| DB | t4g.micro, single-AZ, 1-day backup | t4g.small, multi-AZ, 7-day backup |
| ECS | 1 task per service | 2 tasks per service |
| WAF | Off | On (AWS managed rules) |
| Deletion protection | Off | On |

### 2.2 Parameterize CDK stack

**Files:** `infra/lib/doc-platform-stack.ts`, `infra/bin/app.ts`

- Pass `EnvironmentConfig` into the stack constructor
- Replace all hardcoded values with config references
- Stack name becomes `DocPlatform-{env}` (e.g., `DocPlatform-staging`, `DocPlatform-production`)
- Use `--context env=staging|production` to select environment
- Ensure ECR repos are shared (not per-environment) — images are promoted, not rebuilt

### 2.3 Add WAF for production

**Files:** `infra/lib/doc-platform-stack.ts`

Conditionally create WAF when `config.waf === true`:
- AWSManagedRulesCommonRuleSet
- AWSManagedRulesKnownBadInputsRuleSet
- AWSManagedRulesSQLiRuleSet
- Rate limiting (2000 req/5min per IP)
- Associate with ALB

### 2.4 Production-specific security

- RDS storage encryption at rest (production only, or both)
- Deletion protection on RDS and ECS services
- Separate secrets path (`production/doc-platform/*`)

## Phase 3: Production Deploy Workflows

### 3.1 Update reusable workflows for environment support

**Files:** `_deploy-cdk.yml`, `_run-ecs-task.yml`, `_build-images.yml`, deploy scripts

Add `environment` input to reusable workflows:
- CDK deploy passes `--context env=$environment`
- ECS task runner uses the correct cluster name
- Deploy scripts resolve stack outputs for the target environment
- Build workflow remains environment-agnostic (images are shared)

### 3.2 Update staging CD workflow

**Files:** `.github/workflows/cd.yml`

- Pass `environment: staging` to reusable workflows
- Keep existing pipeline ordering (build → CDK → migrate → seed → deploy)

### 3.3 Create production deploy workflow

**New file:** `.github/workflows/prod-deploy.yml`

Triggered by GitHub release publish:
1. Extract git SHA from release tag
2. Verify images exist in ECR for that SHA
3. CDK deploy production stack (`--context env=production`)
4. Run migrations against production DB
5. Force ECS deployment with the release SHA's images
6. Health check verification

Pipeline: verify images → CDK → migrate → deploy → health check

Key decisions from PR #63 spec:
- `cancel-in-progress: false` — never cancel production deploys
- `environment: production` — requires GitHub approval
- No seed step in production (staging only)

### 3.4 Create rollback workflow

**New file:** `.github/workflows/prod-rollback.yml`

Manual trigger with release tag input:
1. Resolve SHA from release tag
2. Verify images exist
3. Force ECS deployment with that SHA's images (no CDK, no migrations)
4. Wait for stable

## Phase 4: First Production Deploy

### 4.1 Create production secrets

In AWS Secrets Manager:
- `production/doc-platform/db-credentials`
- `production/doc-platform/api-key-encryption-key`
- Other production-specific secrets

### 4.2 Bootstrap production

1. `cdk deploy --context env=production --context bootstrap=true`
2. Build/push images (already in ECR from staging)
3. `cdk deploy --context env=production`
4. Run migrations
5. Seed admin account
6. Verify health checks
7. DNS propagation

### 4.3 Create first release

- Tag as `v0.1.0`
- Verify production deploy workflow triggers and succeeds

---

## Files to Create/Modify

**New files:**
- `infra/lib/environment-config.ts`
- `.github/workflows/prod-deploy.yml`
- `.github/workflows/prod-rollback.yml`

**Modified files:**
- `infra/lib/doc-platform-stack.ts` (parameterize + reliability fixes)
- `infra/bin/app.ts` (environment selection)
- `.github/workflows/_deploy-cdk.yml` (environment input)
- `.github/workflows/_run-ecs-task.yml` (environment input)
- `.github/scripts/get-stack-outputs.sh` (environment-aware)
- `.github/scripts/deploy-services.sh` (environment-aware)
- `.github/workflows/cd.yml` (pass environment: staging)

## Out of Scope

- Blue-green databases (backward-compatible migrations are simpler)
- Canary deployments (ECS rolling updates sufficient for now)
- Multiple AWS accounts (single account with environment prefixes)
- Automated rollback on metrics (manual decision for now)
- Slack/Discord deploy notifications (future)

## Open Questions

1. Should ECR repos be shared across environments or separate? (PR #63 used shared — makes sense for promotion model)
2. Do we need a separate VPC for production or just separate subnets/security groups?
3. Should the OIDC trust policy for the deploy role be restricted by environment (separate roles for staging vs prod)?
