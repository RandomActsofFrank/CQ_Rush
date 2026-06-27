#!/usr/bin/env python3
"""CQ Rush Pi Display — setup portal (WiFi scan + display URL)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from flask import Flask, jsonify, render_template, request
except ImportError:
    print("python3-flask is required", file=sys.stderr)
    sys.exit(1)

APP = Flask(__name__, template_folder="templates", static_folder="static")

CONFIG_PATH = Path(os.environ.get("CQRUSH_DISPLAY_CONFIG", "/etc/cqrush-display/config.json"))
AP_SSID = os.environ.get("CQRUSH_DISPLAY_AP_SSID", "CQ-Rush-Display")
AP_PASSWORD = os.environ.get("CQRUSH_DISPLAY_AP_PASSWORD", "cqrush-setup")
DEFAULT_DISPLAY_URL = "https://your-server.example.com/display"

URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "display_url": DEFAULT_DISPLAY_URL,
        "wifi_ssid": "",
        "setup_complete": False,
    }


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    tmp.replace(CONFIG_PATH)
    os.chmod(CONFIG_PATH, 0o644)


def run_cmd(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def scan_wifi() -> list[dict]:
    run_cmd(["nmcli", "dev", "wifi", "rescan"], timeout=15)
    result = run_cmd(
        ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,IN-USE", "dev", "wifi", "list"],
        timeout=20,
    )
    if result.returncode != 0:
        return []

    networks: dict[str, dict] = {}
    for line in result.stdout.splitlines():
        parts = line.split(":")
        if len(parts) < 4:
            continue
        ssid = parts[0].strip()
        if not ssid:
            continue
        signal = int(parts[1]) if parts[1].isdigit() else 0
        security = parts[2] or "—"
        in_use = parts[3] == "*"
        existing = networks.get(ssid)
        if existing is None or signal > existing["signal"]:
            networks[ssid] = {
                "ssid": ssid,
                "signal": signal,
                "security": security,
                "in_use": in_use,
            }

    return sorted(networks.values(), key=lambda item: item["signal"], reverse=True)


def connect_wifi(ssid: str, password: str | None) -> tuple[bool, str]:
    args = ["nmcli", "dev", "wifi", "connect", ssid]
    if password:
        args.extend(["password", password])
    result = run_cmd(args, timeout=45)
    if result.returncode == 0:
        return True, "Connected"
    message = (result.stderr or result.stdout or "Connection failed").strip()
    return False, message


def validate_display_url(url: str) -> str | None:
    value = url.strip()
    if not value:
        return "Display URL is required"
    if not URL_PATTERN.match(value):
        return "URL must start with http:// or https://"
    if len(value) > 512:
        return "URL is too long"
    return None


@APP.get("/")
def index():
    config = load_config()
    return render_template(
        "setup.html",
        ap_ssid=AP_SSID,
        ap_password=AP_PASSWORD,
        config=config,
        default_display_url=DEFAULT_DISPLAY_URL,
    )


@APP.get("/api/wifi/scan")
def api_wifi_scan():
    return jsonify({"networks": scan_wifi()})


@APP.post("/api/setup")
def api_setup():
    payload = request.get_json(silent=True) or {}
    ssid = (payload.get("ssid") or "").strip()
    password = payload.get("password") or ""
    display_url = (payload.get("display_url") or "").strip()

    if not ssid:
        return jsonify({"ok": False, "error": "Choose a Wi‑Fi network"}), 400

    url_error = validate_display_url(display_url)
    if url_error:
        return jsonify({"ok": False, "error": url_error}), 400

    ok, message = connect_wifi(ssid, password or None)
    if not ok:
        return jsonify({"ok": False, "error": message}), 400

    config = load_config()
    config.update(
        {
            "wifi_ssid": ssid,
            "display_url": display_url,
            "setup_complete": True,
        }
    )
    save_config(config)

    return jsonify(
        {
            "ok": True,
            "message": "Saved. Rebooting into display mode…",
            "rebooting": True,
        }
    )


@APP.post("/api/reboot")
def api_reboot():
    run_cmd(["systemctl", "reboot"], timeout=5)
    return jsonify({"ok": True})


if __name__ == "__main__":
    host = os.environ.get("CQRUSH_SETUP_BIND", "0.0.0.0")
    port = int(os.environ.get("CQRUSH_SETUP_PORT", "8080"))
    APP.run(host=host, port=port, debug=False)
