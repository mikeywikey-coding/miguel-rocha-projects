"use strict";

const $ = (id) => document.getElementById(id);
// Pairing with the PIN hands this phone a device token, and only the token is
// kept. A server from before device tokens still gets the PIN, stored as before.
const TOKEN_KEY = "pcremote.token";
const PIN_KEY = "pcremote.pin";

const state = {
  hotkeys: { pages: [] },
  page: 0,
  editing: false,
  draggingVolume: false,
};

// ── connection ────────────────────────────────────────────

let socket = null;
let authed = false;
let retryDelay = 500;
let token = localStorage.getItem(TOKEN_KEY) || "";
let pin = token ? "" : localStorage.getItem(PIN_KEY) || "";
let usedToken = false;
let lockedOut = false;

function hasCredentials() {
  return Boolean(token || pin);
}

function clearCredentials() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PIN_KEY);
  token = "";
  pin = "";
}

function send(message) {
  if (authed && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

// The status bar is gone; connection trouble surfaces as a toast instead.
let wasOffline = false;
function setOnline(online) {
  if (!online && !wasOffline) toast("Reconnecting…");
  if (online && wasOffline) toast("Connected");
  wasOffline = !online;
}

function connect() {
  if (!hasCredentials()) return showPinScreen();
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  )
    return;

  socket = new WebSocket(`ws://${location.host}/ws`);

  socket.onopen = () => {
    usedToken = Boolean(token);
    socket.send(JSON.stringify(usedToken ? { type: "auth", token } : { type: "auth", pin }));
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "auth") {
      if (!message.ok) {
        authed = false;
        if (message.locked) {
          // The lock is on this network address, not on the phone, so a paired
          // phone keeps its token. Stop retrying until the user asks again.
          lockedOut = true;
          if (!usedToken) pin = "";
          showPinScreen("Too many failed attempts. Wait a few minutes, then try again.");
          return;
        }
        clearCredentials();
        showPinScreen(
          usedToken
            ? "This phone was signed out. Enter the PIN to pair it again."
            : "Wrong PIN. Try again.",
        );
        return;
      }
      // The PC restarted with newer app files while we were away — the page
      // we are running is stale, so pick up the new one.
      if (state.assets && message.assets && state.assets !== message.assets) {
        return location.reload();
      }
      state.assets = message.assets;

      authed = true;
      lockedOut = false;
      retryDelay = 500;
      state.host = message.host;
      if (message.token) {
        token = message.token;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(PIN_KEY);
        pin = "";
      } else if (!usedToken) {
        localStorage.setItem(PIN_KEY, pin);
      }
      $("pinScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
      setOnline(true);
      applyHotkeys(message.hotkeys);
      applyVolume(message.volume);
      return;
    }

    if (message.type === "reload") return location.reload();
    if (message.type === "pong") return clearTimeout(livenessTimer);
    if (message.type === "volume") return applyVolume(message.volume);
    if (message.type === "hotkeys") return applyHotkeys(message.hotkeys);
    if (message.type === "error") return toast(message.message);
  };

  socket.onclose = () => {
    const wasAuthed = authed;
    authed = false;
    clearHeldState();
    setOnline(false);
    if (!hasCredentials() || lockedOut) return;
    if (wasAuthed) retryDelay = 500;
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 5000);
  };
}

function showPinScreen(error) {
  authed = false;
  $("app").classList.add("hidden");
  $("pinScreen").classList.remove("hidden");
  const hint = $("pinHint");
  hint.textContent = error || "Enter the PIN shown in the server window.";
  hint.classList.toggle("error", Boolean(error));
  $("pinInput").value = "";
}

$("pinSubmit").addEventListener("click", () => {
  const value = $("pinInput").value.trim();
  if (value) {
    // A typed PIN means pair (again), even if an old token is still stored.
    pin = value;
    token = "";
    localStorage.removeItem(TOKEN_KEY);
  } else if (!token) {
    return;
  }
  lockedOut = false;
  retryDelay = 500;
  connect();
});

$("pinInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("pinSubmit").click();
});

