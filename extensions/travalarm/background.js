/**
 * TRAVIAN WATCHMAN PRO - BACKGROUND SCRIPT
 * Version: 6.0 (MV3 Service Worker — audio via Offscreen API)
 *
 * Audio playback is handled by offscreen.js via the Chrome Offscreen API.
 * The offscreen document receives PLAY_SOUND / STOP_SOUND / SET_VOLUME messages.
 */

/* global chrome */

let alarms = [];
const DEFAULT_SOUND_CATEGORIES = {
  attack: true,
  hero: true,
  building: true,
  farmlist: true,
  storage: true,
  training: true,
  culture: true,
  custom: true,
  daily: true,
  auto: true,
};
let soundCategories = { ...DEFAULT_SOUND_CATEGORIES };
let volume = 80;
const ignoredAttacks = new Set();
let _stateLoaded = false;

/**
 * Extracts a stable village key from a siren alarm name.
 * Variants we need to map to the same key:
 *   `🚨 Attack on v1 (Scanning...) [tag]`
 *   `🚨 Attack on v1 @ 01:18:21 [tag]`
 * Both should yield `SIREN_v1` so dismissing the village-level scanning
 * siren doesn't accidentally block future per-wave sirens, AND per-wave
 * dismissals don't pollute the set with hundreds of impact-keyed entries.
 */
function getSirenKey(alarmName) {
  const match = alarmName.match(
    /Attack on (.+?)(?:\s+@\s+\d|\s*\(|\s*\[)/,
  );
  return match ? `SIREN_${match[1].trim()}` : alarmName;
}

let soundBroadcastState = "stopped"; // "stopped" | "normal" | "attack"

const STORAGE_KEYS = {
  ALARMS: "_w4a",
  SOUND_CATEGORIES: "_w4sc_snd",
  IGNORED_ATTACKS: "_w4ia",
  VOLUME: "_w4vol",
};
const ALARM_TICK = "_w4tick";

const DUPLICATE_THRESHOLD_MS = 5000; // two alarms with the same name within 5s = duplicate

// ==========================================
// CONTEXT MENU
// ==========================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "_tw-ctx",
    title: "Add to Alarm List",
    contexts: ["all"],
  });
  ensureTickAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureTickAlarm();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "_tw-ctx") {
    chrome.tabs
      .sendMessage(tab.id, {
        type: "OPEN_CONTEXT_ADD",
        selectionText: info.selectionText || "",
      })
      .catch(() => {});
  }
});

// ==========================================
// TICK ALARM (replaces setInterval for MV3)
// ==========================================

function ensureTickAlarm() {
  chrome.alarms.get(ALARM_TICK, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });
    }
  });
}

// Precision tick: schedule a one-shot wake-up at the earliest upcoming alarm's
// scheduledTime so we don't wait up to 60s for the periodic tick.
const PRECISION_TICK = "_w4pt";
let _precisionTimeout = null;

function schedulePreciseTick() {
  // Find the earliest unsilenced, un-notified alarm in the future
  const now = Date.now();
  let earliest = Infinity;
  for (const a of alarms) {
    if (a.silenced || a.notified) continue;
    if (a.scheduledTime > now && a.scheduledTime < earliest) {
      earliest = a.scheduledTime;
    }
  }
  if (earliest === Infinity) return;

  const delayMs = earliest - now;

  // For short delays (< 62s), use setTimeout as a reliable backup.
  // Service workers stay alive while there are pending events/promises,
  // and setTimeout within active execution keeps the SW alive for short
  // durations. chrome.alarms has a ~30s minimum in MV3 and may be
  // clamped, so setTimeout is more precise for short waits.
  clearTimeout(_precisionTimeout);
  if (delayMs < 62000) {
    _precisionTimeout = setTimeout(
      () => {
        _precisionTimeout = null;
        runAlarmTick();
      },
      Math.max(delayMs, 100),
    ); // At least 100ms to avoid tight loops
  }

  // Also schedule a chrome.alarms one-shot as a durable fallback.
  // chrome.alarms persists across SW restarts. The min delay may be
  // clamped to ~30s, but it still reduces worst-case from 60s to ~30s.
  chrome.alarms.create(PRECISION_TICK, { when: earliest });
}

