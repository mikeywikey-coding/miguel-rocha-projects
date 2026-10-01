"use strict";

import { $app, toast } from "./dom.js";
import { state, saveState, replaceState, todayISO, fmtDate, parseNum, esc, prog } from "./state.js";
import { dayKeys } from "./program.js";
import { stopTimer } from "./timer.js";
import { renderHome } from "./home.js";

// selections made during onboarding, before the profile exists
const pending = {
  gender: null,
  name: "",
  goal: "hypertrophy",
  level: "beginner",
  equipment: "mixed",
  style: "full",
  days: 3,
  focus: "balanced",
  spec: "off",
  muscleFocus: [],
  height: 165,
  weight: 60,
  goalChoice: "",
  freq: null,
  hUnit: "cm",
  wUnit: "kg",
};

// muscle groups offered for the "Focus muscles" multi-select (must match groupOf())
const MUSCLE_FOCUS_OPTS = [
  "Glutes",
  "Quads",
  "Hamstrings",
  "Calves",
  "Chest",
  "Back",
  "Shoulders",
  "Abs",
  "Triceps",
  "Biceps",
];
// shorter chip labels for the longest names (stored value stays the full muscle name)
const MUSCLE_FOCUS_LABEL = { Hamstrings: "Hams", Shoulders: "Delts" };

let weightOpen = true; // weight history/chart expanded on the profile screen
let measureOpen = true; // measurement history/chart expanded
const MEASURE_PARTS = ["Waist", "Hips", "Chest", "Arms", "Thighs", "Shoulders"];
let measurePart = "Waist";

export function toggleWeight() {
  weightOpen = !weightOpen;
  renderProfile();
}

export function toggleMeasure() {
  measureOpen = !measureOpen;
  renderProfile();
}

export function pickMeasure(part) {
  measurePart = part;
  renderProfile();
}

export function deleteMeasure(idx) {
  state.measures.splice(idx, 1);
  saveState();
  renderProfile();
}

export function logMeasure() {
  const cm = parseNum(document.getElementById("measure-input").value);
  if (isNaN(cm) || cm <= 0) return;
  const today = todayISO();
  const last = [...state.measures]
    .reverse()
    .find((m) => m.part === measurePart && m.date === today);
  if (last) last.cm = cm;
  else state.measures.push({ date: today, part: measurePart, cm });
  saveState();
  toast(`${measurePart} logged · ${cm} cm`);
  renderProfile();
}

function latestMeasure(part) {
  for (let i = state.measures.length - 1; i >= 0; i--)
    if (state.measures[i].part === part) return state.measures[i];
  return null;
}

function measureCard() {
  const cur = latestMeasure(measurePart);
  const series = state.measures.filter((m) => m.part === measurePart); // oldest→newest
  let html = `
    <div class="card">
      <div class="measure-chips">
        ${MEASURE_PARTS.map((p) => `<button class="m-chip${p === measurePart ? " sel" : ""}" data-act="pick-measure" data-part="${p}">${p}${latestMeasure(p) ? " <b>" + latestMeasure(p).cm + "</b>" : ""}</button>`).join("")}
      </div>
      <div class="field-label">${measurePart} (cm)</div>
      ${numberField("measure-input", measurePart, cur ? cur.cm : 60, 0.5, "cm")}
      <button class="btn-secondary log-weight-btn" data-act="log-measure">Log ${measurePart.toLowerCase()}</button>`;

  if (series.length >= 2) {
    const first = series[0].cm;
    const diff = Math.round((cur.cm - first) * 10) / 10;
    html += `
      <button class="weight-toggle" data-act="toggle-measure">
        <span>${diff > 0 ? "+" : ""}${diff} cm since you started</span>
        <span class="chev">${measureOpen ? "▾" : "▸"}</span>
      </button>`;
    if (measureOpen) {
      html += metricChart(series.map((m) => ({ date: m.date, v: m.cm })));
      html += '<div class="weight-list">';
      for (let i = series.length - 1; i >= 0 && i > series.length - 13; i--) {
        const m = series[i];
        const prev = i > 0 ? series[i - 1].cm : null;
        const d =
          prev === null ? "" : (m.cm - prev > 0 ? "+" : "") + Math.round((m.cm - prev) * 10) / 10;
        const idx = state.measures.indexOf(m);
        html += `<div class="weight-line"><span>${fmtDate(m.date)}</span><b>${m.cm} cm</b><span class="w-diff">${d}</span><button class="del-entry-btn" data-act="del-measure" data-idx="${idx}" aria-label="Delete">×</button></div>`;
      }
      html += "</div>";
    }
  } else if (series.length === 1) {
    html += `<div class="weight-trend">First ${measurePart.toLowerCase()} entry logged — measure again to see your trend.</div>`;
  }
  html += "</div>";
  return html;
}

