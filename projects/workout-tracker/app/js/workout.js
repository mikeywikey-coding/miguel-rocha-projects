"use strict";

import { $app, toast } from "./dom.js";
import { LIB, WEIGHT_STEP, overrideKey, headOf, groupOf } from "./program.js";
import { muscleDiagram } from "./muscleMap.js";
import { e1rm, bestFor, repsByWeight } from "./stats.js";
import {
  state,
  saveState,
  prog,
  currentWeek,
  weekInBlock,
  blockNumber,
  rirLabel,
  setsForWeek,
  lastExercise,
  lastAnyExercise,
  progressionDue,
  todayISO,
  fmtWeight,
  esc,
  parseNum,
} from "./state.js";
import { startTimer, stopTimer, ensureAudio } from "./timer.js";
import { renderHome } from "./home.js";

const howtoOpen = new Set(); // exercise indices with "how to" expanded (transient)
const repsOpen = new Set(); // exercise indices with the rep-history "i" expanded (transient)

function slotAt(ei) {
  const idx = state.active.slotOrder ? state.active.slotOrder[ei] : ei;
  const slot = prog()[state.active.day].exercises[idx];
  if (slot) return slot;
  // The program drifted out from under this in-progress workout: slotOrder
  // points past the current template (an exercise was added/removed/swapped in
  // an older version, or the plan changed). Rather than crash the whole screen
  // — which reads as "Continue does nothing" — synthesize a slot from the
  // exercise's own saved key so the session still renders and finishes.
  const aex = state.active.exercises[ei];
  const key = aex && aex.key;
  return {
    key,
    name: (aex && aex.name) || (key && LIB[key] ? LIB[key].name : "Exercise"),
    sets: 3,
    repMin: 5,
    repMax: 12,
    rest: 180,
  };
}

// collapsed exercises persist on the active workout; plate-entry preference
// persists globally per exercise key (state.prefs.plates)
function isCollapsed(ei) {
  return !!(state.active.collapsed && state.active.collapsed.includes(ei));
}
function isPlate(ei) {
  return !!(state.prefs && state.prefs.plates[state.active.exercises[ei].key]);
}
function isLbs(ei) {
  return !!(state.prefs && state.prefs.lbs && state.prefs.lbs[state.active.exercises[ei].key]);
}
const LBS_PER_KG = 2.2046;
const LBS_STEP = 5; // pounds per step

// default rep targets (strength aims lower; hypertrophy is the growth default)
const WARMUP_REPS = 12; // warm-up sets (lighter, higher reps)
function workReps() {
  return state.profile && state.profile.goal === "strength" ? 5 : 8;
}

// plate entry (kg). Total = bar + 2 × plates loaded per side.
// Barbell lifts use a 20 kg bar; plate-loaded machines (hack squat,
// leg press) load plates only (no bar weight added).
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

function barFor(ei) {
  const lib = LIB[state.active.exercises[ei].key];
  return lib && lib.equip === "barbell" ? 20 : 0;
}

// greedy plate breakdown for one side, given the bar weight
function platesPerSide(weight, bar) {
  let per = Math.max(0, (weight - bar) / 2);
  const out = [];
  for (const p of PLATES) {
    while (per >= p - 1e-9) {
      out.push(p);
      per = Math.round((per - p) * 100) / 100;
    }
  }
  return out;
}

export function resetHowto() {
  howtoOpen.clear();
  repsOpen.clear();
}

export function toggleCollapse(ei) {
  const c = state.active.collapsed || (state.active.collapsed = []);
  const i = c.indexOf(ei);
  i >= 0 ? c.splice(i, 1) : c.push(ei);
  saveState();
  renderWorkout();
}

function syncWeightFromPlates(set, bar) {
  set.weight = Math.round((bar + 2 * set.plates.reduce((a, b) => a + b, 0)) * 100) / 100;
}

export function togglePlate(ei) {
  const key = state.active.exercises[ei].key;
  if (!state.prefs.plates) state.prefs.plates = {};
  if (state.prefs.plates[key]) {
    delete state.prefs.plates[key];
  } else {
    state.prefs.plates[key] = true;
    const bar = barFor(ei);
    // seed each set's plate loadout from its current kg (best-guess breakdown)
    for (const set of state.active.exercises[ei].sets) {
      if (!set.plates) set.plates = platesPerSide(set.weight, bar);
      syncWeightFromPlates(set, bar);
    }
  }
  saveState();
  renderWorkout();
}

// add or remove one plate (`perSide` kg) from a set's loadout
export function plateChange(ei, si, perSide, dir) {
  const set = state.active.exercises[ei].sets[si];
  const bar = barFor(ei);
  if (!set.plates) set.plates = platesPerSide(set.weight, bar);
  if (dir > 0) {
    set.plates.push(perSide);
  } else {
    const idx = set.plates.indexOf(perSide);
    if (idx >= 0) set.plates.splice(idx, 1);
  }
  set.plates.sort((a, b) => b - a);
  syncWeightFromPlates(set, bar);
  saveState();
  renderWorkout();
}

// plate-loading UI for one set: total kg, loaded plates (tap to remove),
// and a row of plates to add (per side)
function plateBuilder(ei, si, set) {
  const bar = barFor(ei);
  const loaded = set.plates || platesPerSide(set.weight, bar);
  const chips = loaded.length
    ? loaded
        .map(
          (p) =>
            `<button class="plate-chip" data-act="plate-sub" data-ex="${ei}" data-set="${si}" data-p="${p}">${p}<span>×</span></button>`,
        )
        .join("")
    : `<span class="plate-empty">${bar ? "bar only" : "no plates"}</span>`;
  const sub = bar ? `${bar} kg bar + plates / side` : "plates / side";
  return `
    <div class="plate-build">
      <div class="plate-total"><b>${fmtWeight(set.weight)}</b><span>${sub}</span></div>
      <div class="plate-chips">${chips}</div>
      <div class="plate-add">
        ${PLATES.map((p) => `<button class="plate-add-btn" data-act="plate-add" data-ex="${ei}" data-set="${si}" data-p="${p}">+${p}</button>`).join("")}
      </div>
    </div>`;
}