$("forgetPin").addEventListener("click", () => {
  // Revoke this phone's token on the PC too, not just here.
  if (authed && token) send({ type: "device.forget" });
  clearCredentials();
  if (socket) socket.close();
  showPinScreen();
});

// iOS freezes the app when you switch away, and the PC may drop the connection
// while it is frozen. On the way back the socket can still *say* it is open, so
// prove it with a ping rather than trusting readyState — otherwise the first few
// taps after reopening would go nowhere.
let livenessTimer = 0;

function ensureLive() {
  if (!hasCredentials() || lockedOut) return;
  if (!socket || socket.readyState > WebSocket.OPEN) {
    retryDelay = 500;
    connect();
    return;
  }
  if (socket.readyState !== WebSocket.OPEN) return;

  clearTimeout(livenessTimer);
  livenessTimer = setTimeout(() => {
    if (socket) socket.close();
  }, 1200);
  send({ type: "ping" });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) ensureLive();
});
window.addEventListener("pageshow", ensureLive);
window.addEventListener("focus", ensureLive);

// ── toast ─────────────────────────────────────────────────

let toastTimer = 0;
function toast(text) {
  const node = $("toast");
  node.textContent = text;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 1800);
}

// ── tabs ──────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    $("view-" + tab.dataset.view).classList.add("active");
    if (tab.dataset.view === "media") send({ type: "volume.get" });
  });
});

// ── cursor movement ───────────────────────────────────────

let pendingX = 0;
let pendingY = 0;
let moveFrame = 0;
let scrollCarry = 0;
let dragLocked = false; // left button latched down by the Drag button

const SCROLL_PIXELS_PER_NOTCH = 26;
const settings = {
  sensitivity: Number(localStorage.getItem("pcremote.sensitivity")) || 1.6,
  natural: localStorage.getItem("pcremote.natural") !== "0",
};
$("sensitivity").value = settings.sensitivity;
$("naturalScroll").checked = settings.natural;

$("sensitivity").addEventListener("input", (event) => {
  settings.sensitivity = Number(event.target.value);
  localStorage.setItem("pcremote.sensitivity", settings.sensitivity);
});

$("naturalScroll").addEventListener("change", (event) => {
  settings.natural = event.target.checked;
  localStorage.setItem("pcremote.natural", settings.natural ? "1" : "0");
});

function flushMove() {
  moveFrame = 0;
  if (!pendingX && !pendingY) return;
  send({ type: "mouse.move", dx: pendingX, dy: pendingY });
  pendingX = 0;
  pendingY = 0;
}

function queueMove(dx, dy) {
  // Speed-dependent acceleration, so slow drags stay precise and fast
  // flicks cross the screen.
  const speed = Math.hypot(dx, dy);
  const accel = Math.min(1 + speed * 0.055, 3);
  pendingX += dx * settings.sensitivity * accel;
  pendingY += dy * settings.sensitivity * accel;
  if (!moveFrame) moveFrame = requestAnimationFrame(flushMove);
}

function queueScroll(dy) {
  scrollCarry += dy;
  const notches = Math.trunc(scrollCarry / SCROLL_PIXELS_PER_NOTCH);
  if (!notches) return;
  scrollCarry -= notches * SCROLL_PIXELS_PER_NOTCH;
  send({ type: "mouse.scroll", dx: 0, dy: settings.natural ? notches : -notches });
}

/* Touch Events, not Pointer Events.
 *
 * iOS only reliably keeps sending move events for a drag if the gesture calls
 * preventDefault() on a non-passive touchmove — otherwise Safari claims the
 * drag for scrolling or rubber-banding and fires pointercancel partway through,
 * which stops the cursor dead. touches.length also gives finger count directly.
 *
 * Written as a factory because the pad is repeated, compact, on the Hotkeys
 * and Keys tabs.
 */
const LONG_PRESS_MS = 420;
const DRAG_SLOP = 12; // finger wobble that still counts as "held still"