const OPTION_LABELS = {
  gender: [
    ["female", "Female"],
    ["male", "Male"],
  ],
  level: [
    ["beginner", "Beginner"],
    ["intermediate", "Intermediate"],
    ["advanced", "Advanced"],
  ],
  equipment: [
    ["mixed", "Mixed"],
    ["free", "Free weights"],
    ["machine", "Machines"],
  ],
  goal: [
    ["hypertrophy", "Muscle growth"],
    ["strength", "Strength"],
  ],
  style: [
    ["full", "Full body"],
    ["ul", "Upper / Lower"],
    ["ppl", "Push Pull Legs"],
  ],
  days: [
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["5", "5"],
    ["6", "6"],
  ],
  focus: [
    ["balanced", "Balanced"],
    ["lower", "Lower body"],
    ["upper", "Upper body"],
  ],
  spec: [
    ["off", "All muscles"],
    ["lower", "Lower only"],
    ["upper", "Upper only"],
  ],
};

const SPLIT_HINTS = {
  full: "Every muscle each session — great at 2–4 days",
  ul: "Alternating upper & lower — great at 3–6 days",
  ppl: "Push / pull / legs cycled — great at 3 or 6 days",
};

const SPEC_HINTS = {
  off: "Full program — trains all muscle groups every week",
  lower: "Legs & glutes only — removes upper body entirely, locks to 3 days/week",
  upper: "Chest, back, shoulders & arms only — removes lower body entirely, locks to 3 days/week",
};

const FOCUS_HINTS = {
  balanced: "Upper and lower body get equal sets across the week",
  lower: "Lower body exercises get extra sets and first priority slots — upper still trained",
  upper: "Upper body exercises get extra sets and first priority slots — lower still trained",
};

const GOAL_HINTS = {
  strength: "Heavier, lower reps (3–6), longer rest",
  hypertrophy: "Growth-optimised reps & volume (default)",
};

const LEVEL_HINTS = {
  beginner: "Simpler lifts, leaner volume to learn form",
  intermediate: "Standard lifts and volume",
  advanced: "Free-weight lifts, extra volume",
};

// onboarding flow (first launch): 0 welcome+name · 1 basics (sex + height/
// weight) · 2 goal · 3 frequency · 4 experience · 5 plan ready. Steps 1–4
// carry the progress bar. The profile/settings screen still shows everything
// on one scroll via profileFields(); the unasked settings keep sane defaults.
const OB_GENDERS = [
  ["female", "Female"],
  ["male", "Male"],
];
const OB_GOALS = [
  ["balanced", "Balanced growth & strength", "Full-body size and power"],
  ["upper", "Upper focus", "Chest, back, shoulders & arms"],
  ["lower", "Lower focus", "Glutes, quads & hamstrings"],
  ["fitness", "General fitness", "Feel good and move well"],
];
const OB_FREQS = [
  [2, "2 days", "A solid weekly minimum", false],
  [3, "3 days", "Recommended to start", true],
  [4, "4 days", "Great for steady progress", false],
  [5, "5 days", "A high weekly commitment", false],
  [6, "6 days", "For the fastest progress", false],
];
const OB_LEVELS = [
  ["beginner", "New to lifting", "Just getting started"],
  ["intermediate", "Some experience", "I've trained on and off"],
  ["advanced", "Experienced", "I train consistently"],
];
// the goal question maps to the program's volume emphasis (focus)
const GOAL_TO_FOCUS = { balanced: "balanced", upper: "upper", lower: "lower", fitness: "balanced" };
// the single frequency answer picks the day count; the split style follows it
const styleForDays = (d) => (d <= 3 ? "full" : d <= 5 ? "ul" : "ppl");
let obStep = 0;

