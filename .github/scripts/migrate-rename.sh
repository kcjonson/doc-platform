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
# Phase 3: Clean up survivors (RETAIN, SNAPSHOT, and stragglers)
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 3: Clean up all remaining project resources ---"

# ── ECR repositories ──
echo "  ECR repos (doc-platform/*):"
ECR_REPOS=$(aws ecr describe-repositories --region "$REGION" \
  --query "repositories[?starts_with(repositoryName,'doc-platform/')].repositoryName" \
  --output text 2>/dev/null || true)
for repo in $ECR_REPOS; do
  echo "    Deleting $repo"
  aws ecr delete-repository --repository-name "$repo" --force --region "$REGION" --no-cli-pager >/dev/null 2>/dev/null || true
done
[ -z "$ECR_REPOS" ] && echo "    None found."

# ── S3 buckets ──
echo "  S3 buckets (doc-platform*):"
S3_BUCKETS=$(aws s3api list-buckets \
  --query "Buckets[?starts_with(Name,'doc-platform')].Name" \
  --output text 2>/dev/null || true)
for bucket in $S3_BUCKETS; do
  echo "    Emptying and deleting $bucket"
  aws s3 rb "s3://$bucket" --force >/dev/null 2>&1 || true
done
[ -z "$S3_BUCKETS" ] && echo "    None found."

# ── RDS final snapshots (created by SNAPSHOT removal policy) ──
echo "  RDS snapshots:"
RDS_SNAPS=$(aws rds describe-db-snapshots --region "$REGION" \
  --query "DBSnapshots[?contains(DBSnapshotIdentifier,'docplatform') || contains(DBSnapshotIdentifier,'doc-platform')].DBSnapshotIdentifier" \
  --output text 2>/dev/null || true)
for snap in $RDS_SNAPS; do
  echo "    Deleting snapshot $snap"
  aws rds delete-db-snapshot --db-snapshot-identifier "$snap" --region "$REGION" --no-cli-pager >/dev/null 2>/dev/null || true
done
[ -z "$RDS_SNAPS" ] && echo "    None found."

# Also check for cluster snapshots
RDS_CLUSTER_SNAPS=$(aws rds describe-db-cluster-snapshots --region "$REGION" \
  --query "DBClusterSnapshots[?contains(DBClusterSnapshotIdentifier,'docplatform') || contains(DBClusterSnapshotIdentifier,'doc-platform')].DBClusterSnapshotIdentifier" \
  --output text 2>/dev/null || true)
for snap in $RDS_CLUSTER_SNAPS; do
  echo "    Deleting cluster snapshot $snap"
  aws rds delete-db-cluster-snapshot --db-cluster-snapshot-identifier "$snap" --region "$REGION" --no-cli-pager >/dev/null 2>/dev/null || true
done

# ── Secrets Manager ──
echo "  Secrets (doc-platform*, production/doc-platform*):"
for prefix in "doc-platform" "production/doc-platform"; do
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

# ── CloudWatch log groups (scan, don't hardcode) ──
echo "  Log groups:"
# Scan all prefixes our project could have created
for prefix in "/ecs/" "/lambda/" "/doc-platform" "/aws/lambda/DocPlatform" "/aws/lambda/doc-platform"; do
  log_groups=$(aws logs describe-log-groups \
    --log-group-name-prefix "$prefix" \
    --query "logGroups[].logGroupName" \
    --output text --region "$REGION" 2>/dev/null || true)
  for lg in $log_groups; do
    echo "    Deleting $lg"
    aws logs delete-log-group --log-group-name "$lg" --region "$REGION" 2>/dev/null || true
  done
done

# ── CloudWatch alarms ──
echo "  CloudWatch alarms:"
CW_ALARMS=$(aws cloudwatch describe-alarms --region "$REGION" \
  --query "MetricAlarms[?contains(AlarmName,'doc-platform') || contains(AlarmName,'DocPlatform')].AlarmName" \
  --output text 2>/dev/null || true)
