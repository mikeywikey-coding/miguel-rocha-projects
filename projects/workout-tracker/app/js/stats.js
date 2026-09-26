'use strict';

import { state } from './state.js';
import { LIB, dayKeys } from './program.js';

const DAY_MS = 86400000;

// Estimated 1RM. No rep flatline: a hard cap made every set past it score
// identically, so a hard-earned 20-rep set read the same as 12 (~27% under the
// standard rep-max table). Instead take the best of three published estimators,
// each strongest in a different rep range, so the number keeps climbing with
// reps and never sells a set short:
//   Epley    w(1 + r/30)      — tracks the coaching table closely to ~20 reps
//   Brzycki  36w/(37 - r)     — best in the 8-12 range, so its input stops at 12
//                               (it runs away past that, exploding near r=37)
//   Lombardi w·r^0.10         — a touch more generous in the low-rep range
// Reps are clamped to 30: beyond that any 1RM guess is fiction.
// BOOST then scales the whole thing up. The textbook formulas assume every set
// was taken to true failure, which real logged sets rarely are, so they read
// low against what you can actually hit on the day. Dial this one number to
// taste — 1.00 is the by-the-book estimate, 1.10 is 10% over it.
const REP_LIMIT = 30;
const BRZYCKI_LIMIT = 12;
const BOOST = 1.20;
export function e1rm(w, reps) {
  const r = Math.min(Math.max(reps || 0, 1), REP_LIMIT);
  // A completed single isn't an estimate — it's a measured 1RM. Report exactly
  // what was lifted: no boost, and no formula overshoot either.
  if (r <= 1) return w;
  return BOOST * Math.max(
    w * (1 + r / 30),
    w * 36 / (37 - Math.min(r, BRZYCKI_LIMIT)),
    w * Math.pow(r, 0.10),
  );
}

// All-time bests for an exercise. `weight`/`reps`/`e1rm` all describe the SAME
// (highest-scoring) set, so the "best set" and the "est. 1RM" shown beside it
// can never disagree. `topWeight` is the heaviest load ever moved, which is a
// different question — the weight half of the PR check needs it, because the
// best-scoring set can be a lighter rep-out.
export function bestFor(name) {
  let best = { weight: 0, reps: 0, e1rm: 0, topWeight: 0 };
  for (const s of state.sessions) {
    const ex = s.exercises.find(e => e.name === name);
    if (!ex) continue;
    for (const set of ex.sets) {
      if (!set.done || set.warmup || set.weight <= 0) continue;
      const e = e1rm(set.weight, set.reps);
      if (set.weight > best.topWeight) best.topWeight = set.weight;
      // ties (two sets capped at the same rep count) go to the heavier set
      if (e > best.e1rm + 1e-9 || (e > best.e1rm - 1e-9 && set.weight > best.weight)) {
        best = { ...best, weight: set.weight, reps: set.reps, e1rm: e };
      }
    }
  }
  return best;
}

// most reps ever done at each weight for an exercise, heaviest first
export function repPRs(name) {
  const byWeight = new Map();
  for (const s of state.sessions) {
    const ex = s.exercises.find(e => e.name === name);
    if (!ex) continue;
    for (const set of ex.sets) {
      if (!set.done || set.warmup || set.weight <= 0) continue;
      const cur = byWeight.get(set.weight);
      if (!cur || set.reps > cur.reps) byWeight.set(set.weight, { weight: set.weight, reps: set.reps, date: s.date });
    }
  }
  return [...byWeight.values()].sort((a, b) => b.weight - a.weight);
}

// Rep history grouped by weight: every weight you have ACTUALLY completed a set
// at for this exercise, and the reps you hit at it. Weights never lifted never
// appear — this only ever reports logged work. Heaviest first.
// Matches history on name or key, so a renamed/swapped-in movement still counts.
// `bucket` maps a stored kg weight to the number the caller will actually show,
// and sets are grouped by THAT — otherwise the same displayed load lands on two
// rows, because kg is stored as a float: 110 lbs typed in lbs mode stores
// 49.8957…, while the kg stepper/plate builder rounds to 49.9. Both read "110
// lbs", so they must group together. Returned `weight` is the bucketed value.
// `extraSets` folds in sets completed in the workout still in progress, so the
// panel reflects what you just lifted instead of going stale until you finish.
export function repsByWeight(name, key, bucket = w => Math.round(w * 10) / 10, extraSets = []) {
  const byWeight = new Map(); // displayed weight -> Map(reps -> times done)
  const add = set => {
    // warm-ups never count: sessions normally keep them in `warmupSets`,
    // but older/imported ones can carry them flagged inside `sets`
    if (!set.done || set.warmup || !(set.weight > 0)) return;
    const w = bucket(set.weight);
    const reps = byWeight.get(w) || new Map();
    reps.set(set.reps, (reps.get(set.reps) || 0) + 1);
    byWeight.set(w, reps);
  };
  for (const s of state.sessions) {
    for (const ex of s.exercises) {
      if (ex.name !== name && !(key && ex.key === key)) continue;
      for (const set of ex.sets) add(set);
    }
  }
  for (const set of extraSets) add(set);
  return [...byWeight.entries()]
    .map(([weight, reps]) => ({
      weight,
      sets: [...reps.values()].reduce((a, b) => a + b, 0),
      best: Math.max(...reps.keys()),
      reps: [...reps.entries()]
        .map(([r, count]) => ({ reps: r, count }))
        .sort((a, b) => b.reps - a.reps),
    }))
    .sort((a, b) => b.weight - a.weight);
}

