"""PC Remote - LAN control server for the phone web app.

Serves the web UI over HTTP and accepts commands over a WebSocket on the same
port. Run it, open the printed URL on the phone and pair it with the PIN.

Anything that gets through here can type on this PC, so every request passes
these checks (README.md, "Security", explains the reasoning):

* The Host header must name this PC, so a web page that points its own domain
  at the PC (DNS rebinding) is refused.
* WebSocket handshakes must come from the app's own origin, so no other web
  page can open a connection from a browser on the network.
* A new connection has AUTH_TIMEOUT seconds to authenticate, either with the
  PIN (which pairs the phone) or with the device token issued at pairing.
* Failed attempts are rate limited per address (an IPv6 /64 counts as one
  address) and across all addresses.
* Every command is validated and clamped before it reaches the controller.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import ipaddress
import json
import math
import mimetypes
import secrets
import socket
import time
import traceback
from collections import deque
from http import HTTPStatus
from pathlib import Path
from urllib.parse import urlsplit

from websockets.asyncio.server import serve
from websockets.datastructures import Headers
from websockets.exceptions import ConnectionClosed
from websockets.http11 import Response

import controller
import keys
import store

WEB_DIR = Path(__file__).parent / "web"

MIN_PIN_LENGTH = 6
AUTH_TIMEOUT = 10  # seconds a new connection has to authenticate
MAX_FAILED_ATTEMPTS = 10  # per address, within FAILURE_WINDOW
MAX_GLOBAL_FAILURES = 30  # across all addresses, within FAILURE_WINDOW
FAILURE_WINDOW = 300  # seconds
HOST_REFRESH_SECONDS = 10  # how often an unknown Host may trigger re-reading addresses
MAX_TEXT_LENGTH = 500  # characters per key.text message

SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'none'; "
        "form-action 'none'; frame-ancestors 'none'"
    ),
}

PIN = ""
PORT = 8765
_extra_hosts: set[str] = set()
_known_hosts: set[str] = set()
_hosts_read_at = 0.0
_devices: dict[str, dict] = {}
_clients: set = set()


def configure(config: dict) -> None:
    """Apply a loaded config.json. main() calls this; so do the tests."""
    global PIN, PORT, _hosts_read_at
    PIN = str(config["pin"])
    PORT = int(config["port"])
    _extra_hosts.clear()
    _extra_hosts.update(
        str(name).strip().lower() for name in config.get("allowed_hosts", []) if str(name).strip()
    )
    _known_hosts.clear()
    _hosts_read_at = 0.0
    _devices.clear()
    _devices.update(store.load_devices(PIN))
    throttle.reset()


def pin_warning(pin: str) -> str | None:
    """Refuse PINs that are too short; warn about ones that are easy to guess."""
    if len(pin) < MIN_PIN_LENGTH:
        raise SystemExit(
            f"The PIN in {store.CONFIG_PATH} must be at least {MIN_PIN_LENGTH} characters."
        )
    ascending = "0123456789" * 4
    if len(set(pin)) == 1 or pin in ascending or pin in ascending[::-1]:
        return "the PIN is easy to guess; pick a random one"
    return None


def assets_version() -> str:
    """Newest mtime under web/, used to tell a phone its copy is stale."""
    latest = 0.0
    for path in WEB_DIR.rglob("*"):
        if path.is_file():
            latest = max(latest, path.stat().st_mtime)
    return f"{latest:.0f}"


async def watch_assets() -> None:
    """Push a reload to every connected phone when the app files change."""
    current = assets_version()
    while True:
        await asyncio.sleep(1)
        latest = assets_version()
        if latest == current:
            continue
        current = latest
        payload = json.dumps({"type": "reload"})
        for client in list(_clients):
            try:
                await client.send(payload)
            except Exception:
                pass
        if _clients:
            print(f"  [~] app files changed, reloaded {len(_clients)} phone(s)")


def lan_ip() -> str:
    """Best guess at the address the phone should connect to."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))  # UDP: picks a route, sends nothing
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def mdns_host() -> str:
    """The Bonjour name for this PC, e.g. "mypc.local".

    Prefer this over lan_ip() for anything the phone keeps. iOS bakes the origin
    into a home-screen icon, and both start_url and the WebSocket URL are
    relative to it, so an icon added at an IP dies the next time DHCP hands out
    a different one. The .local name follows the PC across addresses.
    """
    return f"{socket.gethostname().lower()}.local"


