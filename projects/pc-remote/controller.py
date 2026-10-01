"""Windows input control: mouse, keyboard, media, volume, power."""

from __future__ import annotations

import ctypes
import subprocess
from ctypes import POINTER, cast, wintypes

from pynput.keyboard import Controller as KeyboardController, Key
from pynput.mouse import Button, Controller as MouseController

import keys

_mouse = MouseController()
_keyboard = KeyboardController()

# pynput only moves whole pixels, so slow drags would stall without carrying
# the leftover fraction into the next move.
_residual = [0.0, 0.0]

# Everything the phone is currently holding down, so a dropped connection can
# never leave the PC with Alt or the left mouse button stuck.
_held_keys: dict[str, object] = {}
_held_buttons: set[str] = set()

BUTTONS = {"left": Button.left, "right": Button.right, "middle": Button.middle}


def _key(name: str):
    """Map a name from keys.py onto a pynput key; single characters pass through."""
    if len(name) == 1:
        return name
    key = getattr(Key, name, None)
    if key is None:
        raise ValueError(f"key not available on this system: {name}")
    return key


def resolve_key(name: str):
    """Turn a key name like 'alt', 'tab' or 'c' into something pynput accepts."""
    return _key(keys.key_name(name))


def _button(name: str):
    button = BUTTONS.get(name)
    if button is None:
        raise ValueError(f"unknown mouse button: {name}")
    return button


def send_hotkey(spec: str) -> None:
    modifier_names, final = keys.parse_hotkey(spec)
    mods = [_key(name) for name in modifier_names]
    key = _key(final)
    held = []
    try:
        for mod in mods:
            _keyboard.press(mod)
            held.append(mod)
        _keyboard.press(key)
        _keyboard.release(key)
    finally:
        # Always let go, or a stuck Ctrl makes the PC unusable.
        for mod in reversed(held):
            _keyboard.release(mod)


def key_down(name: str) -> None:
    """Hold a key down until key_up. Alt+Tab needs this: Windows only keeps the
    window switcher on screen for as long as Alt is actually held."""
    key = resolve_key(name)
    _keyboard.press(key)
    _held_keys[name.strip().lower()] = key


def key_up(name: str) -> None:
    key = resolve_key(name)
    _keyboard.release(key)
    _held_keys.pop(name.strip().lower(), None)


def release_all() -> None:
    """Let go of everything the phone was holding."""
    for key in list(_held_keys.values()):
        try:
            _keyboard.release(key)
        except Exception:
            pass
    _held_keys.clear()
    for button in list(_held_buttons):
        try:
            _mouse.release(BUTTONS[button])
        except Exception:
            pass
    _held_buttons.clear()


def type_text(text: str) -> None:
    _keyboard.type(text)


# --- mouse ----------------------------------------------------------------

_user32 = ctypes.windll.user32

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_ABSOLUTE = 0x8000
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79


class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(wintypes.ULONG)),
    ]


class _INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("mi", _MOUSEINPUT)]


def move_mouse(dx: float, dy: float) -> None:
    """Move the cursor as a real input event.

    pynput moves by calling SetCursorPos, which teleports the pointer without
    injecting anything into the input stream. Apps that track the mouse while a
    button is down — drag-and-drop, canvases, anything on raw input — never see
    that motion, so a held button drags nothing. SendInput does show up, and the
    absolute flag keeps the move pixel-exact instead of running it through
    pointer acceleration.
    """
    _residual[0] += dx
    _residual[1] += dy
    step_x = int(_residual[0])
    step_y = int(_residual[1])
    if not (step_x or step_y):
        return
    _residual[0] -= step_x
    _residual[1] -= step_y

    point = wintypes.POINT()
    if not _user32.GetCursorPos(ctypes.byref(point)):
        return

    left = _user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
    top = _user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
    width = _user32.GetSystemMetrics(SM_CXVIRTUALSCREEN) or 1
    height = _user32.GetSystemMetrics(SM_CYVIRTUALSCREEN) or 1

    x = min(max(point.x + step_x, left), left + width - 1)
    y = min(max(point.y + step_y, top), top + height - 1)

    event = _INPUT(
        type=0,
        mi=_MOUSEINPUT(
            round((x - left) * 65535 / max(width - 1, 1)),
            round((y - top) * 65535 / max(height - 1, 1)),
            0,
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
            0,
            None,
        ),
    )
    _user32.SendInput(1, ctypes.byref(event), ctypes.sizeof(_INPUT))


def click(button: str = "left", count: int = 1) -> None:
    _mouse.click(_button(button), count)


def button_down(button: str = "left") -> None:
    _mouse.press(_button(button))
    _held_buttons.add(button)


def button_up(button: str = "left") -> None:
    _mouse.release(_button(button))
    _held_buttons.discard(button)


def scroll(dx: float, dy: float) -> None:
    _mouse.scroll(int(dx), int(dy))


# --- system volume (pycaw) ------------------------------------------------

_volume_endpoint = None


def _resolve_endpoint():
    from pycaw.utils import AudioUtilities

    speakers = AudioUtilities.GetSpeakers()
    endpoint = getattr(speakers, "EndpointVolume", None)
    if endpoint is not None:
        return endpoint

    # Older pycaw hands back a raw IMMDevice instead.
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import IAudioEndpointVolume

    interface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))


def _with_endpoint(action, fallback):
    """Run `action` against the default audio endpoint.

    The cached endpoint goes stale when the default output device changes
    (plugging in headphones), so a failure re-resolves and retries once.
    """
    global _volume_endpoint
    for attempt in range(2):
        try:
            if _volume_endpoint is None:
                _volume_endpoint = _resolve_endpoint()
            return action(_volume_endpoint)
        except Exception:
            _volume_endpoint = None
            if attempt:
                return fallback()
    return fallback()


def _unavailable() -> dict:
    return {"available": False, "level": 0, "muted": False}


def _read(endpoint) -> dict:
    return {
        "available": True,
        "level": round(endpoint.GetMasterVolumeLevelScalar() * 100),
        "muted": bool(endpoint.GetMute()),
    }


def get_volume() -> dict:
    return _with_endpoint(_read, _unavailable)


def set_volume(level: float) -> dict:
    clamped = max(0.0, min(100.0, level))

    def apply(endpoint):
        endpoint.SetMasterVolumeLevelScalar(clamped / 100.0, None)
        return _read(endpoint)

    def nudge():
        # No endpoint: at least move the volume with the media keys.
        send_hotkey("volup" if clamped >= 50 else "voldown")
        return _unavailable()

    return _with_endpoint(apply, nudge)


def set_mute(muted: bool | None = None) -> dict:
    def apply(endpoint):
        target = (not endpoint.GetMute()) if muted is None else muted
        endpoint.SetMute(1 if target else 0, None)
        return _read(endpoint)

    def nudge():
        send_hotkey("mute")
        return _unavailable()

    return _with_endpoint(apply, nudge)


# --- power ----------------------------------------------------------------

POWER_COMMANDS = {
    "lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
    "sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
    "shutdown": ["shutdown", "/s", "/t", "0"],
    "restart": ["shutdown", "/r", "/t", "0"],
    "signout": ["shutdown", "/l"],
}


def power(action: str) -> None:
    command = POWER_COMMANDS.get(action)
    if command is None:
        raise ValueError(f"unknown power action: {action}")
    subprocess.Popen(command, creationflags=subprocess.CREATE_NO_WINDOW)