function optionRow(field, selected) {
  return `
    <div class="gender-row">
      ${OPTION_LABELS[field]
        .map(
          ([v, label]) => `
        <button class="gender-card${selected === v ? " selected" : ""}" data-act="pick-opt" data-field="${field}" data-value="${v}">${label}</button>
      `,
        )
        .join("")}
    </div>`;
}

function numberField(id, label, value, step, unit) {
  return `
    <div class="stepper-wrap">
      <div class="cap">${label} (${unit})</div>
      <div class="stepper">
        <button data-act="nstep" data-target="${id}" data-step="-${step}">−</button>
        <input type="text" inputmode="decimal" id="${id}" value="${value}" min="0">
        <button data-act="nstep" data-target="${id}" data-step="${step}">+</button>
      </div>
    </div>`;
}

function profileFields(p) {
  return `
    <div class="field-label">Gender</div>
    ${optionRow("gender", p.gender)}
    <div class="field-label">Goal</div>
    ${optionRow("goal", p.goal)}
    <div class="split-hint">${GOAL_HINTS[p.goal] || ""}</div>
    <div class="field-label">Experience</div>
    ${optionRow("level", p.level)}
    <div class="split-hint">${LEVEL_HINTS[p.level] || ""}</div>
    <div class="field-label">Equipment you prefer</div>
    ${optionRow("equipment", p.equipment)}
    <div class="field-label">Split type</div>
    ${optionRow("style", p.style)}
    <div class="split-hint" id="split-hint">${SPLIT_HINTS[p.style] || ""}</div>
    <div class="field-label">Days per week</div>
    ${optionRow("days", String(p.days))}
    <div class="field-label">Scope — what the program trains</div>
    ${optionRow("spec", p.spec)}
    <div class="split-hint" id="spec-hint">${SPEC_HINTS[p.spec] || ""}</div>
    <div class="field-label">Volume emphasis — where extra sets go</div>
    ${optionRow("focus", p.focus)}
    <div class="split-hint" id="focus-hint">${FOCUS_HINTS[p.focus] || ""}</div>
    <div class="field-label">Focus muscles</div>
    ${muscleFocusRow(p.muscleFocus)}
    <div class="split-hint">${p.muscleFocus && p.muscleFocus.length ? "Extra sets added for the muscles you picked" : "Optional — pick muscles to train with extra volume"}</div>`;
}

function muscleFocusRow(selected) {
  const sel = selected || [];
  return `
    <div class="muscle-focus-row">
      ${MUSCLE_FOCUS_OPTS.map((m) => `<button class="m-chip${sel.includes(m) ? " sel" : ""}" data-act="toggle-muscle" data-muscle="${m}">${MUSCLE_FOCUS_LABEL[m] || m}</button>`).join("")}
    </div>`;
}

/* ---------- onboarding flow (first launch) ---------- */
// the 4-segment progress bar shown in the gradient header on steps 1–4
function obSegments() {
  return `<div class="ob2-seg">${[1, 2, 3, 4].map((i) => `<i class="${i <= obStep ? "on" : ""}"></i>`).join("")}</div>`;
}

function obHeader(kicker, title, sub) {
  return `
    <div class="ob2-hd">
      <div class="ob2-hd-top">
        <button class="ob2-back" data-act="ob-back" aria-label="Back">‹</button>
        ${obSegments()}
      </div>
      <div class="ob2-kicker">${kicker}</div>
      <h1>${title}</h1>
      ${sub ? `<p>${sub}</p>` : ""}
    </div>`;
}

