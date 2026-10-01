/* global TSP */
/**
 * content.js — Travian Settlement Planner: Content Script
 *
 * Injected into Travian pages. Responsibilities:
 *   1. Scan the current page for CP data (total, daily, village list)
 *   2. Extract progression graph data for trend analysis
 *   3. Register this server in the tracked servers list
 *   4. Play/stop alarm audio when instructed by background.js
 *
 * All constants and utilities come from shared.js (loaded first via manifest).
 */

"use strict";

const { api, parseGameNumber, extractProgression, computeRateSlope, storageKey } = TSP;

// =========================================================================
//  ALARM AUDIO
// =========================================================================

let alarmAudio = null;

api.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "RESCAN") {
    // Background asks us to re-scan this page (we have full cookie access)
    const origin = new URL(window.location.href).origin;
    scanPage()
      .then(() => sendResponse({ success: true, origin }))
      .catch(() => sendResponse({ success: false, origin }));
    return true; // Keep channel open for async response
  }

  if (request.action === "PLAY_ALARM") {
    if (!alarmAudio) {
      alarmAudio = new Audio(api.runtime.getURL("alarm.mp3"));
      alarmAudio.loop = true;
    }
    // .play() rejects under Chrome's autoplay policy until the page has
    // had a user gesture. Swallow the rejection silently — the player
    // will hear the alarm the next time they interact with the tab.
    alarmAudio.play().catch(() => {});
  } else if (request.action === "STOP_ALARM") {
    if (alarmAudio) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
  }
});

// =========================================================================
//  PAGE SCANNING
// =========================================================================

/** CSS selectors where Travian displays the current total CP */
const CP_SELECTORS = [
  ".cpProduction span",
  "#stockBar .culturePoints .value",
  ".expansion-tab .cp-value",
];

/**
 * Scan the current Travian page for CP data and save to extension storage.
 *
 * Extracts:
 *   - Total CP (from DOM elements or embedded JSON)
 *   - Daily CP production (from embedded JSON)
 *   - Village list with CP production per village
 *   - Progression graph data → trend analysis (growth, jerk, snap)
 *   - Server speed (from URL pattern like `.x3.`)
 */
async function scanPage() {
  const origin = new URL(window.location.href).origin;

  // Detect server speed from hostname (e.g., ts5.x3.travian.com)
  const speedMatch = window.location.host.match(/\.x(\d+)\./);
  const speed = speedMatch ? parseInt(speedMatch[1], 10) : 1;

  // --- Register this server ---
  const { tsp_servers: servers = [] } = await api.storage.local.get("tsp_servers");
  if (!servers.includes(origin)) {
    await api.storage.local.set({ tsp_servers: [...servers, origin] });
  }

  // --- Load existing data ---
  const key = storageKey(origin);
  const storage = await api.storage.local.get(key);
  const data = storage[key] || {};

  // --- Extract data from page HTML ---
  const html = document.documentElement.outerHTML;

  let actualDailyCp = 0;
  const dailyMatch = html.match(/"perDay":\s*\{[^}]*?"cpProduction":\s*(\d+)/);
  if (dailyMatch) actualDailyCp = parseInt(dailyMatch[1], 10);

  const cpCandidates = [];
  const totalMatch = html.match(/"soFar":\s*\{[^}]*?"cpProduction":\s*(\d+)/);
  if (totalMatch) cpCandidates.push(parseInt(totalMatch[1], 10));

  // Read CP from DOM elements
  for (const sel of CP_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) cpCandidates.push(parseGameNumber(el.innerText));
  }

  // Best CP = highest valid candidate
  const validCp = cpCandidates.filter((n) => !isNaN(n) && n > 0);
  const currentTotal = validCp.length > 0 ? Math.max(...validCp) : 0;

  // --- Parse village table ---
  const tableRows = document.querySelectorAll(
    "table#culture_points tr.hover, table#culture_points tr.hl",
  );

  let mergedVillages = data.villages || [];
  if (tableRows.length > 0) {
    const scanned = [];
    tableRows.forEach((row) => {
      const name = row.querySelector("td.vil")?.innerText.trim();
      const cpProd = parseGameNumber(row.querySelector("td.cps")?.innerText);
      const hasTimer = !!row.querySelector("td.cel .timer");
      if (name) scanned.push({ name, cpProduction: cpProd, hasTimer });
    });

    if (scanned.length > 0) {
      mergedVillages = scanned.map((newV) => {
        const existing = (data.villages || []).find((v) => v.name === newV.name);
        return {
          name: newV.name,
          cpProduction: newV.cpProduction,
          townHall: existing?.townHall ?? 1,
          smallCel: existing?.smallCel ?? (newV.hasTimer && !existing?.largeCel),
          largeCel: existing?.largeCel ?? false,
          timerSeconds: 0,
        };
      });
    }
  }

  // --- Save merged data ---
  const updates = { villages: mergedVillages, speed };
  if (currentTotal > 0) {
    updates.totalCp = currentTotal;
    updates.lastUpdate = Date.now();
  }
  if (actualDailyCp > 0) updates.actualDailyCp = actualDailyCp;

  // --- Rate-trend estimate from the production-history graph ---
  // `progression.perDay` is the historical passive daily-rate series; its
  // slope tells us how fast production is still climbing as buildings finish.
  const progression = extractProgression(html);
  if (progression) updates.passiveAccel = computeRateSlope(progression);

  await api.storage.local.set({ [key]: { ...data, ...updates } });
}

// =========================================================================
//  INITIALIZATION
// =========================================================================

// Scan on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanPage);
} else {
  scanPage();
}

// Re-scan when the user clicks one of the graph tabs. Travian loads the new
// data for that tab via AJAX, so we wait ~700ms for the DOM to settle before
// rescanning. A fixed delay is sufficient — the click is user-initiated and
// not on a polling loop, so it never gets repetitive enough to need throttling.
document.addEventListener("click", (e) => {
  if (e.target.closest(".legendTabs .tab") || e.target.closest(".dataSwitchButtons .iconButton")) {
    setTimeout(scanPage, 700);
  }
});

// Stop any alarm audio when the player navigates away.
window.addEventListener("pagehide", () => {
  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.src = "";
    alarmAudio = null;
  }
});
