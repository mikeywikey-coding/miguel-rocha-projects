/* global TSP */
// Load shared utilities (replaces the multi-script manifest pattern)
importScripts("shared.js");

/**
 * background.js — Travian Settlement Planner: Background Service
 *
 * Responsibilities:
 *   1. Periodic alarm checking (every 1 min via Alarms API)
 *   2. Auto-fetching CP data from all tracked servers (every 5 min)
 *   3. Desktop notifications + audio alarm via content script relay
 *   4. Responding to messages from content.js and popup.js
 *
 * All constants and utilities come from shared.js (loaded first via manifest).
 */

("use strict");

const {
  api,
  CP_REQUIREMENTS,
  parseGameNumber,
  extractProgression,
  computeRateSlope,
  predictSettlement,
  SECS_PER_DAY,
  storageKey,
  targetCpKey,
} = TSP;

// =========================================================================
//  ALARM STATE
// =========================================================================

let alarmActive = false;
let isSnoozed = false;

// =========================================================================
//  MESSAGE HANDLING
// =========================================================================

api.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "SCAN_SERVER" && request.url) {
    scanServerPreferTabs(request.url)
      .then((success) => sendResponse({ success, source: "scan" }))
      .catch(() => sendResponse({ success: false, source: "scan" }));
    return true; // Keep message channel open for async response
  }

  // Force a direct background fetch (no tab preference).
  // Used by the popup to ensure data is fetched even without open tabs.
  if (request.action === "FORCE_FETCH" && request.url) {
    fetchServerData(request.url)
      .then((success) => sendResponse({ success, source: "fetch" }))
      .catch(() => sendResponse({ success: false, source: "fetch" }));
    return true;
  }

  if (request.action === "UPDATE_TARGET") {
    isSnoozed = false;
    checkAlarmCondition();
  }
});

/**
 * Scan a specific server, preferring open content-script tabs over background fetch.
 * Always falls back to background fetch if no tab succeeds.
 */
async function scanServerPreferTabs(serverUrl) {
  const { hostname } = new URL(serverUrl);

  // Try to find an open tab for this server and ask it to rescan
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && tab.url.includes(hostname)) {
      try {
        const resp = await api.tabs.sendMessage(tab.id, { action: "RESCAN" });
        if (resp?.success) return true;
      } catch {
        /* content script not ready */
      }
    }
  }

  // No open tab succeeded — always do a background fetch
  return fetchServerData(serverUrl);
}

// =========================================================================
//  ALARM MANAGEMENT
// =========================================================================

/**
 * Broadcast a message to all open Travian tabs.
 * Used to trigger/stop alarm audio in content scripts.
 */
function broadcastToTravianTabs(action) {
  api.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.url && tab.url.includes("travian.")) {
        api.tabs.sendMessage(tab.id, { action }).catch(() => {});
      }
    }
  });
}

function startAlarm() {
  if (alarmActive) return;
  alarmActive = true;

  api.notifications.create("tsp-alarm-notif", {
    type: "basic",
    iconUrl: "icon128.png",
    title: "Settlement Ready!",
    message: "You have enough CP! Click here to Snooze.",
    priority: 2,
  });

  broadcastToTravianTabs("PLAY_ALARM");
}

function stopAlarm() {
  alarmActive = false;
  isSnoozed = true;
  api.notifications.clear("tsp-alarm-notif");
  broadcastToTravianTabs("STOP_ALARM");
}

api.notifications.onButtonClicked.addListener((id) => {
  if (id === "tsp-alarm-notif") stopAlarm();
});
api.notifications.onClosed.addListener((id) => {
  if (id === "tsp-alarm-notif") stopAlarm();
});

// =========================================================================
//  PERIODIC TASKS (Alarms API — survives background script suspension)
// =========================================================================

api.alarms.create("checkCP", { periodInMinutes: 1 });
api.alarms.create("autoFetchCP", { periodInMinutes: 5 });

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkCP") checkAlarmCondition();
  if (alarm.name === "autoFetchCP") autoFetchAllServers();
});

// Run once immediately on script wake
checkAlarmCondition();
autoFetchAllServers();

// =========================================================================
//  AUTO-FETCH: Scan all tracked servers in the background
// =========================================================================

/**
 * Ask all open Travian tabs to re-scan via their content scripts (which have
 * full cookie / session access). For any tracked server that has NO open tab,
 * fall back to the background-fetch approach.
 */