// a tappable option card; `field` is the pending key it sets
function obChip(field, id, title, sub, sel, badge) {
  return `
    <button class="ob2-chip${sel ? " sel" : ""}" data-act="ob-pick" data-field="${field}" data-value="${id}">
      <div class="ob2-chip-row">
        <div>
          <div class="t">${title}</div>
          <div class="s">${sub}</div>
        </div>
        ${badge ? '<span class="ob2-best">BEST</span>' : ""}
      </div>
    </button>`;
}

// a draggable measurement ruler; `conv` drives the unit and which pending
// field it writes (height stored as cm, weight as kg regardless of display)
function obRuler(conv, unit, min, max) {
  return `
    <div class="ob2-ruler" data-conv="${conv}" data-unit="${unit}" data-min="${min}" data-max="${max}" data-step="1">
      <span class="ob2-ruler-val"></span>
      <div class="ob2-ruler-win">
        <div class="ob2-ruler-strip"></div>
        <div class="ob2-ruler-center"></div>
      </div>
    </div>`;
}

// whether Continue is allowed for the current step
function obCanAdvance() {
  switch (obStep) {
    case 0:
      return (pending.name || "").trim().length > 0;
    case 1:
      return !!pending.gender;
    case 2:
      return !!pending.goalChoice;
    case 3:
      return pending.freq != null;
    case 4:
      return !!pending.level;
    default:
      return true;
  }
}

function obBody() {
  if (obStep === 1) {
    const { hUnit, wUnit } = pending;
    return `
      <div class="field-label" style="margin-top:0">Sex</div>
      <div class="ob2-sex">
        ${OB_GENDERS.map(([v, l]) => `<button class="${pending.gender === v ? "sel" : ""}" data-act="ob-pick" data-field="gender" data-value="${v}">${l}</button>`).join("")}
      </div>
      <div class="ob2-rowhead" style="margin-top:22px">
        <span>Height</span>
        <div class="ob2-units">${["cm", "ft"].map((u) => `<button class="${hUnit === u ? "sel" : ""}" data-act="ob-unit" data-which="h" data-value="${u}">${u}</button>`).join("")}</div>
      </div>
      ${hUnit === "cm" ? obRuler("cm", "cm", 122, 224) : obRuler("in", "in", 48, 88)}
      <div class="ob2-rowhead" style="margin-top:18px">
        <span>Weight</span>
        <div class="ob2-units">${["kg", "lbs"].map((u) => `<button class="${wUnit === u ? "sel" : ""}" data-act="ob-unit" data-which="w" data-value="${u}">${u}</button>`).join("")}</div>
      </div>
      ${wUnit === "kg" ? obRuler("kg", "kg", 30, 250) : obRuler("lbs", "lbs", 66, 551)}`;
  }
  if (obStep === 2)
    return OB_GOALS.map(([id, t, s]) =>
      obChip("goalChoice", id, t, s, pending.goalChoice === id, false),
    ).join("");
  if (obStep === 3)
    return OB_FREQS.map(([id, t, s, best]) =>
      obChip("freq", id, t, s, pending.freq === id, best),
    ).join("");
  return OB_LEVELS.map(([id, t, s]) => obChip("level", id, t, s, pending.level === id, false)).join(
    "",
  );
}

