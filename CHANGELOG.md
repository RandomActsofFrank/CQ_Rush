# Changelog

All notable changes to CQ Rush are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-29

### Added

- **Multi-contest logbooks** — QSO logs and station settings are scoped by contest slug (default **`field-day`** / ARRL Field Day)
- **`contests`** database table plus **`contacts.contestSlug`** with migration from existing data
- Admin **Active Contest** selector in Station Settings to switch which logbook and settings the logger and public display use
- Contest API: `GET /api/contests`, `GET /api/contests/active`, `PUT /api/contests/active` (admin)
- Client contest registry (`client/src/contests/registry.js`) for contest-specific UI labels and future rules modules

### Changed

- **`contacts`** table is the logbook; each row now belongs to one contest via **`contestSlug`**
- Station settings stored per contest on the **`contests.settings`** JSON column (legacy `site_config.station_settings` migrated on upgrade)
- Public display map title follows the active contest
- Display map zoom adjusted (~one zoom step wider) and pan/zoom no longer resets every second

## [1.2.1] - 2026-06-27

### Added

- **1×1 special event callsign lookup** — FCC 1×1 format (e.g. `W5T`, `K6T`) via [1x1callsigns.org](https://1x1callsigns.org/index.php/search-1x1-database), with operator name and grid from the requestor call (Callook)
- **Local 1×1 cache** — Admin → Station Settings downloads reservations by date range; defaults to Field Day weekend ± 2 days
- README sections for log export formats (Cabrillo, ADIF/LoTW/QRZ) and the **PI_Display** add-in

### Changed

- Callsign popup shows 1×1 event details (coordinator, requestor, requestor call, address)

## [1.2.0] - 2026-06-27

### Added

- **PI_Display** add-in — Raspberry Pi Zero kiosk image builder and setup portal for the public `/display` page (Wi‑Fi hotspot setup, network scanner, flashable `.img` build via pi-gen)

### Changed

- Log contact tab order: **Callsign → Class → Location → Notes → Log Contact** (loops back to Callsign; Band/Mode click-only)

### Fixed

- Narrow-screen layout no longer hides the logbook and log form behind the stats/sections panel
- Tablet-width layout shows only **ARRL Sections Progress (Click for Map)** — no operator/score bars or inline section grid
- Mid-width layout order matches mobile: Active Operators → Add Contact → Logbook → sections map link; Notes column hidden in logbook (Notes field sits above Log Contact)
- Logbook time/callsign columns have more spacing; UTC timestamps no longer overlap callsigns
- Callsign hover popup from the logbook now includes the log entry details (time, band, mode, class, location, notes) with a compact layout and operator in the section title

## [1.1.1] - 2026-06-27

### Changed

- On narrow screens, Active Operators and Projected Score collapse into compact horizontal bars inside a single scroll panel with ARRL Sections Progress

### Fixed

- Tab from Class to Location (and Band to Mode) is now one key press; field help icons no longer interrupt form tab order

## [1.1.0] - 2026-06-26

### Changed

- ARRL Sections Progress opens the sections map on click, with a “(Click for Map)” hint
- Logging form header now shows **Callsign** from station settings alongside **Your Exchange**

### Fixed

- “Already Signed In” dialog Cancel button no longer overflows the modal on wider screens
- Form header (Callsign, Your Exchange, Operator) stacks cleanly on medium-width screens to prevent overlap

## [1.0.0] - 2026-06-26

First public release of **CQ Rush** — rebranded and production-ready Field Day logging software.

### Added

- CQ Rush branding (logo, banner, favicon, About/donation page)
- Individual operator accounts (callsign + password) with admin flag
- Single-device login enforcement with session conflict prompt
- Change password for operators; admin password reset
- Cabrillo (`.log`) and ADIF (`.adi`) log export from Admin
- ARRL Field Day entry helper and export links (LoTW, QRZ)
- Expired callsign notices on lookup and map popup
- Mobile-responsive logbook table layout
- Public display at `/display` with dark/light theme
- AWS EC2 and Raspberry Pi deployment guides and scripts
- HTTPS deployment support (`APP_URL`, `COOKIE_SECURE`)

### Changed

- Rebranded from K1FMK-Web_Ham_Log to **CQ Rush**
- Header shows club logo + club name (configurable in Admin)
- Repository renamed to [CQ_Rush](https://github.com/RandomActsofFrank/CQ_Rush)
- Field Day class validation updated to ARRL rules (1–20 transmitters, categories A–F)
- “Sending” exchange label changed to **Your Exchange**
- Nav label “Logger” renamed to **Logbook**

### Fixed

- Operator name disappearing from recent contacts after server poll
- Individual-user logout not clearing session
- Admin delete-all logs route and double-confirmation flow
- Header date/time layout on desktop and mobile

[1.3.0]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.3.0
[1.2.1]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.2.1
[1.2.0]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.2.0
[1.1.1]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.1.1
[1.1.0]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.1.0
[1.0.0]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.0.0
