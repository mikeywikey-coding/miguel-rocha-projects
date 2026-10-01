/**
 * TravAlarm: remote fetchers
 */

// Content scripts share one global scope; see manifest.json for load order.
/* global
   acknowledgedSirens, api, cleanText, currentAlarms, fetchState, getActiveVillageName,
   globalVillageMap, isFetchingRally:writable, jitterMs, lastRallyFetchTime:writable,
   parseSmartDuration, scan, serverTag, suppressedAttacks
*/
/* exported
   STORAGE_THRESHOLD, checkResourceVillageAttacks, fetchCelebrationsData, fetchHeroData,
   fetchProductionData, fetchTrainingData, fetchWarehouseData, scanForSidebarAttacksAndFetch
*/
let _noAttackSince = 0; // timestamp when the current no-attack streak began (0 = attack present)
const ATTACK_CLEANUP_GRACE_MS = 60000; // require 60s of confirmed no-attacks before auto-clearing

// ==========================================
// VILLAGE LOCK — serializes restore across all newdid= fetchers.
// Travian treats any authenticated request containing `newdid=VID` as a
// server-side village switch (last one wins). Without coordination, periodic
// background fetches silently move the user's active village — next real
// navigation lands in the wrong village (usually sidebar #1).
// INVARIANT: every newdid= fetch site in this file MUST be wrapped in
// withVillageLock(). Never remove.
// ==========================================
let _villageLockHolders = 0;
let _villageLockOrigDid = null;
let _villageLockRestoreTimer = null;
// True while the final restore fetch is in flight (after holders hit 0 but
// before the server has acknowledged the restore). Refreshes during this
// window must still fire the pagehide beacon — otherwise the server's active
// village stays on the last `newdid=` we sent (the attacked village), and the
// page reload lands there. See pagehide handler below.
let _villageLockRestoreInFlight = false;
let _villageLockRestoreDid = null;
// Sticky last-known-good DID. Updated whenever a valid DID is observed from
// any source; survives transient DOM re-renders where `.active` is momentarily
// absent. Read as the last-resort fallback so capture never returns null when
// we've ever seen a valid DID this session.
let _lastKnownActiveDid = null;

// Reads the active village DID from a sidebar. `root` defaults to the live
// document but may be a parsed DOM (e.g. a fetched dorf1 response) so the
// restore can confirm the server actually switched back.
function _readDidFromSidebar(root = document) {
  let el = root.querySelector(
    ".villageList .listEntry.active a[href*='newdid='], " +
      "#sidebarBoxVillagelist .listEntry.active a[href*='newdid=']",
  );
  if (!el) el = root.querySelector(".villageList .active a[href*='newdid=']");
  if (!el) el = root.querySelector("a.active[href*='newdid=']");
  if (el) {
    const href = el.getAttribute("href") || el.href || "";
    const m = href.match(/newdid=(\d+)/);
    if (m) return m[1];
  }
  // Travian removed `newdid=` from sidebar hrefs; the vid is now on `data-did`
  // of the active <li>. Without this fallback, _captureActiveVillageDid() returns
  // null and withVillageLock() REFUSES to run, silently killing all rally fetches.
  const activeLi = root.querySelector(
    ".villageList .listEntry.active, #sidebarBoxVillagelist .listEntry.active",
  );
  if (activeLi) {
    const did = activeLi.getAttribute("data-did");
    if (did && /^\d+$/.test(did)) return did;
  }
  return null;
}

function _readDidFromUrl() {
  // Travian often includes newdid in the current URL after a click.
  const m = window.location.search.match(/[?&]newdid=(\d+)/);
  if (m) return m[1];
  // Some pages expose Travian.Resources or window villageId globals.
  try {
    if (typeof window.villageId === "string" && /^\d+$/.test(window.villageId))
      return window.villageId;
  } catch {
    /* silenced */
  }
  return null;
}

function _readDidFromVillageName() {
  if (typeof getActiveVillageName !== "function") return null;
  const name = getActiveVillageName();
  if (!name || name === "Village") return null;
  if (typeof globalVillageMap !== "object" || !globalVillageMap) return null;
  for (const [vid, n] of Object.entries(globalVillageMap)) {
    if (n === name) return vid;
  }
  return null;
}

function _captureActiveVillageDid() {
  // Priority order: sidebar DOM (most authoritative) → URL → name lookup →
  // sticky last-known-good memo. The memo ensures we never return null when
  // a valid DID has ever been observed this session.
  const fromSidebar = _readDidFromSidebar();
  const fromUrl = _readDidFromUrl();
  const fromName = _readDidFromVillageName();
  // [DEBUG vlock] temporary: shows which source wins and whether it matches
  // the village you're actually on. Remove once the v2→v1 switch is fixed.
  console.warn("[travAlarm:vlock] capture", {
    fromSidebar,
    fromUrl,
    fromName,
    lastKnown: _lastKnownActiveDid,
    activeName: typeof getActiveVillageName === "function" ? getActiveVillageName() : null,
    result: fromSidebar || fromUrl || fromName || _lastKnownActiveDid,
  });
  if (fromSidebar) {
    _lastKnownActiveDid = fromSidebar;
    return fromSidebar;
  }
  if (fromUrl) {
    _lastKnownActiveDid = fromUrl;
    return fromUrl;
  }
  if (fromName) {
    _lastKnownActiveDid = fromName;
    return fromName;
  }
  return _lastKnownActiveDid;
}

// Passive memo updater — observes the sidebar on every DOM change so
// _lastKnownActiveDid is always fresh by the time a lock opens.
if (typeof document !== "undefined" && document.body) {
  const _memoObserver = new MutationObserver(() => {
    const did = _readDidFromSidebar() || _readDidFromUrl();
    if (did) _lastKnownActiveDid = did;
  });
  try {
    _memoObserver.observe(document.body, { childList: true, subtree: true });
  } catch {
    /* silenced */
  }
  // Prime immediately at load
  const primed = _readDidFromSidebar() || _readDidFromUrl();
  if (primed) _lastKnownActiveDid = primed;
}