// ==========================================
// AUDIO DELEGATION (via Offscreen API)
// ==========================================

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function ensureOffscreen() {
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play alarm sounds for expired timers",
    });
  } catch {
    // Already exists — fine
  }
}

function classifyAlarmCategory(a) {
  const n = a.name || "";
  if (a.customType === "attack" || n.includes("🚨") || n.includes("⚠️"))
    return "attack";
  if (n.includes("⚔️")) return "hero";
  if (n.includes("🎓")) return "training";
  if (n.includes("🎉")) return "culture";
  if (a.customType === "storage" || n.includes("📦")) return "storage";
  if (a.customType === "farmlist") return "farmlist";
  if (a.customType === "daily") return "daily";
  if (n.startsWith("⭐")) return a.customType === "manual" ? "custom" : "auto";
  return "building";
}

async function startAlarmSound(type) {
  soundBroadcastState = type;
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: "SET_VOLUME", volume });
  chrome.runtime.sendMessage({ type: "PLAY_SOUND", soundType: type });
}

async function stopAlarmSound() {
  if (soundBroadcastState === "stopped") return;
  soundBroadcastState = "stopped";
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: "STOP_SOUND" });
}

// ==========================================
// STATE
// ==========================================

// Resolves once storage has been loaded into memory.
// GET_ACTIVE_ALARMS waits on this so a freshly-woken service worker never
// returns an empty alarm list before storage has been restored.
let _stateReadyResolve;
const stateReady = new Promise((resolve) => {
  _stateReadyResolve = resolve;
});

