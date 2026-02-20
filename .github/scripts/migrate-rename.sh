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
echo "  3. Verify no dangling billable resources remain"
echo "  4. Deploy new SpecboardStaging stack via CDK"
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
# Phase 4: Verify no dangling billable resources
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 4: Scanning for dangling billable resources ---"
echo ""

DANGLING=0

# Check for stuck/leftover CloudFormation stacks
echo "  CloudFormation stacks:"
STACKS=$(aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE ROLLBACK_COMPLETE UPDATE_ROLLBACK_COMPLETE DELETE_FAILED \
  --query "StackSummaries[?contains(StackName,'DocPlatform') || contains(StackName,'doc-platform')].{Name:StackName,Status:StackStatus}" \
  --output text --region "$REGION" 2>/dev/null || true)
if [ -n "$STACKS" ]; then
  echo "    WARNING: Old stacks still exist!"
  echo "$STACKS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# ECS clusters (~$0 themselves, but running tasks cost money)
echo "  ECS clusters:"
ECS_CLUSTERS=$(aws ecs list-clusters --region "$REGION" \
  --query "clusterArns[?contains(@,'doc-platform')]" --output text 2>/dev/null || true)
if [ -n "$ECS_CLUSTERS" ]; then
  echo "    WARNING: Old ECS clusters still running!"
  echo "$ECS_CLUSTERS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# RDS instances (t4g.micro ~$12/mo, t4g.medium ~$48/mo)
echo "  RDS instances:"
RDS_INSTANCES=$(aws rds describe-db-instances --region "$REGION" \
  --query "DBInstances[?contains(DBInstanceIdentifier,'docplatform') || contains(DBInstanceIdentifier,'doc-platform')].{Id:DBInstanceIdentifier,Class:DBInstanceClass,Status:DBInstanceStatus}" \
  --output table 2>/dev/null || true)
if echo "$RDS_INSTANCES" | grep -q "docplatform\|doc-platform"; then
  echo "    WARNING: Old RDS instances still running!"
  echo "$RDS_INSTANCES" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# RDS snapshots (storage cost: ~$0.02/GB/month)
echo "  RDS snapshots:"
RDS_SNAPSHOTS=$(aws rds describe-db-snapshots --region "$REGION" \
  --query "DBSnapshots[?contains(DBSnapshotIdentifier,'docplatform') || contains(DBSnapshotIdentifier,'doc-platform')].{Id:DBSnapshotIdentifier,Size:AllocatedStorage,Status:Status}" \
  --output table 2>/dev/null || true)
if echo "$RDS_SNAPSHOTS" | grep -q "docplatform\|doc-platform"; then
  echo "    WARNING: Old RDS snapshots exist (storage cost)!"
  echo "$RDS_SNAPSHOTS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# ElastiCache clusters (~$12/mo for cache.t4g.micro)
echo "  ElastiCache clusters:"
ELASTICACHE=$(aws elasticache describe-cache-clusters --region "$REGION" \
  --query "CacheClusters[?contains(CacheClusterId,'doc-platform')].{Id:CacheClusterId,Type:CacheNodeType,Status:CacheClusterStatus}" \
  --output table 2>/dev/null || true)
if echo "$ELASTICACHE" | grep -q "doc-platform"; then
  echo "    WARNING: Old ElastiCache clusters still running!"
  echo "$ELASTICACHE" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Load balancers (~$16/mo each)
echo "  Load balancers:"
ALBS=$(aws elbv2 describe-load-balancers --region "$REGION" \
  --query "LoadBalancers[?contains(LoadBalancerName,'doc-platform') || contains(LoadBalancerName,'DocPl')].{Name:LoadBalancerName,State:State.Code,DNS:DNSName}" \
  --output table 2>/dev/null || true)
if echo "$ALBS" | grep -qi "doc-platform\|DocPl"; then
  echo "    WARNING: Old load balancers still running!"
  echo "$ALBS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# NAT Gateways (~$32/mo EACH — the most expensive dangler)
echo "  NAT Gateways:"
NAT_GWS=$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter "Name=state,Values=available,pending" \
  --query "NatGateways[].{Id:NatGatewayId,State:State,VpcId:VpcId,SubnetId:SubnetId}" \
  --output table 2>/dev/null || true)
if echo "$NAT_GWS" | grep -q "nat-"; then
  echo "    WARNING: NAT Gateways still running (~\$32/month EACH)!"
  echo "$NAT_GWS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Elastic IPs not associated ($3.65/mo each since Feb 2024)
echo "  Unassociated Elastic IPs:"
EIPS=$(aws ec2 describe-addresses --region "$REGION" \
  --query "Addresses[?AssociationId==null].{PublicIp:PublicIp,AllocationId:AllocationId}" \
  --output table 2>/dev/null || true)