export function renderOnboarding() {
  stopTimer();

  // welcome — full-gradient screen that captures the name
  if (obStep === 0) {
    $app.innerHTML = `
      <div class="ob2 grad">
        <div class="ob2-fill">
          <div class="ob2-word">Leg Day</div>
          <h1 class="ob2-welcome-h">Let's build your plan</h1>
          <p class="ob2-welcome-p">Answer a few quick questions — your first workout is ready in under a minute.</p>
          <div class="ob2-kicker" style="margin-bottom:8px">What should we call you?</div>
          <input class="ob2-name" id="ob-name" placeholder="Your name" autocomplete="given-name" value="${esc(pending.name || "")}">
        </div>
        <button class="ob2-white" data-act="ob-next"${obCanAdvance() ? "" : " disabled"}>Get started</button>
      </div>`;
    obWireName();
    return;
  }

  // plan ready — full-gradient screen previewing the real generated program
  if (obStep === 5) {
    const p = prog();
    const days = dayKeys(state.profile)
      .map((k) => p[k])
      .filter(Boolean);
    const focusTxt =
      state.profile.focus && state.profile.focus !== "balanced"
        ? state.profile.focus + " focus"
        : "balanced";
    $app.innerHTML = `
      <div class="ob2 grad">
        <div class="ob2-fill">
          <div class="ob2-check">✓</div>
          <h1 class="ob2-welcome-h">Your plan is ready${state.profile.name ? ", " + esc(state.profile.name) : ""}</h1>
          <p class="ob2-welcome-p">${state.profile.days}×/week · 8-week block · ${focusTxt}</p>
          <div class="ob2-done-list">
            ${days
              .map(
                (d, i) => `
              <div class="ob2-done-day">
                <div class="ob2-done-name">Day ${i + 1} · ${esc(d.focus)}</div>
                <div class="ob2-done-ex">${d.exercises
                  .slice(0, 3)
                  .map((e) => esc(e.name))
                  .join(" · ")}${d.exercises.length > 3 ? " · etc" : ""}</div>
              </div>`,
              )
              .join("")}
          </div>
        </div>
        <button class="ob2-white" data-act="ob-finish">Start training</button>
      </div>`;
    return;
  }

  // question screens 1–4
  const HEADS = {
    1: ["About you", "The basics", "This tailors your starting weights."],
    2: ["Your goal", "What are you here for?", ""],
    3: ["Your schedule", "How often will you train?", ""],
    4: ["Experience", "How much have you lifted?", ""],
  };
  const [kicker, title, sub] = HEADS[obStep];
  $app.innerHTML = `
    <div class="ob2">
      ${obHeader(kicker, title, sub)}
      <div class="ob2-body">${obBody()}</div>
      <div class="ob2-foot">
        <button class="ob2-go" data-act="ob-next"${obCanAdvance() ? "" : " disabled"}>${obStep === 4 ? "Build my plan" : "Continue"}</button>
      </div>
    </div>`;
  if (obStep === 1) obWireRulers();
}

// live-enable the welcome button as the name is typed (no full re-render, so
// the field keeps focus)
function obWireName() {
  const input = document.getElementById("ob-name");
  if (!input) return;
  input.addEventListener("input", () => {
    pending.name = input.value;
    const btn = $app.querySelector(".ob2-white");
    if (btn) btn.disabled = !obCanAdvance();
  });
}

const ftIn = (inch) => `${Math.floor(inch / 12)}'${inch % 12}"`;

// wire each ruler on step 1: build the tick strip, centre it, handle drag
function obWireRulers() {
  const PX = 11;
  $app.querySelectorAll(".ob2-ruler").forEach((r) => {
    const min = +r.dataset.min,
      max = +r.dataset.max,
      step = +r.dataset.step,
      conv = r.dataset.conv,
      unit = r.dataset.unit;
    const strip = r.querySelector(".ob2-ruler-strip");
    const win = r.querySelector(".ob2-ruler-win");
    const valEl = r.querySelector(".ob2-ruler-val");

    // display value derived from the cm/kg stored in pending
    const disp = () =>
      conv === "in"
        ? Math.round(pending.height / 2.54)
        : conv === "cm"
          ? pending.height
          : conv === "lbs"
            ? Math.round(pending.weight * 2.20462)
            : pending.weight;
    // store a dragged display value back as cm / kg
    const store = (v) => {
      if (conv === "cm") pending.height = v;
      else if (conv === "in") pending.height = Math.round(v * 2.54);
      else if (conv === "kg") pending.weight = v;
      else pending.weight = Math.round(v / 2.20462);
    };

    let ticks = "";
    for (let v = min; v <= max; v += step) {
      const major = v % 10 === 0,
        mid = v % 5 === 0;
      const h = major ? 38 : mid ? 26 : 16;
      ticks += `<i class="${major ? "maj" : mid ? "mid" : ""}" style="left:${(v - min) * PX}px;height:${h}px"></i>`;
      if (major) ticks += `<b style="left:${(v - min) * PX}px">${conv === "in" ? ftIn(v) : v}</b>`;
    }
    strip.innerHTML = ticks;

    const paint = () => {
      const v = disp();
      strip.style.transform = `translateX(${win.clientWidth / 2 - (v - min) * PX}px)`;
      valEl.innerHTML = conv === "in" ? ftIn(v) : `${v}<span>${unit}</span>`;
    };
    paint();

    let drag = null;
    win.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, v: disp() };
      try {
        win.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; dragging still works without it.
      }
    });
    win.addEventListener("pointermove", (e) => {
      if (!drag) return;
      let nv = Math.round((drag.v - (e.clientX - drag.x) / PX) / step) * step;
      nv = Math.max(min, Math.min(max, nv));
      store(nv);
      paint();
    });
    const end = (e) => {
      drag = null;
      try {
        win.releasePointerCapture(e.pointerId);
      } catch {
        // The pointer may already have been released.
      }
    };
    win.addEventListener("pointerup", end);
    win.addEventListener("pointercancel", end);
  });
}