for alarm in $CW_ALARMS; do
  echo "    Deleting alarm $alarm"
  aws cloudwatch delete-alarms --alarm-names "$alarm" --region "$REGION" 2>/dev/null || true
done
[ -z "$CW_ALARMS" ] && echo "    None found."

# ── SNS topics ──
echo "  SNS topics:"
SNS_TOPICS=$(aws sns list-topics --region "$REGION" \
  --query "Topics[?contains(TopicArn,'doc-platform') || contains(TopicArn,'DocPlatform')].TopicArn" \
  --output text 2>/dev/null || true)
for topic in $SNS_TOPICS; do
  echo "    Deleting $topic"
  aws sns delete-topic --topic-arn "$topic" --region "$REGION" 2>/dev/null || true
done
[ -z "$SNS_TOPICS" ] && echo "    None found."

# ── SQS queues ──
echo "  SQS queues:"
SQS_QUEUES=$(aws sqs list-queues --region "$REGION" \
  --queue-name-prefix "doc-platform" \
  --query "QueueUrls[]" --output text 2>/dev/null || true)
for queue in $SQS_QUEUES; do
  echo "    Deleting $queue"
  aws sqs delete-queue --queue-url "$queue" --region "$REGION" 2>/dev/null || true
done
# Also check DocPlatform prefix (CDK-generated names)
SQS_QUEUES2=$(aws sqs list-queues --region "$REGION" \
  --queue-name-prefix "DocPlatform" \
  --query "QueueUrls[]" --output text 2>/dev/null || true)
for queue in $SQS_QUEUES2; do
  echo "    Deleting $queue"
  aws sqs delete-queue --queue-url "$queue" --region "$REGION" 2>/dev/null || true
done
[ -z "$SQS_QUEUES" ] && [ -z "$SQS_QUEUES2" ] && echo "    None found."

# ── IAM: deploy role ──
echo "  IAM roles:"
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
else
  echo "    Deploy role already gone."
fi

# ── IAM: OIDC provider ──
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" &>/dev/null; then
  echo "    Deleting OIDC provider"
  aws iam delete-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" 2>/dev/null || true
fi

# ── Route53 hosted zones ──
echo "  Route53 hosted zones (specboard.io):"
ZONE_IDS=$(aws route53 list-hosted-zones-by-name \
  --dns-name "specboard.io" \
  --query "HostedZones[?Name=='specboard.io.'].Id" \
  --output text 2>/dev/null || true)
for zone_id in $ZONE_IDS; do
  # Must delete all non-NS/SOA records first
  zone_id_short="${zone_id##*/}"
  echo "    Deleting hosted zone $zone_id_short"
  # Get all record sets except NS and SOA (required, can't delete)
  RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id "$zone_id_short" \
    --query "ResourceRecordSets[?Type!='NS' && Type!='SOA']" --output json --region "$REGION" 2>/dev/null || echo "[]")
  if [ "$RECORDS" != "[]" ] && [ -n "$RECORDS" ]; then
    # Build batch delete
    CHANGES=$(echo "$RECORDS" | jq '[.[] | {Action: "DELETE", ResourceRecordSet: .}]')
    if [ "$CHANGES" != "[]" ] && [ "$CHANGES" != "null" ]; then
      echo "      Deleting $(echo "$CHANGES" | jq length) DNS records..."
      aws route53 change-resource-record-sets --hosted-zone-id "$zone_id_short" \
        --change-batch "{\"Changes\": $CHANGES}" --no-cli-pager >/dev/null 2>/dev/null || true
    fi
  fi
  aws route53 delete-hosted-zone --id "$zone_id_short" --no-cli-pager >/dev/null 2>/dev/null || true
done
[ -z "$ZONE_IDS" ] && echo "    None found."

# ── ACM certificates ──
echo "  ACM certificates (specboard.io):"
CERT_ARNS=$(aws acm list-certificates --region "$REGION" \
  --query "CertificateSummaryList[?contains(DomainName,'specboard.io')].CertificateArn" \
  --output text 2>/dev/null || true)