async function autoFetchAllServers() {
  const { tsp_servers: servers = [] } = await api.storage.local.get("tsp_servers");
  if (servers.length === 0) return;

  // 1. Find all open Travian tabs
  const tabs = await api.tabs.query({});
  const travianTabs = tabs.filter((t) => t.url && t.url.includes("travian."));

  // 2. Ask each Travian tab to re-scan — track which server origins responded
  const scannedOrigins = new Set();

  const rescanPromises = travianTabs.map((tab) => {
    return api.tabs
      .sendMessage(tab.id, { action: "RESCAN" })
      .then((resp) => {
        if (resp?.success && resp.origin) scannedOrigins.add(resp.origin);
      })
      .catch(() => {}); // Tab may not have content script ready
  });

  await Promise.allSettled(rescanPromises);

  // 3. Fall back to background fetch for servers with no open tab
  for (const url of servers) {
    if (!scannedOrigins.has(url)) {
      await fetchServerData(url);
    }
  }
}

// =========================================================================
//  ALARM CONDITION CHECK
// =========================================================================

/**
 * Extrapolate current CP via the shared deterministic predictor and check
 * whether the target has been reached.
 */
async function checkAlarmCondition() {
  const meta = await api.storage.local.get(["tsp_last_viewed", "tsp_is_muted"]);

  if (meta.tsp_is_muted || !meta.tsp_last_viewed) return;

  const serverUrl = meta.tsp_last_viewed;
  const key = storageKey(serverUrl);
  const tKey = targetCpKey(serverUrl);
  const result = await api.storage.local.get([key, tKey]);
  const data = result[key];
  if (!data) return;

  const speed = data.speed || 1;

  // --- Determine target ---
  let target = result[tKey];
  if (!target) {
    const thresholds = CP_REQUIREMENTS[speed] || CP_REQUIREMENTS[1];
    target = thresholds.find((th) => th > (data.totalCp || 0)) || 0;
  }
  if (target <= 0) return;

  // --- Predict current CP at "now" ---
  const now = Date.now();
  const dt = (now - (data.lastUpdate || now)) / 1000;
  let dailyCp = data.actualDailyCp || 0;
  if (!dailyCp) {
    dailyCp = (data.villages || []).reduce((s, v) => s + v.cpProduction, 0);
  }

  const { currentCp } = predictSettlement({
    totalCp: data.totalCp || 0,
    passiveRate: dailyCp / SECS_PER_DAY,
    passiveAccel: data.passiveAccel || 0,
    villages: data.villages || [],
    speed,
    target,
    dt,
  });

  // --- Trigger or clear alarm ---
  if (currentCp >= target) {
    if (!isSnoozed && !alarmActive) startAlarm();
  } else {
    isSnoozed = false;
    if (alarmActive) stopAlarm();
  }
}

// =========================================================================
//  SERVER DATA FETCHING
// =========================================================================

/**
 * Fetch CP data from a Travian server by scraping two pages:
 *   1. /village/statistics/culturepoints — village list + timers
 *   2. /statistics — daily production, total CP, progression graph data
 *
 * Merges new data with existing stored data to preserve user settings
 * (town hall levels, celebration toggles).
 *
 * @param {string} baseUrl - Any URL on the target server
 * @returns {boolean} True if scan succeeded
 */