// pull the welcome name into pending before navigating
function obCapture() {
  const n = document.getElementById("ob-name");
  if (n) pending.name = n.value;
}

export function obPick(field, value) {
  pending[field] = field === "freq" ? parseInt(value, 10) : value;
  renderOnboarding();
}

export function obUnit(which, value) {
  if (which === "h") pending.hUnit = value;
  else pending.wUnit = value;
  renderOnboarding();
}

export function obNext() {
  obCapture();
  if (!obCanAdvance()) return;
  if (obStep === 4) {
    // build the plan, then show the preview
    saveProfile();
    obStep = 5;
    renderOnboarding();
    return;
  }
  obStep++;
  renderOnboarding();
}

export function obBack() {
  obCapture();
  if (obStep > 0 && obStep < 5) {
    obStep--;
    renderOnboarding();
  }
}

export function obFinish() {
  obStep = 0;
  renderHome();
}

export function pickOption(field, value) {
  const val = field === "days" ? parseInt(value, 10) : value;
  if (state.profile) {
    if (state.profile[field] === val) return;
    if (state.active && !confirm("Changing this resets your unfinished workout. Continue?")) {
      renderProfile();
      return;
    }
    state.active = null; // the program prescription may differ
    state.profile[field] = val;
    saveState();
    renderProfile();
  } else {
    pending[field] = val;
    document.querySelectorAll(`.gender-card[data-field="${field}"]`).forEach((b) => {
      b.classList.toggle("selected", b.dataset.value === value);
    });
    const hintId = {
      style: "split-hint",
      spec: "spec-hint",
      goal: "goal-hint",
      level: "level-hint",
      focus: "focus-hint",
    }[field];
    const hintText = {
      style: SPLIT_HINTS,
      spec: SPEC_HINTS,
      goal: GOAL_HINTS,
      level: LEVEL_HINTS,
      focus: FOCUS_HINTS,
    }[field];
    if (hintId) {
      const hint = document.getElementById(hintId);
      if (hint) hint.textContent = hintText[value] || "";
    }
  }
}

export function toggleMuscle(muscle) {
  if (state.profile) {
    if (state.active && !confirm("Changing this resets your unfinished workout. Continue?")) {
      renderProfile();
      return;
    }
    const arr = state.profile.muscleFocus || (state.profile.muscleFocus = []);
    const i = arr.indexOf(muscle);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(muscle);
    state.active = null; // the program prescription changes
    saveState();
    renderProfile();
  } else {
    const arr = pending.muscleFocus;
    const i = arr.indexOf(muscle);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(muscle);
    const btn = document.querySelector(`.m-chip[data-muscle="${muscle}"]`);
    if (btn) btn.classList.toggle("sel");
  }
}

