'use strict';

import { $app } from './dom.js';
import { state, prog, currentWeek, weekInBlock, blockNumber, rirLabel, lastSession, fmtDate, fmtDateLong, fmtWeight, todayISO, esc, weekSkips, weekMonIso, deleteSessionsOn, moveSessionsTo } from './state.js';
import { dayKeys } from './program.js';
import { weekCalendar, weekStreak, trainedDates, weeklySchedule } from './stats.js';
import { stopTimer } from './timer.js';
import { resetHowto } from './workout.js';

let calOffset = 0; // months back from the current month
let movingDate = null; // ISO of a logged day being relocated to a new date

export function openCalendar(delta) {
  calOffset = delta === undefined ? 0 : Math.max(0, calOffset + delta);
  if (delta === undefined) movingDate = null; // entering fresh from home cancels any move
  renderCalendar();
}

function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderCalendar() {
  stopTimer();
  const dates = trainedDates();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() - calOffset);
  const year = base.getFullYear(), month = base.getMonth();
  const monthName = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoOf(new Date());

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-day empty"></div>';
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(new Date(year, month, d));
    const on = dates.has(iso);
    if (on) count++;
    const today = iso === todayIso ? ' today' : '';
    if (movingDate) {
      // picking the real day: any past/today cell is a drop target; the source is marked
      const src = iso === movingDate ? ' moving' : '';
      cells += iso > todayIso
        ? `<div class="cal-day${on ? ' on' : ''}${today} future">${d}</div>`
        : `<button class="cal-day sel${on ? ' on' : ''}${today}${src}" data-act="cal-move-to" data-date="${iso}">${d}</button>`;
    } else {
      // logged days are tappable to move or remove that workout
      cells += on
        ? `<button class="cal-day on${today}" data-act="cal-day" data-date="${iso}">${d}</button>`
        : `<div class="cal-day${today}">${d}</div>`;
    }
  }

  $app.innerHTML = `
    <div class="screen-header">
      <button class="back-btn" data-act="home" aria-label="Back">‹</button>
      <h1>Calendar</h1>
    </div>
    <div class="card cal-card">
      <div class="cal-nav">
        <button class="cal-arrow" data-act="cal-prev" aria-label="Previous month">‹</button>
        <span class="cal-month">${monthName}</span>
        <button class="cal-arrow${calOffset === 0 ? ' disabled' : ''}" data-act="cal-next" aria-label="Next month">›</button>
      </div>
      <div class="cal-weekdays">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<span>${w}</span>`).join('')}</div>
      ${movingDate ? `
      <div class="cal-move-banner">
        <span>Tap the day you actually trained</span>
        <button class="cal-move-cancel" data-act="cal-move-cancel">Cancel</button>
      </div>` : ''}
      <div class="cal-grid">${cells}</div>
      <div class="cal-count">${count} workout${count === 1 ? '' : 's'} this month</div>
      ${!movingDate && count ? '<div class="cal-hint">Tap a workout day to move or remove it</div>' : ''}
    </div>`;
}

function dayNames(dateIso) {
  return state.sessions.filter(s => s.date === dateIso)
    .map(s => (prog()[s.day] || {}).name || ('Day ' + s.day)).join(', ');
}

// tap a logged day → choose to move it to the right date or remove it
export function openDayActions(dateIso) {
  if (!dayNames(dateIso)) return;
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `
    <div class="sheet">
      <h2>${esc(dayNames(dateIso))}</h2>
      <p>Logged on ${fmtDateLong(dateIso)}</p>
      <button class="feel-btn" data-day-act="move">Move to the right day</button>
      <button class="feel-btn cal-remove" data-day-act="remove">Remove workout</button>
      <button class="sheet-cancel" data-day-act="">Never mind</button>
    </div>`;
  sheet.addEventListener('click', e => {
    const btn = e.target.closest('[data-day-act]');
    if (btn) {
      const act = btn.dataset.dayAct;
      sheet.remove();
      if (act === 'move') { movingDate = dateIso; renderCalendar(); }
      else if (act === 'remove') removeCalendarDay(dateIso);
    } else if (e.target === sheet) sheet.remove();
  });
  document.body.appendChild(sheet);
}

// relocate the workout being moved onto the tapped day
export function moveWorkoutTo(targetIso) {
  if (movingDate) moveSessionsTo(movingDate, targetIso);
  movingDate = null;
  renderCalendar();
}

export function cancelMove() {
  movingDate = null;
  renderCalendar();
}

// remove a logged workout from a calendar date (e.g. a day you didn't actually train)
function removeCalendarDay(dateIso) {
  const names = dayNames(dateIso);
  if (!names) return;
  if (!confirm(`Remove ${names} on ${fmtDate(dateIso)}? This deletes the session from your history.`)) return;
  deleteSessionsOn(dateIso);
  renderCalendar();
}

// done = trained this calendar week (Mon→Sun); resets when the new week starts
function doneThisWeek(day) {
  const last = lastSession(day);
  if (!last) return false;
  return last.date >= weekMonIso();
}

// Up next = the workout to start now: resume an active one; else today's
// scheduled workout (if not already done today); else least-recently trained.
function pickNextDay() {
  if (state.active) return state.active.day;
  const keys = dayKeys(state.profile);
  // today's scheduled day per the recommended weekly schedule
  const wd = (new Date(todayISO()).getDay() + 6) % 7; // Monday-first weekday
  const di = weeklySchedule(state.profile)[wd];
  if (di != null && keys[di]) {
    const last = lastSession(keys[di]);
    if (!last || last.date !== todayISO()) return keys[di];
  }
  let best = keys[0], bestTime = Infinity;
  for (const day of keys) {
    const last = lastSession(day);
    const t = last ? new Date(last.date).getTime() : -Infinity; // never done sorts first
    if (t < bestTime) { bestTime = t; best = day; }
  }
  return best;
}

function dayStats(day) {
  const exs = prog()[day].exercises;
  const sets = exs.reduce((n, e) => n + e.sets, 0);
  const mins = Math.max(20, Math.round(sets * 3.5 / 5) * 5);
  return { count: exs.length, mins };
}

export function renderHome() {
  stopTimer();
  resetHowto();
  const week = currentWeek();
  const wk = weekInBlock(week);
  const bn = blockNumber(week);
  const p = prog();

  const hour = new Date().getHours();
  const timeGreeting = (hour >= 5 && hour < 12) ? 'Good morning'
    : (hour >= 12 && hour < 18) ? 'Good afternoon'
    : 'Good evening'; // covers 18:00–04:59
  const name = state.profile && state.profile.name;
  const greeting = name ? 'Welcome back, loser' : timeGreeting;

  let html = `
    <div class="home-top">
      <div class="kicker">${bn > 1 ? 'Block ' + bn + ' · ' : ''}Week ${wk} · ${rirLabel(wk)}${wk === 8 ? ' · light & easy' : ''}</div>
      <h1>${greeting}</h1>
    </div>`;

  // ---- up next hero ----
  const nd = pickNextDay();
  const d = p[nd];
  const stats = dayStats(nd);
  const active = state.active && state.active.day === nd;
  const wdNow = (new Date(todayISO()).getDay() + 6) % 7;
  const schedToday = weeklySchedule(state.profile)[wdNow];
  const isTodayPlanned = !active && schedToday != null && dayKeys(state.profile)[schedToday] === nd;
  html += `
    <button class="hero-card" data-act="start" data-day="${nd}">
      <div class="hero-label">${active ? 'In progress' : isTodayPlanned ? "Today's workout" : 'Up next'}</div>
      <div class="hero-title">${d.name} · ${d.focus}</div>
      <div class="hero-meta">${stats.count} exercises · ≈ ${stats.mins} min</div>
      <div class="hero-cta">${active ? 'Continue' : 'Start'} <span>›</span></div>
    </button>`;

  // ---- streak + weekly schedule ----
  const streak = weekStreak();
  const cal = weekCalendar(state.profile);
  const sched = weeklySchedule(state.profile);
  // program days actually trained somewhere this week → their planned slot is
  // considered fulfilled even if it landed on a different weekday (auto-shift)
  const fulfilled = new Set(cal.map(c => c.trainedDay).filter(d => d != null));
  const skips = weekSkips();
  // the whole card opens the calendar; the inner skip buttons are matched first
  // by the event router (closest('[data-act]')) so tapping a day still toggles it
  html += `
    <div class="card week-card" data-act="calendar">
      <div class="week-head">
        <span>This week ›</span>
        ${streak ? `<span class="streak">🔥 ${streak} week${streak > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="week-cal">
        ${cal.map((c, i) => {
          const di = sched[i];               // scheduled day index this weekday, or null
          const planned = di != null;
          const moved = planned && !c.trained && fulfilled.has(di);   // done on another day this week
          const skipped = planned && !c.trained && !moved && skips.has(i);
          const showPlanned = planned && !c.trained && !moved && !skipped;
          const canSkip = planned && !c.trained && !moved;            // tap to clear or restore
          const mark = c.trained ? '✓' : showPlanned ? (di + 1) : skipped ? '–' : '';
          const cls = (c.trained ? 'on' : showPlanned ? 'planned' : skipped ? 'skipped' : 'rest') + (c.today ? ' today' : '');
          const tag = canSkip ? 'button' : 'div';
          const attr = canSkip ? ` data-act="toggle-skip" data-wd="${i}"` : '';
          return `<${tag} class="cal-cell ${cls}"${attr}><span>${c.label}</span><i>${mark}</i></${tag}>`;
        }).join('')}
      </div>
      <div class="week-legend">Numbers = recommended days · tap one you’re skipping to clear it · workouts move to the day you train</div>
    </div>`;

  // ---- mesocycle strip (slim) ----
  let segs = '';
  for (let i = 1; i <= 8; i++) {
    const cls = i < wk ? 'past' : i === wk ? 'now' : 'future';
    segs += `<div class="seg ${cls}${i === 8 ? ' deload' : ''}"></div>`;
  }
  html += `
    <div class="meso-slim">
      <span class="meso-slim-label">Week ${wk} of 8</span>
      <div class="meso-strip">${segs}</div>
    </div>`;

  // ---- workouts ----
  html += '<div class="section-label">Workouts</div>';
  dayKeys(state.profile).forEach((day, i) => {
    const dd = p[day];
    const last = lastSession(day);
    const inProgress = state.active && state.active.day === day;
    const done = doneThisWeek(day);
    let status, statusCls = '';
    if (inProgress) { status = 'In progress'; statusCls = ' in-progress'; }
    else if (done) { status = '✓ Done · ' + fmtDate(last.date); statusCls = ' done'; }
    else if (last) status = 'Last done ' + fmtDate(last.date);
    else status = 'Not done yet';

    html += `
      <button class="card day-card" data-act="day-detail" data-day="${day}">
        <span class="day-letter${done ? ' done' : ''}">${done ? '✓' : (i + 1)}</span>
        <span class="day-info">
          <span class="day-name">${dd.name} · ${dd.focus}</span>
          <span class="day-muscles">${dd.muscles}</span>
          <span class="day-sub${statusCls}">${status}</span>
        </span>
        <span class="day-arrow">›</span>
      </button>`;
  });

  // ---- footer ----
  html += `
    <div class="home-actions">
      <button class="btn-secondary" data-act="history">History</button>
      <button class="btn-secondary" data-act="profile">Profile</button>
    </div>`;

  $app.innerHTML = html;
}