// flip demo images between start/end frame to animate the movement
let demoFrame = 0;
setInterval(() => {
  const imgs = document.querySelectorAll("img.demo-img");
  if (!imgs.length) return;
  demoFrame = 1 - demoFrame;
  imgs.forEach((img) => {
    img.src = `media/${img.dataset.base}_${demoFrame}.jpg`;
  });
}, 1200);

function buildSets(day, slot, name, week, withBump, numWarmups = 0) {
  // same-day history takes priority; fall back to most recent session for this exercise anywhere
  const last = lastExercise(day, name, slot.key) || lastAnyExercise(name, slot.key);
  const bump = withBump && progressionDue(day, name, slot.repMax, slot.key);
  const sets = [];
  for (let i = 0; i < setsForWeek(); i++) {
    const prev = last && last.sets[i];
    let weight = prev ? prev.weight : 0;
    let reps = prev ? prev.reps : workReps();
    if (bump) {
      weight += WEIGHT_STEP;
      reps = workReps();
    }
    sets.push({ weight, reps, done: false });
  }
  if (week < 8 && numWarmups > 0) {
    return buildWarmups(slot.key, sets, numWarmups).concat(sets);
  }
  return sets;
}

// warm-up sets for an exercise, seeded from its top working set (or saved prefs)
function buildWarmups(key, workingSets, numWarmups) {
  const top = workingSets[0] ? workingSets[0].weight : 0;
  const round = (v) => Math.max(0, Math.round(v / 2.5) * 2.5);
  const saved = state.prefs.warmup && state.prefs.warmup[key];
  const warm = [];
  if (numWarmups >= 2) {
    const w = saved && saved[0];
    warm.push({
      weight: w ? w.weight : round(top * 0.5),
      reps: w ? w.reps : WARMUP_REPS,
      done: false,
      warmup: true,
    });
  }
  const w2 = saved && saved[numWarmups >= 2 ? 1 : 0];
  warm.push({
    weight: w2 ? w2.weight : round(top * (numWarmups >= 2 ? 0.75 : 0.6)),
    reps: w2 ? w2.reps : WARMUP_REPS,
    done: false,
    warmup: true,
  });
  return warm;
}

// Keep warm-ups on only the first exercise of each muscle group in the CURRENT
// order — so reordering, adding, removing or swapping updates them live.
// Preserves existing warm-ups (and their logged data) where they still belong.
function reconcileWarmups() {
  if (!state.active) return false;
  const week = state.active.week;
  const seen = new Set();
  let changed = false;
  state.active.exercises.forEach((aex, ei) => {
    const group = groupOf(aex.key);
    const first = !seen.has(group);
    seen.add(group);
    const hasWarm = aex.sets.some((s) => s.warmup);
    const shouldWarm = first && week < 8;
    if (shouldWarm && !hasWarm) {
      const working = aex.sets.filter((s) => !s.warmup);
      aex.sets = buildWarmups(aex.key, working, ei <= 1 ? 2 : 1).concat(working);
      changed = true;
    } else if (!shouldWarm && hasWarm) {
      aex.sets = aex.sets.filter((s) => !s.warmup);
      changed = true;
    }
  });
  return changed;
}

export function startWorkout(day) {
  if (state.active && state.active.day !== day) {
    if (
      !confirm(
        `You have an unfinished ${prog()[state.active.day].name} workout. Discard it and start ${prog()[day].name}?`,
      )
    )
      return;
    state.active = null;
  }
  if (!state.active) {
    const total = currentWeek();
    const week = weekInBlock(total);
    const dayAdj = (state.volAdj && state.volAdj[day]) || 0;
    const dayExercises = prog()[day].exercises;
    // Open in the order this day was last left in. prog() keeps its canonical
    // order (slotOrder indexes into it, so it must stay put) — the saved layout
    // is applied here, to the session being built. Slots the saved order doesn't
    // mention (a newly added exercise) keep their natural place; the sort is
    // stable so equal ranks never shuffle.
    const saved = (state.order && state.order[day]) || [];
    const rank = new Map(saved.map((k, i) => [k, i]));
    const rankOf = (i) =>
      rank.has(dayExercises[i].key) ? rank.get(dayExercises[i].key) : Infinity;
    const order = dayExercises.map((_, i) => i).sort((a, b) => rankOf(a) - rankOf(b) || a - b);
    const seenGroups = new Set();
    state.active = {
      day,
      week,
      block: blockNumber(total),
      adj: dayAdj,
      startedAt: todayISO(),
      exercises: order.map((slotIdx, pos) => {
        const slot = dayExercises[slotIdx];
        const group = groupOf(slot.key);
        // only the first exercise of the day that hits this muscle group warms up
        const isFirstOfGroup = !seenGroups.has(group);
        seenGroups.add(group);
        // 2 warmups if it's early in the session, 1 if later
        const numWarmups = isFirstOfGroup ? (pos <= 1 ? 2 : 1) : 0;
        return {
          key: slot.key,
          name: slot.name,
          sets: buildSets(day, slot, slot.name, week, true, numWarmups),
        };
      }),
      slotOrder: order,
      collapsed: dayExercises.map((_, i) => i),
    };
    saveState();
  }
  renderWorkout();
}