// finalise the onboarding answers into a real profile. The flow only collects
// name, sex, height/weight, goal, frequency and experience; the rest take sane
// defaults the user can still change on the Profile screen.
function saveProfile() {
  const kg = pending.weight || 0;
  state.profile = {
    gender: pending.gender,
    height: pending.height || 165,
    name: (pending.name || "").trim(),
    goal: "hypertrophy",
    level: pending.level,
    equipment: "mixed",
    style: styleForDays(pending.freq),
    days: pending.freq,
    focus: GOAL_TO_FOCUS[pending.goalChoice] || "balanced",
    spec: "off",
    muscleFocus: [],
  };
  if (kg > 0) state.weights.push({ date: todayISO(), kg });
  saveState();
}

/* ---------- profile screen ---------- */
export function renderProfile() {
  stopTimer();
  const p = state.profile;
  const lastKg = state.weights.length ? state.weights[state.weights.length - 1].kg : 60;

  // logging input is always visible; the trend/chart/history collapse
  let weightCard = `
    <div class="card">
      <div class="field-label">Today’s weight</div>
      ${numberField("weigh-input", "Weight", lastKg, 0.5, "kg")}
      <button class="btn-secondary log-weight-btn" data-act="log-weight">Log today’s weight</button>`;

  if (state.weights.length && p.height > 0) {
    const b = bmiInfo(lastKg, p.height);
    weightCard += `
      <div class="bmi-row">
        <span class="bmi-val">BMI ${b.value}</span>
        <span class="bmi-cat ${b.cls}">${b.category}</span>
      </div>`;
  }

  if (state.weights.length >= 2) {
    const first = state.weights[0].kg;
    const diff = Math.round((lastKg - first) * 10) / 10;
    const sign = diff > 0 ? "+" : "";
    weightCard += `
      <button class="weight-toggle" data-act="toggle-weight">
        <span>${sign}${diff} kg since you started</span>
        <span class="chev">${weightOpen ? "▾" : "▸"}</span>
      </button>`;
    if (weightOpen) {
      weightCard += weightChart(state.weights);
      weightCard += '<div class="weight-list">';
      for (let i = state.weights.length - 1; i >= 0 && i > state.weights.length - 13; i--) {
        const w = state.weights[i];
        const prev = i > 0 ? state.weights[i - 1].kg : null;
        const d =
          prev === null ? "" : (w.kg - prev > 0 ? "+" : "") + Math.round((w.kg - prev) * 10) / 10;
        weightCard += `<div class="weight-line"><span>${fmtDate(w.date)}</span><b>${w.kg} kg</b><span class="w-diff">${d}</span></div>`;
      }
      weightCard += "</div>";
    }
  } else if (state.weights.length === 1) {
    weightCard += `<div class="weight-trend">First entry logged — weigh in again to see your trend.</div>`;
  }
  weightCard += "</div>";

  $app.innerHTML = `
    <div class="screen-header">
      <button class="back-btn" data-act="home" aria-label="Back">‹</button>
      <h1>Profile</h1>
    </div>
    <div class="card">
      <div class="field-label">Your name</div>
      <input class="text-input" type="text" id="pf-name" placeholder="First name" autocomplete="given-name" value="${esc(p.name || "")}">
      ${profileFields(p)}
      <div class="field-label">Height</div>
      ${numberField("pf-height", "Height", p.height, 1, "cm")}
    </div>
    <div class="section-label">Weight tracking</div>
    ${weightCard}
    <div class="section-label">Measurements</div>
    ${measureCard()}
    <div class="section-label">Data</div>
    <div class="card">
      <div class="data-actions">
        <button class="btn-secondary" data-act="export">Export backup</button>
        <button class="btn-secondary" data-act="import">Import</button>
      </div>
      <button class="btn-secondary clear-data-btn" data-act="clear-data">Clear all data</button>
    </div>`;
}

/* ---------- clear data ---------- */
export function confirmClearData() {
  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.innerHTML = `
    <div class="sheet">
      <h2>Clear all data?</h2>
      <p>This deletes your profile, every workout, and your weight log from this phone. It cannot be undone.</p>
      <button class="feel-btn" data-act="export">⬇️ Export a backup first</button>
      <button class="feel-btn danger" data-clear="yes">🗑 Delete everything</button>
      <button class="sheet-cancel" data-clear="">Cancel</button>
    </div>`;
  sheet.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clear]");
    if (btn) {
      if (btn.dataset.clear === "yes") {
        if (!confirm("Really delete everything? Last chance.")) return;
        sheet.remove();
        clearAllData();
        return;
      }
      sheet.remove();
    } else if (e.target === sheet) sheet.remove();
    // the export button bubbles up to the global handler; sheet stays open
  });
  document.body.appendChild(sheet);
}

