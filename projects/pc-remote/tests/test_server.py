import json

import pytest
from conftest import PIN, FakeSocket, request, run


def pair(server, ip="192.168.1.20"):
    """Pair a phone with the PIN and return the device token it was given."""
    socket = run(server, FakeSocket([{"type": "auth", "pin": PIN}], ip=ip))
    assert socket.sent[0]["ok"] is True
    return socket.sent[0]["token"]


# --- who may talk to the server -------------------------------------------


def test_requests_for_other_host_names_are_refused(server):
    # DNS rebinding: a hostile page points its own domain at this PC.
    assert (
        server.process_request(None, request(host="evil.example:8765")).status_code
        == 403
    )
    assert server.process_request(None, request(host=None)).status_code == 403
    for host in (
        "mypc.local:8765",
        "192.168.1.10:8765",
        "[::1]:8765",
        "localhost:8765",
    ):
        assert server.process_request(None, request(host=host)).status_code == 200


def test_other_web_pages_cannot_open_the_socket(server):
    refused = [
        "http://evil.example",
        "http://mypc.local:9999",  # same name, different origin
        "null",  # sandboxed frames and file:// pages
        "ftp://mypc.local:8765",
    ]
    for origin in refused:
        response = server.process_request(None, request("/ws", origin=origin))
        assert response.status_code == 403, origin
    assert (
        server.process_request(None, request("/ws", origin="http://mypc.local:8765"))
        is None
    )
    assert server.process_request(None, request("/ws")) is None  # not a browser


def test_static_files_cannot_escape_the_web_folder(server):
    for path in ("/../server.py", "/..%2fserver.py", "/nope.js", "/../config.json"):
        assert server.process_request(None, request(path)).status_code == 404


def test_pages_are_sent_with_security_headers(server):
    headers = server.process_request(None, request("/")).headers
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert headers["Cache-Control"] == "no-store"


# --- authentication -------------------------------------------------------


def test_commands_before_auth_close_the_socket(server):
    socket = run(server, FakeSocket([{"type": "key.tap", "keys": "ctrl+c"}]))
    assert socket.closed[0] == 4401
    assert server.controller.calls == []


def test_a_silent_connection_is_closed(server, monkeypatch):
    monkeypatch.setattr(server, "AUTH_TIMEOUT", 0.05)
    socket = run(server, FakeSocket([], silent=True))
    assert socket.closed[0] == 4408
    assert server.controller.calls == []


def test_the_pin_pairs_a_phone_and_its_token_signs_it_in_later(server, isolated_store):
    token = pair(server)
    stored = json.loads(isolated_store.DEVICES_PATH.read_text())
    assert token not in json.dumps(stored)  # only a hash of the token is kept
    assert list(stored["devices"].values())[0]["label"] == "iPhone"

    socket = run(
        server,
        FakeSocket(
            [{"type": "auth", "token": token}, {"type": "key.tap", "keys": "ctrl+c"}]
        ),
    )
    assert socket.sent[0]["ok"] is True and "token" not in socket.sent[0]
    assert ("send_hotkey", ("ctrl+c",)) in server.controller.calls
    # Dropping the connection releases anything the phone was holding.
    assert server.controller.calls[-1] == ("release_all", ())


def test_unknown_tokens_and_wrong_pins_are_refused(server):
    for credentials in ({"token": "made-up"}, {"pin": "00000000"}, {"pin": True}, {}):
        socket = run(server, FakeSocket([{"type": "auth", **credentials}]))
        assert socket.sent == [{"type": "auth", "ok": False}]
        assert socket.closed[0] == 4401
    assert server.controller.calls == []


def test_a_phone_can_unpair_itself(server):
    token = pair(server)
    socket = run(
        server,
        FakeSocket([{"type": "auth", "token": token}, {"type": "device.forget"}]),
    )
    assert socket.sent[-1] == {"type": "forgotten"}
    again = run(server, FakeSocket([{"type": "auth", "token": token}]))
    assert again.sent == [{"type": "auth", "ok": False}]


def test_changing_the_pin_signs_out_paired_phones(server):
    token = pair(server)
    server.configure({"pin": "59120374", "port": 8765})
    socket = run(server, FakeSocket([{"type": "auth", "token": token}]))
    assert socket.sent == [{"type": "auth", "ok": False}]


def test_short_and_guessable_pins(server):
    with pytest.raises(SystemExit):
        server.pin_warning("12345")
    assert server.pin_warning("123456")
    assert server.pin_warning("99999999")
    assert server.pin_warning(PIN) is None


# --- failed-attempt limits ------------------------------------------------