// Load State — runAlarmTick() deferred until storage is restored
chrome.storage.local
  .get([
    STORAGE_KEYS.ALARMS,
    STORAGE_KEYS.SOUND_CATEGORIES,
    STORAGE_KEYS.IGNORED_ATTACKS,
    STORAGE_KEYS.VOLUME,
  ])
  .then((res) => {
    const savedAlarms = (res[STORAGE_KEYS.ALARMS] || []).map((a) => ({
      ...a,
      id: a.id || generateId(),
      isPinned: a.isPinned || false,
    }));

    // Merge
    const combined = [...savedAlarms, ...alarms];
    const uniqueMap = new Map();
    combined.forEach((item) => {
      const key = item.id || item.name;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    alarms = Array.from(uniqueMap.values());
    if (res[STORAGE_KEYS.SOUND_CATEGORIES]) {
      soundCategories = {
        ...DEFAULT_SOUND_CATEGORIES,
        ...res[STORAGE_KEYS.SOUND_CATEGORIES],
      };
    }
    if (res[STORAGE_KEYS.VOLUME] != null) volume = res[STORAGE_KEYS.VOLUME];

    // Restore ignored attacks so dismissed sirens aren't recreated after SW restart.
    // Migration: an older format keyed per-wave (`SIREN_v1 @ 01:18:21`) — drop
    // those so they don't permanently block future per-wave sirens for that
    // wave's impact time. New code uses village-only keys (`SIREN_v1`).
    if (res[STORAGE_KEYS.IGNORED_ATTACKS]) {
      res[STORAGE_KEYS.IGNORED_ATTACKS].forEach((key) => {
        if (!key.includes(" @ ")) ignoredAttacks.add(key);
      });
    }

    // Signal that state is ready — deferred GET_ACTIVE_ALARMS can now respond
    _stateLoaded = true;
    _stateReadyResolve();

    // Now safe to run the tick — alarms array is populated from storage
    runAlarmTick();
  });

function saveState() {
  // Guard: don't overwrite persisted data before storage has loaded into memory.
  // A cold SW wake receives messages before the storage .then() resolves —
  // calling saveState() then would persist empty defaults, wiping all alarms.
  if (!_stateLoaded) return;
  chrome.storage.local.set({
    [STORAGE_KEYS.ALARMS]: alarms,
    [STORAGE_KEYS.SOUND_CATEGORIES]: soundCategories,
    [STORAGE_KEYS.IGNORED_ATTACKS]: Array.from(ignoredAttacks),
    [STORAGE_KEYS.VOLUME]: volume,
  });
}

// ==========================================
// ALARM TICK LOGIC
// ==========================================

function runAlarmTick() {
  const now = Date.now();
  let shouldSave = false;
  let triggerSound = false;
  let soundType = "normal";

  const specialRegex = /[⭐⚔️⚠️🌾🎉🪵🧱🔩📦🎓]/;

  // Auto-delete expired ⚠️ attack tracker alarms (attack already landed)
  const expiredTrackers = [];
  alarms.forEach((a) => {
    if (
      a.customType === "attack" &&
      a.name.includes("⚠️") &&
      now >= a.scheduledTime
    ) {
      expiredTrackers.push(a.id);
    }
  });
  if (expiredTrackers.length > 0) {
    alarms = alarms.filter((a) => !expiredTrackers.includes(a.id));
    shouldSave = true;

    // If no more active ⚠️ trackers remain, also clean up 🚨 sirens (attack has landed)
    const hasActiveTrackers = alarms.some(
      (a) => a.customType === "attack" && a.name.includes("⚠️"),
    );
    if (!hasActiveTrackers) {
      alarms = alarms.filter(
        (a) => !(a.customType === "attack" && a.name.includes("🚨")),
      );
      ignoredAttacks.clear(); // No active attacks → safe to reset
    }
  }

  // Clean up orphaned 🚨 sirens: sirens that have been notified for over 60s
  // with no corresponding ⚠️ tracker. This catches the case where the rally
  // point fetch failed and no tracker was ever created — without this, the
  // siren would persist in storage and re-trigger the attack sound indefinitely.
  const hasAnyTrackers = alarms.some(
    (a) => a.customType === "attack" && a.name.includes("⚠️"),
  );
  if (!hasAnyTrackers) {
    const ORPHAN_THRESHOLD_MS = 60000; // 60s grace period for fetch to complete
    const orphanedSirens = alarms.filter(
      (a) =>
        a.customType === "attack" &&
        a.name.includes("🚨") &&
        a.notified &&
        now - a.scheduledTime > ORPHAN_THRESHOLD_MS,
    );
    if (orphanedSirens.length > 0) {
      const orphanIds = new Set(orphanedSirens.map((a) => a.id));
      alarms = alarms.filter((a) => !orphanIds.has(a.id));
      ignoredAttacks.clear();
      shouldSave = true;
    }
  }

  const landingAlarmsToAdd = [];
  const sirenIdsToRemove = new Set();
  alarms.forEach((a) => {
    if (now >= a.scheduledTime && !a.silenced) {
      const justFired = !a.notified;
      shouldSave = true;
      a.notified = true;

      let thisAlarmIsAttack = a.customType === "attack";
      let isAudible = false;

      if (!a.noSound) {
        const category = classifyAlarmCategory(a);
        if (soundCategories[category] !== false) isAudible = true;
      }

      if (isAudible) {
        triggerSound = true;
        if (thisAlarmIsAttack) soundType = "attack";
      }

      // Attack-Imminent cascade: when the ⚠️ tracker first fires, queue a
      // follow-up `💥 Attack Landing` alarm scheduled for the actual impact
      // time (20s out), and drop the detection siren for this wave — it's
      // served its purpose.
      if (
        justFired &&
        thisAlarmIsAttack &&
        a.name.startsWith("⚠️ Attack Imminent:")
      ) {
        const im = a.name.match(/ @ (\d{2}):(\d{2}):(\d{2})/);
        const tagMatch = a.name.match(/\[[^\]]+\]\s*$/);
        const hm = a.name.match(/^⚠️ Attack Imminent: (.+?) @ /);
        if (im && hm) {
          const impactDate = new Date(now);
          impactDate.setHours(
            parseInt(im[1], 10),
            parseInt(im[2], 10),
            parseInt(im[3], 10),
            0,
          );
          if (impactDate.getTime() < now - 3600 * 1000) {
            impactDate.setDate(impactDate.getDate() + 1);
          }
          const impactMs = impactDate.getTime();
          const tag = tagMatch ? tagMatch[0] : "";
          const headline = hm[1];
          const impactStr = `${im[1]}:${im[2]}:${im[3]}`;

          if (impactMs > now + 500) {
            const landingName = `💥 Attack Landing: ${headline} @ ${impactStr} ${tag}`.trim();
            const exists = alarms.some((x) => x.name === landingName);
            if (!exists) {
              landingAlarmsToAdd.push({
                id: generateId(),
                name: landingName,
                scheduledTime: impactMs,
                customType: "attack",
                notified: false,
                silenced: false,
                createdAt: now,
                // Landing is visual-only — siren already played at detection
                // (🚨) and at the 20s warning (⚠️). Screaming after impact
                // has landed adds no value.
                noSound: true,
              });
            }
          }

          // Clear the detection siren for this same wave (matched by impact
          // time string + serverTag).
          const sirenMarker = ` @ ${impactStr} `;
          alarms.forEach((x) => {
            if (
              x.customType === "attack" &&
              x.name.startsWith("🚨 ") &&
              x.name.includes(sirenMarker) &&
              (!tag || x.name.endsWith(tag))
            ) {
              sirenIdsToRemove.add(x.id);
            }
          });
        }
      }
    }
  });

  if (landingAlarmsToAdd.length > 0 || sirenIdsToRemove.size > 0) {
    if (sirenIdsToRemove.size > 0) {
      alarms = alarms.filter((a) => !sirenIdsToRemove.has(a.id));
    }
    if (landingAlarmsToAdd.length > 0) {
      alarms.push(...landingAlarmsToAdd);
    }
    shouldSave = true;
  }

  if (shouldSave) saveState();

  if (triggerSound) {
    // Don't downgrade attack sound to normal if attack is already playing
    if (!(soundBroadcastState === "attack" && soundType === "normal")) {
      startAlarmSound(soundType);
    }
  } else {
    stopAlarmSound();
  }

  // Schedule a precise wake-up for the next upcoming alarm so we don't
  // wait up to 60s for the periodic tick to detect it.
  schedulePreciseTick();
}

// Run tick on every chrome.alarms fire — wait for storage to load first
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_TICK || alarm.name === PRECISION_TICK) {
    stateReady.then(() => runAlarmTick());
  }
});

