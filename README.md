# CQ Rush

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)](https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.2.1)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**CQ Rush** is a free, open-source, donationware-suggested web app for **ARRL Field Day** contest logging. React frontend, Node.js/Express API, and PostgreSQL. Each club or operator configures their own entry name in the admin panel — the app brand is always CQ Rush.

- **Source:** [github.com/RandomActsofFrank/CQ_Rush](https://github.com/RandomActsofFrank/CQ_Rush)
- **Releases:** [github.com/RandomActsofFrank/CQ_Rush/releases](https://github.com/RandomActsofFrank/CQ_Rush/releases)

## About CQ Rush

CQ Rush is **free to use and open source** (ISC license). If it helps your club, voluntary donations are appreciated via [PayPal](https://www.paypal.com/donate/?hosted_button_id=8FMQ97AZPEPJG) — never required.

**© Frank Kostyun 2026**

Branding assets live in `client/public/branding/` (icon, white icon, logo, banner, donation QR).

## Features

### Logging

- Log QSOs with callsign, band, mode, class, ARRL section/location, and notes
- Callsign lookup via server proxy — **Callook.info** for FCC licenses, plus **1×1 special event** callsigns (e.g. `K6T`) from [1x1callsigns.org](https://1x1callsigns.org/index.php/search-1x1-database) with holder location enrichment
- Duplicate-entry detection and field validation (class, location, band, mode)
- Real-time multi-operator coordination with band/mode conflict flags

### Scoring & maps

- Field Day score breakdown (Phone / CW / Digital) and projected score from station settings
- Interactive ARRL section map (county-level boundaries, contacted sections highlighted)
- Public display at `/display` — score, operators, recent contacts, and full map (polls every 5s, dark/light mode)

### Admin

- Logbook management with inline edit, soft delete, restore, and edit history
- Station settings (entry class, location, power, bonuses)
- **Log export** (Admin → Export Logs) — see [Log export formats](#log-export-formats) below
- Security & branding: club name, shared site password, or per-operator accounts (callsign + password + admin flag)

### Authentication

Two modes (configured in **Admin → Security & Branding**):


| Mode                             | Login                                                          | Admin access            |
| -------------------------------- | -------------------------------------------------------------- | ----------------------- |
| **Shared site password**         | Single password for the site; optional separate admin password | Admin password when set |
| **Individual operator accounts** | Callsign + password per user                                   | Per-user admin checkbox |


No login is required until you enable site security or add operator accounts. The public display route (`/display`) bypasses site login.

## Log export formats

From **Admin → Export Logs**, CQ Rush generates contest and logbook files from your active QSOs and station settings:

| Format | File | Use for |
| ------ | ---- | ------- |
| **Cabrillo** | `{callsign}.log` | Official ARRL Field Day entry — attach as dupe-sheet documentation at [field-day.arrl.org](https://field-day.arrl.org/fdentry.php) |
| **ADIF** | `{callsign}.adi` | **LoTW** — sign with [TrustedQSL (TQSL)](https://lotw.arrl.org/lotw-help/sgnupload/) to produce a `.TQ8`, then upload; **QRZ Logbook** — import ADIF directly |

The export panel also includes:

- **Copy Full Summary** — Field Day entry fields (call used, section, class, exchange, claimed score, QSO totals, operators, bonuses) for pasting into the ARRL web form
- **Open ARRL Entry Form**, **Open LoTW Upload**, and **Open QRZ Logbook** shortcuts

Validation runs before download (station callsign, section, class, and active contacts required). Cabrillo is accepted in place of a dupe sheet but does **not** replace the official ARRL summary form.

## Pi Display add-in

The **[PI_Display](./PI_Display/)** add-in turns a **Raspberry Pi Zero W / Zero 2 W** into a dedicated kiosk for the public **`/display`** page (score, operators, recent contacts, map — same 5s polling as a browser tab).

| Mode | What happens |
| ---- | -------------- |
| **First boot** | Pi creates Wi‑Fi hotspot **CQ-Rush-Display** (password `cqrush-setup`) |
| **Setup portal** | Connect from a phone/laptop → `http://10.42.0.1:8080` → scan Wi‑Fi, set display URL (must include `/display`) |
| **Display mode** | Pi joins your network and opens Chromium fullscreen on that URL |

**Install options:**

1. **Flash a pre-built image** (Linux host, pi-gen) — `cd PI_Display && sudo ./build-image.sh` → flash `PI_Display/build/cqrush-display-pi.img`
2. **Install on existing Pi OS** — `sudo ./PI_Display/install-on-device.sh`

Full hardware list, re-enter setup mode, config file paths, and systemd logs: **[PI_Display/README.md](./PI_Display/README.md)**.

This add-in is **git-only** (not deployed to AWS). You can run the logger on one Pi (`deploy/pi/setup.sh`) and point the display at `http://localhost:3002/display`, or use a second Pi as the screen.

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- PostgreSQL 16 (or Docker — see below)

### Setup

```bash
# Database (Docker)
docker compose up db -d

# Server
cd server
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npx prisma migrate deploy --schema=../prisma/schema.prisma
npm run seed
npm run dev                   # http://localhost:3002

# Client (separate terminal)
cd client
npm install
npm start                     # http://localhost:3000 (proxied to API)
```

On first launch, open **Admin** and set your club name, Field Day entry, and security preferences.

### Production-like local test (Docker)

```bash
docker compose up --build
# Open http://localhost:3002
```

## AWS Deployment

See [DEPLOY_AWS.md](./DEPLOY_AWS.md) for EC2 + Docker Compose deployment.

```bash
cd deploy/aws
./launch.sh    # First time — EC2 instance
./deploy.sh    # Push updates and restart containers
```

Password reset and auth CLI: `./deploy/aws/reset-passwords.sh --help`

## Raspberry Pi Deployment

Run on a local network with Docker on a **Pi 4/5** (ARM64). See [DEPLOY_RASPBERRY_PI.md](./DEPLOY_RASPBERRY_PI.md) for full instructions.

```bash
git clone https://github.com/RandomActsofFrank/CQ_Rush.git
cd CQ_Rush
chmod +x deploy/pi/setup.sh deploy/pi/update.sh
./deploy/pi/setup.sh          # First time — generates secrets, builds containers
./deploy/pi/update.sh         # Pull updates and rebuild
```

First Docker build on a Pi can take **20–40 minutes**. The logger will be at `http://<pi-ip>:3002` (public display at `/display`).

## Project Structure

```
├── client/              React SPA (logbook, admin, public display)
├── server/              Express API, auth, Prisma client
├── prisma/              PostgreSQL schema and migrations
├── deploy/aws/          EC2 launch, deploy, and password-reset scripts
├── deploy/pi/           Raspberry Pi setup, update, and env templates
├── PI_Display/          Pi Zero kiosk add-in for /display (Wi‑Fi setup + image build)
├── data/geographic/     County/state GeoJSON source data for section map
├── Dockerfile           Production container (client build + server)
├── docker-compose.yml   Local dev (db + optional full stack)
└── docker-compose.prod.yml
```

## External Data Sources & APIs

The app uses a small set of third-party services at runtime. Everything else (Field Day rules, ARRL section boundaries, county map geometry) is bundled or computed locally.

### Third-party services (online)


| Service                                                            | URL                                                  | Used for                                                            | Called from                          | Auth                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------- |
| **[Callook.info](https://callook.info)**                           | `https://callook.info/{CALLSIGN}/json`               | US amateur callsign name, grid, state, license expiry               | Server (`GET /api/lookup/:callsign`) | None (public JSON API)                              |
| **[1x1callsigns.org](https://1x1callsigns.org/index.php/search-1x1-database)** | `https://www.1x1callsigns.org/1x1search.php?callsign={CALL}` | FCC 1×1 special event reservations (event name, holder callsign, dates) | Server (1×1 callsigns, e.g. `K6T`) | None; HTML scrape of W5YI database                  |
| **[Nominatim](https://nominatim.org)** (OpenStreetMap)             | `https://nominatim.openstreetmap.org/reverse`        | City/state from grid-square coordinates when Callook returns a grid | Server (during callsign lookup)      | None; sends `User-Agent: HamRadioContestLogger/1.0` |
| **[OpenStreetMap tiles](https://www.openstreetmap.org/copyright)** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Basemap in the callsign detail popup (Leaflet)                      | Browser (`App.js`)                   | None                                                |


**Callsign lookup flow:** Browser → `GET /api/lookup/:callsign` → for **1×1 format** callsigns (`K`/`N`/`W` + digit + letter, e.g. `W5T`), check the **local 1×1 cache** first, then live [1x1callsigns.org](https://1x1callsigns.org/index.php/search-1x1-database); operator **name** and **grid** come from the requestor call via Callook; otherwise Callook → (optional) Nominatim reverse geocode → JSON to client. Successful lookups are cached in PostgreSQL (`callsign_lookups`).

Admins can refresh reservations for a **date range** from **Admin → Station Settings → 1×1 Special Event Cache** (`POST /api/one-by-one/cache/refresh` with `startDate` and `endDate`). The server queries `1x1search.php?startd=…&endd=…`, then downloads each reservation’s detail page (`?byid=…`) and enriches requestor calls via Callook. Reservations are stored in `one_by_one_reservations`.

Override the 1×1 search base URL with `ONE_BY_ONE_SEARCH_URL` if needed. Tune detail download pacing with `ONE_BY_ONE_REQUEST_DELAY_MS` (default 150) and `ONE_BY_ONE_DETAIL_CONCURRENCY` (default 3).

**Links only (no API integration):**


| Resource                                                           | URL                                                     | Purpose |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------- |
| [ARRL Field Day entry](https://field-day.arrl.org/fdentry.php)     | Cabrillo upload instructions in export UI               |         |
| [ARRL Field Day rules](https://www.arrl.org/field-day-rules)       | Scoring, class, and band rules in `fieldDayRules.js`    |         |
| [ARRL section boundaries](https://www.arrl.org/section-boundaries) | County-to-section mapping in `arrlSectionBoundaries.js` |         |


### Bundled / offline data


| Data                             | Source                                                                                                                                          | Shipped as                            | Used for                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| US county boundaries             | [U.S. Census Bureau TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) (`cb_2023_us_county_5m`) | `client/public/us_counties_5m.json`   | ARRL section map (`ArrlSectionsMap.js`) |
| ARRL section rules               | [ARRL section boundaries](https://www.arrl.org/section-boundaries)                                                                              | `client/src/arrlSectionBoundaries.js` | Highlight contacted sections on map     |
| Field Day rules & valid sections | [ARRL Field Day rules](https://www.arrl.org/field-day-rules)                                                                                    | `client/src/fieldDayRules.js`         | Validation, scoring, projected score    |
| Maidenhead grid → lat/lon        | Computed in-app                                                                                                                                 | `server/index.js` (`gridToLocation`)  | Map pin for callsign popup              |


Raw Census shapefiles for rebuilding map assets live under `data/geographic/`.

### Operational notes

- **No API keys** are required for Callook, Nominatim, or OSM tiles.
- **Nominatim** is a shared public service — avoid excessive lookup volume; results are cached server-side after the first lookup per callsign.
- **Outbound HTTPS** from the server is required for callsign lookup (Callook + Nominatim). The browser needs access to OSM tile servers for the popup map.
- Set `**APP_URL`** in production to your public site URL (e.g. `https://logger.yourclub.org`) for CORS and secure session cookies. Set `**COOKIE_SECURE=true`** when using HTTPS.

## API Overview

All routes are on the same origin as the web app (e.g. `/api/...`). The React client uses `fetch` with cookies (`credentials: 'include'`) via `client/src/api.js` and `apiFetch()` elsewhere.

**Public read (no site auth):** `GET /api/auth/status`, `GET /api/contacts`, `GET /api/active-operators`, `GET /api/station-settings`, `GET /api/lookup/:callsign`

**Auth routes (no prior session required):** `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/admin/login`, etc.

When site login is enabled, other mutating `/api/`* routes require an authenticated session.


| Endpoint                                    | Description                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Auth & users**                            |                                                                                                          |
| `GET /api/auth/status`                      | Auth mode, branding, session flags                                                                       |
| `GET /api/auth/me`                          | Same as status (authenticated snapshot)                                                                  |
| `POST /api/auth/login`                      | Site sign-in (password, or callsign + password in user mode); `forceDisconnect` for single-session login |
| `POST /api/auth/logout`                     | Sign out and destroy session                                                                             |
| `POST /api/auth/logout-all`                 | Destroy session (alias)                                                                                  |
| `POST /api/auth/admin/login`                | Admin sign-in (shared-password mode)                                                                     |
| `POST /api/auth/admin/logout`               | Clear admin session flag                                                                                 |
| `POST /api/auth/change-password`            | Operator changes own password (user-account mode)                                                        |
| `GET/POST/PUT/DELETE /api/users`            | Operator accounts (admin, user-auth mode)                                                                |
| **Contacts & logging**                      |                                                                                                          |
| `GET /api/contacts`                         | Active contacts for logbook / display                                                                    |
| `GET /api/contacts/all`                     | All contacts including soft-deleted (admin)                                                              |
| `POST /api/contacts`                        | Log a contact                                                                                            |
| `PUT /api/contacts/:id`                     | Edit contact                                                                                             |
| `DELETE /api/contacts/:id`                  | Soft-delete contact                                                                                      |
| `PUT /api/contacts/:id/restore`             | Restore deleted contact                                                                                  |
| `DELETE /api/contacts/clear`                | Delete all contacts (admin)                                                                              |
| `GET /api/contacts/:id/history`             | Edit audit trail for one contact                                                                         |
| `GET /api/contacts/history/all`             | Full edit history (admin)                                                                                |
| `GET /api/callsigns`                        | Cached callsign lookup records                                                                           |
| **Operators & lookup**                      |                                                                                                          |
| `GET/POST/PUT/DELETE /api/active-operators` | Operator heartbeats and band/mode status                                                                 |
| `GET /api/active-operators/cleanup`         | Remove stale operators (2h+)                                                                             |
| `GET /api/lookup/:callsign`                 | Proxied Callook lookup (+ Nominatim enrichment); 1×1 special event via local cache then 1x1callsigns.org |
| **1×1 cache (admin)**                       |                                                                                                          |
| `GET /api/one-by-one/cache/status`          | Local 1×1 reservation cache status                                                                       |
| `POST /api/one-by-one/cache/refresh`        | Start background download of 1×1 database (202 Accepted)                                                 |
| **Log export (client)**                     | Cabrillo `.log` (ARRL Field Day), ADIF `.adi` (LoTW via TQSL, QRZ) — Admin → Export Logs                 |
| **Configuration**                           |                                                                                                          |
| `GET/PUT /api/station-settings`             | Field Day entry (class, section, power, bonuses)                                                         |
| `GET/PUT /api/app-config`                   | Branding and auth settings (admin)                                                                       |
| `GET /api/test`                             | Health check                                                                                             |


## Tech Stack

- **Frontend:** React, React Router, Leaflet
- **Backend:** Express, express-session, connect-pg-simple
- **Database:** PostgreSQL, Prisma ORM
- **Auth:** bcrypt password hashes, server-side sessions

## Deployment guides


| Platform     | Guide                                              |
| ------------ | -------------------------------------------------- |
| AWS EC2      | [DEPLOY_AWS.md](./DEPLOY_AWS.md)                   |
| Raspberry Pi | [DEPLOY_RASPBERRY_PI.md](./DEPLOY_RASPBERRY_PI.md) |

## Add-ins

| Add-in | Purpose |
| ------ | ------- |
| [PI_Display](./PI_Display/) | Raspberry Pi Zero external display — Wi‑Fi setup portal, network scanner, Chromium kiosk for `/display`, flashable `.img` build via pi-gen on Linux |

See [Pi Display add-in](#pi-display-add-in) for a quick start; full docs in [PI_Display/README.md](./PI_Display/README.md).


## Release

Current stable release: **[v1.2.1](https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.2.1)** — see [CHANGELOG.md](./CHANGELOG.md) for details.

Before publishing docs or tagging a release, run the privacy regression check:

```bash
./scripts/check-public-release.sh
```

```bash
git clone https://github.com/RandomActsofFrank/CQ_Rush.git
cd CQ_Rush
git checkout v1.2.1
docker compose -f docker-compose.prod.yml up -d --build
```

## License

ISC — free and open source. See [LICENSE](./LICENSE).

## Support

CQ Rush is **donationware suggested**. Donations help cover development and hosting but are never required:

- [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=8FMQ97AZPEPJG)
- In-app: open **About** from the footer (`CQ Rush © Frank Kostyun 2026`) on any page