export function renderWorkout() {
  if (reconcileWarmups()) saveState();
  // keep PR badges in sync with the currently committed numbers (e.g. after a
  // weight edit or a reload), not just the value at the moment ✓ was tapped
  state.active.exercises.forEach((aex) =>
    aex.sets.forEach((s) => {
      if (s.done && !s.warmup) s.pr = isPr(aex, s);
    }),
  );
  const day = state.active.day;
  const p = prog()[day];
  const week = state.active.week;

  const totalSets = state.active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = state.active.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0,
  );

  let html = `
    <div class="screen-header">
      <button class="back-btn" data-act="wo-back" aria-label="Back">‹</button>
      <div>
        <h1>${p.name} · ${p.focus}</h1>
        <div class="ex-meta">${p.muscles} · ${state.active.block > 1 ? "Block " + state.active.block + " · " : ""}Week ${week} · ${rirLabel(week)}${week === 8 ? "" : " target"}</div>
      </div>
    </div>
    <div class="wo-progress">
      <div class="wo-progress-bar"><i id="wo-fill" style="width:${totalSets ? (doneSets / totalSets) * 100 : 0}%"></i></div>
      <span id="wo-count">${doneSets} / ${totalSets} sets</span>
    </div>`;

  if (week === 8) {
    html +=
      '<div class="deload-banner">Deload week: 2 light sets per exercise, easy effort. Recovery is the goal.</div>';
  }
  // (no auto-regulation set banner: every exercise is a flat 2 working sets)

  state.active.exercises.forEach((aex, ei) => {
    const slot = slotAt(ei);
    // superset grouping: a label before the first exercise of a group
    const prevSlot = ei > 0 ? slotAt(ei - 1) : null;
    if (slot.ssGroup && (!prevSlot || prevSlot.ssGroup !== slot.ssGroup)) {
      html += '<div class="superset-label">⚡ Superset — alternate sets, rest ~30 s</div>';
    }
    const lib = LIB[aex.key];
    const swapped = aex.key !== slot.key;
    const bump = progressionDue(day, aex.name, slot.repMax);
    const open = howtoOpen.has(ei);
    const collapsedEx = isCollapsed(ei);
    const media = !swapped && week <= 3 && slot.mediaWeeks13 ? slot.mediaWeeks13 : lib.media;
    const last = lastExercise(day, aex.name);
    const workCount = aex.sets.filter((s) => !s.warmup).length;
    const doneCount = aex.sets.filter((s) => !s.warmup && s.done).length;
    const allDone = doneCount === workCount && workCount > 0;

    html += `<div class="card exercise-card${collapsedEx ? " collapsed" : ""}${allDone ? " ex-done" : ""}">
      <div class="ex-head">
        <div class="ex-title-row">
          <button class="ex-collapse-bar" data-act="collapse" data-ex="${ei}" aria-label="Collapse exercise">
            <span class="ex-name">${esc(aex.name)}${allDone ? ' <span class="ex-check">✓</span>' : ""}</span>
            ${bump ? '<span class="badge">Add 2.5 kg</span>' : ""}
            <span class="ex-chev">${collapsedEx ? "▸" : "▾"}</span>
          </button>
          <button class="drag-handle" data-drag="${ei}" aria-label="Drag to reorder">≡</button>
        </div>
        ${
          collapsedEx
            ? `<div class="ex-meta">${doneCount} / ${workCount} sets done</div>`
            : `${slot.note ? `<div class="ex-note">${esc(slot.note)}</div>` : ""}
        <div class="ex-meta">${workCount} × ${slot.repMin}–${slot.repMax} reps · rest ${slot.rest >= 120 ? Math.round(slot.rest / 60) + " min" : slot.rest + " s"}</div>
        <div class="ex-cue">${esc(lib.cue)}</div>
        <div class="ex-actions">
          <button class="howto-btn info-btn${repsOpen.has(ei) ? " on" : ""}" data-act="reps-hist" data-ex="${ei}" aria-label="Reps done at each weight" title="Reps done at each weight">i</button>
          <button class="howto-btn" data-act="howto" data-ex="${ei}">${open ? "Hide info" : "More info"}</button>
          <button class="howto-btn swap-btn" data-act="swap" data-ex="${ei}">Unavailable / swap</button>
          <button class="howto-btn" data-act="plate-toggle" data-ex="${ei}">${isPlate(ei) ? "Use kg" : "Use plates"}</button>
          <button class="howto-btn" data-act="toggle-lbs" data-ex="${ei}">${isLbs(ei) ? "Switch to kg" : "Switch to lbs"}</button>
          <button class="howto-btn remove-btn" data-act="remove-ex" data-ex="${ei}">Remove</button>
        </div>`
        }
      </div>`;

    if (!collapsedEx && repsOpen.has(ei)) html += repsHistHtml(ei, aex);

    if (!collapsedEx && open) {
      const isF = state.profile && state.profile.gender === "female";
      const gender = isF ? "female" : "male";
      const vid = (isF && lib.videoIdF) || lib.videoId;
      // profile-tuned video link; never surfaces gender in UI copy
      const videoLink = vid
        ? `<a class="video-link" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">▶ Watch video</a>`
        : `<a class="video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(isF && lib.videoF ? lib.videoF : lib.video)}" target="_blank" rel="noopener">▶ Watch a video</a>`;

      html += `
        <div class="howto">
          ${muscleDiagram(lib.muscle, gender)}
          ${media ? `<img class="demo-img" src="media/${media}_0.jpg" data-base="${media}" alt="${esc(aex.name)} demonstration">` : ""}
          <ul class="form-list">
            ${lib.form.map((c) => `<li>${esc(c)}</li>`).join("")}
          </ul>
          ${videoLink}
        </div>`;
    }

    let workingNo = 0;
    if (!collapsedEx) {
      aex.sets.forEach((set, si) => {
        const inPlates = isPlate(ei);
        const inLbs = !inPlates && isLbs(ei);
        let label, ghost;
        if (set.warmup) {
          label = "Warm-up";
          ghost = "light & easy";
        } else {
          const prev = last && last.sets[workingNo];
          const prevWt = prev
            ? inLbs
              ? Math.round(prev.weight * LBS_PER_KG) + " lbs"
              : fmtWeight(prev.weight)
            : "";
          ghost = prev
            ? `last: ${prevWt} × ${prev.reps}${prev.partial ? " +" + prev.partial + "p" : ""}`
            : "";
          workingNo += 1;
          label = `Set ${workingNo}`;
        }
        const wtDisplay = inLbs ? Math.round(set.weight * LBS_PER_KG) : set.weight;
        const kgControl = inPlates
          ? plateBuilder(ei, si, set)
          : `
            <div class="stepper-wrap">
              <div class="cap">${inLbs ? "lbs" : "kg"}</div>
              <div class="stepper">
                <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="weight" data-dir="-1">−</button>
                <input type="text" inputmode="${inLbs ? "numeric" : "decimal"}" step="${inLbs ? LBS_STEP : "2.5"}" min="0" value="${wtDisplay}"
                       data-ex="${ei}" data-set="${si}" data-field="weight">
                <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="weight" data-dir="1">+</button>
              </div>
            </div>`;
        html += `
        <div class="set-row${set.done ? " done" : ""}${set.warmup ? " warmup" : ""}${inPlates ? " plates" : ""}" id="set-${ei}-${si}">
          <div class="set-top">
            <span class="set-label">${label}</span>
            <span class="ghost">${ghost}</span>
            ${set.pr ? '<span class="pr-badge">🏆 PR</span>' : ""}
          </div>
          <div class="set-controls">
            ${kgControl}
            <div class="stepper-wrap">
              <div class="cap">reps</div>
              <div class="stepper">
                <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="reps" data-dir="-1">−</button>
                <input type="number" inputmode="numeric" step="1" min="0" value="${set.reps}"
                       data-ex="${ei}" data-set="${si}" data-field="reps">
                <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="reps" data-dir="1">+</button>
              </div>
            </div>
            <button class="set-check" data-act="check" data-ex="${ei}" data-set="${si}">✓</button>
          </div>
          ${
            set.warmup
              ? ""
              : `
          <div class="partial-row">
            <span class="cap">Partial reps (after failure)</span>
            <div class="stepper mini">
              <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="partial" data-dir="-1">−</button>
              <input type="number" inputmode="numeric" step="1" min="0" value="${set.partial || 0}"
                     data-ex="${ei}" data-set="${si}" data-field="partial">
              <button data-act="step" data-ex="${ei}" data-set="${si}" data-field="partial" data-dir="1">+</button>
            </div>
          </div>`
          }
        </div>`;
      });
      html += `<div class="set-edit-row">
      <button class="add-set-btn" data-act="add-set" data-ex="${ei}">+ Add set</button>
      ${aex.sets.filter((s) => !s.warmup).length > 1 ? `<button class="add-set-btn remove-set-btn" data-act="remove-set" data-ex="${ei}">− Remove set</button>` : ""}
    </div>`;
    }

    html += "</div>";
  });

  html += `<button class="add-ex-btn" data-act="add-exercise">+ Add exercise to this day</button>`;

  html += `
    <div class="bottom-bar-spacer"></div>
    <div class="bottom-bar">
      <button class="btn-primary" data-act="finish">Finish workout</button>
    </div>`;

  $app.innerHTML = html;
  setupDrag();
}

