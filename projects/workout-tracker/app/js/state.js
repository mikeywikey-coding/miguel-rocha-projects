"use strict";

import { RIR_BY_WEEK, programFor } from "./program.js";

const STORE_KEY = "gymTracker";

// Bump to force every device through onboarding again on its next open.
// Only the profile is cleared — sessions, weights and measurements are kept.
const REONBOARD = 1;

export let state = loadState();

function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) {
    /* corrupted -> start fresh */
  }
  if (!s) s = { blockStart: null, sessions: [], active: null };
  if (!s.profile) s.profile = null; // { gender, height, level, equipment }
  // one-time re-onboarding: drop the profile so the wizard runs again, but
  // leave all training history intact (the flag persists on the next save)
  if (s.reonboard !== REONBOARD) {
    s.profile = null;
    s.reonboard = REONBOARD;
  }
  if (s.profile) {
    const pr = s.profile;
    if (!pr.level) pr.level = "beginner";
    if (!pr.equipment) pr.equipment = "mixed";
    if (!pr.focus) pr.focus = "balanced";
    if (!pr.goal) pr.goal = "hypertrophy";
    if (!pr.muscleFocus) pr.muscleFocus = [];
    // migrate the old single `split` setting -> separate style + days (+ spec)
    if (!pr.style || pr.days == null) {
      const old = pr.split;
      if (old === "lower" || old === "upper") {
        pr.spec = old;
        pr.style = pr.style || "full";
        if (pr.days == null) pr.days = 3;
      } else {
        const map = { full: ["full", 3], ul: ["ul", 4], five: ["ul", 5], ppl: ["ppl", 6] };
        const m = map[old] || ["full", 3];
        if (!pr.style) pr.style = m[0];
        if (pr.days == null) pr.days = m[1];
      }
    }
    if (!pr.spec) pr.spec = "off";
  }
  if (!s.weights) s.weights = []; // [{ date, kg }]
  if (!s.prefs) s.prefs = { plates: {} }; // global prefs (plate-entry per exercise key)
  if (!s.prefs.plates) s.prefs.plates = {};
  // migrate bicepsLong warmup prefs: slot key changed from inclineCurl/bayesianCurl to preacherCurl/machinePreacher
  if (s.prefs.warmup) {
    if (s.prefs.warmup.inclineCurl && !s.prefs.warmup.preacherCurl)
      s.prefs.warmup.preacherCurl = s.prefs.warmup.inclineCurl;
    if (s.prefs.warmup.bayesianCurl && !s.prefs.warmup.machinePreacher)
      s.prefs.warmup.machinePreacher = s.prefs.warmup.bayesianCurl;
  }
  if (!s.weekSkips) s.weekSkips = {}; // { mondayIso: [weekdayIdx…] } planned days skipped, this-week-only
  if (!s.volAdj) s.volAdj = {}; // per-day auto-regulation set adjustment
  if (!s.measures) s.measures = []; // [{ date, part, cm }]
  if (!s.custom) s.custom = {}; // Meso Builder: persistent per-slot exercise overrides
  if (!s.extras) s.extras = {}; // user-added exercises per day: { dayKey: [exerciseKey…] }
  if (!s.removed) s.removed = {}; // user-removed built-in exercises per day: { dayKey: [exerciseKey…] }
  if (!s.order) s.order = {}; // user's exercise order per day: { dayKey: [exerciseKey…] }
  // workouts started before exercise keys existed can't be resumed
  if (s.active && s.active.exercises.some((e) => !e.key)) s.active = null;
  // cap any in-progress workout built before the 3-set-max rule; only drop
  // trailing sets that haven't been logged yet so no completed work is lost
  if (s.active && Array.isArray(s.active.exercises)) {
    for (const e of s.active.exercises) {
      if (!Array.isArray(e.sets)) continue;
      const working = () => e.sets.filter((st) => !st.warmup).length;
      while (working() > 3) {
        let idx = -1;
        for (let i = e.sets.length - 1; i >= 0; i--) {
          if (!e.sets[i].warmup && !e.sets[i].done) {
            idx = i;
            break;
          }
        }
        if (idx < 0) break; // all working sets already logged — keep them
        e.sets.splice(idx, 1);
      }
    }
  }
  return s;
}