function attachTrackpad(pad) {
  let maxTouches = 0;
  let gestureStart = 0;
  let travelled = 0;
  let lastTapAt = 0;
  let tapDragging = false;
  let anchor = null; // last position of the finger we are tracking
  let pendingDrag = false; // a drag that starts only if the finger actually moves
  let holdTimer = 0;
  let mouseDown = false;

  function beginGesture() {
    gestureStart = performance.now();
    travelled = 0;
    pad.classList.add("pressed", "used");
    // A second touch soon after a tap *may* become a drag, but don't commit yet:
    // a second finger means right-click or scroll, and no movement at all means
    // the user just double-clicked.
    pendingDrag = performance.now() - lastTapAt < 300;
    // Hold one finger still and the button goes down, the way you would press
    // and hold a real mouse. Unlike tap-then-drag this sends no click first,
    // so Windows sees a plain drag instead of a double-click-and-drag.
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      pendingDrag = true;
      commitDrag();
    }, LONG_PRESS_MS);
  }

  function commitDrag() {
    // The Drag button already has the button down; pressing it again here
    // would leave a press with no matching release.
    if (!pendingDrag || tapDragging || dragLocked) return;
    tapDragging = true;
    pad.classList.add("dragging");
    send({ type: "mouse.down", button: "left" });
  }

  function endGesture() {
    clearTimeout(holdTimer);
    pad.classList.remove("pressed", "dragging");
    const duration = performance.now() - gestureStart;
    const wasTap = duration < 250 && travelled < 14;

    if (tapDragging) {
      tapDragging = false;
      send({ type: "mouse.up", button: "left" });
    } else if (wasTap) {
      if (maxTouches === 1) {
        // A left click while the Drag button holds the button would release it.
        if (!dragLocked) {
          send({ type: "mouse.click", button: "left" });
          lastTapAt = performance.now();
        }
      } else if (maxTouches === 2) {
        send({ type: "mouse.click", button: "right" });
      } else {
        send({ type: "mouse.click", button: "middle" });
      }
    }

    anchor = null;
    pendingDrag = false;
    maxTouches = 0;
    scrollCarry = 0;
    flushMove();
  }

  pad.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      if (!anchor) beginGesture();
      maxTouches = Math.max(maxTouches, event.touches.length);
      if (event.touches.length > 1) {
        pendingDrag = false;
        clearTimeout(holdTimer);
      }
      anchor = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    { passive: false },
  );

  pad.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!anchor || !touch) return;

      const dx = touch.clientX - anchor.x;
      const dy = touch.clientY - anchor.y;
      anchor = { x: touch.clientX, y: touch.clientY };
      travelled += Math.abs(dx) + Math.abs(dy);

      if (event.touches.length === 1) {
        // Moving means this is a cursor move, not a press-and-hold.
        if (travelled > DRAG_SLOP && !tapDragging) clearTimeout(holdTimer);
        commitDrag();
        queueMove(dx, dy);
      } else {
        queueScroll(dy);
      }
    },
    { passive: false },
  );

  function onTouchEnd(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
      // A finger lifted but others remain — re-anchor so the cursor doesn't jump.
      anchor = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      return;
    }
    endGesture();
  }

  pad.addEventListener("touchend", onTouchEnd, { passive: false });
  pad.addEventListener("touchcancel", onTouchEnd, { passive: false });

  // Mouse fallback, so the pad also works from a desktop browser.
  pad.addEventListener("mousedown", (event) => {
    mouseDown = true;
    maxTouches = 1;
    beginGesture();
    anchor = { x: event.clientX, y: event.clientY };
  });

  window.addEventListener("mousemove", (event) => {
    if (!mouseDown || !anchor) return;
    const dx = event.clientX - anchor.x;
    const dy = event.clientY - anchor.y;
    anchor = { x: event.clientX, y: event.clientY };
    travelled += Math.abs(dx) + Math.abs(dy);
    if (travelled > DRAG_SLOP && !tapDragging) clearTimeout(holdTimer);
    commitDrag();
    queueMove(dx, dy);
  });

  window.addEventListener("mouseup", () => {
    if (!mouseDown) return;
    mouseDown = false;
    endGesture();
  });
}

document.querySelectorAll(".trackpad").forEach(attachTrackpad);

// Dedicated scroll strip
const strip = $("scrollStrip");
let stripY = null;

