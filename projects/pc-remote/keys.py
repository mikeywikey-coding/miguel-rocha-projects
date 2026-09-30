"""Hotkey parsing with no input-library dependency, so it can be tested anywhere.

A spec such as ``ctrl+shift+s`` becomes a list of modifier names plus one key.
Names are the attribute names pynput uses on ``pynput.keyboard.Key``; a single
character (``c``, ``7``, ``/``) is typed as itself.
"""
from __future__ import annotations

MAX_SPEC_LENGTH = 64

MODIFIERS = {
    "ctrl": "ctrl",
    "control": "ctrl",
    "alt": "alt",
    "shift": "shift",
    "win": "cmd",
    "cmd": "cmd",
    "super": "cmd",
    "meta": "cmd",
}

NAMED_KEYS = {
    "enter": "enter",
    "return": "enter",
    "tab": "tab",
    "esc": "esc",
    "escape": "esc",
    "backspace": "backspace",
    "delete": "delete",
    "del": "delete",
    "space": "space",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "home": "home",
    "end": "end",
    "pageup": "page_up",
    "page_up": "page_up",
    "pgup": "page_up",
    "pagedown": "page_down",
    "page_down": "page_down",
    "pgdn": "page_down",
    "insert": "insert",
    "ins": "insert",
    "capslock": "caps_lock",
    "caps_lock": "caps_lock",
    "numlock": "num_lock",
    "scrolllock": "scroll_lock",
    "printscreen": "print_screen",
    "print_screen": "print_screen",
    "prtsc": "print_screen",
    "pause": "pause",
    "menu": "menu",
    "play": "media_play_pause",
    "playpause": "media_play_pause",
    "next": "media_next",
    "prev": "media_previous",
    "previous": "media_previous",
    "volup": "media_volume_up",
    "voldown": "media_volume_down",
    "mute": "media_volume_mute",
}
# pynput's win32 backend stops at f20; controller.py rejects what it lacks.
NAMED_KEYS.update({f"f{n}": f"f{n}" for n in range(1, 25)})


def split_hotkey(spec: str) -> list[str]:
    """Split 'ctrl+shift+s' into parts, keeping a literal '+' as a key."""
    raw = spec.strip()
    if not raw:
        raise ValueError("empty hotkey")
    if len(raw) > MAX_SPEC_LENGTH:
        raise ValueError("hotkey is too long")
    if raw.endswith("+"):
        return [part for part in raw[:-1].split("+") if part] + ["+"]
    return [part for part in raw.split("+") if part]


def key_name(name: str) -> str:
    """Resolve 'alt', 'pgup' or 'c' to a pynput Key attribute name or a character."""
    stripped = name.strip()
    lowered = stripped.lower()
    if lowered in NAMED_KEYS:
        return NAMED_KEYS[lowered]
    if lowered in MODIFIERS:
        return MODIFIERS[lowered]
    if len(stripped) == 1:
        return stripped
    raise ValueError(f"unknown key: {name}")


def parse_hotkey(spec: str) -> tuple[list[str], str]:
    """Return (modifier names, final key) for a spec like 'ctrl+shift+s'."""
    *modifier_names, final = split_hotkey(spec)
    modifiers = []
    for name in modifier_names:
        modifier = MODIFIERS.get(name.strip().lower())
        if modifier is None:
            raise ValueError(f"unknown modifier: {name}")
        modifiers.append(modifier)
    return modifiers, key_name(final)