# --- which requests are for us --------------------------------------------


def _local_names() -> set[str]:
    """Every name and address this PC answers to, plus config's allowed_hosts."""
    hostname = socket.gethostname().lower()
    names = {"localhost", "127.0.0.1", "::1", hostname, f"{hostname}.local", lan_ip()}
    names.add(socket.getfqdn().lower())
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            names.add(str(info[4][0]).split("%")[0].lower())
    except OSError:
        pass
    return names | _extra_hosts


def _hostname(host: str | None) -> str | None:
    """'mypc.local:8765' -> 'mypc.local', '[::1]:8765' -> '::1'."""
    if not host:
        return None
    host = host.strip().lower()
    if host.startswith("["):
        end = host.find("]")
        return host[1:end] if end > 1 else None
    if host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host or None


def host_allowed(host: str | None) -> bool:
    """True when the Host header names this PC. Blocks DNS rebinding."""
    global _hosts_read_at
    name = _hostname(host)
    if name is None:
        return False
    if name in _known_hosts:
        return True
    # Addresses change (new DHCP lease, Wi-Fi to Ethernet), so re-read them
    # before refusing, but not on every request from a misbehaving client.
    now = time.monotonic()
    if not _known_hosts or now - _hosts_read_at >= HOST_REFRESH_SECONDS:
        _known_hosts.clear()
        _known_hosts.update(_local_names())
        _hosts_read_at = now
    return name in _known_hosts


def origin_allowed(origin: str | None, host: str | None) -> bool:
    """A browser handshake must come from the page this server handed out.

    Browsers always send Origin on a WebSocket handshake, so a request without
    one is not a web page; it still has to authenticate like anything else.
    """
    if origin is None:
        return True
    parts = urlsplit(origin.strip())
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    return parts.netloc.lower() == (host or "").strip().lower()


# --- static file serving --------------------------------------------------


def _http_response(status: HTTPStatus, body: bytes, content_type: str) -> Response:
    headers = Headers(
        {"Content-Type": content_type, "Content-Length": str(len(body)), **SECURITY_HEADERS}
    )
    return Response(status.value, status.phrase, headers, body)


def _refuse_request(status: HTTPStatus, reason: str) -> Response:
    return _http_response(status, reason.encode(), "text/plain; charset=utf-8")


def process_request(connection, request):
    """Check who a request is for, serve the web UI, and let /ws upgrade."""
    host = request.headers.get("Host")
    if not host_allowed(host):
        return _refuse_request(HTTPStatus.FORBIDDEN, "Unknown host")

    path = request.path.split("?", 1)[0]
    if path == "/ws":
        if not origin_allowed(request.headers.get("Origin"), host):
            return _refuse_request(HTTPStatus.FORBIDDEN, "Cross-origin connection refused")
        return None

    relative = "index.html" if path in ("/", "") else path.lstrip("/")
    target = (WEB_DIR / relative).resolve()
    if not target.is_relative_to(WEB_DIR.resolve()) or not target.is_file():
        return _refuse_request(HTTPStatus.NOT_FOUND, "Not found")

    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    if content_type.startswith("text/") or content_type in (
        "application/javascript",
        "application/manifest+json",
        "application/json",
    ):
        content_type += "; charset=utf-8"
    return _http_response(HTTPStatus.OK, target.read_bytes(), content_type)