async function fetchServerData(baseUrl) {
  try {
    const origin = new URL(baseUrl).origin;
    const villageUrl = `${origin}/village/statistics/culturepoints`;
    const statsUrl = `${origin}/statistics/general`;

    api.action.setBadgeText({ text: "⟳" });
    api.action.setBadgeBackgroundColor({ color: "#71d000" });

    const [villageRes, statsRes] = await Promise.all([
      fetch(villageUrl, { credentials: "include" }).catch(() => null),
      fetch(statsUrl, { credentials: "include" }).catch(() => null),
    ]);

    // If both requests failed or returned non-OK, bail early
    if ((!villageRes || !villageRes.ok) && (!statsRes || !statsRes.ok)) {
      api.action.setBadgeText({ text: "" });
      return false;
    }

    let actualDailyCp = 0;
    let cpCandidates = [];
    let scannedVillages = [];
    let progression = null;

    // --- Parse /statistics/general page ---
    if (statsRes?.ok) {
      const text = await statsRes.text();

      const dailyMatch = text.match(/"perDay":\s*\{[^}]*?"cpProduction":\s*(\d+)/);
      if (dailyMatch) actualDailyCp = parseInt(dailyMatch[1], 10);

      const totalMatch = text.match(/"soFar":\s*\{[^}]*?"cpProduction":\s*(\d+)/);
      if (totalMatch) cpCandidates.push(parseInt(totalMatch[1], 10));

      // Fallback: viewData has cpProducedForNextSlot
      const cpProducedMatch = text.match(/"cpProducedForNextSlot":\s*(\d+)/);
      if (cpProducedMatch) cpCandidates.push(parseInt(cpProducedMatch[1], 10));

      // Historical daily-rate series → rate-growth trend
      progression = extractProgression(text);
    }

    // --- Parse /village/statistics/culturepoints page ---
    // Uses regex instead of DOMParser (unavailable in MV3 service workers)
    if (villageRes?.ok) {
      const text = await villageRes.text();

      // Extract CP bar value from #stockBar .culturePoints .value or .cp-value
      const cpBarMatch =
        text.match(
          /class="[^"]*(?:culturePoints|cp-value)[^"]*"[^>]*>[\s\S]*?class="[^"]*value[^"]*"[^>]*>([\d.,\s]+)</,
        ) || text.match(/class="[^"]*cp-value[^"]*"[^>]*>([\d.,\s]+)</);
      if (cpBarMatch) cpCandidates.push(parseGameNumber(cpBarMatch[1]));

      // Fallback: viewData has cpProducedForNextSlot
      const cpProducedMatch = text.match(/"cpProducedForNextSlot":\s*(\d+)/);
      if (cpProducedMatch) cpCandidates.push(parseInt(cpProducedMatch[1], 10));

      // Extract rows from table#culture_points — match tr.hover and tr.hl rows
      const rowRegex = /<tr[^>]+class="[^"]*(?:hover|hl)[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(text)) !== null) {
        const rowHtml = rowMatch[1];

        // Village name: <td class="vil ...">name</td>
        const nameMatch = rowHtml.match(/<td[^>]+class="[^"]*\bvil\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
        const rawName = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, "").trim() : null;
        if (!rawName) continue;

        // CP production: <td class="cps ...">number</td>
        const cpsMatch = rowHtml.match(/<td[^>]+class="[^"]*\bcps\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
        const cpProd = cpsMatch ? parseGameNumber(cpsMatch[1].replace(/<[^>]+>/g, "").trim()) : 0;

        // Timer: <span class="timer" value="12345">
        const timerMatch = rowHtml.match(/<[^>]+class="[^"]*\btimer\b[^"]*"[^>]*value="(\d+)"/);
        const timerSecs = timerMatch ? parseInt(timerMatch[1], 10) || 0 : 0;

        scannedVillages.push({ name: rawName, cpProduction: cpProd, timerSeconds: timerSecs });
      }
    }

    // Best CP value = highest among all candidates
    cpCandidates = cpCandidates.filter((n) => !isNaN(n) && n > 0);
    const currentTotal = cpCandidates.length > 0 ? Math.max(...cpCandidates) : 0;

    // --- Merge with stored data ---
    const key = storageKey(origin);
    const storage = await api.storage.local.get(key);
    const data = storage[key] || {};

    let mergedVillages = data.villages || [];
    if (scannedVillages.length > 0) {
      mergedVillages = scannedVillages.map((newV) => {
        const existing = (data.villages || []).find((ov) => ov.name === newV.name);
        let smallCel = false,
          largeCel = false;

        if (newV.timerSeconds > 0) {
          // Preserve large celebration flag if previously set by user
          if (existing?.largeCel) largeCel = true;
          else smallCel = true;
        }

        return {
          name: newV.name,
          cpProduction: newV.cpProduction,
          townHall: existing?.townHall ?? 1,
          smallCel,
          largeCel,
          timerSeconds: newV.timerSeconds,
        };
      });
    }

    // Build update payload (only include fields with valid data)
    const updates = { villages: mergedVillages };
    const hasTimerData = scannedVillages.some((v) => v.timerSeconds > 0);
    if (currentTotal > 0 || hasTimerData) {
      if (currentTotal > 0) updates.totalCp = currentTotal;
      updates.lastUpdate = Date.now();
    }
    if (actualDailyCp > 0) updates.actualDailyCp = actualDailyCp;

    // --- Rate-trend estimate from the production-history graph ---
    if (progression) updates.passiveAccel = computeRateSlope(progression);

    await api.storage.local.set({ [key]: { ...data, ...updates } });
    api.action.setBadgeText({ text: "" });
    return true;
  } catch {
    // Network failure, parser regex miss, or storage write rejection.
    // We don't surface these — the next periodic fetch will retry,
    // and stale data in storage is better than crashing the worker.
    api.action.setBadgeText({ text: "" });
    return false;
  }
}
