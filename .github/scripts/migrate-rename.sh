#!/usr/bin/env bash
#
# migrate-rename.sh — One-time migration from doc-platform → specboard
#
# Tears down all old infrastructure and cleans up RETAIN resources,
# then deploys the new SpecboardStaging stack via CDK.
#
# Prerequisites:
#   - AWS CLI configured with admin credentials
#   - Node.js 22+ and npm available
#   - Run from the project root directory
#
# Usage:
#   bash .github/scripts/migrate-rename.sh
#
set -euo pipefail

REGION=us-west-2
OLD_STAGING_STACK=DocPlatformStack
OLD_PROD_STACK=DocPlatformProd

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")

echo "=== Specboard Migration ==="
echo "Account:  $ACCOUNT_ID"
echo "Region:   $REGION"
echo ""
echo "This will:"
echo "  1. Delete old stacks ($OLD_PROD_STACK, $OLD_STAGING_STACK)"
echo "  2. Clean up leftover resources (ECR, S3, Secrets, logs)"
echo "  3. Deploy new SpecboardStaging stack via CDK"
echo ""
echo "Press Enter to continue or Ctrl+C to abort..."
read -r

# ─────────────────────────────────────────────────
# Phase 1: Disable RDS deletion protection
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 1: Disable RDS deletion protection ---"

for stack in "$OLD_PROD_STACK" "$OLD_STAGING_STACK"; do
  if ! aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &>/dev/null; then
    echo "  Stack $stack not found, skipping."
    continue
  fi

  instances=$(aws cloudformation describe-stack-resources \
    --stack-name "$stack" \
    --query "StackResources[?ResourceType=='AWS::RDS::DBInstance'].PhysicalResourceId" \
    --output text --region "$REGION" 2>/dev/null || true)

  for db in $instances; do
    echo "  Disabling deletion protection: $db"
    aws rds modify-db-instance \
      --db-instance-identifier "$db" \
      --no-deletion-protection \
      --region "$REGION" --no-cli-pager 2>/dev/null || true
  done
done

echo "  Waiting 15s for RDS modifications to apply..."
sleep 15

# ─────────────────────────────────────────────────
# Phase 2: Delete CloudFormation stacks
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 2: Delete CloudFormation stacks ---"

# Production first (depends on staging's shared resources)
for stack in "$OLD_PROD_STACK" "$OLD_STAGING_STACK"; do
  if ! aws cloudformation describe-stacks --stack-name "$stack" --region "$REGION" &>/dev/null; then
    echo "  $stack: not found, skipping."
    continue
  fi

  echo "  Deleting $stack..."
  aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
  echo "  Waiting for $stack deletion (this may take 10-15 minutes)..."
  aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$REGION"
  echo "  $stack: deleted."
done

# ─────────────────────────────────────────────────
# Phase 3: Clean up RETAIN resources
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 3: Clean up RETAIN resources ---"

# ECR repositories
echo "  ECR repos:"
for repo in doc-platform/api doc-platform/frontend doc-platform/mcp doc-platform/storage; do
  if aws ecr describe-repositories --repository-names "$repo" --region "$REGION" &>/dev/null; then
    echo "    Deleting $repo"
    aws ecr delete-repository --repository-name "$repo" --force --region "$REGION" --no-cli-pager >/dev/null
  fi
done

# S3 buckets
echo "  S3 buckets:"
for suffix in "storage" "prod-storage"; do
  bucket="doc-platform-${suffix}-${ACCOUNT_ID}"
  if aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    echo "    Deleting $bucket"
    aws s3 rb "s3://$bucket" --force >/dev/null 2>&1 || true
  fi
done

# Secrets Manager
echo "  Secrets:"
for prefix in "doc-platform/" "production/doc-platform/"; do
  secrets=$(aws secretsmanager list-secrets \
    --filter Key=name,Values="$prefix" \
    --query "SecretList[].Name" --output text --region "$REGION" 2>/dev/null || true)
  for secret in $secrets; do
    echo "    Deleting $secret"
    aws secretsmanager delete-secret \
      --secret-id "$secret" \
      --force-delete-without-recovery \
      --region "$REGION" --no-cli-pager >/dev/null 2>/dev/null || true
  done