# --- failed-attempt limits ------------------------------------------------


class Throttle:
    """Counts failed authentications per address and across all addresses.

    Once a limit is reached, attempts are refused without being counted, so
    the bookkeeping stays small however hard a client pushes.
    """

    def __init__(
        self,
        per_address=MAX_FAILED_ATTEMPTS,
        overall=MAX_GLOBAL_FAILURES,
        window=FAILURE_WINDOW,
        clock=time.monotonic,
    ):
        self.per_address = per_address
        self.overall = overall
        self.window = window
        self.clock = clock
        self._by_address: dict[str, deque] = {}
        self._all: deque = deque()

    @staticmethod
    def key(ip: str) -> str:
        """An IPv6 host can pick any address in its /64, so count the /64."""
        try:
            address = ipaddress.ip_address(ip.split("%")[0])
        except ValueError:
            return ip
        if address.version == 6:
            if address.ipv4_mapped:
                return str(address.ipv4_mapped)
            return str(ipaddress.ip_network(f"{address}/64", strict=False))
        return str(address)

    def _prune(self, stamps: deque, now: float) -> None:
        while stamps and now - stamps[0] >= self.window:
            stamps.popleft()

    def blocked(self, ip: str, pairing: bool) -> bool:
        """True if this address (or, for PIN attempts, everyone) is locked out.

        The global limit only gates PIN attempts: guessing a device token is
        hopeless, and paired phones should keep working during an attack.
        """
        now = self.clock()
        self._prune(self._all, now)
        key = self.key(ip)
        stamps = self._by_address.get(key)
        if stamps is not None:
            self._prune(stamps, now)
            if not stamps:
                del self._by_address[key]
                stamps = None
        if stamps is not None and len(stamps) >= self.per_address:
            return True
        return pairing and len(self._all) >= self.overall

    def failed(self, ip: str) -> None:
        now = self.clock()
        self._all.append(now)
        self._by_address.setdefault(self.key(ip), deque()).append(now)

    def succeeded(self, ip: str) -> None:
        self._by_address.pop(self.key(ip), None)

    def reset(self) -> None:
        self._by_address.clear()
        self._all.clear()


throttle = Throttle()


# --- paired devices -------------------------------------------------------


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _device_label(websocket) -> str:
    request = getattr(websocket, "request", None)
    agent = request.headers.get("User-Agent", "") if request is not None else ""
    for name in ("iPhone", "iPad", "Android", "Windows", "Macintosh"):
        if name in agent:
            return name
    return "Browser"


def _pair_device(label: str) -> tuple[str, str]:
    """Issue a new device token. Only its hash is kept, capped at MAX_DEVICES."""
    token = secrets.token_urlsafe(32)
    digest = _token_digest(token)
    now = int(time.time())
    _devices[digest] = {"label": label, "paired": now, "seen": now}
    while len(_devices) > store.MAX_DEVICES:
        oldest = min(_devices, key=lambda d: _devices[d].get("seen", 0))
        del _devices[oldest]
    store.save_devices(PIN, _devices)
    return token, digest


def _device_seen(digest: str) -> None:
    """Note when a phone last connected. Phones reconnect every time the app
    comes back to the foreground, so the file is rewritten at most hourly."""
    record = _devices[digest]
    now = int(time.time())
    stale = now - int(record.get("seen", 0)) >= 3600
    record["seen"] = now
    if stale:
        store.save_devices(PIN, _devices)


def _forget_device(digest: str) -> None:
    if _devices.pop(digest, None) is not None:
        store.save_devices(PIN, _devices)


# --- command dispatch -----------------------------------------------------


def _number(value, low: float, high: float, default: float | None = None) -> float:
    """A finite number clamped to [low, high]; anything else is an error."""
    if value is None and default is not None:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("expected a number")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("expected a finite number")
    return max(low, min(high, number))


def _text(value, limit: int) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError("expected text")
    if len(value) > limit:
        raise ValueError("text is too long")
    return value


