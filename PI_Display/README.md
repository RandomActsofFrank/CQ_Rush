# CQ Rush Pi Display

Turn a **Raspberry Pi Zero W / Zero 2 W** into a dedicated external display for the CQ Rush public display page (`/display`). The page already polls the server every 5 seconds — this add-in only provides Wi‑Fi setup and a fullscreen browser.

This add-in lives in **`PI_Display/`** and is **git-only** for now (not part of the AWS deploy).

## What you get

| Mode | Behavior |
|------|----------|
| **First boot / setup** | Pi creates Wi‑Fi hotspot **CQ-Rush-Display** (password `cqrush-setup`). Connect with a phone or laptop and open the setup page. |
| **Setup page** | Scan nearby Wi‑Fi networks, enter password, set display URL (e.g. `https://your-server.example.com/display`). |
| **Display mode** | Pi joins your Wi‑Fi and launches Chromium kiosk on the configured URL. |

## Hardware

- Raspberry Pi Zero W, Zero 2 W, or any Pi with Wi‑Fi
- MicroSD card (16 GB+ recommended)
- HDMI adapter/cable and monitor or TV
- Power supply

## Option A — Flash a pre-built image (recommended)

Raspberry Pi boards use a flashable **`.img`** SD card image (not a PC-style ISO). The build script writes:

`PI_Display/build/cqrush-display-pi.img`

### Build the image (Linux host)

Image builds use [pi-gen](https://github.com/RPi-Distro/pi-gen) and require **Debian/Ubuntu Linux** with sudo (~20 GB disk).

```bash
cd PI_Display
chmod +x build-image.sh sync-pi-gen-files.sh
sudo ./build-image.sh
```

On macOS, use a Linux VM or CI runner, or use Option B below.

### Flash to SD card

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or:

```bash
sudo dd if=PI_Display/build/cqrush-display-pi.img of=/dev/sdX bs=4M status=progress conv=fsync
```

## Option B — Install on existing Raspberry Pi OS

Flash standard **Raspberry Pi OS Lite (64-bit or 32-bit)** with Raspberry Pi Imager, boot once, then:

```bash
git clone https://github.com/RandomActsofFrank/CQ_Rush.git
cd CQ_Rush/PI_Display
chmod +x install-on-device.sh
sudo ./install-on-device.sh
sudo reboot
```

## First-time setup

1. Power on the Pi and wait ~60 seconds.
2. On a phone or laptop, join Wi‑Fi **CQ-Rush-Display** (password `cqrush-setup`).
3. Open **http://10.42.0.1:8080**
4. Enter your CQ Rush display URL (must include `/display`).
5. Click **Scan**, choose your home/club Wi‑Fi, enter its password, and **Save and start display**.
6. The Pi reboots and opens the display page in kiosk mode.

The CQ Rush server must be reachable on your LAN (or over the internet if you use a public HTTPS URL). The `/display` route does not require login.

## Re-enter setup mode

Create a flag file on the boot partition and reboot:

```bash
sudo touch /boot/firmware/cqrush-display-setup
sudo reboot
```

On older images the path may be `/boot/cqrush-display-setup`.

## Configuration file

`/etc/cqrush-display/config.json`:

```json
{
  "display_url": "https://your-server.example.com/display",
  "wifi_ssid": "YourNetwork",
  "setup_complete": true
}
```

Environment overrides (systemd): `CQRUSH_DISPLAY_AP_SSID`, `CQRUSH_DISPLAY_AP_PASSWORD`, `CQRUSH_SETUP_PORT`, `CQRUSH_WIFI_IFACE`.

## Folder layout

```
PI_Display/
├── README.md                 This file
├── build-image.sh            Build flashable .img via pi-gen (Linux)
├── install-on-device.sh      Install onto running Pi OS
├── sync-pi-gen-files.sh      Assemble pi-gen stage files
├── build/                    Output images (gitignored)
├── config/                   Example config
├── opt/cqrush-display/       Setup portal, Wi‑Fi scripts, kiosk launcher
├── systemd/                  systemd units
├── overlay/                  X session files
└── pi-gen-stage/             Custom pi-gen stage scripts
```

## Services

| Service | Purpose |
|---------|---------|
| `cqrush-display-x.service` | Starts X11 on tty1 |
| `cqrush-display.service` | Setup hotspot + portal, or prepares kiosk mode |

Logs:

```bash
journalctl -u cqrush-display -f
journalctl -u cqrush-display-x -f
```

## Same Pi as the logger?

Yes — you can run the CQ Rush server with `deploy/pi/setup.sh` on one Pi and point the display URL to `http://localhost:3002/display`, or use two Pis (one server, one display).

## License

Same as CQ Rush (ISC). See repository [LICENSE](../LICENSE).
