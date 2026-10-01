/* global TSP */
/**
 * popup.js — Travian Settlement Planner: Popup UI Controller
 *
 * This is the main UI for the extension popup. It:
 *   1. Loads and displays stored CP data for the active server
 *   2. Runs a real-time simulation (1 Hz) to predict settlement date
 *   3. Manages village celebration settings (TH level, small/large toggles)
 *   4. Handles zoom, alarm mute, and server switching
 *
 * Predictions come from TSP.predictSettlement: passive production projected
 * from the recent rate trend, plus an event queue for celebration rewards.
 */

"use strict";

const {
  api,
  CP_REQUIREMENTS,
  SECS_PER_DAY,
  predictSettlement,
  getCelebrationDuration,
  formatDuration,
  formatHMS,
  storageKey,
  targetCpKey,
} = TSP;

// =========================================================================
//  STATE
// =========================================================================

let currentServerUrl = null;
let villages = [];
let speed = 1;
let storedTotalCp = 0;
let actualDailyCp = 0;
let passiveAccel = 0;
let lastUpdate = 0;
let calculatedTargetDate = null;
let isMuted = false;
let currentZoom = 1;

// =========================================================================
//  DOM REFERENCES (cached for performance in 1 Hz loop)
// =========================================================================

/** @type {Object<string, HTMLElement>} */
let dom = {};

function cacheDom() {
  const ids = [
    "serverSelect",
    "speed-display",
    "cpDisplay",
    "targetSlot",
    "timeRemaining",
    "targetDate",
    "totalProdDisplay",
    "villageList",
    "alarmToggle",
    "dateRow",
    "refreshIndicator",
    "progressFill",
  ];
  for (const id of ids) dom[id] = document.getElementById(id);
}

// =========================================================================
//  INITIALIZATION
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();

  const meta = await api.storage.local.get([
    "tsp_servers",
    "tsp_last_viewed",
    "tsp_is_muted",
    "tsp_zoom",
  ]);
  const serverList = meta.tsp_servers || [];

  isMuted = !!meta.tsp_is_muted;
  updateMuteIcon();

  // --- Zoom ---
  currentZoom = meta.tsp_zoom || 1;
  applyZoom();
  initZoomListeners();

  // --- Determine active server ---
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  let activeUrl = null;
  if (tabs[0]?.url) {
    try {
      const u = new URL(tabs[0].url);
      if (serverList.includes(u.origin)) activeUrl = u.origin;
    } catch {
      /* not a valid URL */
    }
  }
  currentServerUrl = activeUrl || meta.tsp_last_viewed || serverList[0] || null;

  // --- Server selector (multi-server support) ---
  if (serverList.length > 1) {
    const select = dom["serverSelect"];
    select.style.display = "block";
    for (const srv of serverList) {
      const opt = document.createElement("option");
      opt.value = srv;
      opt.textContent = srv.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (srv === currentServerUrl) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", (e) => {
      currentServerUrl = e.target.value;
      api.storage.local.set({ tsp_last_viewed: currentServerUrl });
      loadServerData();
    });
  }

  // --- Load initial data & trigger background scan for all servers ---
  loadServerData();
  refreshAllServers(serverList);

  // --- Live reload when background updates storage ---
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[storageKey(currentServerUrl)]) {
      loadServerData();
    }
  });

  // --- Event listeners ---
  dom["targetSlot"].addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    api.storage.local.set({ [targetCpKey(currentServerUrl)]: val });
    api.runtime.sendMessage({ action: "UPDATE_TARGET" });
    calculate();
  });

  dom["dateRow"].addEventListener("click", copyTime);

  dom["alarmToggle"].addEventListener("click", () => {
    isMuted = !isMuted;
    api.storage.local.set({ tsp_is_muted: isMuted });
    updateMuteIcon();
  });

  // --- Start real-time simulation loop ---
  setInterval(calculate, 1000);
});

// =========================================================================
//  ZOOM
// =========================================================================