for cert in $CERT_ARNS; do
  echo "    Deleting $cert"
  aws acm delete-certificate --certificate-arn "$cert" --region "$REGION" 2>/dev/null || true
done
[ -z "$CERT_ARNS" ] && echo "    None found."

echo "  Done."

# ─────────────────────────────────────────────────
# Phase 4: Verify clean slate (broad sweep of ALL resources)
# ─────────────────────────────────────────────────
echo ""
echo "--- Phase 4: Verifying clean slate (scanning ALL resource types) ---"
echo ""
echo "  Checking that the account looks like a fresh AWS account"
echo "  (excluding CDK bootstrap resources which are account-level)."
echo ""

DANGLING=0

# Helper: flag a dangling resource
flag() {
  DANGLING=1
}

# CloudFormation stacks (except CDKToolkit bootstrap)
echo "  CloudFormation stacks:"
STACKS=$(aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE ROLLBACK_COMPLETE UPDATE_ROLLBACK_COMPLETE DELETE_FAILED CREATE_IN_PROGRESS UPDATE_IN_PROGRESS \
  --query "StackSummaries[?StackName!='CDKToolkit'].{Name:StackName,Status:StackStatus}" \
  --output text --region "$REGION" 2>/dev/null || true)
if [ -n "$STACKS" ]; then
  echo "    WARNING: Stacks still exist!"
  echo "$STACKS" | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# ECS clusters (any)
echo "  ECS clusters:"
ECS_CLUSTERS=$(aws ecs list-clusters --region "$REGION" \
  --query "clusterArns" --output text 2>/dev/null || true)
if [ -n "$ECS_CLUSTERS" ]; then
  echo "    WARNING: ECS clusters exist!"
  echo "$ECS_CLUSTERS" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# RDS instances (any)
echo "  RDS instances:"
RDS_COUNT=$(aws rds describe-db-instances --region "$REGION" \
  --query "length(DBInstances)" --output text 2>/dev/null || echo "0")
if [ "$RDS_COUNT" != "0" ]; then
  echo "    WARNING: $RDS_COUNT RDS instance(s) still running!"
  aws rds describe-db-instances --region "$REGION" \
    --query "DBInstances[].{Id:DBInstanceIdentifier,Class:DBInstanceClass,Status:DBInstanceStatus}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# RDS snapshots (any manual/final snapshots — automated ones are free)
echo "  RDS snapshots (manual/final):"
RDS_SNAPS=$(aws rds describe-db-snapshots --region "$REGION" \
  --snapshot-type manual \
  --query "DBSnapshots[].{Id:DBSnapshotIdentifier,SizeGB:AllocatedStorage,Status:Status}" \
  --output text 2>/dev/null || true)
if [ -n "$RDS_SNAPS" ]; then
  echo "    WARNING: Manual RDS snapshots exist (~\$0.02/GB/month)!"
  aws rds describe-db-snapshots --region "$REGION" --snapshot-type manual \
    --query "DBSnapshots[].{Id:DBSnapshotIdentifier,SizeGB:AllocatedStorage}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# ElastiCache (any)
echo "  ElastiCache clusters:"
EC_COUNT=$(aws elasticache describe-cache-clusters --region "$REGION" \
  --query "length(CacheClusters)" --output text 2>/dev/null || echo "0")
if [ "$EC_COUNT" != "0" ]; then
  echo "    WARNING: $EC_COUNT ElastiCache cluster(s) still running!"
  aws elasticache describe-cache-clusters --region "$REGION" \
    --query "CacheClusters[].{Id:CacheClusterId,Type:CacheNodeType,Status:CacheClusterStatus}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Load balancers (any)
echo "  Load balancers:"
ALB_COUNT=$(aws elbv2 describe-load-balancers --region "$REGION" \
  --query "length(LoadBalancers)" --output text 2>/dev/null || echo "0")
if [ "$ALB_COUNT" != "0" ]; then
  echo "    WARNING: $ALB_COUNT load balancer(s) still running (~\$16/month each)!"
  aws elbv2 describe-load-balancers --region "$REGION" \
    --query "LoadBalancers[].{Name:LoadBalancerName,State:State.Code}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# NAT Gateways (any active — the most expensive dangler)
