"use strict";

import { $app, $importFile } from "./dom.js";
import { LIB } from "./program.js";
import { MUSCLE_IMG } from "./muscleMap.js";
import { state, replaceState, saveState, todayISO, parseNum, toggleWeekSkip } from "./state.js";
import { stopTimer } from "./timer.js";
import {
  renderHome,
  openCalendar,
  renderDayDetail,
  openDayActions,
  moveWorkoutTo,
  cancelMove,
} from "./home.js";
import {
  startWorkout,
  stepValue,
  inputValue,
  toggleSet,
  finishWorkout,
  toggleHowto,
  toggleRepsHist,
  openSwapSheet,
  toggleCollapse,
  togglePlate,
  plateChange,
  addSet,
  removeSet,
  toggleLbs,
  removeExercise,
  openAddExerciseSheet,
} from "./workout.js";
import { renderHistory, toggleSession, resetHistory, openExerciseDetail } from "./history.js";
import {
  renderOnboarding,
  renderProfile,
  pickOption,
  obNext,
  obBack,
  obPick,
  obUnit,
  obFinish,
  logWeight,
  stepNumber,
  applyProfileField,
  confirmClearData,
  toggleWeight,
  pickMeasure,
  logMeasure,
  toggleMeasure,
  toggleMuscle,
  deleteMeasure,
} from "./profile.js";

/* ================= steppers: tap once, or hold to keep ticking ================= */
let holdDelay = null;
let holdRepeat = null;
let holdDidRepeat = false;

function runStepBtn(btn) {
  if (btn.dataset.act === "step") {
    stepValue(+btn.dataset.ex, +btn.dataset.set, btn.dataset.field, +btn.dataset.dir);
  } else {
    stepNumber(btn.dataset.target, +btn.dataset.step);
  }
}

function stopHold() {
  clearTimeout(holdDelay);
  clearInterval(holdRepeat);
  holdDelay = holdRepeat = null;
}

document.body.addEventListener("pointerdown", (e) => {
  const btn = e.target.closest('[data-act="step"], [data-act="nstep"]');
  if (!btn) return;
  stopHold();
  holdDidRepeat = false;
  holdDelay = setTimeout(() => {
    holdDidRepeat = true;
    runStepBtn(btn);
    holdRepeat = setInterval(() => runStepBtn(btn), 110);
  }, 400);
  btn.addEventListener("pointerleave", stopHold, { once: true });
});
window.addEventListener("pointerup", stopHold);
window.addEventListener("pointercancel", stopHold);

