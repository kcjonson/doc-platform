#!/bin/bash
set -euo pipefail

# Force new deployment on all ECS services and wait for stabilization
# Usage: deploy-services.sh
#
# Required environment variables:
#   AWS_REGION, CLUSTER, ALB_DNS

echo "Forcing new deployment on all services..."

aws ecs update-service --cluster "$CLUSTER" --service api --force-new-deployment --region "$AWS_REGION" --no-cli-pager
aws ecs update-service --cluster "$CLUSTER" --service frontend --force-new-deployment --region "$AWS_REGION" --no-cli-pager
aws ecs update-service --cluster "$CLUSTER" --service mcp --force-new-deployment --region "$AWS_REGION" --no-cli-pager

echo "Waiting for services to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services api frontend mcp \
  --region "$AWS_REGION"

echo "Deployed to: http://$ALB_DNS"
