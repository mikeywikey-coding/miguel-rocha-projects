/**
 * TRAVIAN WATCHMAN PRO - ENTRY POINT
 * Version: 5.9 (Remote Fetch, Auto-Regen, Auto-Prod Fetch & Server Isolation)
 *
 * Load order (manifest.json):
 *   state.js → helpers.js → fetchers.js → scanners.js → ui.js → content.js
 */

// ==========================================
// MESSAGE LISTENER
// ==========================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_CONTEXT_ADD") {
    let prefilled = generateSmartBuildingName();

    if (
      prefilled === CROP_OVERVIEW_LABEL ||
      window.location.pathname.includes("dorf1.php")
    ) {
      const cropAlarms = scanResources();

      if (cropAlarms && cropAlarms.length > 0) {
        api.runtime
          .sendMessage({
            type: "REFRESH_ALARMS",
            buildings: cropAlarms,
          })
          .then(() => syncState(true));
        return;
      }
    }

    prefilled = prefilled.replace(/,/g, "").replace(/\s+/g, " ").trim();
    setTimeout(() => {
      const name = prompt("Enter Alarm Name:", prefilled);
      if (!name) return;
      let text = msg.selectionText;
      let sourceNode = null;
      if (!text) {
        sourceNode = document.querySelector(
          ".window .timer, #content .timer, .buildDuration .timer",
        );
        if (sourceNode) text = sourceNode.innerText;
      }
      let d = calculateDelayFromSmartText(text, sourceNode);
      if (d === null) {
        const t = prompt(
          "Could not auto-detect time. Enter duration (e.g. 15, 1:30):",
        );
        if (t) d = parseSmartDuration(t);
      }
      if (d !== null && d > 0) {
        api.runtime
          .sendMessage({
            type: "REFRESH_ALARMS",
            buildings: [
              {
                name: `⭐ ${name} | ${getActiveVillageName()} ${serverTag}`,
                delay: d - 5000,
                customType: "manual",
              },
            ],
          })
          .then(() => syncState(true));
      }
    }, 50);
  }
});

// ==========================================
// STARTUP
// ==========================================
const jitterMs = (ms) => Math.round(ms * (0.7 + Math.random() * 0.8));

const TIMING_INTERVALS = {
  STATE_SYNC: 200,
  TRAINING_INITIAL: 3000,
  TRAINING_REPEAT: 300000, // 5 min
  WAREHOUSE_INITIAL: 5000,
  WAREHOUSE_REPEAT: 120000, // 2 min
  CELEBRATIONS_INITIAL: 7000,
  CELEBRATIONS_REPEAT: 600000, // 10 min
  STORAGE_REGEN: 90000, // 1.5 min
  ATTACK_CHECK_INITIAL: 10000,
  ATTACK_CHECK_REPEAT: 120000, // 2 min
  HERO_INITIAL: 3000,
  HERO_REPEAT: 60000,
};

const _activeIntervals = [];
let _scanObserver = null;
let _rafId = null;

const STORAGE_ALARM_ICONS = ["📦", "🌾"];

/** Detects newly-fired storage/resource alarms and triggers an immediate warehouse re-fetch. */
function checkFiredStorageAlarms() {
  const now = Date.now();
  let anyNewlyFired = false;

  currentAlarms.forEach((a) => {
    const isStorageAlarm =
      STORAGE_ALARM_ICONS.some((ic) => a.name.includes(ic)) ||
      a.customType === "storage";
    if (!isStorageAlarm) return;
    const uid = a.id || a.name;
    if (a.scheduledTime <= now && !_firedResourceAlarms.has(uid)) {
      _firedResourceAlarms.add(uid);
      anyNewlyFired = true;
    }
  });

  // Remove entries for alarms that no longer exist
  const activeUids = new Set(currentAlarms.map((a) => a.id || a.name));
  for (const uid of _firedResourceAlarms) {
    if (!activeUids.has(uid)) _firedResourceAlarms.delete(uid);
  }

  if (anyNewlyFired) {
    fetchState.warehouse.lastTime = 0; // Reset cooldown to allow immediate re-fetch
    fetchWarehouseData();
  }
}

function startLoops() {
  _activeIntervals.push(
    setInterval(syncState, jitterMs(TIMING_INTERVALS.STATE_SYNC)),
  );
  setTimeout(fetchTrainingData, jitterMs(TIMING_INTERVALS.TRAINING_INITIAL));
  _activeIntervals.push(
    setInterval(fetchTrainingData, jitterMs(TIMING_INTERVALS.TRAINING_REPEAT)),
  );
  setTimeout(fetchWarehouseData, jitterMs(TIMING_INTERVALS.WAREHOUSE_INITIAL));
  _activeIntervals.push(
    setInterval(
      fetchWarehouseData,
      jitterMs(TIMING_INTERVALS.WAREHOUSE_REPEAT),
    ),
  );
  setTimeout(
    fetchCelebrationsData,
    jitterMs(TIMING_INTERVALS.CELEBRATIONS_INITIAL),
  );
  _activeIntervals.push(
    setInterval(
      fetchCelebrationsData,
      jitterMs(TIMING_INTERVALS.CELEBRATIONS_REPEAT),
    ),
  );

  // Auto-re-fetch warehouse when storage alarms expire (lightweight piggyback)
  _activeIntervals.push(
    setInterval(
      checkFiredStorageAlarms,
      jitterMs(TIMING_INTERVALS.STORAGE_REGEN),
    ),
  );
  setTimeout(
    checkResourceVillageAttacks,
    jitterMs(TIMING_INTERVALS.ATTACK_CHECK_INITIAL),
  );
  _activeIntervals.push(
    setInterval(
      checkResourceVillageAttacks,
      jitterMs(TIMING_INTERVALS.ATTACK_CHECK_REPEAT),
    ),
  );
  setTimeout(fetchHeroData, jitterMs(TIMING_INTERVALS.HERO_INITIAL));
  _activeIntervals.push(
    setInterval(fetchHeroData, jitterMs(TIMING_INTERVALS.HERO_REPEAT)),
  );
  const loop = () => {
    tick();
    _rafId = requestAnimationFrame(loop);
  };
  _rafId = requestAnimationFrame(loop);
  // Ignore mutations whose target lives inside our own widget — otherwise the
  // re-render scan() performs (innerHTML writes inside #_tw-w) triggers this
  // observer, which fires scan(), which re-renders the widget … a render loop
  // that thrashes the section-body scroll position whenever the user tries to
  // scroll inside a category.
  _scanObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      let n = m.target;
      let internal = false;
      while (n && n !== document.body) {
        if (n.id === "_tw-w" || n.id === "_tw-tt") {
          internal = true;
          break;
        }
        n = n.parentNode;
      }
      if (!internal) {
        scan();
        return;
      }
    }
  });
  _scanObserver.observe(document.body, { childList: true, subtree: true });

  scan();
}

window.addEventListener("pagehide", () => {
  _activeIntervals.forEach((id) => clearInterval(id));
  _activeIntervals.length = 0;
  if (_scanObserver) {
    _scanObserver.disconnect();
    _scanObserver = null;
  }
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
});

const { timerWidget, listContainer, toggleBtn, audioBtn } = createWidget();
loadShortcuts();
Promise.all([restoreSectionState(), restoreVillageColors()]).then(() =>
  startLoops(),
);