// Ensure tick alarm exists on wake (runAlarmTick is called after storage loads above)
ensureTickAlarm();

// ==========================================
// HELPERS
// ==========================================

/**
 * Removes stale alarms of a given type that are no longer in the active set.
 * @param {string} type - customType to filter (e.g. "resource", "storage", "culture")
 * @param {string[]} activeNames - names still valid on the page
 * @param {string} serverTag - server identifier to scope the cleanup
 * @param {boolean} [keepExpired=false] - if true, keep alarms that have already fired
 * @param {boolean} [ignoreSilenced=false] - if true, silenced alarms are still removed when not in activeNames
 */
function filterStaleAlarms(
  type,
  activeNames,
  serverTag,
  keepExpired = false,
  ignoreSilenced = false,
) {
  const activeSet = new Set(activeNames || []);
  alarms = alarms.filter((a) => {
    if (a.customType !== type) return true;
    if (!a.name.includes(serverTag)) return true;
    if (keepExpired && a.scheduledTime <= Date.now()) return true;
    if (!ignoreSilenced && a.silenced) return true;
    return activeSet.has(a.name);
  });
}

// ==========================================
// MESSAGE LISTENER
// ==========================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case "REFRESH_ALARMS":
      // INVARIANT: Gate on stateReady to prevent SW cold-wake duplication.
      // Without this wrapper, messages arriving before storage-load completes push
      // into an empty in-memory `alarms` array with a fresh generateId(). When storage
      // load finishes, the merge at line ~178 keys on `id || name` — both the saved
      // alarm (old id) and the just-pushed one (new id) survive, producing name-level
      // duplicates that CLEAR_STALE_* cannot remove. See learnings 2026-04-22 (hero)
      // and 2026-04-17 (non-hero). Mirror of GET_ACTIVE_ALARMS pattern below.
      stateReady.then(() => {
        msg.buildings.forEach((newB) => {
          const delay = parseInt(newB.delay, 10);
          if (isNaN(delay) || delay < 0) return;

          const now = Date.now();
          const newScheduledTime = now + delay;

          if (newB.customType === "attack") {
          if (ignoredAttacks.has(getSirenKey(newB.name))) return;
          // Tracker names embed a `(detected HH:MM)` timestamp captured at
          // first sighting. Exact-name match would treat every page refresh
          // as a fresh attack. Match trackers by their stable prefix
          // (`⚠️ <headline>`) instead; sirens (🚨) and other attack alarms
          // continue to use exact-name match.
          const isTracker = newB.name.startsWith("⚠️ ");
          const isSiren = newB.name.startsWith("🚨 ");
          // Tracker names embed `@ HH:MM:SS` (absolute impact time). Parse
          // that to dedup across refreshes — `scheduledTime` drifts when the
          // 20s dodge-lead clamps near impact, but impact time is stable.
          const parseImpactMs = (name) => {
            const m = name && name.match(/ @ (\d{2}):(\d{2}):(\d{2})/);
            if (!m) return null;
            const now = new Date();
            const t = new Date(now);
            t.setHours(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), 0);
            if (t.getTime() < now.getTime() - 3600 * 1000) {
              t.setDate(t.getDate() + 1);
            }
            return t.getTime();
          };
          let headlineOnly = null;
          if (isTracker) {
            const m = newB.name.match(/^(⚠️ .+?)(?:\s\(wave\s×\d+\))?\s@\s/);
            headlineOnly = m ? `${m[1]} ` : null;
          }
          // Sirens, like trackers, embed `@ HH:MM:SS`. Two fetches a moment
          // apart can round the same wave's impact to adjacent seconds (e.g.
          // 15:03:20 vs 15:03:21), so match sirens by their `🚨 Attack on
          // <village> @` prefix + impact tolerance instead of exact name —
          // otherwise that 1s drift spawns a duplicate siren.
          let sirenPrefix = null;
          if (isSiren) {
            const m = newB.name.match(/^(🚨 Attack on .+?) @ /);
            sirenPrefix = m ? `${m[1]} @ ` : null;
          }
          const newImpactMs =
            isTracker || isSiren ? parseImpactMs(newB.name) : null;
          // Tight 2s tolerance — keeps 1-3s-apart attacks as distinct
          // alarms while still merging re-detections of the same attack
          // across refreshes (which drift <1s between fetches).
          const ATTACK_DEDUP_TOLERANCE_MS = 2000;
          const existingAttack = alarms.find((a) => {
            if (a.customType !== "attack") return a.name === newB.name;
            if (isSiren) {
              if (!sirenPrefix || !a.name.startsWith(sirenPrefix)) return false;
              const existingImpact = parseImpactMs(a.name);
              if (existingImpact != null && newImpactMs != null) {
                return (
                  Math.abs(existingImpact - newImpactMs) <
                  ATTACK_DEDUP_TOLERANCE_MS
                );
              }
              return a.name === newB.name;
            }
            if (!isTracker) return a.name === newB.name;
            if (!headlineOnly || !a.name.startsWith(headlineOnly)) return false;
            const existingImpact = parseImpactMs(a.name);
            if (existingImpact != null && newImpactMs != null) {
              return (
                Math.abs(existingImpact - newImpactMs) <
                ATTACK_DEDUP_TOLERANCE_MS
              );
            }
            return (
              Math.abs((a.scheduledTime || 0) - newScheduledTime) <
              ATTACK_DEDUP_TOLERANCE_MS
            );
          });
          if (existingAttack) {
            // UI cards are keyed by name; we normally skip name updates so
            // transit/detected drift doesn't change the uid every refresh and
            // wipe the user's scroll position. EXCEPTION: wave-count changes
            // (a second attack just joined the wave) ARE worth showing —
            // patch only the `(wave ×N)` segment in place, leaving the rest
            // of the name (and the uid that depends on it) untouched if N
            // matches.
            if (isTracker) {
              const oldM = existingAttack.name.match(/\(wave\s×(\d+)\)/);
              const newM = newB.name.match(/\(wave\s×(\d+)\)/);
              const oldN = oldM ? parseInt(oldM[1], 10) : 1;
              const newN = newM ? parseInt(newM[1], 10) : 1;
              if (newN !== oldN) {
                existingAttack.name = newB.name;
              }
            }
            const movedEarlier =
              newScheduledTime < existingAttack.scheduledTime - 2000;
            if (isSiren) {
              // Sirens fire exactly once per wave. Leave them alone on
              // refresh — same `scheduledTime`, same `notified` state.
              return;
            }
            if (existingAttack.notified) {
              // Tracker already fired. Drift forward (from leadDelay clamping
              // in the 20s window) shouldn't re-alarm. Only re-arm if the new
              // schedule is GENUINELY earlier — a real new threat.
              if (movedEarlier && !existingAttack.silenced) {
                existingAttack.scheduledTime = newScheduledTime;
                existingAttack.notified = false;
              }
              return;
            }
            // Not yet fired — keep schedule accurate.
            existingAttack.scheduledTime = newScheduledTime;
            return;
          }
        }

        // For refreshable types, update an existing alarm in-place rather than creating a duplicate.
        // resource/storage: skip update if silenced and already past due (user dismissed it).
        // culture: update time but keep silenced state (no auto-un-silence on cultural alarms).
        const refreshTypes = [
          "training",
          "settler",
          "resource",
          "storage",
          "culture",
          "farmlist",
          "daily",
          "hero",
        ];
        if (refreshTypes.includes(newB.customType)) {
          let existing;
          if (newB.customType === "hero") {
            // Hero has one state at a time per server — match by customType + serverTag
            // so status transitions (e.g. "Going to Oasis" → "Returning") reuse the
            // same alarm record instead of accumulating stale expired duplicates.
            const newServerTag = newB.name.split(" ").pop();
            existing = alarms.find(
              (a) => a.customType === "hero" && a.name.endsWith(newServerTag),
            );
          } else {
            existing = alarms.find((a) => a.name === newB.name);
          }
          if (existing) {
            if (newB.customType === "farmlist" || newB.customType === "daily") {
              existing.scheduledTime = newScheduledTime;
              existing.notified = false;
              existing.silenced = false;
              return;
            }

            if (newB.customType === "hero") {
              existing.name = newB.name;
              existing.noSound = newB.noSound || false;
            }
            existing.scheduledTime = newScheduledTime;
            existing.notified = false;
            if (newB.customType !== "culture") existing.silenced = false;
            return;
          }
        }

        const isDuplicate = alarms.some(
          (a) =>
            a.name === newB.name &&
            Math.abs(a.scheduledTime - newScheduledTime) <
              DUPLICATE_THRESHOLD_MS,
        );
        if (!isDuplicate) {
          const isHero = newB.name.includes("⚔️");
          if (isHero) {
            const serverTag = newB.name.split(" ").pop();
            const idx = alarms.findIndex(
              (a) =>
                a.name.includes("⚔️") &&
                a.name.endsWith(serverTag) &&
                a.scheduledTime <= now,
            );
            if (idx !== -1) alarms.splice(idx, 1);
          } else if (newB.customType == null) {
            const buildingTagMatch = newB.name.match(
              /\((.+)\)\s*(\[[^\]]+\])$/,
            );
            if (buildingTagMatch) {
              const villagePart = buildingTagMatch[1];
              const serverTagPart = buildingTagMatch[2];
              // Strip the `#N` disambiguator the scanner appends to buildings
              // queued at the same time, leaving the base
              // "<name> lvl <n> (village) [tag]" identity. Alarms that share
              // this identity are distinct completions of the same upgrade on
              // different fields (e.g. leveling crops one-by-one) — keep them
              // until the user clears them, instead of letting a new same-named
              // build evict the earlier one.
              const baseId = (n) => n.replace(/ #\d+$/, "");
              const newBaseId = baseId(newB.name);
              for (let i = alarms.length - 1; i >= 0; i--) {
                const a = alarms[i];
                if (
                  a.customType == null &&
                  !a.name.includes("⚔️") &&
                  !a.isPinned &&
                  baseId(a.name) !== newBaseId &&
                  a.name.includes(`(${villagePart})`) &&
                  a.name.includes(serverTagPart) &&
                  (a.scheduledTime <= now || a.silenced === true)
                ) {
                  alarms.splice(i, 1);
                }
              }
            }
          }
          alarms.push({
            id: generateId(),
            name: newB.name,
            scheduledTime: newScheduledTime,
            createdAt: now,
            notified: false,
            silenced: false,
            recurring: newB.recurring || 0,
            customType: newB.customType || null,
            isPinned: false,
            noSound: newB.noSound || false,
          });
        }
        });
        // Run a tick immediately after new alarms are added
        runAlarmTick();
        saveState();
      });
      return true;

    case "GET_ACTIVE_ALARMS":
      stateReady.then(() => sendResponse({ alarms, soundCategories, volume }));
      return true;

    case "STOP_SOUND_ONLY":
      stopAlarmSound();
      break;

    case "DELETE_ALARM": {
      const target = alarms.find((a) => a.id === msg.id || a.name === msg.name);

      if (target && target.customType === "attack" && !msg.autoClear) {
        if (target.name.includes("🚨")) {
          ignoredAttacks.add(getSirenKey(target.name));
        }
      }

      if (msg.id) alarms = alarms.filter((a) => a.id !== msg.id);
      else if (msg.name) alarms = alarms.filter((a) => a.name !== msg.name);

      saveState();
      break;
    }

    case "ATTACK_CLEARED":
      if (msg.name) {
        ignoredAttacks.delete(getSirenKey(msg.name));
        saveState();
      }
      break;

    case "EDIT_ALARM": {
      const alarmToEdit = alarms.find((a) => a.id === msg.id);
      if (alarmToEdit) {
        if (msg.newName) alarmToEdit.name = msg.newName;
        if (msg.newDelay) {
          alarmToEdit.scheduledTime = Date.now() + msg.newDelay;
          alarmToEdit.createdAt = Date.now();
          alarmToEdit.notified = false;
          alarmToEdit.silenced = false;
        }
        saveState();
        schedulePreciseTick();
      }
      break;
    }

    case "TOGGLE_PIN": {
      const pinTarget = alarms.find((a) => a.id === msg.id);
      if (pinTarget) {
        pinTarget.isPinned = !pinTarget.isPinned;
        saveState();
      }
      break;
    }

    case "CLEAR_STALE_TRAINING": {
      // Can't use filterStaleAlarms() here — training alarms support a legacy
      // name format (without the 🎓 prefix) that requires fuzzy matching below.
      const activeSet = new Set(msg.activeNames || []);
      alarms = alarms.filter((a) => {
        if (a.customType !== "training") return true;
        if (!a.name.includes(msg.serverTag)) return true;
        // Keep alarms that already fired — let user dismiss them manually
        if (a.scheduledTime <= Date.now()) return true;
        // Match both new (🎓) and old (no emoji) name formats
        if (activeSet.has(a.name)) return true;
        const legacyName = a.name.replace("🎓 ", "");
        if (activeSet.has("🎓 " + a.name) || activeSet.has(legacyName))
          return true;
        return false;
      });
      saveState();
      break;
    }

    case "CLEAR_STALE_RESOURCES":
      filterStaleAlarms("resource", msg.activeNames, msg.serverTag);
      saveState();
      break;

    case "CLEAR_STALE_STORAGE":
      filterStaleAlarms("storage", msg.activeNames, msg.serverTag, false, true);
      saveState();
      break;

    case "CLEAR_STALE_CELEBRATIONS":
      // keepExpired=true: alarms that already fired stay until user dismisses them
      filterStaleAlarms("culture", msg.activeNames, msg.serverTag, true);
      saveState();
      break;

    case "CLEAR_STALE_HERO":
      // Hero has one state per server — collapse any accumulated duplicates.
      // Drop expired hero alarms not in activeNames so stale "Going to Oasis"
      // or "Returning" entries from prior trips don't persist across cycles.
      filterStaleAlarms("hero", msg.activeNames, msg.serverTag, false);
      saveState();
      break;

    case "SILENCE_ALARM": {
      const silenceTarget = alarms.find((a) => a.id === msg.id);
      if (silenceTarget) {
        silenceTarget.silenced = true;
        saveState();
      }
      break;
    }

    case "SOUND_RECHECK":
      // Offscreen document finished playing a sound and cooldown expired —
      // re-evaluate alarms to see if sound should repeat.
      runAlarmTick();
      break;

    case "SET_SOUND_CATEGORY":
      if (
        msg.category &&
        Object.prototype.hasOwnProperty.call(DEFAULT_SOUND_CATEGORIES, msg.category)
      ) {
        soundCategories[msg.category] = !!msg.enabled;
        stopAlarmSound();
        saveState();
      }
      sendResponse({ soundCategories });
      return true;

    case "SET_VOLUME":
      // Only process SET_VOLUME from content scripts (sender.tab exists).
      // The background itself forwards SET_VOLUME via chrome.runtime.sendMessage,
      // which is also received by the background's own onMessage listener —
      // without this guard, it creates an infinite recursion loop.
      if (!sender.tab) break;
      volume = msg.volume;
      saveState();
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage({ type: "SET_VOLUME", volume });
      });
      break;
  }
});