export function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function replaceState(s) {
  s.reonboard = REONBOARD; // an imported backup has already been onboarded
  state = s;
  saveState();
}

// active program for the current profile (with Meso Builder overrides)
export function prog() {
  return programFor(state.profile, state.custom, state.extras, state.removed);
}

/* ---------- dates & weeks ---------- */
export function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// Total week count since the first workout; grows forever
export function currentWeek() {
  if (!state.blockStart) return 1;
  const days = Math.floor((new Date(todayISO()) - new Date(state.blockStart)) / 86400000);
  return Math.floor(days / 7) + 1;
}

// 8-week blocks cycle automatically: week 9 = block 2, week 1
export function blockNumber(week) {
  return Math.floor((week - 1) / 8) + 1;
}
export function weekInBlock(week) {
  return ((week - 1) % 8) + 1;
}

export function rirLabel(week) {
  return RIR_BY_WEEK[Math.min(week, 8) - 1];
}

// Working sets for a slot. Deliberately flat: two sets for every exercise, every
// week (user preference); a third can be added in the session with +Add set.
export function setsForWeek() {
  return 2;
}

/* ---------- session lookups ---------- */
export function lastSession(day) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    if (state.sessions[i].day === day) return state.sessions[i];
  }
  return null;
}

export function lastExercise(day, exName, exKey) {
  const s = lastSession(day);
  if (!s) return null;
  return s.exercises.find((e) => e.name === exName || (exKey && e.key === exKey)) || null;
}

export function lastAnyExercise(name, key) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const ex = state.sessions[i].exercises.find((e) => e.name === name || (key && e.key === key));
    if (ex) return ex;
  }
  return null;
}

// Double progression: all sets done last time and every set hit the top of the range
export function progressionDue(day, exName, repMax, exKey) {
  const last = lastExercise(day, exName, exKey);
  if (!last || !last.sets.length) return false;
  return last.sets.every((s) => s.done && s.reps >= repMax);
}

/* ---------- weekly skips (current week only) ---------- */
// Monday (local) of the week containing `d`, as YYYY-MM-DD — the skip-bucket key
export function weekMonIso(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return (
    mon.getFullYear() +
    "-" +
    String(mon.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(mon.getDate()).padStart(2, "0")
  );
}

// weekday indices (Mon-first) the user has cleared as "didn't go" this week
export function weekSkips() {
  return new Set((state.weekSkips && state.weekSkips[weekMonIso()]) || []);
}

// toggle a planned weekday between skipped and active for the current week;
// older weeks are dropped so skips never carry past the week they were made in
export function toggleWeekSkip(wd) {
  const key = weekMonIso();
  if (!state.weekSkips) state.weekSkips = {};
  for (const k of Object.keys(state.weekSkips)) if (k !== key) delete state.weekSkips[k];
  const set = new Set(state.weekSkips[key] || []);
  set.has(wd) ? set.delete(wd) : set.add(wd);
  state.weekSkips[key] = [...set];
  saveState();
}

// drop every logged session on a given date (used to remove a day from the calendar)
export function deleteSessionsOn(dateIso) {
  state.sessions = state.sessions.filter((s) => s.date !== dateIso);
  saveState();
}

// reassign every session logged on `fromIso` to `toIso` (fix a wrong calendar day)
export function moveSessionsTo(fromIso, toIso) {
  if (!toIso || fromIso === toIso) return;
  for (const s of state.sessions) if (s.date === fromIso) s.date = toIso;
  saveState();
}

/* ---------- formatting ---------- */
export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function fmtDateLong(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtWeight(w) {
  return (w % 1 === 0 ? w : w.toFixed(1)) + " kg";
}

export function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

// display number for an internal day key (A→1, B→2, …)
export function dayNum(key) {
  return "ABCDEF".indexOf(key) + 1 || key;
}

// parse a decimal that may use a comma separator (e.g. "42,5")
export function parseNum(raw) {
  return parseFloat(String(raw).replace(",", "."));
}