def _button(value) -> str:
    button = "left" if value is None else value
    if button not in ("left", "right", "middle"):
        raise ValueError("unknown mouse button")
    return button


def dispatch(command: dict) -> dict | None:
    kind = command.get("type")

    if kind == "mouse.move":
        controller.move_mouse(
            _number(command.get("dx"), -2000, 2000, 0), _number(command.get("dy"), -2000, 2000, 0)
        )
        return None
    if kind == "mouse.scroll":
        controller.scroll(
            _number(command.get("dx"), -100, 100, 0), _number(command.get("dy"), -100, 100, 0)
        )
        return None
    if kind == "mouse.click":
        controller.click(_button(command.get("button")), int(_number(command.get("count"), 1, 3, 1)))
        return None
    if kind == "mouse.down":
        controller.button_down(_button(command.get("button")))
        return None
    if kind == "mouse.up":
        controller.button_up(_button(command.get("button")))
        return None

    if kind == "key.tap":
        controller.send_hotkey(_text(command.get("keys"), keys.MAX_SPEC_LENGTH))
        return None
    if kind == "key.down":
        controller.key_down(_text(command.get("key"), 32))
        return None
    if kind == "key.up":
        controller.key_up(_text(command.get("key"), 32))
        return None
    if kind == "key.text":
        controller.type_text(_text(command.get("text"), MAX_TEXT_LENGTH))
        return None

    if kind == "volume.get":
        return {"type": "volume", "volume": controller.get_volume()}
    if kind == "volume.set":
        return {"type": "volume", "volume": controller.set_volume(_number(command.get("level"), 0, 100))}
    if kind == "volume.mute":
        muted = command.get("muted")
        if muted is not None and not isinstance(muted, bool):
            raise ValueError("muted must be true, false or omitted")
        return {"type": "volume", "volume": controller.set_mute(muted)}

    if kind == "hotkeys.get":
        return {"type": "hotkeys", "hotkeys": store.load_hotkeys()}
    if kind == "hotkeys.save":
        return {"type": "hotkeys", "hotkeys": store.save_hotkeys(command.get("pages"))}

    if kind == "power":
        controller.power(_text(command.get("action"), 16))
        return None

    if kind == "ping":
        return {"type": "pong"}

    raise ValueError(f"unknown command: {str(kind)[:40]}")


# --- websocket handler ----------------------------------------------------


def _reject_constant(name: str):
    raise ValueError(f"{name} is not allowed")


def _decode(raw) -> dict | None:
    if not isinstance(raw, str):
        return None
    try:
        message = json.loads(raw, parse_constant=_reject_constant)
    except ValueError:
        return None
    return message if isinstance(message, dict) else None


async def _refuse(websocket, locked: bool = False) -> None:
    reply = {"type": "auth", "ok": False}
    if locked:
        reply["locked"] = True
    try:
        await websocket.send(json.dumps(reply))
        await websocket.close(4429 if locked else 4401, "too many attempts" if locked else "refused")
    except ConnectionClosed:
        pass


async def _authenticate(websocket, ip: str) -> tuple[str, str | None] | None:
    """Wait for the auth message.

    Returns (device digest, new token or None), or None after refusing the
    connection. A correct PIN pairs the phone and issues it a new token.
    """
    try:
        raw = await asyncio.wait_for(websocket.recv(), AUTH_TIMEOUT)
    except asyncio.TimeoutError:
        await websocket.close(4408, "auth timeout")
        return None
    except ConnectionClosed:
        return None

    message = _decode(raw)
    if message is None or message.get("type") != "auth":
        await websocket.close(4401, "auth required")
        return None

    token = message.get("token")
    if isinstance(token, str) and token:
        if throttle.blocked(ip, pairing=False):
            await _refuse(websocket, locked=True)
            return None
        digest = _token_digest(token)
        if digest in _devices:
            throttle.succeeded(ip)
            _device_seen(digest)
            return digest, None
        throttle.failed(ip)
        print(f"  [!] unknown device token from {ip}")
        await _refuse(websocket)
        return None

    if throttle.blocked(ip, pairing=True):
        await _refuse(websocket, locked=True)
        return None
    pin = message.get("pin")
    if isinstance(pin, (str, int)) and not isinstance(pin, bool):
        if hmac.compare_digest(str(pin).encode("utf-8"), PIN.encode("utf-8")):
            throttle.succeeded(ip)
            token, digest = _pair_device(_device_label(websocket))
            print(f"  [+] paired a new device from {ip}")
            return digest, token
    throttle.failed(ip)
    print(f"  [!] wrong PIN from {ip}")
    await _refuse(websocket)
    return None