function initZoomListeners() {
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        currentZoom += e.deltaY < 0 ? 0.1 : -0.1;
        saveAndApplyZoom();
      }
    },
    { passive: false },
  );

  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      currentZoom += 0.1;
      saveAndApplyZoom();
    }
    if (e.key === "-") {
      e.preventDefault();
      currentZoom -= 0.1;
      saveAndApplyZoom();
    }
    if (e.key === "0") {
      e.preventDefault();
      currentZoom = 1;
      saveAndApplyZoom();
    }
  });
}

function saveAndApplyZoom() {
  currentZoom = Math.max(0.5, Math.min(parseFloat(currentZoom.toFixed(1)), 2.0));
  api.storage.local.set({ tsp_zoom: currentZoom });
  applyZoom();
}

function applyZoom() {
  if (CSS.supports("zoom", "1")) {
    document.body.style.zoom = currentZoom;
  } else {
    // Firefox fallback: CSS transform
    document.documentElement.style.height = "auto";
    document.body.style.transform = `scale(${currentZoom})`;
    document.body.style.transformOrigin = "top left";
    document.documentElement.style.width = `${365 * currentZoom}px`;
    document.documentElement.style.height = `${document.body.scrollHeight * currentZoom}px`;
  }
}

// Sync fallback bounds on resize
if (!CSS.supports("zoom", "1")) {
  const resizeObserver = new ResizeObserver(applyZoom);
  window.addEventListener("load", () => resizeObserver.observe(document.body));
}

// =========================================================================
//  MUTE TOGGLE
// =========================================================================

function updateMuteIcon() {
  const btn = dom["alarmToggle"];
  if (!btn) return;
  btn.textContent = isMuted ? "🔕" : "🔔";
  btn.classList.toggle("muted", isMuted);
}

// =========================================================================
//  REFRESH ON OPEN
// =========================================================================

/**
 * Fetch fresh data for all tracked servers when the popup opens.
 * Always uses FORCE_FETCH (direct background fetch of /statistics) to
 * guarantee up-to-date CP values, regardless of which page the user's
 * Travian tab is currently viewing.
 * Shows a spinner in the header while fetching.
 */
async function refreshAllServers(serverList) {
  if (!serverList || serverList.length === 0) return;

  const indicator = dom["refreshIndicator"];
  if (indicator) indicator.classList.add("active");

  await Promise.allSettled(
    serverList.map(async (srv) => {
      try {
        const resp = await api.runtime.sendMessage({
          action: "FORCE_FETCH",
          url: srv,
        });
        return resp?.success || false;
      } catch {
        return false;
      }
    }),
  );

  if (indicator) indicator.classList.remove("active");

  // Reload data after all fetches complete (storage.onChanged might have
  // already triggered this, but call it once more to be safe)
  loadServerData();
}

// =========================================================================
//  DATA LOADING
// =========================================================================

async function loadServerData() {
  if (!currentServerUrl) return;

  const key = storageKey(currentServerUrl);
  const tKey = targetCpKey(currentServerUrl);
  const result = await api.storage.local.get([key, tKey]);
  const data = result[key];
  if (!data) return;

  villages = data.villages || [];
  speed = data.speed || 1;
  storedTotalCp = data.totalCp || 0;
  actualDailyCp = data.actualDailyCp || 0;
  lastUpdate = data.lastUpdate || Date.now();

  if (!CP_REQUIREMENTS[speed]) speed = 1;
  dom["speed-display"].textContent = speed;

  passiveAccel = data.passiveAccel || 0;
  // Fall back to summing per-village production if the daily total is missing.
  if (actualDailyCp <= 0) {
    actualDailyCp = villages.reduce((sum, v) => sum + v.cpProduction, 0);
  }

  renderVillages();
  setupTargetDropdown(result[tKey]);
  calculate();
}

async function saveServerData(updates) {
  if (!currentServerUrl) return;
  const key = storageKey(currentServerUrl);
  const result = await api.storage.local.get(key);
  const data = result[key] || {};
  await api.storage.local.set({ [key]: { ...data, ...updates } });
  if (updates.villages) villages = updates.villages;
}