done

# CloudWatch log groups
echo "  Log groups:"
for lg in \
  /doc-platform/errors /doc-platform-prod/errors \
  /ecs/api /ecs/frontend /ecs/mcp /ecs/storage \
  /ecs/production/api /ecs/production/frontend /ecs/production/mcp /ecs/production/storage \
  /lambda/github-sync /lambda/production/github-sync; do
  if aws logs describe-log-groups --log-group-name-prefix "$lg" --query "logGroups[?logGroupName=='$lg']" --output text --region "$REGION" 2>/dev/null | grep -q "$lg"; then
    echo "    Deleting $lg"
    aws logs delete-log-group --log-group-name "$lg" --region "$REGION" 2>/dev/null || true
  fi
done

# Old deploy role (might already be gone with stack, but check)
echo "  IAM role:"
ROLE_NAME="doc-platform-github-actions-deploy"
if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null | grep -q "$ROLE_NAME"; then
  echo "    Cleaning up $ROLE_NAME"
  policies=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" \
    --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null || true)
  for policy in $policies; do
    aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policy" 2>/dev/null || true
  done
  inline=$(aws iam list-role-policies --role-name "$ROLE_NAME" \
    --query "PolicyNames[]" --output text 2>/dev/null || true)
  for policy in $inline; do
    aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "$policy" 2>/dev/null || true
  done
  aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null || true
fi

# Old OIDC provider (might already be gone with stack, but check)
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" &>/dev/null; then
  echo "    Deleting old OIDC provider"
  aws iam delete-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" 2>/dev/null || true
fi

echo "  Done."

# ─────────────────────────────────────────────────
# Phase 4: Deploy new staging stack
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 4: Deploy SpecboardStaging via CDK ---"
echo "  Installing dependencies..."
npm ci --silent

echo "  Building sync-lambda..."
npm run --workspace @specboard/sync-lambda build

echo "  Building infrastructure..."
npm run --workspace @specboard/infra build

echo "  Running CDK deploy (bootstrap mode)..."
cd infra
npx cdk deploy --context env=staging --context bootstrap=true --require-approval never
cd ..

# Get outputs
DEPLOY_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name SpecboardStaging \
  --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue" \
  --output text --region "$REGION")

HOSTED_ZONE_ID=$(aws cloudformation describe-stacks \
  --stack-name SpecboardStaging \
  --query "Stacks[0].Outputs[?OutputKey=='HostedZoneId'].OutputValue" \
  --output text --region "$REGION")

NS_RECORDS=$(aws route53 get-hosted-zone \
  --id "$HOSTED_ZONE_ID" \
  --query 'DelegationSet.NameServers' \
  --output text 2>/dev/null || echo "(could not retrieve)")

# ─────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────
echo ""
echo "==========================================="
echo "  Migration complete!"
echo "==========================================="
echo ""
echo "Deploy role ARN (for GitHub secret):"
echo "  $DEPLOY_ROLE_ARN"
echo ""
echo "Hosted zone NS records (update registrar if different):"
echo "  $NS_RECORDS"
echo ""
echo "Next steps:"
echo ""
echo "  1. Update GitHub secret AWS_DEPLOY_ROLE_ARN:"
echo "     → $DEPLOY_ROLE_ARN"
echo "     (Settings → Secrets and variables → Actions)"
echo ""
echo "  2. Update your domain registrar's NS records if they changed."
echo "     Compare the NS records above with what your registrar has."
echo ""
echo "  3. Run full staging deploy:"
echo "     gh workflow run cd.yml"
echo ""
echo "  4. Verify staging:"
echo "     curl -sf https://staging.specboard.io/api/health"
echo ""
echo "  5. Deploy production (create a GitHub release)"
echo ""
