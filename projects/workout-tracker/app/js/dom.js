'use strict';

export const $app = document.getElementById('app');
export const $timer = document.getElementById('timer');
export const $importFile = document.getElementById('import-file');

// transient confirmation toast (with a light haptic) for logging actions
let toastTimer;
export function toast(msg, kind = 'ok') {
  let t = document.getElementById('app-toast');
  if (!t) { t = document.createElement('div'); t.id = 'app-toast'; document.body.appendChild(t); }
  t.className = 'app-toast ' + kind;
  t.textContent = msg;
  void t.offsetWidth;       // restart the transition if it's already showing
  t.classList.add('in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('in'), 1500);
  if (navigator.vibrate) navigator.vibrate(15);
}