// Remember this day's exercise order so the next workout on this day opens the
// same way. Stores the program's slot keys in display order, so a one-off swap
// (which changes aex.key but not the slot) doesn't corrupt the saved layout.
function saveDayOrder() {
  if (!state.active) return;
  const keys = state.active.exercises
    .map((_, ei) => {
      const s = slotAt(ei);
      return s && s.key;
    })
    .filter(Boolean);
  if (!state.order) state.order = {};
  state.order[state.active.day] = keys;
}

function reorderExercise(from, to) {
  if (from === to) return;
  if (!state.active.slotOrder) {
    state.active.slotOrder = state.active.exercises.map((_, i) => i);
  }
  const [exMoved] = state.active.exercises.splice(from, 1);
  state.active.exercises.splice(to, 0, exMoved);
  const [slotMoved] = state.active.slotOrder.splice(from, 1);
  state.active.slotOrder.splice(to, 0, slotMoved);
  if (state.active.collapsed) {
    state.active.collapsed = state.active.collapsed.map((c) => {
      if (c === from) return to;
      if (from < to && c > from && c <= to) return c - 1;
      if (from > to && c >= to && c < from) return c + 1;
      return c;
    });
  }
  howtoOpen.clear();
  repsOpen.clear();
  saveDayOrder();
  saveState();
  renderWorkout();
}

export function removeExercise(ei) {
  const day = state.active.day;
  const slotIdx = state.active.slotOrder ? state.active.slotOrder[ei] : ei;
  const extras = state.extras && state.extras[day];
  const extrasCount = extras ? extras.length : 0;
  // extras occupy the tail of prog(); anything before that is a built-in slot
  const templateCount = prog()[day].exercises.length - extrasCount;
  if (slotIdx >= templateCount) {
    // a user-added exercise → drop it from the saved extras
    extras.splice(slotIdx - templateCount, 1);
  } else {
    // a built-in exercise → remember the removal so it stays gone next time
    if (!state.removed) state.removed = {};
    const key = state.active.exercises[ei].key;
    (state.removed[day] = state.removed[day] || []).push(key);
  }
  // prog() loses the entry at slotIdx either way → shift later refs down one
  if (state.active.slotOrder) {
    state.active.slotOrder = state.active.slotOrder.map((v) => (v > slotIdx ? v - 1 : v));
  }
  state.active.exercises.splice(ei, 1);
  if (state.active.slotOrder) state.active.slotOrder.splice(ei, 1);
  if (state.active.collapsed) {
    state.active.collapsed = state.active.collapsed
      .filter((c) => c !== ei)
      .map((c) => (c > ei ? c - 1 : c));
  }
  howtoOpen.clear();
  repsOpen.clear();
  saveDayOrder();
  saveState();
  renderWorkout();
}