async function _doRestoreActiveVillage(did) {
  if (!did) return;
  // [DEBUG vlock] temporary — this is the request that physically switches the
  // server's active village. If `did` here is v1 while you're on v2, capture is wrong.
  console.warn("[travAlarm:vlock] RESTORE writing newdid=", did);
  // A single fire-and-forget restore can lose the race against the just-sent
  // `newdid=` fetches (HTTP/2 reordering, server-side write lag) — the active
  // village is then silently left on the wrong one and the next refresh lands
  // there. Re-issue until the returned dorf1 confirms `did` is active, bounded
  // to a few attempts. Each request targets the correct village, so retries can
  // only push the server toward the right state — never away from it.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/dorf1.php?newdid=${did}`, {
        credentials: "include",
      });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const active = _readDidFromSidebar(doc);
      // Confirmed, or the response has no parseable sidebar to verify against
      // (don't loop blindly in that case — the fetch above already issued the
      // switch, matching the old single-shot behaviour).
      if (!active || active === did) return;
    } catch {
      // Network error; next user navigation will correct the active village.
      return;
    }
  }
}

/**
 * Wraps an async function in the village lock. First entrant captures the
 * active village DID; last releaser schedules a single restore (debounced
 * 250ms so rapid successive holders coalesce). Crash-safe via try/finally.
 * @param {() => Promise<any>} asyncFn
 */
async function withVillageLock(asyncFn) {
  if (_villageLockHolders === 0) {
    _villageLockOrigDid = _captureActiveVillageDid();
    // [DEBUG vlock] temporary
    console.warn(
      "[travAlarm:vlock] lock OPEN origDid=",
      _villageLockOrigDid || "(null → REFUSE burst)",
    );
    // If we cannot determine the active village, REFUSE to run the fetch
    // burst. Allowing it to proceed without a restore target is what causes
    // the session to drift to whichever village was fetched last (typically
    // sidebar #1). Skipping one cycle is always safer than a silent switch.
    if (!_villageLockOrigDid) return undefined;
  }
  _villageLockHolders++;
  // Cancel any pending restore — a new holder has entered before it fired
  if (_villageLockRestoreTimer) {
    clearTimeout(_villageLockRestoreTimer);
    _villageLockRestoreTimer = null;
  }
  try {
    return await asyncFn();
  } finally {
    _villageLockHolders--;
    if (_villageLockHolders === 0) {
      const did = _villageLockOrigDid;
      _villageLockOrigDid = null;
      // Restore IMMEDIATELY — the previous 250ms debounce created a window
      // where a user refresh between fetch-completion and restore-firing
      // would land them on the rally-point village (the last newdid= we sent).
      // Coalesce optimization isn't worth the refresh-race risk.
      //
      // Track the restore separately so pagehide can still fire the beacon
      // if the user hits F5 between holders→0 and the server ack'ing the
      // restore. Without this, refreshing while a rally fetch is finishing
      // lands the user on the attacked village.
      _villageLockRestoreInFlight = true;
      _villageLockRestoreDid = did;
      try {
        await _doRestoreActiveVillage(did);
      } finally {
        _villageLockRestoreInFlight = false;
        _villageLockRestoreDid = null;
      }
    }
  }
}

// Safety net: if the page is being unloaded (refresh, navigation, tab close)
// while a village-switching fetch is in flight or just completed, fire a
// synchronous beacon so the server's active village is restored before the
// next page load reads it.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    // Prefer the in-flight restore target, then the active orig DID, then
    // the sticky last-known DID — covers all three race windows:
    //   1. fetch in flight (holders > 0)
    //   2. final restore fetch in flight (holders == 0, but server hasn't
    //      yet processed the restore — without this branch, refresh lands
    //      on the last `newdid=` we sent, e.g. the attacked village)
    //   3. neither, but we have a last-known good DID
    const did = _villageLockRestoreDid || _villageLockOrigDid || _lastKnownActiveDid;
    const inFlight =
      _villageLockHolders > 0 || _villageLockRestoreInFlight || _villageLockRestoreTimer !== null;
    if (inFlight && did) {
      // [DEBUG vlock] temporary — beacon fired on refresh/unload.
      console.warn("[travAlarm:vlock] pagehide BEACON newdid=", did, {
        restoreDid: _villageLockRestoreDid,
        origDid: _villageLockOrigDid,
        lastKnown: _lastKnownActiveDid,
        holders: _villageLockHolders,
      });
      // Persist the expected village so the next page load can detect a
      // wrong landing (the reload's GET racing past this beacon) and
      // self-heal — see the startup block below.
      try {
        sessionStorage.setItem("_twVlockPending", JSON.stringify({ did, ts: Date.now() }));
      } catch {
        /* unload — nothing we can do */
      }
      try {
        navigator.sendBeacon(`/dorf1.php?newdid=${did}`);
      } catch {
        /* unload — nothing we can do */
      }
    }
  });
}

// Records village ids our own newdid= fetches have targeted this tab session,
// so the self-heal below can tell "our fetch race dumped the user here" apart
// from a deliberate village switch.
function _noteNewdidTarget(vid) {
  if (!vid) return;
  try {
    const raw = JSON.parse(sessionStorage.getItem("_twVlockTargets") || "null");
    const vids = raw && Array.isArray(raw.vids) ? raw.vids : [];
    if (!vids.includes(String(vid))) vids.push(String(vid));
    sessionStorage.setItem("_twVlockTargets", JSON.stringify({ vids, ts: Date.now() }));
  } catch {
    /* silenced */
  }
}