strip.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    stripY = event.touches[0].clientY;
  },
  { passive: false },
);

strip.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    if (stripY === null) return;
    queueScroll(event.touches[0].clientY - stripY);
    stripY = event.touches[0].clientY;
  },
  { passive: false },
);

function endStrip(event) {
  if (event) event.preventDefault();
  stripY = null;
  scrollCarry = 0;
}

strip.addEventListener("touchend", endStrip, { passive: false });
strip.addEventListener("touchcancel", endStrip, { passive: false });

/* Drag lock. A phone pad is too small to finish a long drag in one swipe, so
 * latch the left button down and let the drag span as many swipes as it takes. */
function setDragLock(on) {
  if (on === dragLocked) return;
  dragLocked = on;
  $("dragBtn").classList.toggle("held", on);
  send({ type: on ? "mouse.down" : "mouse.up", button: "left" });
  toast(on ? "Left button held — drag, then tap Drag to drop" : "Dropped");
}

$("dragBtn").addEventListener("click", () => setDragLock(!dragLocked));

// click buttons — tap to click, long-press to hold for dragging
let heldButton = null;

document.querySelectorAll(".click-btn[data-click]").forEach((button) => {
  const which = button.dataset.click;
  let holdTimer = 0;
  let didHold = false;

  button.addEventListener("pointerdown", () => {
    didHold = false;
    holdTimer = setTimeout(() => {
      didHold = true;
      heldButton = which;
      button.classList.add("held");
      send({ type: "mouse.down", button: which });
      toast(which + " button held — tap to release");
    }, 500);
  });

  const finish = () => {
    clearTimeout(holdTimer);
    if (didHold) return;
    if (heldButton === which) {
      heldButton = null;
      button.classList.remove("held");
      send({ type: "mouse.up", button: which });
      return;
    }
    send({ type: "mouse.click", button: which });
  };

  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", () => clearTimeout(holdTimer));
});

// Quick shortcuts under the pad
document.querySelectorAll("[data-hotkey]").forEach((button) => {
  button.addEventListener("click", () => sendShortcut(button.dataset.hotkey));
});

// ── keyboard ──────────────────────────────────────────────

const fnGrid = $("fnGrid");
for (let n = 1; n <= 12; n += 1) {
  const button = document.createElement("button");
  button.className = "key";
  button.dataset.key = "f" + n;
  button.textContent = "F" + n;
  fnGrid.appendChild(button);
}

$("view-keys").addEventListener("click", (event) => {
  const key = event.target.closest("[data-key]");
  if (!key) return;
  send({ type: "key.tap", keys: key.dataset.key });
});

/* Text fields mirror what the PC has already received, so edits and
 * autocorrect replay as backspaces rather than duplicated text. One per
 * field — the Touchpad and Keys tabs each have their own. */
document.querySelectorAll(".type-field").forEach((field) => {
  let mirrored = "";

  field.addEventListener("input", () => {
    const value = field.value;
    if (value.startsWith(mirrored)) {
      const added = value.slice(mirrored.length);
      if (added) send({ type: "key.text", text: added });
    } else if (mirrored.startsWith(value)) {
      for (let i = value.length; i < mirrored.length; i += 1) {
        send({ type: "key.tap", keys: "backspace" });
      }
    } else {
      // Autocorrect replaced a word: wipe what we sent and retype it.
      for (let i = 0; i < mirrored.length; i += 1) send({ type: "key.tap", keys: "backspace" });
      if (value) send({ type: "key.text", text: value });
    }
    mirrored = value;
  });

  field.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    send({ type: "key.tap", keys: "enter" });
  });

  // Sending Enter usually means "that message is gone" — start a fresh
  // mirror so the next keystroke isn't diffed against stale text.
  field.addEventListener("keyup", (event) => {
    if (event.key !== "Enter") return;
    field.value = "";
    mirrored = "";
  });
});

// ── hotkeys ───────────────────────────────────────────────

/* A button whose keys read "display 2" moves the focused window to that
 * monitor outright, instead of counting win+shift+arrow presses. */
