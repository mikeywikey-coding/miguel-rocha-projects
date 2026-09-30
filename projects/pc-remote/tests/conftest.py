"""Run the tests without Windows input libraries and without touching real files."""

import asyncio
import json
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest
from websockets.exceptions import ConnectionClosedOK

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

PIN = "40718263"
LOCAL_NAMES = {"localhost", "127.0.0.1", "::1", "mypc", "mypc.local", "192.168.1.10"}


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    import store

    monkeypatch.setattr(store, "CONFIG_PATH", tmp_path / "config.json")
    monkeypatch.setattr(store, "HOTKEYS_PATH", tmp_path / "hotkeys.json")
    monkeypatch.setattr(store, "DEVICES_PATH", tmp_path / "devices.json")
    return store


@pytest.fixture
def server(monkeypatch):
    """Import server.py with a stand-in controller, so no real input is ever sent."""
    fake = types.ModuleType("controller")
    fake.calls = []
    for name in (
        "move_mouse",
        "scroll",
        "click",
        "button_down",
        "button_up",
        "send_hotkey",
        "key_down",
        "key_up",
        "type_text",
        "power",
        "release_all",
    ):
        setattr(fake, name, lambda *args, _name=name: fake.calls.append((_name, args)))
    fake.get_volume = lambda: {"available": False, "level": 0, "muted": False}
    fake.set_volume = lambda level: {"available": True, "level": level, "muted": False}
    fake.set_mute = lambda muted: {"available": True, "level": 0, "muted": bool(muted)}
    monkeypatch.setitem(sys.modules, "controller", fake)
    monkeypatch.delitem(sys.modules, "server", raising=False)
    import server as module

    monkeypatch.setattr(module, "_local_names", lambda: set(LOCAL_NAMES))
    module.configure({"pin": PIN, "port": 8765})
    return module


class FakeSocket:
    """Stands in for a websockets connection: hands out queued messages, records replies."""

    def __init__(self, messages, ip="192.168.1.20", agent="Mozilla/5.0 (iPhone)", silent=False):
        self.remote_address = (ip, 50000)
        self.request = SimpleNamespace(headers={"User-Agent": agent})
        self._queue = [m if isinstance(m, str) else json.dumps(m) for m in messages]
        self._silent = silent
        self.sent = []
        self.closed = None

    async def recv(self):
        if self._queue and not self.closed:
            return self._queue.pop(0)
        if self._silent and not self.closed:
            await asyncio.Event().wait()  # a client that connects and never speaks
        raise ConnectionClosedOK(None, None)

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        while self._queue and not self.closed:
            yield self._queue.pop(0)

    async def send(self, data):
        self.sent.append(json.loads(data))

    async def close(self, code=1000, reason=""):
        self.closed = (code, reason)


def request(path="/", host="mypc.local:8765", origin=None):
    headers = {"Host": host} if host is not None else {}
    if origin is not None:
        headers["Origin"] = origin
    return SimpleNamespace(path=path, headers=headers)


def run(server, socket):
    asyncio.run(server.handler(socket))
    return socket