function clearAllData() {
  replaceState({
    blockStart: null,
    sessions: [],
    active: null,
    profile: null,
    weights: [],
    prefs: { plates: {} },
    volAdj: {},
    measures: [],
    custom: {},
    weekSkips: {},
  });
  Object.assign(pending, {
    gender: null,
    name: "",
    goal: "hypertrophy",
    level: "beginner",
    equipment: "mixed",
    style: "full",
    days: 3,
    focus: "balanced",
    spec: "off",
    muscleFocus: [],
    height: 165,
    weight: 60,
    goalChoice: "",
    freq: null,
    hUnit: "cm",
    wUnit: "kg",
  });
  obStep = 0;
  renderOnboarding();
}

export function logWeight() {
  const kg = parseNum(document.getElementById("weigh-input").value);
  if (isNaN(kg) || kg <= 0) return;
  const today = todayISO();
  const last = state.weights[state.weights.length - 1];
  if (last && last.date === today)
    last.kg = kg; // re-logging today overwrites
  else state.weights.push({ date: today, kg });
  saveState();
  toast(`Weight logged · ${kg} kg`);
  renderProfile();
}

// generic +/- stepper for standalone number inputs (profile & onboarding)
export function stepNumber(targetId, step) {
  const input = document.getElementById(targetId);
  if (!input) return;
  const v = Math.max(0, Math.round(((parseNum(input.value) || 0) + step) * 10) / 10);
  input.value = v;
  applyProfileField(targetId, v);
}

export function applyProfileField(targetId, value) {
  if (targetId === "pf-height" && state.profile) {
    state.profile.height = value;
    saveState();
  }
}

// BMI from weight (kg) and height (cm), with WHO category
function bmiInfo(kg, heightCm) {
  const m = heightCm / 100;
  const bmi = kg / (m * m);
  let category, cls;
  if (bmi < 18.5) {
    category = "underweight";
    cls = "low";
  } else if (bmi < 25) {
    category = "healthy";
    cls = "ok";
  } else if (bmi < 30) {
    category = "overweight";
    cls = "high";
  } else {
    category = "obese";
    cls = "high";
  }
  return { value: bmi.toFixed(1), category, cls };
}

// proper line chart for a series of { date, v } points (min/max on the
// y-axis, first/last date on x, soft area fill). scales to container width.
function metricChart(points) {
  const W = 300,
    H = 150,
    padL = 30,
    padR = 8,
    padT = 10,
    padB = 20;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, points.length - 1);
  const y = (v) => padT + ((max - v) * (H - padT - padB)) / span;

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${padL},${H - padB} ${line} ${x(points.length - 1).toFixed(1)},${H - padB}`;
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" fill="var(--accent)"/>`,
    )
    .join("");

  const yl = (
    v,
  ) => `<text x="0" y="${(y(v) + 3).toFixed(1)}" class="ax-y">${Math.round(v * 10) / 10}</text>
    <line x1="${padL - 3}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" class="ax-grid"/>`;
  const mid = Math.round(((min + max) / 2) * 10) / 10;

  return `<svg class="weight-chart" viewBox="0 0 ${W} ${H}">
    ${yl(max)}${min !== max ? yl(mid) + yl(min) : ""}
    <polygon points="${area}" fill="var(--accent)" opacity="0.12"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    <text x="${padL}" y="${H - 5}" class="ax-x" text-anchor="start">${fmtDate(points[0].date)}</text>
    <text x="${W - padR}" y="${H - 5}" class="ax-x" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>
  </svg>`;
}
const weightChart = (entries) => metricChart(entries.map((e) => ({ date: e.date, v: e.kg })));