function sendShortcut(keys) {
  const display = /^display\s+(\d+)$/i.exec(keys);
  if (display) {
    send({ type: "window.display", index: Number(display[1]) });
    return;
  }
  // Tapping alt+tab would flash the switcher and land on the last window.
  // Hold Alt instead so every window stays reachable.
  if (/^alt\s*\+\s*tab$/i.test(keys.trim())) return openSwitcher();
  send({ type: "key.tap", keys });
}

/* ── Alt+Tab switcher ──
 * Windows only draws the switcher while Alt is physically down, so the PC holds
 * Alt for us and this panel drives Tab until a window is chosen. */
let switching = false;
let switchStep = 0; // how far we have moved from the window we started on

function openSwitcher() {
  if (switching) return stepSwitcher(1);
  switching = true;
  switchStep = 0;
  send({ type: "key.down", key: "alt" });
  stepSwitcher(1);
  $("switcher").classList.remove("hidden");
}

function stepSwitcher(direction) {
  switchStep += direction;
  send({ type: "key.tap", keys: direction > 0 ? "tab" : "shift+tab" });
}

function closeSwitcher(cancel) {
  if (!switching) return;
  switching = false;
  // Escape does not dismiss the switcher when the keypress is injected — it
  // commits like any other. So cancel by undoing our own steps: entry 0 is the
  // window we started on. The list wraps, so the count holds however far it ran.
  if (cancel) {
    const back = switchStep > 0 ? "shift+tab" : "tab";
    for (let i = 0; i < Math.abs(switchStep); i += 1) send({ type: "key.tap", keys: back });
  }
  switchStep = 0;
  send({ type: "key.up", key: "alt" });
  $("switcher").classList.add("hidden");
}

$("switchNext").addEventListener("click", () => stepSwitcher(1));
$("switchPrev").addEventListener("click", () => stepSwitcher(-1));
$("switchPick").addEventListener("click", () => closeSwitcher(false));
$("switchCancel").addEventListener("click", () => closeSwitcher(true));

$("switcher").addEventListener("click", (event) => {
  if (event.target === $("switcher")) closeSwitcher(false);
});

// Putting the phone down must not leave Alt held on the PC — back out quietly
// rather than switching to whatever happened to be highlighted.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) closeSwitcher(true);
});

/* The PC releases every held key and button when a phone drops off, so the app
 * has to forget what it thought it was holding. */
function clearHeldState() {
  dragLocked = false;
  heldButton = null;
  switching = false;
  switchStep = 0;
  $("switcher").classList.add("hidden");
  document.querySelectorAll(".click-btn.held").forEach((button) => button.classList.remove("held"));
}

function applyHotkeys(hotkeys) {
  if (!hotkeys || !Array.isArray(hotkeys.pages)) return;
  state.hotkeys = hotkeys;
  state.page = Math.min(state.page, Math.max(0, hotkeys.pages.length - 1));
  renderHotkeys();
}

function saveHotkeys() {
  send({ type: "hotkeys.save", pages: state.hotkeys.pages });
  renderHotkeys();
}