// =========================================================================
//  VILLAGE LIST RENDERING
// =========================================================================

function renderVillages() {
  const list = dom["villageList"];
  list.innerHTML = "";

  for (let index = 0; index < villages.length; index++) {
    const v = villages[index];
    const timerHtml = buildTimerHtml(v);

    const row = document.createElement("div");
    row.className = "v-row";
    row.innerHTML = `
            <div class="v-name" title="${TSP.escapeHtml(v.name)}">
                ${TSP.escapeHtml(v.name)} ${timerHtml}
                <br><span class="v-prod">${v.cpProduction} CP/d</span>
            </div>
            <div class="v-set">
                <div class="th-stepper">
                    <button class="th-btn th-dec" data-idx="${index}">&#8722;</button>
                    <input type="number" min="1" max="20" class="th-input"
                           value="${v.townHall || 1}" data-idx="${index}">
                    <button class="th-btn th-inc" data-idx="${index}">+</button>
                </div>
            </div>
            <div class="v-set">
                <label class="check-container">
                    <input type="checkbox" class="sc-check"
                           ${v.smallCel ? "checked" : ""} data-idx="${index}">
                    <span class="checkmark small"></span>
                </label>
            </div>
            <div class="v-set">
                <label class="check-container">
                    <input type="checkbox" class="lc-check"
                           ${v.largeCel ? "checked" : ""} data-idx="${index}">
                    <span class="checkmark large"></span>
                </label>
            </div>
        `;
    list.appendChild(row);
  }

  // Attach change handlers to all inputs/checkboxes
  list
    .querySelectorAll("input")
    .forEach((el) => el.addEventListener("change", handleVillageChange));

  // Stepper buttons for TH level
  list.querySelectorAll(".th-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const input = list.querySelector(`.th-input[data-idx="${idx}"]`);
      const delta = e.target.classList.contains("th-inc") ? 1 : -1;
      const newVal = Math.max(1, Math.min(20, (parseInt(input.value, 10) || 1) + delta));
      input.value = newVal;
      input.dispatchEvent(new Event("change"));
    });
  });

  applyZoom(); // Recalculate popup bounds after DOM update
}

/**
 * Build the timer badge HTML for a village's active celebration.
 * @param {Object} village
 * @returns {string} HTML string (may be empty)
 */
function buildTimerHtml(village) {
  if (village.timerSeconds <= 0) return "";

  const elapsed = (Date.now() - lastUpdate) / 1000;
  const remaining = Math.max(0, village.timerSeconds - elapsed);

  if (remaining <= 0) return `<span class="timer-tag done">Done</span>`;

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `<span class="timer-tag">⏱ ${h}h ${m}m</span>`;
}

// =========================================================================
//  VILLAGE SETTINGS UPDATE
// =========================================================================

function handleVillageChange(e) {
  const idx = parseInt(e.target.dataset.idx, 10);
  const v = villages[idx];

  if (e.target.classList.contains("th-input")) {
    v.townHall = parseInt(e.target.value, 10);
  }
  if (e.target.classList.contains("sc-check")) {
    v.smallCel = e.target.checked;
    v.timerSeconds = v.smallCel ? getCelebrationDuration("small", v.townHall || 1, speed) : 0;
    if (v.smallCel) v.largeCel = false; // Mutual exclusion
  }
  if (e.target.classList.contains("lc-check")) {
    v.largeCel = e.target.checked;
    v.timerSeconds = v.largeCel ? getCelebrationDuration("large", v.townHall || 1, speed) : 0;
    if (v.largeCel) v.smallCel = false; // Mutual exclusion
  }

  lastUpdate = Date.now();
  saveServerData({ villages, lastUpdate });
  renderVillages();
  calculate();
}

// =========================================================================
//  TARGET DROPDOWN
// =========================================================================