// Self-heal wrong landings: if the previous page unloaded while a newdid=
// fetch/restore was in flight, the reload's GET can race past the pagehide
// beacon and land the user on the last village we fetched (the attacked one).
// Detect that here — expected DID persisted at pagehide vs the village the
// server actually rendered — and reload once onto the right village. Only
// fires when the landed village is one OUR fetches targeted, so a deliberate
// sidebar switch is never bounced.
(() => {
  if (typeof window === "undefined") return;
  let marker = null;
  try {
    marker = JSON.parse(sessionStorage.getItem("_twVlockPending") || "null");
    sessionStorage.removeItem("_twVlockPending");
  } catch {
    /* silenced */
  }
  if (!marker || !marker.did) return;
  if (Date.now() - (marker.ts || 0) > 30000) return;
  // URL already carries newdid= → deliberate switch; leave it alone.
  if (/[?&]newdid=\d+/.test(window.location.search)) return;
  const active = _readDidFromSidebar();
  if (!active || active === String(marker.did)) return;
  let targets = null;
  try {
    targets = JSON.parse(sessionStorage.getItem("_twVlockTargets") || "null");
  } catch {
    /* silenced */
  }
  if (!targets || !Array.isArray(targets.vids)) return;
  if (!targets.vids.includes(String(active))) return;
  console.warn("[travAlarm:vlock] self-heal: landed on", active, "expected", marker.did);
  const url = new URL(window.location.href);
  url.searchParams.set("newdid", String(marker.did));
  window.location.replace(url.toString());
})();

/**
 * Returns true if the named fetcher is allowed to run (not already running and past cooldown).
 * Sets isFetching=true and records lastTime when it returns true.
 * @param {string} key - key in fetchState ("prod"|"training"|"warehouse"|"celebrations")
 * @param {number} cooldownMs
 */
function canFetch(key, cooldownMs) {
  const f = fetchState[key];
  if (f.isFetching || Date.now() - f.lastTime < cooldownMs) return false;
  f.isFetching = true;
  f.lastTime = Date.now();
  return true;
}

/**
 * Reads a fill-time delay (ms) from a table cell.
 * Checks for a .timer span with a `value` attribute first, then parses text.
 * Returns 0 if no valid time found.
 * @param {Element} cell
 * @returns {number}
 */
function parseCellDelay(cell) {
  if (!cell) return 0;
  const timerSpan = cell.querySelector(".timer");
  if (timerSpan) {
    const val = (timerSpan.getAttribute("value") | 0) * 1000;
    if (val > 0) return val;
    // value=0 means server didn't populate it — fall through to text parse
    const timerTxt = timerSpan.textContent.trim();
    if (/\d+:\d+:\d+/.test(timerTxt)) return parseSmartDuration(timerTxt);
  }
  const txt = cell.textContent.trim();
  if (/\d+:\d+:\d+/.test(txt)) return parseSmartDuration(txt);
  return 0;
}

// ==========================================
// BACKGROUND PRODUCTION FETCHER
// ==========================================
async function fetchProductionData() {
  if (!canFetch("prod", 10000)) return;

  try {
    const res = await fetch("/village/statistics/resources/production");
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const rows = doc.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      if (row.classList.contains("sum") || row.querySelector(".empty")) return;
      const vilNode = row.querySelector(".vil a");
      if (!vilNode) return;

      const vName = cleanText(vilNode.innerText);

      const getVal = (selector) => {
        const el = row.querySelector(selector);
        if (!el) return 0;
        return parseInt(el.innerText.replace(/[^\d-]/g, ""), 10) || 0;
      };

      const pW = getVal(".lum");
      const pC = getVal(".clay");
      const pI = getVal(".iron");
      const pCr = getVal(".crop");
      const total = pW + pC + pI + pCr;

      const prodMap = { w: pW, c: pC, i: pI, cr: pCr };
      localStorage.setItem(`_wpt_${serverTag}_${vName}`, total);
      localStorage.setItem(`_wpm_${serverTag}_${vName}`, JSON.stringify(prodMap));
    });

    scan(); // Re-trigger scan to update NPC text
  } catch {
    // Fetch errors are non-critical, silently ignore
  } finally {
    fetchState.prod.isFetching = false;
  }
}

// ==========================================
// TRAINING QUEUE FETCHER
// ==========================================
async function fetchTrainingData() {
  if (!canFetch("training", 30000)) return;

  const GID_NAMES = {
    19: "Barracks",
    20: "Stable",
    21: "Workshop",
    22: "Academy",
    29: "Great Barracks",
    30: "Great Stable",
    36: "Trapper",
    45: "Hospital",
    46: "Hospital",
  };

  try {
    const res = await fetch(window.location.origin + "/village/statistics/troops/training");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");

    const table = doc.querySelector("table.under_progress");
    if (!table) return;

    // Parse header columns to get building GIDs
    const headerCells = table.querySelectorAll("thead th");
    const columns = [];
    headerCells.forEach((th, i) => {
      const icon = th.querySelector('i[class*="type"]');
      if (icon) {
        const match = icon.className.match(/type(\d+)/);
        if (match) columns.push({ colIdx: i, gid: match[1] });
      }
    });

    // Parse each village row
    const queueMap = {};
    table.querySelectorAll("tbody tr").forEach((row) => {
      const vilNode = row.querySelector(".villageName a");
      if (!vilNode) return;
      const vName = cleanText(vilNode.textContent);
      if (!vName) return;

      const cells = row.querySelectorAll("td");
      columns.forEach(({ colIdx, gid }) => {
        const cell = cells[colIdx];
        if (!cell) return;
        const durationSpan = cell.querySelector(".duration");
        if (!durationSpan) return;
        const seconds = (parseSmartDuration(durationSpan.textContent.trim()) ?? 0) / 1000;
        if (seconds <= 0) return;

        const buildingName = GID_NAMES[gid] || `Building ${gid}`;
        const key = `${buildingName}__${vName}`;
        if (!queueMap[key] || seconds > queueMap[key].seconds) {
          queueMap[key] = { buildingName, vName, seconds };
        }
      });
    });

    const newAlarms = [];
    const activeNames = [];

    Object.values(queueMap).forEach(({ buildingName, vName, seconds }) => {
      const alarmName = `🎓 ${buildingName} (${vName}) ${serverTag}`;
      activeNames.push(alarmName);
      newAlarms.push({
        name: alarmName,
        delay: seconds * 1000,
        customType: "training",
      });
    });

    if (newAlarms.length > 0) {
      await api.runtime.sendMessage({
        type: "REFRESH_ALARMS",
        buildings: newAlarms,
      });

      // Only clean up stale training alarms when we have a valid non-empty
      // snapshot — sending an empty activeNames would wipe all training alarms.
      api.runtime.sendMessage({
        type: "CLEAR_STALE_TRAINING",
        activeNames,
        serverTag,
      });
    }
  } catch {
    // Fetch errors are non-critical, silently ignore
  } finally {
    fetchState.training.isFetching = false;
  }
}