function renderHotkeys() {
  const tabs = $("pageTabs");
  const grid = $("hotkeyGrid");
  tabs.innerHTML = "";
  grid.innerHTML = "";

  state.hotkeys.pages.forEach((page, index) => {
    const tab = document.createElement("button");
    tab.className = "page-tab" + (index === state.page ? " active" : "");
    tab.textContent = page.name;
    tab.addEventListener("click", () => {
      if (state.editing && index === state.page) return openPageSheet(page);
      state.page = index;
      renderHotkeys();
    });
    tabs.appendChild(tab);
  });

  // New pages are added from Edit mode, so the tab row stays a clean set of
  // equal-width pills that all fit on screen.
  if (state.editing) {
    const addPage = document.createElement("button");
    addPage.className = "page-tab";
    addPage.textContent = "+";
    addPage.style.flex = "0 0 auto";
    addPage.style.padding = "7px 12px";
    addPage.style.borderStyle = "dashed";
    addPage.style.color = "var(--accent)";
    addPage.addEventListener("click", () => openPageSheet(null));
    tabs.appendChild(addPage);
  }

  grid.classList.toggle("editing", state.editing);
  const page = state.hotkeys.pages[state.page];
  if (!page) return;

  page.buttons.forEach((entry) => {
    const button = document.createElement("button");
    button.className = "hotkey-btn";
    button.innerHTML = "<span></span><small></small>";
    button.firstChild.textContent = entry.label;
    button.lastChild.textContent = entry.keys;

    // Read back on drop to turn DOM order into button order.
    button.entry = entry;

    let holdTimer = 0;
    let didHold = false;
    button.addEventListener("pointerdown", (event) => {
      didHold = false;
      const { pointerId, clientX, clientY } = event;
      holdTimer = setTimeout(() => {
        didHold = true;
        // In edit mode a hold lifts the button to reorder it. Outside edit mode
        // the hold is still the shortcut straight to the edit sheet.
        if (state.editing) startReorder(button, pointerId, clientX, clientY);
        else openButtonSheet(page, entry);
      }, 550);
    });
    button.addEventListener("pointerup", () => {
      clearTimeout(holdTimer);
      if (didHold) return;
      if (state.editing) return openButtonSheet(page, entry);
      sendShortcut(entry.keys);
    });
    button.addEventListener("pointercancel", () => clearTimeout(holdTimer));

    grid.appendChild(button);
  });

  if (state.editing) {
    const add = document.createElement("button");
    add.className = "hotkey-btn add";
    add.textContent = "+";
    add.addEventListener("click", () => openButtonSheet(page, null));
    grid.appendChild(add);
  }
}

/* ── reordering ──
 * Holding a button in edit mode lifts it out of the grid to follow the finger.
 * The grid reflows live as it passes over other buttons, so the new order is
 * simply read back off the DOM when the finger lifts. */
let reordering = null;

const orderedButtons = () => [...$("hotkeyGrid").querySelectorAll(".hotkey-btn:not(.add)")];

function startReorder(element, pointerId, x, y) {
  if (reordering) return;
  const rect = element.getBoundingClientRect();
  reordering = { element, pointerId, grabX: x - rect.left, grabY: y - rect.top };

  element.classList.add("dragging");
  $("hotkeyGrid").classList.add("reordering");
  // Keeps the moves coming even once the finger leaves the button itself.
  try {
    element.setPointerCapture(pointerId);
  } catch (error) {
    /* not fatal */
  }
  dragTo(x, y);
}

function dragTo(x, y) {
  const { element, grabX, grabY } = reordering;
  // Re-measure the slot the grid is currently holding for it: every reflow
  // moves that slot, and the offset is relative to it.
  element.style.transform = "none";
  const base = element.getBoundingClientRect();
  element.style.transform = `translate(${x - grabX - base.left}px, ${y - grabY - base.top}px)`;
}

function dragOver(x, y) {
  const { element } = reordering;
  const grid = $("hotkeyGrid");

  // The lifted button sits under the finger, so it has to be seen through.
  element.style.pointerEvents = "none";
  const under = document.elementFromPoint(x, y);
  element.style.pointerEvents = "";

  const target = under && under.closest(".hotkey-btn");
  if (!target || target === element || target.classList.contains("add")) return;
  if (target.parentElement !== grid) return;

  const before = element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING;
  grid.insertBefore(element, before ? target : target.nextSibling);
}

function endReorder(save) {
  const { element, pointerId } = reordering;
  try {
    element.releasePointerCapture(pointerId);
  } catch (error) {
    /* already gone */
  }
  element.style.transform = "";
  element.style.pointerEvents = "";
  element.classList.remove("dragging");
  $("hotkeyGrid").classList.remove("reordering");

  const page = state.hotkeys.pages[state.page];
  const order = orderedButtons().map((button) => button.entry);
  reordering = null;

  if (save && page && order.some((entry, index) => entry !== page.buttons[index])) {
    page.buttons = order;
    saveHotkeys();
  } else {
    // Nothing moved — re-render to drop the lifted button back into its slot.
    renderHotkeys();
  }
}

const forDrag = (handler) => (event) => {
  if (!reordering || event.pointerId !== reordering.pointerId) return;
  handler(event);
};