function setupDrag() {
  const getCards = () => [...$app.querySelectorAll(".exercise-card")];
  let active = false;
  let dragFrom = -1,
    dragTo = -1;
  let clone = null,
    sourceCard = null,
    offsetY = 0;

  function updateShifts(cards, from, to) {
    const h = sourceCard.getBoundingClientRect().height + 12;
    cards.forEach((c, i) => {
      if (i === from) return;
      if (from < to && i > from && i <= to) c.style.transform = `translateY(-${h}px)`;
      else if (from > to && i >= to && i < from) c.style.transform = `translateY(${h}px)`;
      else c.style.transform = "";
    });
  }

  function calcTo(cards, clientY) {
    // dead-zone: pointer still within the source card → keep it in place
    const sr = sourceCard.getBoundingClientRect();
    if (clientY >= sr.top && clientY <= sr.bottom) return dragFrom;
    let best = dragFrom,
      bestDist = Infinity;
    cards.forEach((c, i) => {
      if (i === dragFrom) return;
      const r = c.getBoundingClientRect();
      // clamp center to viewport so off-screen cards (scrolled away) are still reachable
      const center = Math.max(0, Math.min(window.innerHeight, r.top + r.height / 2));
      const dist = Math.abs(clientY - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  getCards().forEach((card, ei) => {
    const handle = card.querySelector(".drag-handle");
    if (!handle) return;
    let holdTimer = null,
      startY = 0;

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      startY = e.clientY;
      holdTimer = setTimeout(() => {
        active = true;
        dragFrom = dragTo = ei;
        sourceCard = card;
        const rect = card.getBoundingClientRect();
        offsetY = e.clientY - rect.top;
        clone = card.cloneNode(true);
        Object.assign(clone.style, {
          position: "fixed",
          left: rect.left + "px",
          top: rect.top + "px",
          width: rect.width + "px",
          zIndex: "999",
          pointerEvents: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,.2)",
          opacity: "0.95",
        });
        document.body.appendChild(clone);
        card.style.opacity = "0.2";
        card.style.pointerEvents = "none";
        handle.setPointerCapture(e.pointerId);
        if (navigator.vibrate) navigator.vibrate(80);
        clone.style.transition = "transform 120ms ease-out";
        clone.style.transform = "scale(1.03)";
        setTimeout(() => {
          if (clone) clone.style.transform = "";
        }, 120);
      }, 200);
    });

    handle.addEventListener("pointermove", (e) => {
      if (!active) {
        if (Math.abs(e.clientY - startY) > 8) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        return;
      }
      clone.style.top = e.clientY - offsetY + "px";
      // scroll the page when dragging near the top or bottom edge
      const edge = 80;
      if (e.clientY < edge) window.scrollBy(0, -12 * (1 - e.clientY / edge));
      else if (e.clientY > window.innerHeight - edge)
        window.scrollBy(0, 12 * (1 - (window.innerHeight - e.clientY) / edge));
      const cards = getCards();
      const newTo = calcTo(cards, e.clientY);
      if (newTo !== dragTo) {
        dragTo = newTo;
        updateShifts(cards, dragFrom, dragTo);
      }
    });

    const finish = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      if (!active) return;
      active = false;
      clone.remove();
      clone = null;
      getCards().forEach((c) => {
        c.style.transform = "";
        c.style.opacity = "";
        c.style.pointerEvents = "";
      });
      sourceCard = null;
      reorderExercise(dragFrom, dragTo);
    };

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

/* ---------- swaps (machine taken) ---------- */
export function openSwapSheet(ei) {
  const day = state.active.day;
  const slot = slotAt(ei);
  const aex = state.active.exercises[ei];
  // only ever offer movements that hit the exact same head as the planned slot,
  // so a swap keeps the same emphasis (e.g. upper chest -> upper chest, not flat).
  // curated alts come first for quality, then any other same-head movement.
  const head = headOf(slot.key);
  const sameHead = Object.keys(LIB).filter((k) => headOf(k) === head);
  const curated = LIB[slot.key].alts.filter((k) => sameHead.includes(k));
  const options = [...new Set([slot.key, ...curated, ...sameHead])].filter((k) => k !== aex.key);

  // options matching the equipment preference float to the top
  const eq = state.profile && state.profile.equipment;
  if (eq && eq !== "mixed") {
    const fits = (k) => {
      const e = LIB[k].equip;
      return eq === "machine" ? e === "machine" || e === "cable" : e !== "machine" && e !== "cable";
    };
    options.sort((a, b) => fits(b) - fits(a));
  }

  const overridden = !!(state.custom && state.custom[overrideKey(state.profile, day, ei)]);
  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.innerHTML = `
    <div class="sheet">
      <h2>Swap ${esc(aex.name)}</h2>
      <p>Same muscles, different exercise:</p>
      <button class="feel-btn current" data-swap-key="${aex.key}">
        ${esc(LIB[aex.key].name)} <span class="swap-now">now</span>
        <span class="swap-muscle">${esc(LIB[aex.key].muscle)}</span>
      </button>
      ${options
        .filter((k) => k !== aex.key)
        .map(
          (k) => `
        <button class="feel-btn" data-swap-key="${k}">
          ${esc(LIB[k].name)}
          <span class="swap-muscle">${esc(LIB[k].muscle)}</span>
        </button>`,
        )
        .join("")}
      <button class="ss-persist${overridden ? " on" : ""}" data-persist>
        <span class="ss-check">${overridden ? "✓" : ""}</span> Use this every workout (saves to your plan)
      </button>
      <button class="sheet-cancel" data-swap-key="">Never mind</button>
    </div>`;
  let persist = overridden;
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-persist]")) {
      persist = !persist;
      const b = sheet.querySelector("[data-persist]");
      b.classList.toggle("on", persist);
      b.querySelector(".ss-check").textContent = persist ? "✓" : "";
      return;
    }
    const btn = e.target.closest("[data-swap-key]");
    if (btn) {
      if (btn.dataset.swapKey) applySwap(ei, btn.dataset.swapKey, persist);
      else if (persist !== overridden) {
        setOverride(day, ei, persist ? aex.key : null);
      }
      sheet.remove();
    } else if (e.target === sheet) sheet.remove();
  });
  document.body.appendChild(sheet);
}

// Muscle groups in training order (push → pull → arms → legs → core) rather
// than alphabetically, so the picker reads like a gym session. Anything groupOf
// returns that isn't listed here falls in after these, alphabetically.
const GROUP_ORDER = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Adductors",
  "Calves",
  "Abs",
];

