#!/bin/bash
# Stop EC2 instance to save compute costs (you only pay ~$1/mo for disk)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.aws-deploy-state"
source "$STATE_FILE"
aws ec2 stop-instances --region "$REGION" --instance-ids "$INSTANCE_ID" --output text
echo "Stopping $INSTANCE_ID ... (~\$0.80/mo EBS storage while stopped)"
aws ec2 wait instance-stopped --region "$REGION" --instance-ids "$INSTANCE_ID"
echo "Stopped. Run ./start.sh before ./deploy.sh when you need it again."
