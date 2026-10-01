"""Config, hotkey and paired-device persistence."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import uuid
from pathlib import Path

ROOT = Path(__file__).parent
CONFIG_PATH = ROOT / "config.json"
HOTKEYS_PATH = ROOT / "hotkeys.json"
DEVICES_PATH = ROOT / "devices.json"

DEFAULT_PIN_DIGITS = 8
MAX_DEVICES = 10

DEFAULT_HOTKEYS = {
    "pages": [
        {
            "id": "general",
            "name": "General",
            "buttons": [
                {"id": "copy", "label": "Copy", "keys": "ctrl+c"},
                {"id": "paste", "label": "Paste", "keys": "ctrl+v"},
                {"id": "cut", "label": "Cut", "keys": "ctrl+x"},
                {"id": "undo", "label": "Undo", "keys": "ctrl+z"},
                {"id": "redo", "label": "Redo", "keys": "ctrl+y"},
                {"id": "selectall", "label": "Select All", "keys": "ctrl+a"},
                {"id": "save", "label": "Save", "keys": "ctrl+s"},
                {"id": "find", "label": "Find", "keys": "ctrl+f"},
                {"id": "alttab", "label": "Alt+Tab", "keys": "alt+tab"},
                {"id": "desktop", "label": "Show Desktop", "keys": "win+d"},
                {"id": "snip", "label": "Snip", "keys": "win+shift+s"},
                {"id": "close", "label": "Close App", "keys": "alt+f4"},
            ],
        },
        {
            "id": "windows",
            "name": "Windows",
            "buttons": [
                {"id": "start", "label": "Start Menu", "keys": "win"},
                {"id": "explorer", "label": "Explorer", "keys": "win+e"},
                {"id": "run", "label": "Run", "keys": "win+r"},
                {"id": "search", "label": "Search", "keys": "win+s"},
                {"id": "settings", "label": "Settings", "keys": "win+i"},
                {"id": "taskview", "label": "Task View", "keys": "win+tab"},
                {"id": "lockscreen", "label": "Lock", "keys": "win+l"},
                {"id": "snapleft", "label": "Snap Left", "keys": "win+left"},
                {"id": "snapright", "label": "Snap Right", "keys": "win+right"},
                {"id": "maximize", "label": "Maximize", "keys": "win+up"},
                {"id": "minimize", "label": "Minimize", "keys": "win+down"},
                {"id": "clipboard", "label": "Clipboard", "keys": "win+v"},
            ],
        },
        {
            "id": "browser",
            "name": "Browser",
            "buttons": [
                {"id": "newtab", "label": "New Tab", "keys": "ctrl+t"},
                {"id": "closetab", "label": "Close Tab", "keys": "ctrl+w"},
                {"id": "reopentab", "label": "Reopen Tab", "keys": "ctrl+shift+t"},
                {"id": "nexttab", "label": "Next Tab", "keys": "ctrl+tab"},
                {"id": "reload", "label": "Reload", "keys": "f5"},
                {"id": "hardreload", "label": "Hard Reload", "keys": "ctrl+shift+r"},
                {"id": "fullscreen", "label": "Fullscreen", "keys": "f11"},
                {"id": "zoomin", "label": "Zoom In", "keys": "ctrl+="},
                {"id": "zoomout", "label": "Zoom Out", "keys": "ctrl+-"},
                {"id": "zoomreset", "label": "Zoom Reset", "keys": "ctrl+0"},
                {"id": "back", "label": "Back", "keys": "alt+left"},
                {"id": "forward", "label": "Forward", "keys": "alt+right"},
            ],
        },
    ]
}


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write_json(path: Path, data) -> None:
    """Write via a temp file so a crash mid-write can't corrupt the original."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_config() -> dict:
    config = _read_json(CONFIG_PATH) or {}
    changed = False
    if not config.get("pin"):
        config["pin"] = (
            f"{secrets.randbelow(10**DEFAULT_PIN_DIGITS):0{DEFAULT_PIN_DIGITS}d}"
        )
        changed = True
    if not config.get("port"):
        config["port"] = 8765
        changed = True
    if changed:
        _write_json(CONFIG_PATH, config)
    return config


def load_hotkeys() -> dict:
    data = _read_json(HOTKEYS_PATH)
    if not isinstance(data, dict) or not isinstance(data.get("pages"), list):
        _write_json(HOTKEYS_PATH, DEFAULT_HOTKEYS)
        return DEFAULT_HOTKEYS
    return data


def _item_id(value) -> str:
    return str(value or "")[:32] or uuid.uuid4().hex[:8]


def save_hotkeys(pages) -> dict:
    """Validate and persist pages sent from the phone."""
    if not isinstance(pages, list):
        raise ValueError("pages must be a list")

    clean_pages = []
    for page in pages[:20]:
        if not isinstance(page, dict):
            continue
        buttons = []
        for button in (page.get("buttons") or [])[:60]:
            if not isinstance(button, dict):
                continue
            label = str(button.get("label", "")).strip()[:24]
            keys = str(button.get("keys", "")).strip()[:64]
            if not label or not keys:
                continue
            buttons.append(
                {"id": _item_id(button.get("id")), "label": label, "keys": keys}
            )
        name = str(page.get("name", "")).strip()[:20]
        if not name:
            continue
        clean_pages.append(
            {"id": _item_id(page.get("id")), "name": name, "buttons": buttons}
        )

    data = {"pages": clean_pages}
    _write_json(HOTKEYS_PATH, data)
    return data


# --- paired devices -------------------------------------------------------


def _pin_check(pin: str, salt: str) -> str:
    return hmac.new(
        bytes.fromhex(salt), pin.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def load_devices(pin: str) -> dict:
    """Paired phones, keyed by the SHA-256 of their device token.

    Tokens themselves are never stored. The file also keeps a salted check of
    the PIN the phones were paired under, so changing the PIN in config.json
    signs every phone out.
    """
    data = _read_json(DEVICES_PATH)
    if not isinstance(data, dict) or not isinstance(data.get("devices"), dict):
        return {}
    try:
        expected = _pin_check(pin, str(data.get("salt", "")))
    except ValueError:
        return {}
    if not hmac.compare_digest(str(data.get("pin_check", "")), expected):
        return {}
    return {
        digest: record
        for digest, record in data["devices"].items()
        if isinstance(digest, str) and isinstance(record, dict)
    }


def save_devices(pin: str, devices: dict) -> None:
    salt = secrets.token_hex(16)
    _write_json(
        DEVICES_PATH,
        {"salt": salt, "pin_check": _pin_check(pin, salt), "devices": devices},
    )