// every past session that included this exercise (done sets only), oldest→newest
export function exerciseSessions(name) {
  const out = [];
  for (const s of state.sessions) {
    const ex = s.exercises.find(e => e.name === name);
    if (!ex) continue;
    const done = ex.sets.filter(x => x.done && !x.warmup && x.weight > 0);
    if (!done.length) continue;
    const top = done.reduce((a, b) => e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a);
    out.push({ date: s.date, sets: done, topE1rm: e1rm(top.weight, top.reps), top });
  }
  return out;
}

// names of all exercises that appear in history, most-recent first
export function loggedExerciseNames() {
  const seen = [];
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    for (const e of state.sessions[i].exercises) {
      if (e.sets.some(s => s.done && s.weight > 0) && !seen.includes(e.name)) seen.push(e.name);
    }
  }
  return seen;
}

// simplified muscle group for a logged exercise (match an active LIB entry by name)
function groupForName(name) {
  const lib = Object.values(LIB).find(l => l.name === name);
  const m = (lib ? lib.muscle : name).toLowerCase();
  if (m === 'quads & glutes') return 'Glutes';
  if (m.includes('quad')) return 'Quads';
  if (m.includes('glute')) return 'Glutes';
  if (m.includes('hamstring')) return 'Hamstrings';
  if (m.includes('calf') || m.includes('calves')) return 'Calves';
  if (m.includes('inner') || m.includes('adduct')) return 'Adductors';
  if (m.includes('chest') || m.includes('pec')) return 'Chest';
  if (m.includes('back') || m.includes('lat')) return 'Back';
  if (m.includes('shoulder') || m.includes('delt')) return 'Shoulders';
  if (m.includes('bicep')) return 'Biceps';
  if (m.includes('tricep')) return 'Triceps';
  if (m.includes('ab')) return 'Abs';
  return 'Other';
}

// MEV / MAV weekly set landmarks per muscle (rough, for the dashboard)
export const LANDMARKS = {
  Glutes: [6, 16], Quads: [8, 18], Hamstrings: [6, 16], Calves: [6, 16],
  Chest: [8, 18], Back: [10, 20], Shoulders: [6, 18], Biceps: [6, 18],
  Triceps: [6, 18], Abs: [0, 16], Adductors: [0, 12], Other: [0, 20],
};

// completed working sets per muscle group over the last 7 days
export function weeklyVolume() {
  const since = new Date(todayStr()) - 7 * DAY_MS;
  const vol = {};
  for (const s of state.sessions) {
    if (new Date(s.date) < since) continue;
    for (const e of s.exercises) {
      const n = e.sets.filter(x => x.done && !x.warmup).length;
      if (!n) continue;
      const g = groupForName(e.name);
      vol[g] = (vol[g] || 0) + n;
    }
  }
  return vol;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// dates (YYYY-MM-DD) with at least one finished workout
export function trainedDates() {
  return new Set(state.sessions.map(s => s.date));
}

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Monday of the calendar week containing `d`
function mondayOf(d) {
  const dow = d.getDay();                 // 0 Sun … 6 Sat
  return new Date(d - ((dow + 6) % 7) * DAY_MS); // days since Monday
}

// the current Mon→Sun week as cells: weekday initial, trained?, isToday, future,
// plus `trainedDay` = the program-day index trained that weekday (or null). The
// day index lets the home strip recognise when a workout was done on a different
// weekday than planned, so the plan can "move" to the day it was actually trained.
export function weekCalendar(profile) {
  const dates = trainedDates();
  const keys = dayKeys(profile);
  const today = new Date(todayStr());
  const monday = mondayOf(today);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const dIso = iso(d);
    let trainedDay = null;
    for (const s of state.sessions) {
      if (s.date !== dIso) continue;
      const di = keys.indexOf(s.day);
      if (di >= 0) trainedDay = di; // last matching session of the day wins
    }
    cells.push({ label: labels[i], trained: dates.has(dIso), trainedDay, today: dIso === iso(today), future: d > today });
  }
  return cells;
}

// recommended weekday for each workout, with rest days spread out.
// weekday index is Monday-first (0=Mon … 6=Sun). Returns a 7-slot array
// where each slot is the program day index scheduled that day, or null (rest).
const REST_PATTERNS = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};
export function weeklySchedule(profile) {
  const n = dayKeys(profile).length;
  const pat = REST_PATTERNS[n] || REST_PATTERNS[3];
  const byWeekday = new Array(7).fill(null);
  pat.forEach((wd, dayIdx) => { byWeekday[wd] = dayIdx; });
  return byWeekday;
}

// consecutive Mon→Sun weeks (back from this week) that hit ≥2 workouts
export function weekStreak() {
  const dates = trainedDates();
  const thisMon = mondayOf(new Date(todayStr())).getTime();
  let streak = 0;
  for (let w = 0; w < 52; w++) {
    let c = 0;
    for (let i = 0; i < 7; i++) if (dates.has(iso(new Date(thisMon - w * 7 * DAY_MS + i * DAY_MS)))) c++;
    if (c >= 2) streak++;
    else break;
  }
  return streak;
}
