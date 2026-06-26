# Deploying CQ Rush to a Raspberry Pi

Run the full stack (React app + Express API + PostgreSQL) on a **Raspberry Pi 4 or 5** using Docker Compose. This is a good option for a club shack logger on your local network with no cloud hosting cost.

| Approach | Cost | Best for |
|----------|------|----------|
| **Pi + Docker (this guide)** | Hardware only | Field Day at a fixed site, home shack, LAN-only logging |
| [AWS EC2](./DEPLOY_AWS.md) | ~$0–3/month | Public internet access, remote operators |

---

## Hardware & OS

| Item | Recommendation |
|------|----------------|
| Board | Raspberry Pi **4 (2 GB+ RAM)** or **Pi 5** |
| Storage | **32 GB+** microSD, or USB/SSD boot (preferred for speed) |
| OS | **Raspberry Pi OS (64-bit)** — Bookworm or newer |
| Network | Ethernet recommended during Field Day; Wi‑Fi is fine for testing |

The Docker images (`node:18-alpine`, `postgres:16-alpine`) support **ARM64**, so no cross-compilation is required on the Pi.

---

## Quick start (on the Pi)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or reboot) so your user can run `docker` without `sudo`.

Verify:

```bash
docker --version
docker compose version
```

### 2. Clone the repository

```bash
cd ~
git clone https://github.com/RandomActsofFrank/CQ_Rush.git
cd CQ_Rush
```

### 3. Run first-time setup

```bash
chmod +x deploy/pi/setup.sh deploy/pi/update.sh
./deploy/pi/setup.sh
```

This script:

1. Generates `deploy/pi/.env.production` with random DB and session secrets
2. Links it for Docker Compose (`deploy/aws/.env.production` symlink)
3. Builds and starts the app + database containers

**First build on a Pi often takes 20–40 minutes** (compiling the React client and installing npm packages). Later updates are faster thanks to Docker layer cache.

### 4. Open the logger

Setup prints a URL like `http://192.168.x.x:3002`. From any device on the same network:

| Page | URL |
|------|-----|
| Logbook | `http://<pi-ip>:3002` |
| Public display | `http://<pi-ip>:3002/display` |
| Admin | `http://<pi-ip>:3002/admin` |

Configure **Admin → Station Settings** and **Admin → Security & Branding** on first use.

---

## Updating after code changes

On the Pi, from the project directory:

```bash
./deploy/pi/update.sh
```

This runs `git pull` and rebuilds/restarts containers.

---

## Manual environment file

To create secrets yourself instead of using `setup.sh`:

```bash
cp deploy/pi/.env.production.example deploy/pi/.env.production
nano deploy/pi/.env.production
```

Set at minimum:

- `POSTGRES_PASSWORD` — strong random password
- `SESSION_SECRET` — long random string (32+ bytes hex is fine)
- `DATABASE_URL` — must match user/password/db above
- `APP_URL` — e.g. `http://192.168.1.50:3002` (used for CORS)

Then:

```bash
mkdir -p deploy/aws
ln -sf ../pi/.env.production deploy/aws/.env.production
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production up -d --build
```

---

## Password reset

```bash
ENV_FILE=deploy/pi/.env.production ./scripts/reset-auth-docker.sh --show
ENV_FILE=deploy/pi/.env.production ./scripts/reset-auth-docker.sh --set-site-password "NewPass"
ENV_FILE=deploy/pi/.env.production ./scripts/reset-auth-docker.sh --set-admin-password "NewAdminPass"
ENV_FILE=deploy/pi/.env.production ./scripts/reset-auth-docker.sh --clear-all
```

---

## Recommended Pi settings

### Static IP (optional but helpful)

Set a reserved DHCP address or static IP in Raspberry Pi OS so the logger URL does not change after reboot.

**Settings → Network → Ethernet/Wi‑Fi → IPv4 → Manual**

### Hostname (optional)

```bash
sudo hostnamectl set-hostname hamlog
```

Then use `http://hamlog.local:3002` on networks that support mDNS.

### Auto-start on boot

Docker Compose services use `restart: unless-stopped` in `docker-compose.prod.yml`, so containers come back after a Pi reboot.

### Firewall

By default the app listens on port **3002** on all interfaces. For a LAN-only shack logger this is usually fine. To restrict access, use `ufw` or your router firewall and allow only your club subnet.

---

## Build from your laptop (optional)

You can develop on a Mac/PC and deploy to the Pi over SSH without building on the Pi:

```bash
# From your laptop — sync code to the Pi
rsync -az --delete \
  --exclude node_modules \
  --exclude client/node_modules \
  --exclude server/node_modules \
  --exclude client/build \
  --exclude .git \
  --exclude deploy/pi/.env.production \
  ./ pi@192.168.1.50:~/CQ_Rush/

ssh pi@192.168.1.50 'cd ~/CQ_Rush && ./deploy/pi/update.sh'
```

Replace `192.168.1.50` with your Pi’s address.

---

## Troubleshooting

```bash
# Container status
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production ps

# App logs
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production logs -f app

# Database logs
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production logs -f db

# Restart everything
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production restart

# Full rebuild (clears nothing — data is in Docker volume hamlog_pg_data)
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production up -d --build
```

| Issue | Fix |
|-------|-----|
| Build runs out of memory | Use a Pi with 4 GB RAM, enable swap, or build on another machine and sync |
| `Cannot connect to Docker` | Re-login after `usermod -aG docker`; or use `sudo docker ...` |
| Page loads but API fails | Check `docker compose logs app`; verify `DATABASE_URL` in `.env.production` |
| Slow first build | Normal on Pi — wait for `npm run build` inside Docker to finish |
| Wrong URL / CORS errors | Set `APP_URL` in `deploy/pi/.env.production` to match how browsers reach the Pi |

---

## Data backup

Contact data lives in the PostgreSQL Docker volume `hamlog_pg_data`.

```bash
# Backup
docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production \
  exec -T db pg_dump -U hamlog hamlog > hamlog-backup-$(date +%Y%m%d).sql

# Restore (with containers running)
cat hamlog-backup.sql | docker compose -f docker-compose.prod.yml --env-file deploy/pi/.env.production \
  exec -T db psql -U hamlog hamlog
```

---

## Local test before Pi deploy

On any machine with Docker:

```bash
docker compose up --build
# http://localhost:3002
```

See also [README.md](./README.md) for development setup without Docker.