// ==========================================
// WAREHOUSE / GRANARY FETCHER (Storage Alarms)
// ==========================================
const STORAGE_THRESHOLD = 3600000; // 1h in ms

/**
 * Fetches dorf1 for a given village and returns the "granary empty in" delay
 * in ms, read from the stockBar crop tooltip's timer. Returns 0 if not found.
 * @param {string} vDid
 * @returns {Promise<number>}
 */
async function fetchGranaryEmptyDelay(vDid) {
  try {
    _noteNewdidTarget(vDid);
    const res = await fetch(`/dorf1.php?newdid=${vDid}`, {
      credentials: "include",
    });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sb = doc.getElementById("stockBar");
    if (!sb) return 0;
    const titles = Array.from(sb.querySelectorAll("[title]"))
      .map((el) => el.getAttribute("title"))
      .filter(Boolean);
    const cropTip = titles.find((t) => t.includes("Empty in")) || "";
    if (!cropTip) return 0;
    const inner = new DOMParser().parseFromString(cropTip, "text/html");
    const timer = inner.querySelector("span.timer, span[id^='timer']");
    if (!timer) return 0;
    const secs = parseInt(timer.getAttribute("value"), 10) || 0;
    return secs > 0 ? secs * 1000 : 0;
  } catch {
    return 0;
  }
}

async function fetchWarehouseData() {
  if (!canFetch("warehouse", 60000)) return;

  try {
    const res = await fetch(window.location.origin + "/village/statistics/resources/warehouse");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");

    const warehouseTable = doc.getElementById("warehouse");
    const newAlarms = [];
    const activeNames = [];

    if (warehouseTable) {
      const rows = warehouseTable.querySelectorAll("tbody tr");
      const starvingRows = [];
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 7) return;

        let vName = "Village";
        let vDid = null;
        const vilCell = row.querySelector(".vil") || cells[0];
        if (vilCell) {
          const aNode = vilCell.querySelector("a");
          vName = cleanText(aNode ? aNode.textContent : vilCell.textContent);
          const href = aNode?.getAttribute("href") || "";
          const m = href.match(/newdid=(\d+)/);
          if (m) vDid = m[1];
        }

        // Warehouse timer (column 5, index 4)
        const whCell = cells[4];
        if (whCell) {
          const whTxt = whCell.textContent.trim();
          const whAlreadyFull = whTxt === "-" || whTxt === "–";
          const delay = whAlreadyFull ? 0 : parseCellDelay(whCell);
          if ((whAlreadyFull || delay > 0) && delay < STORAGE_THRESHOLD) {
            const alarmName = `📦 Warehouse Full | ${vName} ${serverTag}`;
            activeNames.push(alarmName);
            newAlarms.push({ name: alarmName, delay, customType: "storage" });
          }
        }

        // Granary timer (column 7, index 6)
        // A cell text starting with "−" (U+2212) means crop production is
        // negative — the timer counts down to EMPTY, not FULL, and the
        // warehouse-stats value is unreliable. For those cases fetch dorf1
        // and read the stockBar crop tooltip's "Empty in" timer directly.
        const grCell = cells[6];
        if (grCell) {
          const grTxt = grCell.textContent.trim();
          const grAlreadyFull = grTxt === "-" || grTxt === "–";
          const grStarving = !grAlreadyFull && (grTxt.startsWith("−") || grTxt.startsWith("-"));
          if (grStarving) {
            if (vDid) starvingRows.push({ vName, vDid });
          } else {
            const delay = grAlreadyFull ? 0 : parseCellDelay(grCell);
            // A plain dash means the granary isn't filling — which happens
            // both when it's genuinely full (crop produced but capped) AND
            // when net crop production is 0 (stable below cap). Only the
            // former should fire a done "Granary Full" alarm; gate on the
            // cached net crop production so a 0-production village doesn't
            // spawn a bogus already-done alarm.
            let grCropProd = null;
            try {
              const pm = JSON.parse(localStorage.getItem(`_wpm_${serverTag}_${vName}`) || "null");
              if (pm) grCropProd = pm.cr;
            } catch {
              // No cached production for this village yet.
            }
            const grFull = grAlreadyFull && grCropProd > 0;
            if ((grFull || delay > 0) && delay < STORAGE_THRESHOLD) {
              const alarmName = `📦 Granary Full | ${vName} ${serverTag}`;
              activeNames.push(alarmName);
              newAlarms.push({
                name: alarmName,
                delay,
                customType: "storage",
              });
            }
          }
        }
      });

      if (starvingRows.length > 0) {
        await withVillageLock(async () => {
          for (const { vName, vDid } of starvingRows) {
            await new Promise((r) => setTimeout(r, jitterMs(1500)));
            const delay = await fetchGranaryEmptyDelay(vDid);
            if (delay > 0 && delay < STORAGE_THRESHOLD) {
              const alarmName = `🌾 Granary Empty | ${vName} ${serverTag}`;
              activeNames.push(alarmName);
              newAlarms.push({
                name: alarmName,
                delay,
                customType: "storage",
              });
            }
          }
        });
      }
    } else {
      // Fallback: older layout
      const table =
        doc.getElementById("overview") ||
        doc.getElementById("resources") ||
        doc.querySelector("#content table");
      if (!table) {
        fetchState.warehouse.isFetching = false;
        return;
      }

      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        const vilCell = row.querySelector(".vil") || cells[0];
        if (!vilCell) return;
        const aNode = vilCell.querySelector("a");
        const vName = cleanText(aNode ? aNode.textContent : vilCell.textContent);

        cells.forEach((cell, idx) => {
          if (idx === 0) return;
          const txt = cell.textContent.trim();
          const alreadyFull = txt === "-" || txt === "–";
          const delay = alreadyFull ? 0 : parseCellDelay(cell);
          if ((!alreadyFull && delay <= 0) || delay >= STORAGE_THRESHOLD) return;
          const alarmName = `📦 Warehouse Full | ${vName} ${serverTag}`;
          if (!activeNames.includes(alarmName)) {
            activeNames.push(alarmName);
            newAlarms.push({ name: alarmName, delay, customType: "storage" });
          }
        });
      });
    }

    if (newAlarms.length > 0) {
      await api.runtime.sendMessage({
        type: "REFRESH_ALARMS",
        buildings: newAlarms,
      });
    }

    // Always send cleanup after a successful fetch — empty activeNames is
    // authoritative: it means no storage is near-full, so all storage alarms
    // for this server should be cleared (including fired/silenced ones).
    api.runtime.sendMessage({
      type: "CLEAR_STALE_STORAGE",
      activeNames,
      serverTag,
    });
  } catch {
    // Fetch errors are non-critical, silently ignore
  } finally {
    fetchState.warehouse.isFetching = false;
  }
}

