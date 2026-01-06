#!/bin/bash
set -euo pipefail

# Get CloudFormation stack outputs and export as environment variables
# Usage: source get-stack-outputs.sh [environment]
#
# Arguments:
#   environment - 'staging' (default) or 'production'
#
# Required environment variables:
#   AWS_REGION - AWS region for CloudFormation API
#
# Exports (required):
#   CLUSTER, TASK_DEF, SUBNETS, SECURITY_GROUP, LOG_GROUP, ALB_DNS
# Exports (optional):
#   ENV_URL - Full environment URL (e.g., https://staging.specboard.io)

# Validate AWS_REGION is set
: "${AWS_REGION:?ERROR: AWS_REGION environment variable is not set}"

ENV="${1:-staging}"

# Validate environment parameter
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "ERROR: Invalid environment '$ENV'. Must be 'staging' or 'production'"
  exit 1
fi

# Staging uses legacy stack name for backward compatibility
if [ "$ENV" = "staging" ]; then
  STACK_NAME="DocPlatformStack"
else
  STACK_NAME="DocPlatform-${ENV}"
fi

echo "Loading outputs from stack: $STACK_NAME"

if ! OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output json \
  --region "$AWS_REGION" 2>&1); then
  echo "ERROR: Failed to fetch stack outputs for $STACK_NAME in $AWS_REGION"
  echo "$OUTPUTS"
  exit 1
fi

export CLUSTER=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ClusterName") | .OutputValue // ""')
export TASK_DEF=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiTaskDefinitionArn") | .OutputValue // ""')
export SUBNETS=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="PrivateSubnetIds") | .OutputValue // ""')
export SECURITY_GROUP=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiSecurityGroupId") | .OutputValue // ""')
export LOG_GROUP=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiLogGroupName") | .OutputValue // ""')
export ALB_DNS=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="AlbDnsName") | .OutputValue // ""')
export ENV_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="EnvironmentUrl") | .OutputValue // ""')

# Validate required outputs
MISSING=""
[ -z "$CLUSTER" ] && MISSING="$MISSING CLUSTER"
[ -z "$TASK_DEF" ] && MISSING="$MISSING TASK_DEF"
[ -z "$SUBNETS" ] && MISSING="$MISSING SUBNETS"
[ -z "$SECURITY_GROUP" ] && MISSING="$MISSING SECURITY_GROUP"
[ -z "$LOG_GROUP" ] && MISSING="$MISSING LOG_GROUP"
[ -z "$ALB_DNS" ] && MISSING="$MISSING ALB_DNS"

if [ -n "$MISSING" ]; then
  echo "ERROR: Missing required stack outputs:$MISSING"
  echo "Ensure $STACK_NAME is deployed and outputs are configured correctly."
  exit 1
fi

# ENV_URL is optional - warn if missing but don't fail
if [ -z "$ENV_URL" ]; then
  echo "WARNING: ENV_URL not found in stack outputs, using ALB_DNS fallback"
  export ENV_URL="http://$ALB_DNS"
fi

echo "Stack outputs loaded:"
echo "  CLUSTER=$CLUSTER"
echo "  TASK_DEF=$TASK_DEF"
echo "  SUBNETS=$SUBNETS"
echo "  ALB_DNS=$ALB_DNS"
echo "  ENV_URL=$ENV_URL"