// Picker for adding a brand-new exercise to the current day: the whole library
// bucketed by muscle group (groups in training order, exercises A-Z inside),
// with a filter that matches the group name as well as the exercise.
export function openAddExerciseSheet() {
  const have = new Set(state.active.exercises.map((e) => e.key));
  const groups = {};
  for (const key of Object.keys(LIB)) {
    if (have.has(key)) continue; // already in today's workout
    const g = groupOf(key);
    (groups[g] = groups[g] || []).push(key);
  }
  const rank = (g) => {
    const i = GROUP_ORDER.indexOf(g);
    return i < 0 ? GROUP_ORDER.length : i;
  };
  const order = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const listHtml = order
    .map(
      (g) => `
    <div class="add-ex-group" data-group="${esc(g.toLowerCase())}">
      <div class="add-ex-group-label">${esc(g)}</div>
      ${groups[g]
        .sort((a, b) => LIB[a].name.localeCompare(LIB[b].name))
        .map(
          (k) => `
        <button class="feel-btn" data-add-key="${k}" data-search="${esc((LIB[k].name + " " + g + " " + LIB[k].muscle).toLowerCase())}">
          ${esc(LIB[k].name)}
          <span class="swap-muscle">${esc(LIB[k].muscle)}</span>
        </button>`,
        )
        .join("")}
    </div>`,
    )
    .join("");

  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.innerHTML = `
    <div class="sheet sheet-tall">
      <h2>Add exercise</h2>
      <p>Added to this day, now and next time.</p>
      <input type="text" class="add-ex-search" placeholder="Search exercise or muscle group…" autocomplete="off">
      <div class="add-ex-list">
        ${listHtml}
        <div class="add-ex-none" hidden>Nothing matches that.</div>
      </div>
      <button class="sheet-cancel" data-add-key="">Never mind</button>
    </div>`;

  const search = sheet.querySelector(".add-ex-search");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let anyAtAll = false;
    sheet.querySelectorAll(".add-ex-group").forEach((g) => {
      // a query naming a muscle group shows that whole group on its own
      const groupHit = !!q && g.dataset.group.includes(q);
      let anyVisible = false;
      g.querySelectorAll("[data-add-key]").forEach((b) => {
        const show = !q || groupHit || b.dataset.search.includes(q);
        b.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      g.style.display = anyVisible ? "" : "none";
      if (anyVisible) anyAtAll = true;
    });
    sheet.querySelector(".add-ex-none").hidden = anyAtAll;
  });

  sheet.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-key]");
    if (btn) {
      if (btn.dataset.addKey) addExerciseToDay(btn.dataset.addKey);
      sheet.remove();
    } else if (e.target === sheet) sheet.remove();
  });
  document.body.appendChild(sheet);
}

function addExerciseToDay(key) {
  if (!LIB[key]) return;
  const day = state.active.day;
  // if this is a built-in the user had removed, restore it to its slot rather
  // than appending a duplicate; otherwise add it as an extra at the end
  const removed = state.removed && state.removed[day];
  const wasRemoved = removed && removed.includes(key);
  if (wasRemoved) {
    removed.splice(removed.indexOf(key), 1);
  } else {
    if (!state.extras) state.extras = {};
    (state.extras[day] = state.extras[day] || []).push(key);
  }
  const progDay = prog()[day];
  const slotIdx = wasRemoved
    ? progDay.exercises.findIndex((e) => e.key === key)
    : progDay.exercises.length - 1;
  if (slotIdx < 0) return;
  // prog() gained an entry at slotIdx → shift existing refs at/after it up one
  if (state.active.slotOrder) {
    state.active.slotOrder = state.active.slotOrder.map((v) => (v >= slotIdx ? v + 1 : v));
  }
  const slot = progDay.exercises[slotIdx];
  const ei = state.active.exercises.length;
  state.active.exercises.push({
    key: slot.key,
    name: slot.name,
    sets: buildSets(day, slot, slot.name, state.active.week, false),
  });
  if (!state.active.slotOrder) state.active.slotOrder = state.active.exercises.map((_, i) => i);
  else state.active.slotOrder[ei] = slotIdx;
  howtoOpen.clear();
  repsOpen.clear();
  saveDayOrder();
  saveState();
  renderWorkout();
  toast(`${LIB[key].name} added`);
}

function applySwap(ei, key, persist) {
  const aex = state.active.exercises[ei];
  if (
    aex.sets.some((s) => s.done) &&
    !confirm("You already checked off sets on this exercise. Swapping clears them — continue?")
  )
    return;
  const day = state.active.day;
  const slot = slotAt(ei);
  aex.key = key;
  aex.name = key === slot.key ? slot.name : LIB[key].name;
  aex.sets = buildSets(day, slot, aex.name, state.active.week, false);
  if (persist) setOverride(day, ei, key === slot.key ? null : key);
  saveState();
  renderWorkout();
}

// Meso Builder: persist (or clear) a per-slot exercise override
function setOverride(day, ei, key) {
  const k = overrideKey(state.profile, day, ei);
  if (key) state.custom[k] = key;
  else delete state.custom[k];
  saveState();
}

/* ---------- set logging ---------- */
export function stepValue(ei, si, field, dir) {
  const set = state.active.exercises[ei].sets[si];
  const input = document.querySelector(
    `input[data-ex="${ei}"][data-set="${si}"][data-field="${field}"]`,
  );
  const lbsMode = field === "weight" && isLbs(ei);
  if (input) {
    const typed = parseNum(input.value);
    if (!isNaN(typed) && typed >= 0) {
      set[field] = lbsMode ? typed / LBS_PER_KG : typed;
    }
  }
  if (lbsMode) {
    const lbsNow = Math.round(set.weight * LBS_PER_KG);
    const lbsNew = Math.max(0, lbsNow + dir * LBS_STEP);
    set.weight = lbsNew / LBS_PER_KG;
  } else {
    const step = field === "weight" ? WEIGHT_STEP : 1;
    set[field] = Math.max(0, Math.round((set[field] + dir * step) * 10) / 10);
  }
  if (field === "weight") delete set.plates;
  saveState();
  if (input) input.value = lbsMode ? Math.round(set.weight * LBS_PER_KG) : set[field];
}

export function inputValue(ei, si, field, raw) {
  const lbsMode = field === "weight" && isLbs(ei);
  let v;
  if (lbsMode) {
    const lbs = parseNum(raw);
    v = isNaN(lbs) ? 0 : lbs / LBS_PER_KG;
  } else {
    v = field === "reps" || field === "partial" ? parseInt(raw, 10) : parseNum(raw);
  }
  const set = state.active.exercises[ei].sets[si];
  set[field] = isNaN(v) || v < 0 ? 0 : v;
  if (field === "weight") delete set.plates;
  saveState();
  // value to echo back into the input: weight is stored in kg, so a lbs field
  // must show its lbs equivalent (not the converted kg) after editing
  return lbsMode ? Math.round(set.weight * LBS_PER_KG) : set[field];
}

export function toggleLbs(ei) {
  const key = state.active.exercises[ei].key;
  if (!state.prefs.lbs) state.prefs.lbs = {};
  if (state.prefs.lbs[key]) delete state.prefs.lbs[key];
  else state.prefs.lbs[key] = true;
  saveState();
  renderWorkout();
}