// ==========================================
// CELEBRATIONS FETCHER
// ==========================================
async function fetchCelebrationsData() {
  if (!canFetch("celebrations", 60000)) return;

  try {
    const res = await fetch(window.location.origin + "/village/statistics/culturepoints");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");

    const table = doc.getElementById("culture_points");
    if (!table) return;

    const newAlarms = [];
    const activeNames = [];

    table.querySelectorAll("tbody tr").forEach((row) => {
      const vilNode = row.querySelector(".vil");
      const celNode = row.querySelector(".cel");
      if (!vilNode || !celNode) return;

      const aNode = vilNode.querySelector("a");
      const vName = cleanText(aNode ? aNode.textContent : vilNode.textContent);
      const delay = parseCellDelay(celNode);

      if (delay > 0) {
        const alarmName = `🎉 Celebrations Ends In | ${vName} ${serverTag}`;
        activeNames.push(alarmName);
        newAlarms.push({ name: alarmName, delay, customType: "culture" });
      }
    });

    if (newAlarms.length > 0) {
      await api.runtime.sendMessage({
        type: "REFRESH_ALARMS",
        buildings: newAlarms,
      });
    }

    // Always clean up stale/duplicate celebration alarms after a
    // successful fetch — even when no active celebrations remain.
    // keepExpired in the handler preserves fired alarms for user dismissal.
    api.runtime.sendMessage({
      type: "CLEAR_STALE_CELEBRATIONS",
      activeNames,
      serverTag,
    });
  } catch {
    // Fetch errors are non-critical, silently ignore
  } finally {
    fetchState.celebrations.isFetching = false;
  }
}