def wrong_pin(server, ip):
    return run(server, FakeSocket([{"type": "auth", "pin": "x" + PIN}], ip=ip))


def test_repeated_wrong_pins_lock_the_address_out(server):
    for _ in range(server.MAX_FAILED_ATTEMPTS):
        assert wrong_pin(server, "192.168.1.30").sent == [{"type": "auth", "ok": False}]
    locked = run(server, FakeSocket([{"type": "auth", "pin": PIN}], ip="192.168.1.30"))
    assert locked.sent == [{"type": "auth", "ok": False, "locked": True}]
    assert locked.closed[0] == 4429
    pair(server, ip="192.168.1.31")  # other addresses are unaffected


def test_ipv6_addresses_in_one_64_share_a_limit(server):
    for n in range(server.MAX_FAILED_ATTEMPTS):
        wrong_pin(server, f"2001:db8::{n + 1:x}")
    fresh_address = run(
        server, FakeSocket([{"type": "auth", "pin": PIN}], ip="2001:db8::ffff")
    )
    assert fresh_address.sent[0].get("locked") is True
    pair(server, ip="2001:db8:0:1::1")  # the neighbouring /64 is a different network


def test_the_global_limit_stops_pin_guessing_but_not_paired_phones(server):
    token = pair(server, ip="192.168.1.5")
    for n in range(server.MAX_GLOBAL_FAILURES):
        wrong_pin(server, f"10.0.{n}.1")  # one attempt each from many addresses
    guess = run(server, FakeSocket([{"type": "auth", "pin": PIN}], ip="10.9.9.9"))
    assert guess.sent[0].get("locked") is True
    phone = run(
        server, FakeSocket([{"type": "auth", "token": token}], ip="192.168.1.6")
    )
    assert phone.sent[0]["ok"] is True


def test_lockouts_expire(server):
    now = [1000.0]
    throttle = server.Throttle(
        per_address=2, overall=5, window=60, clock=lambda: now[0]
    )
    throttle.failed("192.168.1.40")
    throttle.failed("192.168.1.40")
    assert throttle.blocked("192.168.1.40", pairing=True)
    now[0] += 61
    assert not throttle.blocked("192.168.1.40", pairing=True)


# --- commands -------------------------------------------------------------


def session(server, *commands):
    return run(server, FakeSocket([{"type": "auth", "pin": PIN}, *commands]))


def test_numbers_are_clamped_and_must_be_finite(server):
    socket = session(
        server,
        {"type": "mouse.move", "dx": 10**9, "dy": -5},
        {"type": "mouse.click", "button": "left", "count": 10**6},
        {"type": "mouse.scroll", "dy": -1e9},
        '{"type": "mouse.move", "dx": NaN, "dy": 0}',  # not valid JSON for us: ignored
        {"type": "volume.set", "level": "loud", "rid": 1},
    )
    calls = server.controller.calls
    assert ("move_mouse", (2000.0, -5.0)) in calls
    assert ("click", ("left", 3)) in calls
    assert ("scroll", (0.0, -100.0)) in calls
    assert sum(1 for name, _ in calls if name == "move_mouse") == 1
    assert socket.sent[-1] == {
        "type": "error",
        "message": "expected a number",
        "rid": 1,
    }


def test_bad_commands_become_error_replies(server):
    socket = session(
        server,
        {"type": "mouse.down", "button": "fourth", "rid": 1},
        {"type": "key.text", "text": "x" * (server.MAX_TEXT_LENGTH + 1), "rid": 2},
        {"type": "format.disk", "rid": 3},
        {"type": "volume.mute", "muted": "yes", "rid": 4},
    )
    assert [reply["message"] for reply in socket.sent[1:]] == [
        "unknown mouse button",
        "text is too long",
        "unknown command: format.disk",
        "muted must be true, false or omitted",
    ]
    assert not any(
        name in ("button_down", "type_text") for name, _ in server.controller.calls
    )


def test_unexpected_failures_do_not_leak_details(server, monkeypatch):
    def broken(spec):
        raise OSError(r"C:\secret\path is on fire")

    monkeypatch.setattr(server.controller, "send_hotkey", broken)
    socket = session(server, {"type": "key.tap", "keys": "ctrl+c", "rid": 9})
    assert socket.sent[-1] == {"type": "error", "message": "command failed", "rid": 9}


def test_ping_and_request_ids(server):
    socket = session(
        server,
        {"type": "ping", "rid": 7},
        {"type": "ping", "rid": {"not": "echoed"}},
    )
    assert socket.sent[1] == {"type": "pong", "rid": 7}
    assert socket.sent[2] == {"type": "pong"}