document.addEventListener(
  "pointermove",
  forDrag((event) => {
    event.preventDefault();
    dragTo(event.clientX, event.clientY);
    dragOver(event.clientX, event.clientY);
  }),
  { passive: false },
);

document.addEventListener(
  "pointerup",
  forDrag(() => endReorder(true)),
);
document.addEventListener(
  "pointercancel",
  forDrag(() => endReorder(false)),
);

$("editToggle").addEventListener("click", () => {
  // Leaving edit mode mid-drag would strand the lifted button.
  if (reordering) endReorder(true);
  state.editing = !state.editing;
  $("editToggle").classList.toggle("on", state.editing);
  $("editToggle").textContent = state.editing ? "Done" : "Edit";
  renderHotkeys();
});

// ── edit sheet ────────────────────────────────────────────

const NAMED_KEYS = [
  "enter",
  "tab",
  "escape",
  "backspace",
  "delete",
  "space",
  "up",
  "down",
  "left",
  "right",
  "home",
  "end",
  "pageup",
  "pagedown",
  "insert",
  "printscreen",
  "menu",
  "capslock",
  "pause",
  "play",
  "next",
  "prev",
  "volup",
  "voldown",
  "mute",
];
for (let n = 1; n <= 12; n += 1) NAMED_KEYS.push("f" + n);
$("keyOptions").innerHTML = NAMED_KEYS.map((k) => `<option value="${k}">`).join("");

const sheetMods = { ctrl: false, shift: false, alt: false, win: false };
let sheetContext = null;

function renderSheetMods() {
  $("sheetMods")
    .querySelectorAll(".mod")
    .forEach((button) => {
      button.classList.toggle("on", sheetMods[button.dataset.mod]);
    });
  const active = Object.keys(sheetMods).filter((name) => sheetMods[name]);
  const key = $("sheetKey").value.trim();
  $("sheetPreview").textContent = key ? [...active, key].join("+") : "—";
}

$("sheetMods")
  .querySelectorAll(".mod")
  .forEach((button) => {
    button.addEventListener("click", () => {
      sheetMods[button.dataset.mod] = !sheetMods[button.dataset.mod];
      renderSheetMods();
    });
  });

$("sheetKey").addEventListener("input", renderSheetMods);

function openButtonSheet(page, entry) {
  sheetContext = { mode: "button", page, entry };
  $("sheetTitle").textContent = entry ? "Edit button" : "New button";
  $("sheetLabel").value = entry ? entry.label : "";
  $("sheetKeysWrap").classList.remove("hidden");
  $("sheetDelete").classList.toggle("hidden", !entry);

  Object.keys(sheetMods).forEach((name) => {
    sheetMods[name] = false;
  });
  let key = "";
  if (entry) {
    const parts = entry.keys.split("+").filter(Boolean);
    key = parts.pop() || "";
    parts.forEach((part) => {
      const name = part.toLowerCase();
      if (name in sheetMods) sheetMods[name] = true;
    });
  }
  $("sheetKey").value = key;
  renderSheetMods();
  $("sheet").classList.remove("hidden");
}

function openPageSheet(page) {
  sheetContext = { mode: "page", page };
  $("sheetTitle").textContent = page ? "Edit page" : "New page";
  $("sheetLabel").value = page ? page.name : "";
  $("sheetKeysWrap").classList.add("hidden");
  $("sheetDelete").classList.toggle("hidden", !page);
  $("sheet").classList.remove("hidden");
}

function closeSheet() {
  $("sheet").classList.add("hidden");
  sheetContext = null;
}

$("sheetCancel").addEventListener("click", closeSheet);

$("sheet").addEventListener("click", (event) => {
  if (event.target === $("sheet")) closeSheet();
});