// ==========================================
// PERIODIC RALLY POINT CHECK FOR VILLAGES UNDER ATTACK
// ==========================================
async function checkResourceVillageAttacks() {
  // Seed the throttle from the persisted timestamp so a page refresh doesn't
  // reset the 10-minute cooldown and re-fire a newdid= burst shortly after
  // every load (same reload-race as the rally cooldown in
  // scanForSidebarAttacksAndFetch).
  if (fetchState.attackCheck.lastTime === 0) {
    fetchState.attackCheck.lastTime =
      parseInt(localStorage.getItem(`_twAtkChkTs_${serverTag}`), 10) || 0;
  }
  if (!canFetch("attackCheck", 600000)) return; // 10 minutes
  try {
    localStorage.setItem(`_twAtkChkTs_${serverTag}`, String(fetchState.attackCheck.lastTime));
  } catch {
    /* silenced */
  }

  // Find villages with active resource/storage alarms
  const resourceVillages = new Set();
  currentAlarms.forEach((a) => {
    if ((a.customType === "resource" || a.customType === "storage") && a.name.includes(serverTag)) {
      const match = a.name.match(/\|\s*(.+?)\s*\[/);
      if (match) resourceVillages.add(match[1].trim());
    }
  });
  if (resourceVillages.size === 0) return;

  // Find villages under attack (from sidebar)
  const attackedVillages = new Set();
  const listEntries = document.querySelectorAll(".villageList .listEntry.attack");
  listEntries.forEach((entry) => {
    const nameNode = entry.querySelector(".name");
    if (nameNode) attackedVillages.add(cleanText(nameNode.innerText));
  });
  // Also check existing attack alarms
  currentAlarms.forEach((a) => {
    if (a.customType === "attack" && a.name.includes(serverTag)) {
      const match = a.name.match(/Attack on (.+?)[\s(]/);
      if (match) attackedVillages.add(match[1].trim());
    }
  });

  // Find villages that are under attack
  const villagesToCheck = [];
  resourceVillages.forEach((vName) => {
    if (attackedVillages.has(vName)) {
      // Reverse lookup VID from globalVillageMap
      const entry = Object.entries(globalVillageMap).find(([, name]) => name === vName);
      if (entry) villagesToCheck.push(entry[0]);
    }
  });
  if (villagesToCheck.length === 0) return;

  // Fetch rally point for each attacked village
  try {
    await withVillageLock(async () => {
      for (const vid of villagesToCheck) {
        if (isFetchingRally) break;
        const attacks = await fetchAndParseRallyPoint(vid);
        if (attacks && attacks.length > 0) {
          api.runtime.sendMessage({
            type: "REFRESH_ALARMS",
            buildings: attacks,
          });
        }
      }
    });
  } catch {
    // Fetch errors are non-critical, silently ignore
  } finally {
    fetchState.attackCheck.isFetching = false;
  }
}

// ==========================================
// DUAL-ALARM ATTACK SYSTEM (REMOTE FETCH)
// ==========================================

function scanForSidebarAttacksAndFetch() {
  const foundAlarms = [];
  const villagesToFetch = new Set();
  let hasAnyAttack = false;

  const listEntries = document.querySelectorAll(".villageList .listEntry");
  // No village-list sidebar rendered on this page (reports, statistics,
  // fullscreen map, or a mid-re-render frame) → we have zero visibility into
  // incoming attacks. Absence of `.attack` markers here is NOT evidence the
  // attack ended, so bail before the no-attack cleanup can wipe live alarms.
  if (listEntries.length === 0) return;
  listEntries.forEach((entry) => {
    // Travian moved the incoming-attack marker off the .listEntry class and
    // onto an inner icon: `<span class="incomingTroops"><svg class="attack">`.
    // The old `entry.classList.contains("attack")` check matched nothing after
    // that change, so every entry bailed here, no rally fetch was ever queued,
    // and the !hasAnyAttack branch below auto-cleared live attack alarms.
    if (!entry.querySelector(".incomingTroops svg.attack")) return;

    // Hero movements to oases use the same .attack class as incoming enemy
    // attacks. Skip entries that contain a hero icon — they are outbound, not
    // incoming threats.
    if (entry.querySelector(".hero-icon, .unit.hero")) return;

    // Secondary guard: the DOM-based .hero-icon check above can miss during
    // transient re-renders triggered by hover/tooltip events (Tippy appends
    // to document.body → MutationObserver fires scan() → we arrive here while
    // Travian simultaneously removes/reinserts the .hero-icon span in the same
    // event-loop tick). Check the live tooltip DOM instead — if a hero tooltip
    // is open containing movement keywords, any .attack entry is outbound hero.
    const _heroTooltip = document.querySelector(".tippy-content, #travian_tooltip");
    if (_heroTooltip) {
      const _ttText = (_heroTooltip.innerText || "").toLowerCase();
      if (
        _ttText.includes("oasis") ||
        _ttText.includes("adventure") ||
        _ttText.includes("reinforc")
      )
        return;
    }

    hasAnyAttack = true;

    // 1. EXTRACT DATA
    const link = entry.querySelector("a");
    const isActive = entry.classList.contains("active");
    let vid = null;

    if (link && link.href) {
      const match = link.href.match(/newdid=(\d+)/);
      if (match) vid = match[1];
    }
    // Travian moved the village id off the sidebar href (now just `dorf1.php#`)
    // onto a `data-did` attribute on the <li>. Without this fallback, every
    // non-active attacked village fails vid lookup and skips the rally-point fetch.
    if (!vid) vid = entry.getAttribute("data-did") || null;

    // 2. QUEUE FETCH (cooldown enforced below)
    if (vid) {
      villagesToFetch.add(vid);
    } else if (isActive) {
      villagesToFetch.add("CURRENT");
    }
  });

  // 3. EXECUTE FETCHES (For Trackers)
  // Cooldown is generous (60s) — each rally fetch opens a window where
  // Travian's server-side active village briefly points at the attacked
  // village, and a refresh during that window lands the user on the wrong
  // village. 60s detection delay for new waves is the cost we pay for not
  // thrashing the active village.
  const now = Date.now();
  // The cooldown must survive page reloads: lastRallyFetchTime resets to 0
  // on every refresh, so without the persisted timestamp a refresh while
  // under attack fired a newdid= burst within the first second of every
  // page load — exactly when the user is about to click something, which is
  // how they kept landing on the attacked village. localStorage also shares
  // the cooldown across tabs.
  const persistedRallyTs = parseInt(localStorage.getItem(`_twRallyTs_${serverTag}`), 10) || 0;
  if (
    villagesToFetch.size > 0 &&
    !isFetchingRally &&
    now - Math.max(lastRallyFetchTime, persistedRallyTs) > 60000
  ) {
    lastRallyFetchTime = now;
    try {
      localStorage.setItem(`_twRallyTs_${serverTag}`, String(now));
    } catch {
      /* silenced */
    }

    const fetchOrder = Array.from(villagesToFetch);
    withVillageLock(async () => {
      const fetchPromises = fetchOrder.map((idKey) => {
        const vid = idKey === "CURRENT" ? null : idKey;
        return fetchAndParseRallyPoint(vid);
      });
      const results = await Promise.allSettled(fetchPromises);
      const allFetchedAlarms = [];
      results.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          allFetchedAlarms.push(...res.value);
        }
      });
      if (allFetchedAlarms.length > 0) {
        api.runtime.sendMessage({
          type: "REFRESH_ALARMS",
          buildings: allFetchedAlarms,
        });
      }
    }).catch(() => {});
  }

  // 4. CLEANUP
  if (!hasAnyAttack) {
    const hasActiveAttackAlarms = currentAlarms.some(
      (a) => a.customType === "attack" && a.name.includes(serverTag),
    );
    if (hasActiveAttackAlarms) {
      // Gate auto-clear on ELAPSED TIME, not scan count: scan() fires on
      // every DOM mutation (up to ~20×/s), so a raw count reached the
      // threshold within seconds and wiped live attack alarms during brief
      // sidebar re-renders. Only clear after a sustained no-attack window.
      if (_noAttackSince === 0) _noAttackSince = Date.now();

      if (Date.now() - _noAttackSince > ATTACK_CLEANUP_GRACE_MS) {
        currentAlarms.forEach((a) => {
          if (a.customType === "attack" && a.name.includes(serverTag)) {
            api.runtime.sendMessage({
              type: "DELETE_ALARM",
              id: a.id,
              name: a.name,
              autoClear: true,
            });
          }
        });
        acknowledgedSirens.clear();
        suppressedAttacks.clear();
        _noAttackSince = 0;
      }
    }
  } else {
    _noAttackSince = 0;
  }

  if (foundAlarms.length > 0) {
    api.runtime.sendMessage({ type: "REFRESH_ALARMS", buildings: foundAlarms });
  }
}

