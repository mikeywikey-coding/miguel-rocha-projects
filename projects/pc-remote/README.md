[Back to the portfolio](../../README.md)

# PC Remote

Control a Windows PC from an iPhone: trackpad, live keyboard, editable hotkey
pages, media, system volume and power. The PC serves a small web app over the
local network and the phone runs it from the home screen, so there is no cloud
service, no account and no App Store.

- **Python server** (`websockets`) serving the app over HTTP and taking commands
  over a WebSocket on the same port.
- **Windows input** through `pynput`, system volume through `pycaw`.
- **Phone app** in plain HTML, CSS and JavaScript: installable to the home
  screen, follows Light/Dark mode, reconnects on its own and picks up app
  updates without a reinstall.
- **Secured for a shared network:** PIN pairing with per-device tokens,
  host and origin checks, rate limiting and input validation. See
  [Security](#security).
- **Tested** with a pytest suite that stubs out the input layer, so it never
  moves the mouse or types.

## Quick start

You need Windows 10 or 11 and Python 3.10 or newer.

```powershell
pip install -r requirements.txt
python server.py        # or double-click start.bat
```

The first run creates `config.json` with a random 8-digit PIN and prints where
to connect:

```
  PC Remote is running
  On your phone open:   http://mypc.local:8765
  ^ add that one to the home screen; it survives an IP change
  Fallback, this IP:    http://192.168.1.20:8765
  PIN (pairs a phone):  58203914
```

Allow the port through the firewall (see [Firewall](#firewall)), open the
address on the phone and enter the PIN. That pairs the phone; it signs in on
its own from then on.

## Putting it on the iPhone home screen

1. Put the phone and the PC on the same network.
2. Open the **`.local` address** (`http://<pc-name>.local:8765`) in **Safari**.
   Only Safari can add home-screen apps. Use the name, **not the IP**; the next
   section explains why.
3. Tap Share, then **Add to Home Screen**.
4. Launch it from the icon. It opens full screen with no browser bars.
5. Enter the PIN once to pair.

### Add the icon from the `.local` name, not an IP

iOS bakes the origin into a home-screen icon when you add it, and both
`start_url` in the manifest and the WebSocket URL in `app.js` are relative to
that origin. The icon stays pinned to whatever host you were on.

An icon pinned to an IP stops working the next time the PC's address changes:
a new DHCP lease, a switch between Ethernet and Wi-Fi, or tethering to the
phone's hotspot. It then opens to a blank screen while the server is perfectly
healthy. The `.local` name is published over mDNS and follows the PC across
addresses. (The setup this was built on publishes it with Apple's Bonjour
service.)

The server listens on **IPv4 and IPv6**. mDNS publishes an AAAA record next to
the A record and iOS usually tries the AAAA first, so an IPv4-only socket makes
the name look dead while the IP still works.

## Using it

**Touchpad**
- Drag to move the cursor, tap to left-click.
- Two-finger tap = right-click, three-finger tap = middle-click.
- Two-finger drag, or the strip on the right, scrolls.
- **Click and drag:** press and hold one finger still for about half a second.
  The pad tints and the left button goes down; drag, then lift to drop.
  Tap-then-tap-and-hold also works, but Windows reads the leading tap as the
  first half of a double-click, so prefer press-and-hold on files and title bars.
- For a drag too long for one swipe, tap *Drag* to latch the left button down,
  swipe as often as you need, then tap *Drag* again to drop. Long-pressing
  *Middle* or *Right* latches those buttons the same way.
- The text field above the pad types on the PC as you type.
- *Speed* sets pointer sensitivity; *Natural scroll* flips the scroll direction.

**Alt+Tab**
- The Alt+Tab button (on the pad's favourites row and in Hotkeys) holds Alt
  down on the PC, so the window switcher stays on screen. Step through it with
  *Prev* / *Next*, then *Select window*, or *Cancel* to go back.
- Alt is released when you choose, when the app goes to the background, and by
  the PC itself if the phone drops off, so it can never be left stuck down.

**Keys**
- Characters typed in the text field land on the PC as you type; deleting in
  the field sends backspaces.
- Esc, Tab, Enter, Backspace, Delete, Win, Space, PrtScn, the navigation
  cluster, arrows and F1 to F12.

**Hotkeys**
- Tap a button to fire it.
- *Edit*, then tap a button to change it or `+` to add one. Long-pressing any
  button edits it without entering edit mode.
- In edit mode, press and hold a button to lift it out of the grid and drag it
  to a new spot; the new order saves when you let go.
- In edit mode, tap `+` in the page strip to add a page, or tap the current
  page to rename or delete it.
- Everything is stored in `hotkeys.json`, which you can also edit by hand.

**Media**
- Transport controls, a system volume slider, mute, and power actions (lock,
  sleep, sign out, restart, shut down). Sign out, restart and shut down need a
  second tap.
- *Disconnect remote* at the bottom of Power unpairs the phone.

## Hotkey syntax

`modifier+modifier+key`, for example `ctrl+shift+s`, `win+d`, `alt+f4`, `f11`,
`ctrl+=`.

- Modifiers: `ctrl`, `shift`, `alt`, `win`
- Named keys: `enter` `tab` `escape` `backspace` `delete` `space` `up` `down`
  `left` `right` `home` `end` `pageup` `pagedown` `insert` `printscreen`
  `menu` `capslock` `numlock` `scrolllock` `pause` `f1`–`f20`
- Media keys: `playpause` `next` `prev` `volup` `voldown` `mute`
- Any other single character is typed as itself (`c`, `7`, `/`, `+`).

Specs are limited to 64 characters, and unknown names are rejected with an
error instead of being guessed at.

## Configuration

`config.json` is created on the first run and is ignored by git:

```json
{ "pin": "58203914", "port": 8765 }
```

| Key | Default | Meaning |
| --- | --- | --- |
| `pin` | random, 8 digits | Pairs new phones. At least 6 characters. Changing it signs out every paired phone. |
| `port` | `8765` | HTTP and WebSocket port. Update the firewall rule to match. |
| `allowed_hosts` | none | Extra host names to answer to, such as a Tailscale MagicDNS name. The PC's own names and addresses are always allowed. |
| `bind` | `["0.0.0.0", "::"]` | Addresses to listen on. List a single address to listen on one network only. |

Restart the server after editing it.

## Firewall

Allow the port from your own subnet only (admin PowerShell):

```powershell
New-NetFirewallRule -DisplayName "PC Remote (8765)" -Direction Inbound `
  -Action Allow -Protocol TCP -LocalPort 8765 -Profile Any -RemoteAddress LocalSubnet
```

If the phone cannot resolve the `.local` name and you use Bonjour, note that
its own firewall rules cover the *Public* profile only. This rule allows mDNS
on any profile, again from the local subnet only:

```powershell
New-NetFirewallRule -DisplayName "PC Remote mDNS (5353)" -Direction Inbound `
  -Action Allow -Protocol UDP -LocalPort 5353 -Profile Any -RemoteAddress LocalSubnet `
  -Program "C:\Program Files\Bonjour\mDNSResponder.exe"
```

## Starting with Windows

A scheduled task runs the server at logon with `pythonw.exe`, so there is no
console window. Run this from the project folder:

```powershell
$action = New-ScheduledTaskAction -Execute (Get-Command pythonw.exe).Source `
  -Argument "server.py" -WorkingDirectory $PWD
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask "PC Remote" -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings
```

```powershell
Start-ScheduledTask "PC Remote"                        # start it now
Stop-ScheduledTask "PC Remote"                         # stop it
Unregister-ScheduledTask "PC Remote" -Confirm:$false   # remove it
```

To watch the log instead, stop the task and run `start.bat`.

### Elevated or not

Windows (UIPI) stops a normal process from sending input to an elevated
window, such as Task Manager or an admin terminal. With `-RunLevel Limited`
the remote does nothing while one of those has focus, until you click a normal
window. Registering the task with `-RunLevel Highest` (from an admin
PowerShell) lifts that, but then a paired phone can type into admin windows
too. Keep `Limited` unless you need that.

## Updating the app

Edit anything under `web/` and the phone picks it up by itself:

- Every response is sent `Cache-Control: no-store`, so iOS never keeps a stale copy.
- The server watches `web/` and pushes a reload to connected phones when a file changes.
- A phone that was asleep compares an asset stamp when it reconnects and
  reloads if its copy is old.

The exception is the **home-screen icon and name**, which iOS captures when the
icon is added; changing `icon-180.png` means removing and re-adding the icon.
Changes to the Python files need a server restart.

## Security

A paired phone can type and click on the PC, so the design goal is that
nothing else can. These are the threats the server handles, and how:

| Threat | Protection |
| --- | --- |
| Another device on the network guesses the PIN | Random 8-digit PIN by default (6 characters minimum, obvious ones flagged). Ten wrong attempts from one address lock it out for up to five minutes; IPv6 addresses count per /64, so rotating addresses doesn't help. After 30 failures in five minutes from all addresses combined, pairing pauses; already-paired phones keep working. |
| A connection holds a slot open without signing in | Closed after 10 seconds. |
| A web page, opened in any browser on the network, connects to the WebSocket (cross-site WebSocket hijacking) | The handshake must come from the app's own origin. |
| A web page points its own domain at the PC (DNS rebinding) | Requests whose `Host` isn't one of the PC's names or addresses get a 403. |
| A copy of the server's files leaks | The PIN pairs a phone once. After that the phone signs in with a random 256-bit token, and `devices.json` keeps only SHA-256 hashes of the tokens. |
| A phone is lost | *Disconnect remote* unpairs a phone from the phone. Changing the PIN, or deleting `devices.json`, signs out every phone. |
| Malformed or hostile commands | Every field is type-checked and clamped (pointer movement, scroll, click count, 500 characters of text per message, volume). Unknown commands and keys are refused, power actions come from a fixed list, and a message over 256 KB closes the connection. Unexpected errors reply with a generic message, never internal details. |
| Framing, sniffing, or reading files outside the app | Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and `no-referrer` on every page. Static files are served only from `web/`. No `Server` banner. |

**Limits**
- **Traffic is plain HTTP.** Anyone who can capture traffic on the network can
  read the PIN during pairing, the device token, and what you type. Use it on a
  network you trust, not public Wi-Fi.
- **Never forward the port to the internet.** To use it away from home, put
  both devices on [Tailscale](https://tailscale.com); its WireGuard tunnel
  encrypts the traffic. Connect to the PC's Tailscale address, or add its
  MagicDNS name to `allowed_hosts`.
- Keep the firewall rule scoped to `LocalSubnet`.
- Software already running as your Windows user can read `config.json`. That
  is outside what the server can protect against.

## Tests

```powershell
pip install -r requirements-dev.txt
python -m pytest
```

The suite covers hotkey parsing, config and device storage, host and origin
checks, pairing and sign-out, rate limits and command validation. The Windows
input layer is replaced by a stub, so the tests never move the mouse or type.

## Files

| File | Purpose |
| --- | --- |
| `server.py` | HTTP and WebSocket server: host and origin checks, pairing, rate limits, command validation |
| `controller.py` | Windows input: mouse, keyboard, volume, power |
| `keys.py` | Hotkey parsing, with no input-library dependency |
| `store.py` | `config.json`, `hotkeys.json` and `devices.json` |
| `web/` | The phone app (`index.html`, `app.js`, `style.css`, manifest, icons) |
| `tests/` | pytest suite |
| `start.bat` | Runs the server in a console window |

## About this copy

A snapshot of the working repository, taken on 30 September 2026 after the security rework. Local configuration, paired devices, hotkey layouts, the startup task and personal network details are not included.
