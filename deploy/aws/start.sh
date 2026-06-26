#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.aws-deploy-state"
source "$STATE_FILE"
aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE_ID" --output text
echo "Starting $INSTANCE_ID ..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
NEW_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
sed -i.bak "s/^PUBLIC_IP=.*/PUBLIC_IP=$NEW_IP/" "$STATE_FILE" && rm -f "$STATE_FILE.bak"
echo "Running at http://${NEW_IP}:3002 (IP may change unless you add an Elastic IP)"