echo "  NAT Gateways:"
NAT_COUNT=$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter "Name=state,Values=available,pending" \
  --query "length(NatGateways)" --output text 2>/dev/null || echo "0")
if [ "$NAT_COUNT" != "0" ]; then
  echo "    WARNING: $NAT_COUNT NAT Gateway(s) running (~\$32/month EACH)!"
  aws ec2 describe-nat-gateways --region "$REGION" \
    --filter "Name=state,Values=available,pending" \
    --query "NatGateways[].{Id:NatGatewayId,VpcId:VpcId}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Elastic IPs (any unassociated)
echo "  Unassociated Elastic IPs:"
EIP_COUNT=$(aws ec2 describe-addresses --region "$REGION" \
  --query "length(Addresses[?AssociationId==null])" --output text 2>/dev/null || echo "0")
if [ "$EIP_COUNT" != "0" ]; then
  echo "    WARNING: $EIP_COUNT unassociated EIP(s) (~\$3.65/month each)!"
  aws ec2 describe-addresses --region "$REGION" \
    --query "Addresses[?AssociationId==null].{IP:PublicIp,Id:AllocationId}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Non-default VPCs (any)
echo "  Non-default VPCs:"
VPC_COUNT=$(aws ec2 describe-vpcs --region "$REGION" \
  --query "length(Vpcs[?IsDefault==\`false\`])" --output text 2>/dev/null || echo "0")
if [ "$VPC_COUNT" != "0" ]; then
  echo "    WARNING: $VPC_COUNT non-default VPC(s) found (may contain billable resources)!"
  aws ec2 describe-vpcs --region "$REGION" \
    --query "Vpcs[?IsDefault==\`false\`].{Id:VpcId,CIDR:CidrBlock,Name:Tags[?Key=='Name']|[0].Value}" \
    --output table 2>/dev/null | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# ECR repos (any)
echo "  ECR repositories:"
ECR_REPOS_ALL=$(aws ecr describe-repositories --region "$REGION" \
  --query "repositories[].repositoryName" --output text 2>/dev/null || true)
if [ -n "$ECR_REPOS_ALL" ]; then
  echo "    WARNING: ECR repositories still exist!"
  echo "$ECR_REPOS_ALL" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# S3 buckets (exclude CDK bootstrap bucket)
echo "  S3 buckets (non-CDK):"
S3_ALL=$(aws s3api list-buckets \
  --query "Buckets[?!starts_with(Name,'cdk-')].Name" \
  --output text 2>/dev/null || true)
if [ -n "$S3_ALL" ]; then
  echo "    WARNING: S3 buckets still exist!"
  echo "$S3_ALL" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Secrets Manager (any)
echo "  Secrets Manager:"
SECRET_COUNT=$(aws secretsmanager list-secrets --region "$REGION" \
  --query "length(SecretList)" --output text 2>/dev/null || echo "0")
if [ "$SECRET_COUNT" != "0" ]; then
  echo "    WARNING: $SECRET_COUNT secret(s) still exist (~\$0.40/secret/month)!"
  aws secretsmanager list-secrets --region "$REGION" \
    --query "SecretList[].Name" --output text 2>/dev/null | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# CloudWatch log groups (exclude CDK and AWS service logs)
echo "  CloudWatch log groups (non-CDK):"
LOG_GROUPS=$(aws logs describe-log-groups --region "$REGION" \
  --query "logGroups[?!starts_with(logGroupName,'/aws/cdk')].logGroupName" \
  --output text 2>/dev/null || true)
if [ -n "$LOG_GROUPS" ]; then
  echo "    WARNING: Log groups still exist!"
  echo "$LOG_GROUPS" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# CloudWatch alarms (any)
echo "  CloudWatch alarms:"
ALARM_COUNT=$(aws cloudwatch describe-alarms --region "$REGION" \
  --query "length(MetricAlarms)" --output text 2>/dev/null || echo "0")
