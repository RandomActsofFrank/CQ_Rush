#!/bin/bash
# Launch a low-cost EC2 instance for CQ Rush (free-tier friendly)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo us-east-2)}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROJECT_NAME="hamlog-app"
KEY_NAME="${PROJECT_NAME}-key"
INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.micro}"
AMI_ID="$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64 \
  --region "$AWS_REGION" \
  --query 'Parameter.Value' \
  --output text)"

SSH_DIR="$HOME/.ssh"
KEY_PATH="$SSH_DIR/${KEY_NAME}.pem"
STATE_FILE="$SCRIPT_DIR/.aws-deploy-state"

echo "==> CQ Rush — AWS EC2 launch"
echo "    Region:  $AWS_REGION"
echo "    Account: $AWS_ACCOUNT_ID"
echo "    Type:    $INSTANCE_TYPE (free tier eligible)"
echo ""

# --- Key pair ---
if [ ! -f "$KEY_PATH" ]; then
  echo "==> Creating SSH key pair: $KEY_NAME"
  mkdir -p "$SSH_DIR"
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --region "$AWS_REGION" \
    --query 'KeyMaterial' \
    --output text > "$KEY_PATH"
  chmod 600 "$KEY_PATH"
else
  echo "==> Using existing key: $KEY_PATH"
fi

# --- Security group ---
VPC_ID="$(aws ec2 describe-vpcs \
  --region "$AWS_REGION" \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)"

MY_IP="$(curl -s --max-time 5 https://checkip.amazonaws.com || echo 0.0.0.0/0)"
MY_IP="${MY_IP//$'\n'/}/32"

SG_NAME="${PROJECT_NAME}-sg"
EXISTING_SG="$(aws ec2 describe-security-groups \
  --region "$AWS_REGION" \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || true)"

if [ "$EXISTING_SG" = "None" ] || [ -z "$EXISTING_SG" ]; then
  echo "==> Creating security group: $SG_NAME"
  SG_ID="$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "CQ Rush app" \
    --vpc-id "$VPC_ID" \
    --region "$AWS_REGION" \
    --query 'GroupId' \
    --output text)"

  aws ec2 authorize-security-group-ingress --region "$AWS_REGION" --group-id "$SG_ID" \
    --ip-permissions \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MY_IP,Description='SSH from your IP'}]" \
    "IpProtocol=tcp,FromPort=3002,ToPort=3002,IpRanges=[{CidrIp=0.0.0.0/0,Description='Hamlog web UI'}]"
else
  SG_ID="$EXISTING_SG"
  echo "==> Using existing security group: $SG_ID"
fi

# --- Check for existing instance ---
EXISTING_INSTANCE="$(aws ec2 describe-instances \
  --region "$AWS_REGION" \
  --filters "Name=tag:Project,Values=$PROJECT_NAME" "Name=instance-state-name,Values=running,pending,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || true)"

if [ "$EXISTING_INSTANCE" != "None" ] && [ -n "$EXISTING_INSTANCE" ]; then
  PUBLIC_IP="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$EXISTING_INSTANCE" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)"
  echo ""
  echo "Instance already exists: $EXISTING_INSTANCE ($PUBLIC_IP)"
  echo "Run ./deploy.sh to push code, or ./start.sh if stopped."
  cat > "$STATE_FILE" <<EOF
INSTANCE_ID=$EXISTING_INSTANCE
PUBLIC_IP=$PUBLIC_IP
REGION=$AWS_REGION
KEY_PATH=$KEY_PATH
SG_ID=$SG_ID
EOF
  exit 0
fi

# --- Generate production secrets ---
ENV_FILE="$SCRIPT_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=hamlog
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=hamlog
DATABASE_URL=postgresql://hamlog:${POSTGRES_PASSWORD}@db:5432/hamlog
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
PORT=3002
APP_URL=
EOF
  chmod 600 "$ENV_FILE"
  echo "==> Created $ENV_FILE (keep this secret!)"
else
  echo "==> Using existing $ENV_FILE"
fi

# --- Launch instance ---
echo "==> Launching EC2 instance..."
INSTANCE_ID="$(aws ec2 run-instances \
  --region "$AWS_REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --user-data "file://$SCRIPT_DIR/user-data.sh" \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":12,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=hamlog-app},{Key=Project,Value=hamlog-app}]" \
  --query 'Instances[0].InstanceId' \
  --output text)"

echo "==> Waiting for instance to start: $INSTANCE_ID"
aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"

PUBLIC_IP="$(aws ec2 describe-instances \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

cat > "$STATE_FILE" <<EOF
INSTANCE_ID=$INSTANCE_ID
PUBLIC_IP=$PUBLIC_IP
REGION=$AWS_REGION
KEY_PATH=$KEY_PATH
SG_ID=$SG_ID
EOF

echo ""
echo "============================================"
echo " EC2 instance launched!"
echo " Instance:  $INSTANCE_ID"
echo " Public IP: $PUBLIC_IP"
echo " SSH key:   $KEY_PATH"
echo "============================================"
echo ""
echo "Bootstrap takes ~2-3 minutes (Docker install)."
echo "Then run from project root:"
echo ""
echo "  cd deploy/aws && ./deploy.sh"
echo ""
echo "App URL (after deploy): http://${PUBLIC_IP}:3002"
echo "Configure passwords in Admin → Security & Branding (no default password)"
echo ""
echo "Cost tip: run ./stop.sh when not in use (~\$0.80/mo storage only)"