function setupTargetDropdown(savedTarget) {
  const sel = dom["targetSlot"];
  sel.innerHTML = "";

  const thresholds = CP_REQUIREMENTS[speed];
  let nextSlotIndex = thresholds.findIndex((th) => th > storedTotalCp);
  if (nextSlotIndex === -1) nextSlotIndex = thresholds.length - 1;

  // Reset saved target if already reached
  if (savedTarget && savedTarget <= storedTotalCp) savedTarget = null;

  let hasSelected = false;

  for (let i = 1; i < thresholds.length; i++) {
    const th = thresholds[i];
    const opt = document.createElement("option");
    opt.value = th;
    opt.textContent = `Vil ${i + 1}: ${th.toLocaleString()}`;

    if ((savedTarget && th === savedTarget) || (!savedTarget && i === nextSlotIndex)) {
      opt.selected = true;
      hasSelected = true;
    }
    sel.appendChild(opt);
  }

  if (!hasSelected && sel.options.length > 0) sel.options[0].selected = true;

  if (!savedTarget && sel.value) {
    api.storage.local.set({
      [targetCpKey(currentServerUrl)]: parseInt(sel.value, 10),
    });
    api.runtime.sendMessage({ action: "UPDATE_TARGET" });
  }
}

// =========================================================================
//  CORE SIMULATION
// =========================================================================

/**
 * Main calculation loop (runs every second).
 *
 * Delegates to the shared deterministic predictor (exact game state + bounded
 * rate-growth trend + celebration event queue) and renders the result.
 */
function calculate() {
  try {
    const now = Date.now();
    const dt = (now - lastUpdate) / 1000;
    const target = parseInt(dom["targetSlot"].value, 10) || 0;

    const { seconds, currentCp, ratePerDay } = predictSettlement({
      totalCp: storedTotalCp,
      passiveRate: actualDailyCp / SECS_PER_DAY,
      passiveAccel,
      villages,
      speed,
      target,
      dt,
    });

    // --- Live readouts (always shown) ---
    dom["cpDisplay"].textContent = Math.floor(currentCp).toLocaleString();
    dom["totalProdDisplay"].textContent = Math.round(ratePerDay).toLocaleString();

    if (target <= 0) {
      dom["timeRemaining"].textContent = "—";
      return;
    }

    // --- Progress bar ---
    if (dom["progressFill"]) {
      const pct = Math.min(100, (Math.floor(currentCp) / target) * 100);
      dom["progressFill"].style.width = pct.toFixed(1) + "%";
    }

    // --- Already reached ---
    if (currentCp >= target) {
      dom["timeRemaining"].textContent = "Ready!";
      dom["targetDate"].textContent = "Right Now";
      if (dom["progressFill"]) dom["progressFill"].style.width = "100%";
      calculatedTargetDate = new Date();
      return;
    }

    // --- Unreachable (no production, no parties) ---
    if (!isFinite(seconds)) {
      dom["timeRemaining"].textContent = "Never";
      dom["targetDate"].textContent = "—";
      calculatedTargetDate = null;
      return;
    }

    // --- Countdown + ETA ---
    calculatedTargetDate = new Date(now + seconds * 1000);
    dom["targetDate"].textContent = calculatedTargetDate.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    dom["timeRemaining"].textContent = formatDuration(seconds);
  } catch {
    // The simulation loop runs once per second — a single bad frame
    // (e.g. mid-render race during a server switch) shouldn't crash it.
    // We swallow and try again on the next tick.
  }
}

// =========================================================================
//  CLIPBOARD COPY
// =========================================================================

function copyTime() {
  if (!calculatedTargetDate) return;
  const diffMs = calculatedTargetDate - new Date();
  if (diffMs <= 0) return;

  const totalSecs = Math.floor(diffMs / 1000);
  navigator.clipboard.writeText(formatHMS(totalSecs));

  const el = dom["targetDate"];
  const old = el.textContent;
  el.textContent = "Copied!";
  el.style.color = "#71d000";
  setTimeout(() => {
    el.textContent = old;
    el.style.color = "";
  }, 1000);
}