if [ "$ALARM_COUNT" != "0" ]; then
  echo "    WARNING: $ALARM_COUNT CloudWatch alarm(s) still exist!"
  aws cloudwatch describe-alarms --region "$REGION" \
    --query "MetricAlarms[].AlarmName" --output text 2>/dev/null | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Lambda functions (exclude CDK bootstrap)
echo "  Lambda functions:"
LAMBDA_LIST=$(aws lambda list-functions --region "$REGION" \
  --query "Functions[?!starts_with(FunctionName,'cdk-')].FunctionName" \
  --output text 2>/dev/null || true)
if [ -n "$LAMBDA_LIST" ]; then
  echo "    WARNING: Lambda functions still exist!"
  echo "$LAMBDA_LIST" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Route53 hosted zones (any for specboard.io)
echo "  Route53 hosted zones:"
ZONE_COUNT=$(aws route53 list-hosted-zones-by-name \
  --dns-name "specboard.io" \
  --query "length(HostedZones[?Name=='specboard.io.'])" \
  --output text 2>/dev/null || echo "0")
if [ "$ZONE_COUNT" != "0" ] 2>/dev/null; then
  echo "    WARNING: $ZONE_COUNT hosted zone(s) for specboard.io (\$0.50/month each)!"
  flag
else
  echo "    Clean."
fi

# ACM certificates (any)
echo "  ACM certificates:"
CERT_COUNT=$(aws acm list-certificates --region "$REGION" \
  --query "length(CertificateSummaryList)" --output text 2>/dev/null || echo "0")
if [ "$CERT_COUNT" != "0" ]; then
  echo "    WARNING: $CERT_COUNT ACM certificate(s) still exist!"
  aws acm list-certificates --region "$REGION" \
    --query "CertificateSummaryList[].DomainName" --output text 2>/dev/null | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# WAF WebACLs (any)
echo "  WAF WebACLs:"
WAF_COUNT=$(aws wafv2 list-web-acls --scope REGIONAL --region "$REGION" \
  --query "length(WebACLs)" --output text 2>/dev/null || echo "0")
if [ "$WAF_COUNT" != "0" ]; then
  echo "    WARNING: $WAF_COUNT WAF WebACL(s) still exist (~\$5/month each)!"
  flag
else
  echo "    Clean."
fi

# SNS topics (any)
echo "  SNS topics:"
SNS_LIST=$(aws sns list-topics --region "$REGION" \
  --query "Topics[].TopicArn" --output text 2>/dev/null || true)
if [ -n "$SNS_LIST" ]; then
  echo "    WARNING: SNS topics still exist!"
  echo "$SNS_LIST" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# SQS queues (any)
echo "  SQS queues:"
SQS_LIST=$(aws sqs list-queues --region "$REGION" \
  --query "QueueUrls" --output text 2>/dev/null || true)
if [ -n "$SQS_LIST" ]; then
  echo "    WARNING: SQS queues still exist!"
  echo "$SQS_LIST" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# OIDC providers (check if still lingering)
echo "  IAM OIDC providers:"
OIDC_CHECK=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[].Arn" --output text 2>/dev/null || true)
if [ -n "$OIDC_CHECK" ]; then
  echo "    WARNING: OIDC provider(s) still exist!"
  echo "$OIDC_CHECK" | tr '\t' '\n' | sed 's/^/    /'
  flag
else
  echo "    Clean."
fi

# Summary
echo ""
echo "  ─────────────────────────────────────────"
if [ "$DANGLING" -eq 1 ]; then
  echo "  ⚠ DANGLING RESOURCES DETECTED"
  echo "  Review the warnings above. These incur ongoing charges."
  echo ""
  echo "  Press Enter to continue to CDK deploy anyway,"
  echo "  or Ctrl+C to abort and clean up first..."
  read -r
else
  echo "  ✓ Clean slate confirmed. No billable resources found."
  echo "    (CDK bootstrap resources excluded — they are account-level.)"
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