if echo "$EIPS" | grep -q "eipalloc-"; then
  echo "    WARNING: Unassociated Elastic IPs found (~\$3.65/month each)!"
  echo "$EIPS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Non-default VPCs (free but indicate leftover infrastructure)
echo "  Non-default VPCs:"
VPCS=$(aws ec2 describe-vpcs --region "$REGION" \
  --query "Vpcs[?IsDefault==\`false\`].{VpcId:VpcId,CidrBlock:CidrBlock,Name:Tags[?Key=='Name']|[0].Value}" \
  --output table 2>/dev/null || true)
if echo "$VPCS" | grep -q "vpc-"; then
  echo "    WARNING: Non-default VPCs found (may contain billable resources)!"
  echo "$VPCS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# ECR repos with old prefix
echo "  ECR repos (doc-platform/*):"
ECR_OLD=$(aws ecr describe-repositories --region "$REGION" \
  --query "repositories[?starts_with(repositoryName,'doc-platform/')].repositoryName" \
  --output text 2>/dev/null || true)
if [ -n "$ECR_OLD" ]; then
  echo "    WARNING: Old ECR repos still exist!"
  echo "$ECR_OLD" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# S3 buckets with old prefix
echo "  S3 buckets (doc-platform*):"
S3_OLD=$(aws s3api list-buckets \
  --query "Buckets[?starts_with(Name,'doc-platform')].Name" \
  --output text 2>/dev/null || true)
if [ -n "$S3_OLD" ]; then
  echo "    WARNING: Old S3 buckets still exist!"
  echo "$S3_OLD" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Secrets Manager
echo "  Secrets (doc-platform*):"
SECRETS_OLD=$(aws secretsmanager list-secrets --region "$REGION" \
  --filter Key=name,Values="doc-platform" \
  --query "SecretList[].Name" --output text 2>/dev/null || true)
SECRETS_PROD=$(aws secretsmanager list-secrets --region "$REGION" \
  --filter Key=name,Values="production/doc-platform" \
  --query "SecretList[].Name" --output text 2>/dev/null || true)
if [ -n "$SECRETS_OLD" ] || [ -n "$SECRETS_PROD" ]; then
  echo "    WARNING: Old secrets still exist (~\$0.40/secret/month)!"
  echo "$SECRETS_OLD $SECRETS_PROD" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Lambda functions
echo "  Lambda functions (doc-platform*):"
LAMBDAS=$(aws lambda list-functions --region "$REGION" \
  --query "Functions[?contains(FunctionName,'doc-platform')].{Name:FunctionName,Runtime:Runtime}" \
  --output table 2>/dev/null || true)
if echo "$LAMBDAS" | grep -q "doc-platform"; then
  echo "    WARNING: Old Lambda functions still exist!"
  echo "$LAMBDAS" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Route53 hosted zones (check for duplicates — $0.50/mo each)
echo "  Route53 hosted zones (specboard.io):"
ZONES=$(aws route53 list-hosted-zones-by-name \
  --dns-name "specboard.io" \
  --query "HostedZones[?Name=='specboard.io.'].{Id:Id,Name:Name,Records:ResourceRecordSetCount}" \
  --output table 2>/dev/null || true)
ZONE_COUNT=$(aws route53 list-hosted-zones-by-name \
  --dns-name "specboard.io" \
  --query "length(HostedZones[?Name=='specboard.io.'])" \
  --output text 2>/dev/null || echo "0")
if [ "$ZONE_COUNT" -gt "0" ] 2>/dev/null; then
  echo "    Found $ZONE_COUNT hosted zone(s) for specboard.io (\$0.50/month each):"
  echo "$ZONES" | sed 's/^/    /'
  # This is informational — zones may be intentionally kept
fi

# WAF WebACLs ($5/mo each)
echo "  WAF WebACLs:"
WAF=$(aws wafv2 list-web-acls --scope REGIONAL --region "$REGION" \
  --query "WebACLs[?contains(Name,'doc-platform')].{Name:Name,Id:Id}" \
  --output table 2>/dev/null || true)
if echo "$WAF" | grep -q "doc-platform"; then
  echo "    WARNING: Old WAF WebACLs still exist (~\$5/month each)!"
  echo "$WAF" | sed 's/^/    /'
  DANGLING=1
else
  echo "    None found."
fi

# Summary
echo ""
if [ "$DANGLING" -eq 1 ]; then
  echo "  ⚠ DANGLING RESOURCES DETECTED — review above and clean up manually."
  echo "  These will incur ongoing charges until deleted."
  echo ""
  echo "  Press Enter to continue to CDK deploy, or Ctrl+C to abort and clean up first..."
  read -r
else
  echo "  ✓ No dangling billable resources found. Clean slate confirmed."
fi

# ─────────────────────────────────────────────────
# Phase 5: Deploy new staging stack
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 5: Deploy SpecboardStaging via CDK ---"
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
