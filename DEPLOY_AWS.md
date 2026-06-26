# Deploying CQ Rush to AWS (Low-Cost)

**Recommended setup:** one **EC2 t4g.micro** running Docker Compose (app + PostgreSQL on the same server).

| Approach | Monthly cost (approx.) | Best for |
|----------|------------------------|----------|
| **EC2 + Docker (this guide)** | **$0–3** on free tier; ~$1 when stopped | Contest logging, lowest cost |
| App Runner + RDS | $20–40+ | Always-on managed service |

## Prerequisites

- An [AWS account](https://aws.amazon.com/) with permissions for EC2, VPC, and key pairs
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured (`aws configure`)
- SSH client on your machine

Default region in `launch.sh` is `us-east-2` if unset; override with `AWS_REGION`.

After deploy, configure Field Day settings in **Admin → Station Settings** and passwords/club name in **Admin → Security & Branding**.

---

## Quick commands

From the project:

```bash
cd deploy/aws

./launch.sh    # First time only — creates EC2 + secrets
./deploy.sh    # Push code updates and restart containers
./stop.sh      # Stop instance between contests (~$0.80/mo storage)
./start.sh     # Start instance again (public IP may change)
./reset-passwords.sh --show   # Check auth config on remote server
```

After a successful deploy, the app URL is printed as `http://YOUR_EC2_PUBLIC_IP:3002` (or your configured `APP_URL` if using HTTPS).

### Password reset (forgotten passwords)

Passwords are stored as **bcrypt hashes** in PostgreSQL (`site_config.app_config`). There is no default password on a fresh install.

**From your laptop** (uses SSH + Docker on the server):

```bash
cd deploy/aws
./reset-passwords.sh --show
./reset-passwords.sh --clear-all
./reset-passwords.sh --set-site-password "NewSitePass"
./reset-passwords.sh --set-admin-password "NewAdminPass"
./reset-passwords.sh --disable-site-login
./reset-passwords.sh --clear-admin-password
```

**After SSH into the server** (`/opt/hamlog-app`):

```bash
./scripts/reset-auth-docker.sh --show
./scripts/reset-auth-docker.sh --clear-all
./scripts/reset-auth-docker.sh --set-admin-password "NewAdminPass"
```

**Inside the app container** (advanced):

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production \
  exec -T app node scripts/reset-auth.js --help
```

---

## Cost breakdown (EC2 path)

### While running (Field Day weekend)

| Resource | Free tier (12 months) | After free tier |
|----------|----------------------|-----------------|
| t4g.micro EC2 (750 hrs/mo) | **$0** | ~$6/mo if always on |
| 12 GB EBS storage | **$0** (30 GB included) | ~$1/mo |
| Data transfer | First 100 GB/mo free | Usually negligible |

**Typical contest use:** run for 48 hours → essentially **$0** on free tier.

### When stopped (`./stop.sh`)

- EC2 compute: **$0**
- EBS disk only: **~$0.80/month**

### What we avoided (savings)

- **RDS PostgreSQL:** ~$15–25/month
- **App Runner:** ~$5–15/month minimum
- **NAT Gateway:** ~$32/month (not used)

---

## First-time setup (`launch.sh`)

The `launch.sh` script:

1. Creates an EC2 key pair (saved under `~/.ssh/` — path printed at launch)
2. Creates a security group (SSH from your current IP, port 3002 public)
3. Generates secrets in `deploy/aws/.env.production` (gitignored — never commit)
4. Launches **t4g.micro** Amazon Linux 2023 (ARM, free tier)
5. Installs Docker via bootstrap script

Then `deploy.sh` rsyncs code and runs `docker compose`.

State is stored locally in `deploy/aws/.aws-deploy-state` (gitignored).

---

## HTTPS (optional)

Port **3002** serves HTTP by default. For production over HTTPS:

1. Point a domain (e.g. `logger.yourclub.org`) at your EC2 public IP or Elastic IP
2. Terminate TLS with **nginx**, **Caddy**, or another reverse proxy on the instance
3. Proxy to `http://127.0.0.1:3002`
4. Set in `deploy/aws/.env.production`:
   - `APP_URL=https://logger.yourclub.org`
   - `COOKIE_SECURE=true`
5. Redeploy or restart the app container

Do **not** commit certificate private keys or production secrets to the repository.

---

## Security notes

1. Use an IAM user with least privilege for day-to-day AWS work; enable MFA on the root account.
2. **Port 3002 is HTTP** unless you add HTTPS as above. Passwords are still hashed server-side.
3. **Keep secrets safe** — `deploy/aws/.env.production` contains DB password and session secret. It is listed in `.gitignore`.
4. Restrict security group SSH (port 22) to your IP; update the rule if your IP changes.

---

## Updating the app

After code changes locally:

```bash
cd deploy/aws && ./deploy.sh
```

---

## Troubleshooting

Replace placeholders with values from `deploy/aws/.aws-deploy-state`:

```bash
# SSH into server
ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@YOUR_EC2_PUBLIC_IP

# View logs
cd /opt/hamlog-app
docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production logs -f app

# Restart everything
docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production restart
```

| Issue | Fix |
|-------|-----|
| Can't reach URL | Instance stopped? Run `./start.sh`. Check security group allows 3002. |
| SSH fails | Your IP changed — update security group port 22 rule in AWS Console. |
| 502 / app crash | Check `docker compose logs app` — usually DB connection; verify `.env.production`. |
| IP changed after stop/start | Run `./start.sh` — it updates `.aws-deploy-state`. Or assign an Elastic IP (free while attached). |

---

## Optional: Elastic IP (stable URL)

If you stop/start often and want a fixed IP:

```bash
aws ec2 allocate-address --domain vpc --region YOUR_REGION
# Associate the allocation to your instance in Console → EC2 → Elastic IPs
```

Free while associated with a **running** instance.

---

## Alternative: App Runner + RDS

See git history if you outgrow single-server setup. Not recommended for cost-sensitive hobby/club use.

---

## Local test before deploy

Requires Docker locally:

```bash
docker compose up --build
# http://localhost:3002 — no password until configured in Admin → Security & Branding
```