export function renderDayDetail(day) {
  stopTimer();
  const d = prog()[day];
  const last = lastSession(day);
  const inProgress = state.active && state.active.day === day;

  let html = `
    <div class="screen-header">
      <button class="back-btn" data-act="home" aria-label="Back">‹</button>
      <div>
        <h1>${d.name} · ${d.focus}</h1>
        <div class="ex-meta">${d.muscles}${last ? ' · ' + fmtDateLong(last.date) : ''}</div>
      </div>
    </div>`;

  if (last) {
    last.exercises.forEach(e => {
      const doneSets = e.sets.filter(s => s.done);
      const allDone = doneSets.length > 0 && doneSets.length === e.sets.length;
      html += `<div class="card exercise-card${allDone ? ' ex-done' : ''}">
        <div class="ex-head">
          <span class="ex-name">${esc(e.name)}${allDone ? ' <span class="ex-check">✓</span>' : ''}</span>
        </div>`;
      if (e.warmupSets && e.warmupSets.length) {
        e.warmupSets.forEach(set => {
          html += `<div class="set-row warmup${set.done ? ' done' : ''}">
            <div class="set-top">
              <span class="set-label">Warm-up</span>
              <span class="ghost">${fmtWeight(set.weight)} × ${set.reps} reps</span>
            </div>
          </div>`;
        });
      }
      let wi = 0;
      e.sets.forEach(set => {
        if (!set.done) return;
        wi++;
        html += `<div class="set-row done">
          <div class="set-top">
            <span class="set-label">Set ${wi}</span>
            <span class="ghost">${set.weight % 1 === 0 ? set.weight : set.weight.toFixed(1)} kg × ${set.reps} reps${set.partial ? ' +' + set.partial + 'p' : ''}</span>
            ${set.pr ? '<span class="pr-badge">🏆 PR</span>' : ''}
          </div>
        </div>`;
      });
      if (!doneSets.length) {
        html += `<div class="set-row"><div class="set-top"><span class="ghost">skipped</span></div></div>`;
      }
      html += '</div>';
    });
  } else {
    d.exercises.forEach(slot => {
      html += `<div class="card exercise-card">
        <div class="ex-head">
          <span class="ex-name">${esc(slot.name)}</span>
          <div class="ex-meta">${slot.sets} × ${slot.repMin}–${slot.repMax} reps</div>
        </div>
      </div>`;
    });
  }

  html += `
    <div class="bottom-bar-spacer"></div>
    <div class="bottom-bar">
      <button class="btn-primary" data-act="start" data-day="${day}">${inProgress ? 'Continue workout' : 'Start workout'}</button>
    </div>`;

  $app.innerHTML = html;
}