/* ================= event routing ================= */
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  switch (btn.dataset.act) {
    case "start":
      startWorkout(btn.dataset.day);
      break;
    case "day-detail":
      renderDayDetail(btn.dataset.day);
      break;
    case "home":
      renderHome();
      break;
    case "wo-back": {
      if (state.active) {
        const doneWork = state.active.exercises.reduce(
          (n, e) => n + e.sets.filter((s) => s.done && !s.warmup).length,
          0,
        );
        if (doneWork === 0) {
          state.active = null;
          saveState();
        }
      }
      renderHome();
      break;
    }
    case "history":
      resetHistory();
      renderHistory();
      break;
    case "calendar":
      openCalendar();
      break;
    case "cal-prev":
      openCalendar(1);
      break;
    case "cal-next":
      openCalendar(-1);
      break;
    case "cal-day":
      openDayActions(btn.dataset.date);
      break;
    case "cal-move-to":
      moveWorkoutTo(btn.dataset.date);
      break;
    case "cal-move-cancel":
      cancelMove();
      break;
    case "toggle-skip":
      toggleWeekSkip(+btn.dataset.wd);
      renderHome();
      break;
    case "ex-detail":
      openExerciseDetail(btn.dataset.name);
      break;
    case "profile":
      renderProfile();
      break;
    case "export":
      exportData();
      break;
    case "import":
      $importFile.click();
      break;
    case "step":
    case "nstep":
      if (holdDidRepeat) {
        holdDidRepeat = false;
        break;
      } // the hold already ticked
      runStepBtn(btn);
      break;
    case "howto":
      toggleHowto(+btn.dataset.ex);
      break;
    case "reps-hist":
      toggleRepsHist(+btn.dataset.ex);
      break;
    case "collapse":
      toggleCollapse(+btn.dataset.ex);
      break;
    case "plate-toggle":
      togglePlate(+btn.dataset.ex);
      break;
    case "plate-add":
      plateChange(+btn.dataset.ex, +btn.dataset.set, +btn.dataset.p, 1);
      break;
    case "plate-sub":
      plateChange(+btn.dataset.ex, +btn.dataset.set, +btn.dataset.p, -1);
      break;
    case "swap":
      openSwapSheet(+btn.dataset.ex);
      break;
    case "check":
      toggleSet(+btn.dataset.ex, +btn.dataset.set);
      break;
    case "finish":
      finishWorkout();
      break;
    case "skip-rest":
      stopTimer();
      break;
    case "toggle-session":
      toggleSession(+btn.dataset.i);
      break;
    case "pick-opt":
      pickOption(btn.dataset.field, btn.dataset.value);
      break;
    case "toggle-muscle":
      toggleMuscle(btn.dataset.muscle);
      break;
    case "ob-next":
      obNext();
      break;
    case "ob-back":
      obBack();
      break;
    case "ob-pick":
      obPick(btn.dataset.field, btn.dataset.value);
      break;
    case "ob-unit":
      obUnit(btn.dataset.which, btn.dataset.value);
      break;
    case "ob-finish":
      obFinish();
      break;
    case "log-weight":
      logWeight();
      break;
    case "clear-data":
      confirmClearData();
      break;
    case "toggle-weight":
      toggleWeight();
      break;
    case "pick-measure":
      pickMeasure(btn.dataset.part);
      break;
    case "log-measure":
      logMeasure();
      break;
    case "toggle-measure":
      toggleMeasure();
      break;
    case "del-measure":
      deleteMeasure(+btn.dataset.idx);
      break;
    case "add-set":
      addSet(+btn.dataset.ex);
      break;
    case "remove-set":
      removeSet(+btn.dataset.ex);
      break;
    case "toggle-lbs":
      toggleLbs(+btn.dataset.ex);
      break;
    case "remove-ex":
      removeExercise(+btn.dataset.ex);
      break;
    case "add-exercise":
      openAddExerciseSheet();
      break;
  }
});

// tapping a number-entry input selects its content, so typing replaces the
// old value (weight fields are type=text+inputmode now, reps are number)
document.body.addEventListener("focusin", (e) => {
  const input = e.target;
  if (input.tagName !== "INPUT") return;
  if (input.type === "number" || input.inputMode === "decimal" || input.inputMode === "numeric") {
    setTimeout(() => input.select(), 0); // deferred: iOS clears selections made during focus
  }
});

document.body.addEventListener("change", (e) => {
  const input = e.target;
  if (input.tagName !== "INPUT") return;
  if (input.dataset.field && state.active) {
    // workout set inputs — echo back the display value (lbs-aware; store is kg)
    input.value = inputValue(
      +input.dataset.ex,
      +input.dataset.set,
      input.dataset.field,
      input.value,
    );
  } else if (input.id === "pf-height") {
    applyProfileField(input.id, parseNum(input.value) || 0);
  } else if (input.id === "pf-name" && state.profile) {
    state.profile.name = input.value.trim();
    saveState();
  }
});

/* ================= export / import ================= */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gym-backup-" + todayISO() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$importFile.addEventListener("change", () => {
  const file = $importFile.files[0];
  $importFile.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.sessions)) throw new Error("bad format");
      if (!confirm(`Import ${data.sessions.length} session(s)? This replaces all current data.`))
        return;
      replaceState({
        blockStart: data.blockStart || null,
        sessions: data.sessions,
        active: data.active || null,
        profile: data.profile || null,
        weights: data.weights || [],
        prefs: data.prefs || { plates: {} },
        volAdj: data.volAdj || {},
        measures: data.measures || [],
        custom: data.custom || {},
        extras: data.extras || {},
        removed: data.removed || {},
        order: data.order || {},
        weekSkips: data.weekSkips || {},
      });
      state.profile ? renderHome() : renderOnboarding();
    } catch (e) {
      alert("That file doesn’t look like a gym backup.");
    }
  };
  reader.readAsText(file);
});