$("sheetSave").addEventListener("click", () => {
  if (!sheetContext) return;
  const label = $("sheetLabel").value.trim();
  if (!label) return toast("Give it a name");

  if (sheetContext.mode === "page") {
    if (sheetContext.page) {
      sheetContext.page.name = label;
    } else {
      state.hotkeys.pages.push({ id: "p" + Date.now().toString(36), name: label, buttons: [] });
      state.page = state.hotkeys.pages.length - 1;
    }
  } else {
    const key = $("sheetKey").value.trim();
    if (!key) return toast("Pick a key");
    const active = Object.keys(sheetMods).filter((name) => sheetMods[name]);
    const keys = [...active, key].join("+");
    if (sheetContext.entry) {
      sheetContext.entry.label = label;
      sheetContext.entry.keys = keys;
    } else {
      sheetContext.page.buttons.push({ id: "b" + Date.now().toString(36), label, keys });
    }
  }

  closeSheet();
  saveHotkeys();
});

$("sheetDelete").addEventListener("click", () => {
  if (!sheetContext) return;
  if (sheetContext.mode === "page") {
    const index = state.hotkeys.pages.indexOf(sheetContext.page);
    if (index >= 0) state.hotkeys.pages.splice(index, 1);
    state.page = Math.max(0, Math.min(state.page, state.hotkeys.pages.length - 1));
  } else {
    const list = sheetContext.page.buttons;
    const index = list.indexOf(sheetContext.entry);
    if (index >= 0) list.splice(index, 1);
  }
  closeSheet();
  saveHotkeys();
});

// ── media ─────────────────────────────────────────────────

const MEDIA_KEYS = { play: "playpause", next: "next", prev: "prev" };

document.querySelectorAll("[data-media]").forEach((button) => {
  button.addEventListener("click", () =>
    send({ type: "key.tap", keys: MEDIA_KEYS[button.dataset.media] }),
  );
});

function applyVolume(volume) {
  if (!volume) return;
  state.volume = volume;
  $("muteBtn").classList.toggle("muted", volume.muted);
  $("volLabel").textContent = volume.available ? volume.level + "%" : "use ± buttons";
  if (!state.draggingVolume) $("volSlider").value = volume.level;
}

let volumeThrottle = 0;
const slider = $("volSlider");

slider.addEventListener("pointerdown", () => {
  state.draggingVolume = true;
});

slider.addEventListener("input", () => {
  $("volLabel").textContent = slider.value + "%";
  const now = performance.now();
  if (now - volumeThrottle < 60) return;
  volumeThrottle = now;
  send({ type: "volume.set", level: Number(slider.value) });
});

const releaseVolume = () => {
  if (!state.draggingVolume) return;
  state.draggingVolume = false;
  send({ type: "volume.set", level: Number(slider.value) });
};

slider.addEventListener("pointerup", releaseVolume);
slider.addEventListener("pointercancel", releaseVolume);
slider.addEventListener("change", releaseVolume);

$("muteBtn").addEventListener("click", () => send({ type: "volume.mute" }));

document.querySelectorAll("[data-volstep]").forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.dataset.volstep);
    if (!state.volume || !state.volume.available) {
      return send({ type: "key.tap", keys: step > 0 ? "volup" : "voldown" });
    }
    const level = Math.max(0, Math.min(100, state.volume.level + step));
    send({ type: "volume.set", level });
  });
});

// power — destructive actions need a second tap
const NEEDS_CONFIRM = new Set(["shutdown", "restart", "signout"]);
let confirming = null;

document.querySelectorAll("[data-power]").forEach((button) => {
  const action = button.dataset.power;
  const original = button.textContent;

  button.addEventListener("click", () => {
    if (NEEDS_CONFIRM.has(action) && confirming !== action) {
      if (confirming) resetConfirm();
      confirming = action;
      button.textContent = "Tap again";
      button.classList.add("confirm");
      confirmTimer = setTimeout(resetConfirm, 3000);
      return;
    }
    resetConfirm();
    send({ type: "power", action });
    toast(original + " sent");
  });

  button.dataset.original = original;
});

let confirmTimer = 0;
function resetConfirm() {
  clearTimeout(confirmTimer);
  confirming = null;
  document.querySelectorAll("[data-power]").forEach((button) => {
    button.classList.remove("confirm");
    if (button.dataset.original) button.textContent = button.dataset.original;
  });
}

// ── misc iOS hardening ────────────────────────────────────

document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("contextmenu", (event) => event.preventDefault());

connect();
