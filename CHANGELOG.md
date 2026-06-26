# Changelog

All notable changes to CQ Rush are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/RandomActsofFrank/CQ_Rush/releases/tag/v1.0.0