/* ================= updates ================= */
function showUpdateBanner(waitingWorker) {
  if (document.getElementById("update-banner")) return;
  const bar = document.createElement("div");
  bar.id = "update-banner";
  bar.innerHTML = `
    <span>A new version is ready</span>
    <button id="update-now">Update now</button>`;
  bar.querySelector("#update-now").addEventListener("click", () => {
    sessionStorage.setItem("updating", "1");
    showSplash(0);
    waitingWorker.postMessage("SKIP_WAITING");
  });
  document.body.appendChild(bar);
}

// Boot-up splash shown while an update refreshes the app, so the reload
// reads as intentional. The flag survives the reload via sessionStorage.
// Icon-only. holdMs > 0 auto-fades after that long; 0 keeps it up (used
// just before an update reload swaps the page out from under it).
function showSplash(holdMs) {
  let splash = document.getElementById("update-splash");
  if (!splash) {
    splash = document.createElement("div");
    splash.id = "update-splash";
    splash.innerHTML = '<img src="icons/icon-192.png" alt="">';
    document.body.appendChild(splash);
  }
  if (holdMs) {
    setTimeout(() => {
      splash.classList.add("fade");
      setTimeout(() => splash.remove(), 450);
    }, holdMs);
  }
  return splash;
}

// New versions apply themselves (the app refreshes once, data is untouched).
// Mid-workout we don't yank the screen away — show the banner instead.
function applyUpdate(waitingWorker) {
  if (!waitingWorker) return;
  showUpdateBanner(waitingWorker);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache:'none' = iOS must always revalidate sw.js, never serve it stale
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      // update already downloaded on a previous visit
      applyUpdate(reg.waiting);
      // update found while the app is open
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) applyUpdate(nw);
        });
      });
      // re-check whenever the app is brought to the foreground
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        reg.update().catch(() => {});
        applyUpdate(reg.waiting);
      });
    });
    // when the new worker takes over, reload onto the new version
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  });
}

/* ================= fit-to-screen scroll lock ================= */
// disable scrolling whenever the current screen's content fits the viewport
function updateFit() {
  const fits = $app.scrollHeight <= window.innerHeight + 1;
  document.documentElement.classList.toggle("fits", fits);
}
const fitObserver = new MutationObserver(() => requestAnimationFrame(updateFit));
fitObserver.observe($app, { childList: true, subtree: true });
window.addEventListener("resize", updateFit);
window.addEventListener("load", updateFit);

/* ================= boot ================= */
// boot splash (icon + wordmark): 1s after an update reload, a brief 800ms on
// a normal open so the app feels quick rather than gated behind a logo
if (sessionStorage.getItem("updating")) {
  sessionStorage.removeItem("updating");
  showSplash(1000);
} else {
  showSplash(800);
}

// ask the OS not to evict our storage (granted automatically for installed PWAs)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// quietly pull the demo-video thumbnails into the offline cache (the SW
// runtime-caches them), so how-to previews work with no signal at the gym
setTimeout(() => {
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
  const isF = state.profile && state.profile.gender === "female";
  for (const lib of Object.values(LIB)) {
    const vid = (isF && lib.videoIdF) || lib.videoId;
    if (vid)
      fetch(`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, { mode: "no-cors" }).catch(() => {});
  }
  // and the muscle-diagram images, so the how-to anatomy works offline too
  for (const u of Object.values(MUSCLE_IMG)) fetch(u, { mode: "no-cors" }).catch(() => {});
}, 5000);

// iOS keeps the PWA in memory; on resume, refresh the home screen so the
// greeting, "up next", week counter and statuses reflect the current time
// (only when home is the visible screen — don't disturb other views)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.querySelector(".home-top")) {
    renderHome();
  }
});

/* ================= left-edge swipe back ================= */
{
  let x0 = 0,
    y0 = 0,
    tracking = false;
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      tracking = t.clientX <= 24;
      if (tracking) {
        x0 = t.clientX;
        y0 = t.clientY;
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = Math.abs(t.clientY - y0);
      if (dx > 56 && dx > dy * 1.8) {
        if (document.querySelector(".sheet-backdrop")) return;
        const btn = document.querySelector(".back-btn");
        if (btn) btn.click();
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - y0) > Math.abs(t.clientX - x0) + 10) tracking = false;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchcancel",
    () => {
      tracking = false;
    },
    { passive: true },
  );
}

if (!state.profile) {
  renderOnboarding(); // first launch: collect profile before anything else
} else {
  renderHome(); // always open on home; an unfinished workout resumes from its day card
}