// Flush the row's on-screen weight/reps/partial inputs into state (used at tick
// time so a value typed just before ✓ isn't missed if its change event is late).
function commitRowInputs(ei, si) {
  for (const f of ["weight", "reps", "partial"]) {
    const inp = document.querySelector(
      `input[data-ex="${ei}"][data-set="${si}"][data-field="${f}"]`,
    );
    if (inp) inputValue(ei, si, f, inp.value);
  }
}

// A working set is a PR when it beats your all-time history (past sessions, not
// this one) on EITHER the weight lifted or the estimated 1RM — and is the
// session's best by that metric, so only the top set is badged. Checking weight
// directly means a clear load jump like 20→35 always counts, even where the
// rep-based 1RM estimate would lag.
function isPr(aex, set) {
  if (!set.done || set.warmup || !(set.weight > 0)) return false;
  const best = bestFor(aex.name); // history only; excludes the current workout
  const done = aex.sets.filter((s) => s.done && !s.warmup && s.weight > 0);
  const maxW = Math.max(...done.map((s) => s.weight));
  const maxE = Math.max(...done.map((s) => e1rm(s.weight, s.reps)));
  const setE = e1rm(set.weight, set.reps);
  const eps = 0.01;
  const weightPr = set.weight > best.topWeight + eps && set.weight >= maxW - eps;
  const e1rmPr = setE > best.e1rm + eps && setE >= maxE - eps;
  return weightPr || e1rmPr;
}

export function toggleSet(ei, si) {
  const aex = state.active.exercises[ei];
  const set = aex.sets[si];
  // Commit any weight/reps typed into this row but not yet blurred, BEFORE we
  // judge a PR or save. On phones a value tapped in right before the ✓ often
  // hasn't fired its change event yet, so without this the set would be scored
  // (and saved) against the prefilled number, not what's on screen.
  commitRowInputs(ei, si);
  set.done = !set.done;
  const pr = set.done && isPr(aex, set);
  set.pr = pr;
  saveState();
  const row = document.getElementById(`set-${ei}-${si}`);
  if (row) {
    row.classList.toggle("done", set.done);
    const check = row.querySelector(".set-check");
    const existing = row.querySelector(".pr-badge");
    if (pr && !existing) {
      const b = document.createElement("span");
      b.className = "pr-badge";
      b.textContent = "🏆 PR";
      row.querySelector(".set-top").appendChild(b);
    } else if (!pr && existing) {
      existing.remove();
    }
    if (set.done && check) {
      check.classList.remove("pop");
      void check.offsetWidth;
      check.classList.add("pop");
    }
  }
  updateWorkoutProgress();
  // the "i" panel counts completed sets, so refresh it in place when one lands
  const histPanel = document.getElementById(`reps-hist-${ei}`);
  if (histPanel) histPanel.outerHTML = repsHistHtml(ei, aex);
  if (set.done) {
    ensureAudio(); // user gesture -> unlock audio for the end-of-rest beep
    if (pr) showPrToast(aex.name);
    else if (navigator.vibrate) navigator.vibrate(15);
    // a quick toast when an exercise's last working set is completed
    const workLeft = aex.sets.some((s) => !s.warmup && !s.done);
    if (!workLeft && aex.sets.some((s) => !s.warmup)) toast(`${aex.name} done 💪`);
    startTimer(set.warmup ? 30 : slotAt(ei).rest);
  } else {
    stopTimer();
  }
}

function showPrToast(name) {
  const t = document.createElement("div");
  t.className = "pr-toast";
  t.innerHTML = `🏆 New PR — ${esc(name)}!`;
  document.body.appendChild(t);
  if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 400);
  }, 2200);
}

function updateWorkoutProgress() {
  if (!state.active) return;
  const total = state.active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = state.active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const fill = document.getElementById("wo-fill");
  if (fill) fill.style.width = (total ? (done / total) * 100 : 0) + "%";
  const count = document.getElementById("wo-count");
  if (count) count.textContent = `${done} / ${total} sets`;
}

/* ---------- finishing ---------- */
export function finishWorkout() {
  const doneSets = state.active.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done && !s.warmup).length,
    0,
  );
  if (doneSets === 0) {
    if (!confirm("No working sets are checked off. Discard this workout?")) return;
    state.active = null;
    saveState();
    renderHome();
    return;
  }
  // end-of-workout feedback sheet
  stopTimer();
  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.id = "finish-sheet";
  const q = (key, label, opts) => `
    <div class="fb-q">
      <div class="fb-label">${label}</div>
      <div class="fb-row" data-fb="${key}">
        ${opts.map(([v, t]) => `<button class="fb-opt" data-v="${v}">${t}</button>`).join("")}
      </div>
    </div>`;
  sheet.innerHTML = `
    <div class="sheet feedback-sheet">
      <h2>Nice work! 💪</h2>
      <p>A few quick taps tune next week (RP-style). Skip any.</p>
      ${q("effort", "How hard was it?", [
        ["easy", "😴 Easy"],
        ["right", "💪 Right"],
        ["hard", "🥵 Hard"],
      ])}
      ${q("pump", "Muscle pump?", [
        ["low", "Low"],
        ["good", "Good"],
        ["huge", "🔥 Huge"],
      ])}
      ${q("soreness", "Still sore coming in?", [
        ["none", "None"],
        ["some", "Some"],
        ["lots", "A lot"],
      ])}
      ${q("joints", "Joint pain?", [
        ["none", "None"],
        ["some", "Some"],
        ["lots", "A lot"],
      ])}
      <button class="btn-primary fb-save" data-fb-save>Save workout</button>
      <button class="sheet-cancel" data-fb-skip>Save without rating</button>
    </div>`;
  sheet.addEventListener("click", (e) => {
    const opt = e.target.closest(".fb-opt");
    if (opt) {
      const row = opt.closest(".fb-row");
      row.querySelectorAll(".fb-opt").forEach((b) => b.classList.toggle("sel", b === opt));
      return;
    }
    if (e.target.closest("[data-fb-save]")) {
      const fb = {};
      sheet.querySelectorAll(".fb-row").forEach((row) => {
        const sel = row.querySelector(".fb-opt.sel");
        if (sel) fb[row.dataset.fb] = sel.dataset.v;
      });
      saveWorkout(fb);
      sheet.remove();
      return;
    }
    if (e.target.closest("[data-fb-skip]")) {
      saveWorkout({});
      sheet.remove();
    } else if (e.target === sheet) sheet.remove();
  });
  document.body.appendChild(sheet);
}

