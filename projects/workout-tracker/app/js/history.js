'use strict';

import { $app } from './dom.js';
import { FEEL_LABELS } from './program.js';
import { state, prog, fmtDate, fmtDateLong, fmtWeight, esc, dayNum } from './state.js';
import { stopTimer } from './timer.js';
import { bestFor, loggedExerciseNames, exerciseSessions, weeklyVolume, LANDMARKS, e1rm, repPRs } from './stats.js';

let expandedSession = null;
let detailExercise = null;

export function toggleSession(i) {
  expandedSession = expandedSession === i ? null : i;
  renderHistory();
}

export function openExerciseDetail(name) {
  detailExercise = name;
  renderExerciseDetail();
}

export function resetHistory() {
  expandedSession = null;
  detailExercise = null;
}

/* ---------- weekly volume dashboard ---------- */
function volumeCard() {
  const vol = weeklyVolume();
  const groups = Object.keys(vol).filter(g => g !== 'Other').sort((a, b) => vol[b] - vol[a]);
  if (!groups.length) return '';
  let html = '<div class="card vol-card"><h2>This week · sets per muscle</h2>';
  for (const g of groups) {
    const sets = vol[g];
    const [mev, mav] = LANDMARKS[g] || [0, 20];
    const pct = Math.min(100, sets / mav * 100);
    const cls = sets < mev ? 'low' : sets > mav ? 'high' : 'ok';
    html += `
      <div class="vol-row">
        <span class="vol-name">${g}</span>
        <div class="vol-bar"><i class="${cls}" style="width:${pct}%"></i></div>
        <span class="vol-n ${cls}">${sets}</span>
      </div>`;
  }
  html += '<p class="bests-note">Green = inside the productive range for the week. Low = below minimum, high = near your recoverable cap.</p>';
  html += '</div>';
  return html;
}

/* ---------- simple e1RM line chart ---------- */
function e1rmChart(points) {
  if (points.length < 2) return '';
  const W = 300, H = 130, padL = 30, padR = 8, padT = 10, padB = 20;
  const vals = points.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const x = i => padL + i * (W - padL - padR) / (points.length - 1);
  const y = v => padT + (max - v) * (H - padT - padB) / span;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" fill="var(--accent)"/>`).join('');
  return `<svg class="weight-chart" viewBox="0 0 ${W} ${H}">
    <text x="0" y="${(y(max) + 3).toFixed(1)}" class="ax-y">${Math.round(max)}</text>
    <text x="0" y="${(y(min) + 3).toFixed(1)}" class="ax-y">${Math.round(min)}</text>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    <text x="${padL}" y="${H - 5}" class="ax-x" text-anchor="start">${fmtDate(points[0].date)}</text>
    <text x="${W - padR}" y="${H - 5}" class="ax-x" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>
  </svg>`;
}

/* ---------- per-exercise detail screen ---------- */
export function renderExerciseDetail() {
  stopTimer();
  const name = detailExercise;
  const sessions = exerciseSessions(name);
  const best = bestFor(name);
  const prs = repPRs(name);
  const points = sessions.map(s => ({ date: s.date, v: s.topE1rm }));

  let html = `
    <div class="screen-header">
      <button class="back-btn" data-act="history" aria-label="Back">‹</button>
      <h1>${esc(name)}</h1>
    </div>
    <div class="card bests-card">
      <div class="best-line"><span>Best set</span><b>${fmtWeight(best.weight)} × ${best.reps}</b></div>
      <div class="best-line"><span>Est. 1RM</span><b>${Math.round(best.e1rm)} kg</b></div>
      ${points.length >= 2 ? '<div class="field-label" style="margin-top:12px">Estimated 1RM over time</div>' + e1rmChart(points) : ''}
    </div>`;

  if (prs.length) {
    html += '<div class="card bests-card"><h2>PRs by weight</h2>';
    for (const p of prs) {
      html += `<div class="best-line">
        <span>${fmtWeight(p.weight)}</span>
        <b>${p.reps} reps<span class="e1rm">${fmtDate(p.date)}</span></b>
      </div>`;
    }
    html += '<p class="bests-note">Most reps you\'ve ever done at each weight.</p></div>';
  }

  html += '<div class="section-label">Every session</div>';

  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const detail = s.sets.map(st => `${st.weight % 1 === 0 ? st.weight : st.weight.toFixed(1)}×${st.reps}${st.partial ? '+' + st.partial + 'p' : ''}`).join('  ');
    html += `<div class="card" style="padding:12px 14px">
      <div class="s-sub">${fmtDateLong(s.date)}</div>
      <div class="ex-detail-sets">${detail} <span class="e1rm">1RM ~${Math.round(s.topE1rm)} kg</span></div>
    </div>`;
  }
  $app.innerHTML = html;
}

