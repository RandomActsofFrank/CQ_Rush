#!/bin/bash
# Bootstrap script for Amazon Linux 2023 (ARM64) — installs Docker + swap for low-RAM builds
set -euxo pipefail

# 2GB swap helps t4g.micro survive docker builds
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

dnf update -y
dnf install -y docker git rsync
systemctl enable --now docker

mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

usermod -aG docker ec2-user

mkdir -p /opt/hamlog-app
chown ec2-user:ec2-user /opt/hamlog-app

echo "hamlog bootstrap complete" > /var/log/hamlog-bootstrap.log