// Parses `@ HH:MM:SS` from a tracker name into an absolute millisecond
// timestamp. Returns null when no such marker is present. Handles midnight
// rollover: if the parsed HH:MM:SS is more than 1 hour earlier than `now`,
// assume the impact is on the following day.
function parseImpactTimeFromName(name) {
  const m = name && name.match(/ @ (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const now = new Date();
  const t = new Date(now);
  t.setHours(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), 0);
  if (t.getTime() < now.getTime() - 3600 * 1000) {
    t.setDate(t.getDate() + 1);
  }
  return t.getTime();
}

// Fetcher Function (Strictly for Trackers ⚠️)
async function fetchAndParseRallyPoint(vid) {
  isFetchingRally = true;

  let url = window.location.origin + "/build.php?gid=16&tt=1&filter=1&subfilters=1";
  if (vid) {
    url += `&newdid=${vid}`;
    _noteNewdidTarget(vid);
  }

  try {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const foundAlarms = [];
    const infoBodies = doc.querySelectorAll("tbody.infos");

    // 1) Collect all attacks
    const attacks = [];
    infoBodies.forEach((infoBody) => {
      const timer = infoBody.querySelector(".timer");
      if (!timer) return;
      const seconds = parseInt(timer.getAttribute("value"), 10);
      if (isNaN(seconds) || seconds <= 0) return;

      let headlineText = "Unknown Attack";
      let sibling = infoBody.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === "THEAD") {
          const headline = sibling.querySelector(".troopHeadline");
          if (headline) headlineText = cleanText(headline.innerText);
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      attacks.push({ headlineText, seconds });
    });

    // A "wave" is defined by IMPACT proximity, not detection proximity:
    // attacks of the same headline whose impacts land within WAVE_WINDOW_S
    // of each other are real cata-wave patterns and collapse into one
    // alarm. Anything spaced further apart in impact time stays as
    // distinct alarms (even if they were detected in the same fetch).
    attacks.sort((a, b) => a.seconds - b.seconds);
    const WAVE_WINDOW_S = 5;
    const clusters = [];
    attacks.forEach((atk) => {
      const last = clusters[clusters.length - 1];
      if (
        last &&
        last.headlineText === atk.headlineText &&
        atk.seconds - last.lastSeconds <= WAVE_WINDOW_S
      ) {
        last.count++;
        last.lastSeconds = atk.seconds;
      } else {
        clusters.push({
          headlineText: atk.headlineText,
          firstSeconds: atk.seconds,
          lastSeconds: atk.seconds,
          count: 1,
        });
      }
    });

    // 3) Emit alarms per cluster. Dedup is by ABSOLUTE impact time parsed
    //    from existing alarm names — stable across refreshes even when the
    //    20s dodge lead clamps near impact (which makes scheduledTime
    //    drift relative to the original schedule). Each cluster also gets
    //    a sibling `🚨` detection alarm that fires immediately so the
    //    user hears a sound on first sighting AND again 20s before impact.
    const pad = (n) => String(n).padStart(2, "0");
    const nowMs = Date.now();
    clusters.forEach(({ headlineText, firstSeconds, count }) => {
      const seconds = firstSeconds;
      const impactMs = nowMs + seconds * 1000;
      const impactDate = new Date(impactMs);
      const impactStr = `${pad(impactDate.getHours())}:${pad(impactDate.getMinutes())}:${pad(impactDate.getSeconds())}`;
      const waveLabel = count > 1 ? ` (wave ×${count})` : "";
      // Tracker is the "Attack Imminent" warning that fires 20s before
      // impact. Background creates a follow-up `💥 Attack Landing` alarm
      // when this one fires (scheduled for actual impact time).
      const uniquePrefix = `⚠️ Attack Imminent: ${headlineText}${waveLabel} @ ${impactStr}`;

      const headlinePrefix = `⚠️ Attack Imminent: ${headlineText} `;
      // Tolerance is tight (2s) so two attacks impacting 1-3s apart
      // stay as distinct alarms. Re-detections of the SAME attack
      // drift by <1s between fetches, so they still dedup correctly.
      const DEDUP_TOLERANCE_MS = 2000;
      const trackerExists = currentAlarms.some((a) => {
        if (!a.name.startsWith(headlinePrefix)) return false;
        if (!a.name.endsWith(serverTag)) return false;
        const existingImpact = parseImpactTimeFromName(a.name);
        if (existingImpact != null) return Math.abs(existingImpact - impactMs) < DEDUP_TOLERANCE_MS;
        return Math.abs((a.scheduledTime || 0) - impactMs) < DEDUP_TOLERANCE_MS;
      });

      const DODGE_LEAD_MS = 20000;
      // Imminent alarm is the "20 seconds left" warning — only meaningful
      // when there's actually >=20s of lead time. If detected closer than
      // that, skip the imminent alarm entirely (detection siren already
      // warned the user; cascading a 1s-delayed warning is just noise).
      if (!trackerExists && seconds * 1000 > DODGE_LEAD_MS) {
        const detectedAt = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const transit = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
        const trackerName = `${uniquePrefix} (${transit} · detected ${detectedAt}) ${serverTag}`;
        const leadDelay = seconds * 1000 - DODGE_LEAD_MS;
        foundAlarms.push({
          name: trackerName,
          delay: leadDelay,
          customType: "attack",
        });
      }

      // Per-wave detection siren — keyed by impact time so it's unique
      // to this wave. Background dedups by impact tolerance + preserves
      // notified state so it only sounds ONCE per wave (not on every
      // refresh). Match existing sirens by `🚨 Attack on <village> @`
      // prefix + impact tolerance (not exact name) so a 1s impact-time
      // drift between two fetches doesn't spawn a duplicate siren.
      const village = (headlineText.match(/(?:attacks|raids)\s+(.+)/i) || [])[1] || headlineText;
      const sirenName = `🚨 Attack on ${village} @ ${impactStr} ${serverTag}`;
      const sirenPrefix = `🚨 Attack on ${village} @ `;
      const sirenExists = currentAlarms.some((a) => {
        if (!a.name.startsWith(sirenPrefix)) return false;
        if (!a.name.endsWith(serverTag)) return false;
        const existingImpact = parseImpactTimeFromName(a.name);
        if (existingImpact != null) return Math.abs(existingImpact - impactMs) < DEDUP_TOLERANCE_MS;
        return a.name === sirenName;
      });
      if (!sirenExists) {
        foundAlarms.push({
          name: sirenName,
          delay: 100,
          customType: "attack",
        });
      }
    });

    return foundAlarms;
  } catch (e) {
    // silenced
    return [];
  } finally {
    isFetchingRally = false;
  }
}

// ==========================================
// HERO FETCHER
// ==========================================

// Hero status codes from Travian GQL schema
const HERO_STATUS = {
  IDLE: 1,
  REVIVING: 2,
  TRAVEL_ADVENTURE: 50,
  TRAVEL_OASIS: 4,
  TRAVEL_REINFORCE: 5,
  TRAVEL_RAID: 6,
  TRAVEL_ATTACK: 3,
  RETURN_ADVENTURE: 8,
  RETURN_OTHER: 9,
};

/**
 * Fetches /hero/adventures, extracts the pre-rendered viewData JSON, and
 * upserts a hero alarm. Works from any page — no live DOM dependency.
 */
async function fetchHeroData() {
  if (!canFetch("hero", 60000)) return;

  try {
    const res = await fetch(window.location.origin + "/hero/adventures");
    const html = await res.text();

    // Extract the viewData JSON using brace-depth counting
    const viewDataIdx = html.indexOf("viewData: ");
    if (viewDataIdx === -1) return;
    const jsonStart = viewDataIdx + "viewData: ".length;

    let depth = 0,
      i = jsonStart,
      inStr = false,
      escape = false;
    for (; i < html.length && i < jsonStart + 100000; i++) {
      const c = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && inStr) {
        escape = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }

    let heroData;
    try {
      const parsed = JSON.parse(html.substring(jsonStart, i + 1));
      heroData = parsed?.data?.ownPlayer?.hero;
    } catch {
      return;
    }

    if (!heroData) return;

    const status = heroData.status;
    const homeVillage = heroData.homeVillage?.name || "";

    // No status or hero is idle/reviving — clear stale alarms
    if (!status || status.status === HERO_STATUS.IDLE || status.status === HERO_STATUS.REVIVING) {
      api.runtime.sendMessage({
        type: "CLEAR_STALE_HERO",
        activeNames: [],
        serverTag,
      });
      return;
    }

    const arrivalIn = status.arrivalIn; // seconds
    if (!arrivalIn || arrivalIn <= 0) return;
    const delayMs = arrivalIn * 1000 + 2000;

    const isReturning =
      status.status === HERO_STATUS.RETURN_ADVENTURE || status.status === HERO_STATUS.RETURN_OTHER;

    // Hero always returns home — use homeVillage for all alarms
    const villagePart = homeVillage ? ` | ${homeVillage}` : "";

    // Target village name (only set when hero is travelling to a village,
    // e.g. attacks/raids). status.onWayTo.village.name is the destination.
    const targetVillage = status.onWayTo?.village?.name || "";

    let actionLabel;
    switch (status.status) {
      case HERO_STATUS.TRAVEL_ADVENTURE:
        actionLabel = "Going to Adventure";
        break;
      case HERO_STATUS.RETURN_ADVENTURE:
        actionLabel = "Returning";
        break;
      case HERO_STATUS.TRAVEL_OASIS:
        actionLabel = "Going to Oasis";
        break;
      case HERO_STATUS.TRAVEL_REINFORCE:
        actionLabel = "Reinforcing";
        break;
      case HERO_STATUS.TRAVEL_RAID:
      case HERO_STATUS.TRAVEL_ATTACK:
        actionLabel = targetVillage ? `Attacking ${targetVillage}` : "Attacking";
        break;
      default:
        actionLabel = "Returning";
    }

    const alarmName = `⚔️ ${actionLabel}${villagePart} ${serverTag}`;

    await api.runtime.sendMessage({
      type: "REFRESH_ALARMS",
      buildings: [
        {
          name: alarmName,
          delay: delayMs,
          customType: "hero",
          noSound: !isReturning,
        },
      ],
    });

    api.runtime.sendMessage({
      type: "CLEAR_STALE_HERO",
      activeNames: [alarmName],
      serverTag,
    });
  } catch {
    // Fetch errors are non-critical
  } finally {
    fetchState.hero.isFetching = false;
  }
}