/* ---------- history screen ---------- */
export function renderHistory() {
  stopTimer();
  let html = `
    <div class="screen-header">
      <button class="back-btn" data-act="home" aria-label="Back">‹</button>
      <h1>History</h1>
    </div>`;

  html += volumeCard();

  const names = loggedExerciseNames();
  if (names.length) {
    html += '<div class="card bests-card"><h2>Bests · tap for progress</h2>';
    for (const name of names) {
      const b = bestFor(name);
      html += `<button class="best-line tappable" data-act="ex-detail" data-name="${esc(name)}">
        <span>${esc(name)}</span>
        <b>${fmtWeight(b.weight)} × ${b.reps}<span class="e1rm">1RM ~${Math.round(b.e1rm)} kg</span></b>
      </button>`;
    }
    html += '</div>';
  }

  if (!state.sessions.length) {
    html += '<div class="empty-note">No workouts yet. Your finished sessions will show up here.</div>';
  } else {
    html += '<div class="section-label">Sessions</div>';
    for (let i = state.sessions.length - 1; i >= 0; i--) {
      const s = state.sessions[i];
      const open = expandedSession === i;
      const d = prog()[s.day] || { name: 'Day ' + dayNum(s.day), focus: '' };
      html += `
        <div class="card" style="padding:0">
          <button class="session-item" data-act="toggle-session" data-i="${i}">
            <span class="day-letter">${dayNum(s.day)}</span>
            <span class="session-info">
              <span class="s-title">${d.name} · ${d.focus}</span>
              <span class="s-sub">${fmtDateLong(s.date)} · ${s.block > 1 ? 'block ' + s.block + ', ' : ''}week ${s.week}${s.feel ? ' · ' + FEEL_LABELS[s.feel] : ''}</span>
            </span>
            <span class="day-arrow">${open ? '⌄' : '›'}</span>
          </button>`;
      if (open) {
        html += '<div class="session-detail" style="padding:0 16px 12px">';
        const fb = s.feedback;
        if (fb && Object.keys(fb).length) {
          const bits = [];
          if (fb.pump) bits.push('Pump: ' + fb.pump);
          if (fb.soreness) bits.push('Soreness: ' + fb.soreness);
          if (fb.joints) bits.push('Joints: ' + fb.joints);
          if (bits.length) html += `<div class="fb-summary">${esc(bits.join(' · '))}</div>`;
        }
        for (const e of s.exercises) {
          const done = e.sets.filter(st => st.done);
          const detail = done.length
            ? done.map(st => `${st.weight % 1 === 0 ? st.weight : st.weight.toFixed(1)}×${st.reps}${st.partial ? '+' + st.partial + 'p' : ''}`).join('  ')
            : 'skipped';
          const warmupDetail = (e.warmupSets && e.warmupSets.length)
            ? e.warmupSets.map(st => `${st.weight % 1 === 0 ? st.weight : st.weight.toFixed(1)}×${st.reps}`).join('  ')
            : null;
          html += `<div class="ex-line">
            <b>${esc(e.name)}</b>
            ${warmupDetail ? `<span class="ex-line-warmup">↑ Warm-up: ${warmupDetail}</span>` : ''}
            <span>${detail} ${done.length ? 'kg×reps' : ''}</span>
          </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
  }

  $app.innerHTML = html;
}