// RP-style auto-regulation: translate this session's feedback into a set
// nudge for next time this day comes around (clamped to ±2).
function nextVolumeAdj(day, fb) {
  let adj = (state.volAdj && state.volAdj[day]) || 0;
  const easy = fb.effort === "easy";
  const lowPump = fb.pump === "low";
  const lowSore = !fb.soreness || fb.soreness === "none";
  const tooMuch = fb.soreness === "lots" || fb.joints === "lots";
  if (tooMuch)
    adj -= 1; // back off — recovery first
  else if (easy && lowPump && lowSore) adj += 1; // room for more — add a set
  return Math.max(-2, Math.min(2, adj));
}

function saveWorkout(fb) {
  if (!state.blockStart) state.blockStart = todayISO(); // block clock starts at first finished workout
  state.volAdj[state.active.day] = nextVolumeAdj(state.active.day, fb);

  // persist warmup weights for each exercise so they prefill next time
  if (!state.prefs.warmup) state.prefs.warmup = {};
  for (const e of state.active.exercises) {
    const warmups = e.sets.filter((s) => s.warmup);
    if (warmups.length)
      state.prefs.warmup[e.key] = warmups.map((s) => ({ weight: s.weight, reps: s.reps }));
  }

  state.sessions.push({
    date: todayISO(),
    day: state.active.day,
    week: state.active.week,
    block: state.active.block || 1,
    feel: fb.effort || null,
    feedback: fb,
    exercises: state.active.exercises.map((e) => ({
      name: e.name,
      key: e.key,
      sets: e.sets
        .filter((s) => !s.warmup)
        .map((s) => ({ weight: s.weight, reps: s.reps, done: s.done, partial: s.partial || 0 })),
      warmupSets: e.sets
        .filter((s) => s.warmup)
        .map((s) => ({ weight: s.weight, reps: s.reps, done: s.done })),
    })),
  });
  state.active = null;
  saveState();
  renderHome();
}

// "i" panel: est. 1RM plus the best reps at every weight actually lifted. Only
// COMPLETED working sets count, so weights never lifted are never listed — but
// sets ticked off in the session in progress do count, otherwise the panel goes
// stale the moment you beat your old numbers.
function repsHistHtml(ei, aex) {
  const histLbs = !isPlate(ei) && isLbs(ei);
  // group by what's displayed, so one shown load is always one row
  const bucket = histLbs ? (w) => Math.round(w * LBS_PER_KG) : (w) => Math.round(w * 10) / 10;
  const liveSets = aex.sets.filter((s) => s.done && !s.warmup && s.weight > 0);
  const hist = repsByWeight(aex.name, aex.key, bucket, liveSets);
  const wLabel = (w) => (histLbs ? w + " lbs" : fmtWeight(w));
  // best-scoring set across history AND this session, with the set it came from
  const pastBest = bestFor(aex.name);
  const best = liveSets.reduce(
    (b, s) => {
      const e = e1rm(s.weight, s.reps);
      return e > b.e1rm ? { e1rm: e, weight: s.weight, reps: s.reps } : b;
    },
    { e1rm: pastBest.e1rm, weight: pastBest.weight, reps: pastBest.reps },
  );
  return `
    <div class="reps-hist" id="reps-hist-${ei}">
      ${
        hist.length
          ? `
      ${
        best.e1rm > 0
          ? `
      <div class="reps-hist-1rm">
        <div class="reps-hist-cap">Estimated 1RM</div>
        <b>${wLabel(bucket(best.e1rm))}</b>
        <span>from ${wLabel(bucket(best.weight))} × ${best.reps}</span>
      </div>`
          : ""
      }
      <div class="reps-hist-cap">Best reps at each weight</div>
      ${hist
        .map(
          (h) => `
        <div class="reps-hist-row">
          <b>${wLabel(h.weight)}</b>
          <span>${h.best} reps</span>
        </div>`,
        )
        .join("")}`
          : `<div class="reps-hist-empty">No completed sets logged yet — finish a set and it shows up here.</div>`
      }
    </div>`;
}

export function toggleRepsHist(ei) {
  repsOpen.has(ei) ? repsOpen.delete(ei) : repsOpen.add(ei);
  renderWorkout();
}

export function toggleHowto(ei) {
  howtoOpen.has(ei) ? howtoOpen.delete(ei) : howtoOpen.add(ei);
  renderWorkout();
}

export function addSet(ei) {
  const aex = state.active.exercises[ei];
  const last = [...aex.sets].reverse().find((s) => !s.warmup);
  aex.sets.push({ weight: last ? last.weight : 0, reps: last ? last.reps : 8, done: false });
  saveState();
  renderWorkout();
}

export function removeSet(ei) {
  const aex = state.active.exercises[ei];
  // drop the last working set; keep at least one
  for (let i = aex.sets.length - 1; i >= 0; i--) {
    if (!aex.sets[i].warmup) {
      if (aex.sets.filter((s) => !s.warmup).length <= 1) return;
      aex.sets.splice(i, 1);
      break;
    }
  }
  saveState();
  renderWorkout();
}

export function moveExercise(ei, dir) {
  const to = ei + dir;
  if (to < 0 || to >= state.active.exercises.length) return;
  if (!state.active.slotOrder) {
    state.active.slotOrder = state.active.exercises.map((_, i) => i);
  }
  [state.active.exercises[ei], state.active.exercises[to]] = [
    state.active.exercises[to],
    state.active.exercises[ei],
  ];
  [state.active.slotOrder[ei], state.active.slotOrder[to]] = [
    state.active.slotOrder[to],
    state.active.slotOrder[ei],
  ];
  if (state.active.collapsed) {
    state.active.collapsed = state.active.collapsed.map((c) => (c === ei ? to : c === to ? ei : c));
  }
  howtoOpen.clear();
  repsOpen.clear();
  saveDayOrder();
  saveState();
  renderWorkout();
}