async def handler(websocket) -> None:
    try:
        await _serve(websocket)
    except ConnectionClosed:
        pass  # the phone went away mid-reply; nothing left to answer
    finally:
        if websocket in _clients:
            _clients.discard(websocket)
            # A phone that drops mid-drag or mid-Alt+Tab must not leave the PC
            # with the left button or Alt stuck down.
            controller.release_all()


async def _serve(websocket) -> None:
    ip = websocket.remote_address[0] if websocket.remote_address else "?"
    result = await _authenticate(websocket, ip)
    if result is None:
        return
    digest, new_token = result

    _clients.add(websocket)
    print(f"  [+] {ip} connected")
    reply = {
        "type": "auth",
        "ok": True,
        "host": socket.gethostname(),
        "assets": assets_version(),
        "volume": controller.get_volume(),
        "hotkeys": store.load_hotkeys(),
    }
    if new_token:
        reply["token"] = new_token
    await websocket.send(json.dumps(reply))

    async for raw in websocket:
        command = _decode(raw)
        if command is None:
            continue

        if command.get("type") == "device.forget":
            _forget_device(digest)
            print(f"  [-] {ip} unpaired itself")
            await websocket.send(json.dumps({"type": "forgotten"}))
            await websocket.close(1000, "device forgotten")
            return

        try:
            reply = dispatch(command)
        except ValueError as error:
            reply = {"type": "error", "message": str(error)}
        except Exception:
            traceback.print_exc()
            reply = {"type": "error", "message": "command failed"}
        if reply is not None:
            rid = command.get("rid")
            if isinstance(rid, (int, str)) and not isinstance(rid, bool) and len(str(rid)) <= 32:
                reply["rid"] = rid
            await websocket.send(json.dumps(reply))

    print(f"  [-] {ip} disconnected")


async def main() -> None:
    config = store.load_config()
    configure(config)
    warning = pin_warning(PIN)
    bind = config.get("bind") or ["0.0.0.0", "::"]

    print()
    print("  PC Remote is running")
    print(f"  On your phone open:   http://{mdns_host()}:{PORT}")
    print("  ^ add that one to the home screen; it survives an IP change")
    print(f"  Fallback, this IP:    http://{lan_ip()}:{PORT}")
    print(f"  PIN (pairs a phone):  {PIN}")
    print(f"  (change it in {store.CONFIG_PATH}; that also signs out paired phones)")
    print(f"  Paired phones:        {len(_devices)}")
    if warning:
        print(f"  Warning: {warning}")
    print()
    print("  Press Ctrl+C to stop.")
    print()

    # Bind IPv4 *and* IPv6. Bonjour publishes both A and AAAA records for the
    # .local name and iOS generally tries the AAAA first, so an IPv4-only socket
    # makes the hostname URL look dead while the IP one still works.
    async with serve(
        handler,
        bind,
        PORT,
        process_request=process_request,
        server_header=None,
        ping_interval=20,
        ping_timeout=20,
        max_size=256 * 1024,
    ) as server:
        asyncio.create_task(watch_assets())
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n  Stopped.")
