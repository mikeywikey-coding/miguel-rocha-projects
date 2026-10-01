"use strict";

import { $timer } from "./dom.js";

let timerInterval = null;
let timerEndsAt = 0;
let timerTotal = 0;

let alarmTimeout = null;
let armed = false;

export function startTimer(seconds) {
  stopTimer();
  timerTotal = seconds;
  timerEndsAt = Date.now() + seconds * 1000;
  armed = true;
  $timer.innerHTML = `
    <div style="flex:1">
      <div class="timer-label">Rest</div>
      <div class="timer-time" id="timer-time"></div>
    </div>
    <button class="timer-skip" data-act="skip-rest">Skip rest</button>
    <div class="timer-bar"><i id="timer-fill" style="width:100%"></i></div>`;
  $timer.hidden = false;
  // Two alarms, whichever gets there first (they share a notification tag, so
  // you only ever see one): the service worker fires even with the app in the
  // background or the screen off, while this page timer handles the foreground
  // case and produces the beep.
  swAlarm({ type: "REST_ALARM", delay: seconds * 1000 });
  alarmTimeout = setTimeout(fireAlarm, seconds * 1000);
  tickTimer();
  timerInterval = setInterval(tickTimer, 250);
}

function tickTimer() {
  const left = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  const el = document.getElementById("timer-time");
  if (el) el.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  const fill = document.getElementById("timer-fill");
  if (fill) fill.style.width = (left / timerTotal) * 100 + "%";
  if (left <= 0) fireAlarm();
}

// Idempotent: whichever of the interval, the timeout, or a foreground-return
// reaches the end first fires the alarm exactly once.
function fireAlarm() {
  if (!armed) return;
  armed = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
    alarmTimeout = null;
  }
  $timer.hidden = true;
  swAlarm({ type: "REST_ALARM_CANCEL" }); // we got here first — drop the backup
  showRestNotification();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  beep();
}

export function stopTimer() {
  armed = false;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
    alarmTimeout = null;
  }
  swAlarm({ type: "REST_ALARM_CANCEL" });
  $timer.hidden = true;
}

// talk to the service worker (no-op before it has taken control)
function swAlarm(msg) {
  try {
    const sw = navigator.serviceWorker;
    if (sw && sw.controller) sw.controller.postMessage(msg);
  } catch (e) {
    /* ignore */
  }
}

// The worker beat us to it: stand down quietly. It has already shown the
// notification, so don't alert twice — just clear the timer bar, and beep only
// if the app is actually on screen to hear it.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "REST_ALARM_FIRED" || !armed) return;
    armed = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (alarmTimeout) {
      clearTimeout(alarmTimeout);
      alarmTimeout = null;
    }
    $timer.hidden = true;
    if (document.visibilityState === "visible") beep();
  });
  // addEventListener alone leaves worker messages queued forever — delivery
  // only starts once onmessage is assigned or this is called
  if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();
}

// If the rest ended while the app was backgrounded (JS timers frozen), fire as
// soon as the user returns to the app.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && armed && Date.now() >= timerEndsAt) {
    fireAlarm();
  }
});

// Lock-screen alarm that doesn't steal Spotify's audio session. A non-silent
// notification makes the OS play its alert sound + vibrate even when locked.
async function showRestNotification() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = {
      body: "Time for your next set",
      tag: "rest-timer",
      renotify: true,
      vibrate: [300, 150, 300],
      silent: false,
    };
    if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("Rest done 💪", opts);
    } else {
      new Notification("Rest done 💪", opts);
    }
  } catch (e) {
    /* ignore */
  }
}

/* ----------------------------------------------------------------------------
 * End-of-rest beep via the Web Audio API. Web Audio mixes/ducks with other
 * apps rather than seizing playback the way an <audio> element does, so the
 * music app (Spotify) keeps playing — it just dips for the beep and continues,
 * with nothing to "resume". On iOS an 'ambient' audio session makes our sound
 * mix instead of interrupt. The locked/background alarm is the notification
 * above, which never touches audio focus either.
 * -------------------------------------------------------------------------- */

let audioCtx = null;

// iOS Audio Session API (Safari 16.4+): 'ambient' makes our audio mix with
// other apps (never interrupts Spotify). No-op elsewhere (e.g. Android Chrome),
// where Web Audio already ducks rather than seizes playback.
function setAudioSession(type) {
  try {
    if ("audioSession" in navigator) navigator.audioSession.type = type;
  } catch (e) {
    /* ignore */
  }
}

// Called from the set-done tap (a user gesture) so iOS unlocks audio and the
// end-of-rest beep can play later. Also requests notification permission for
// the lock-screen alarm. Never takes exclusive audio focus → Spotify plays on.
export function ensureAudio() {
  try {
    setAudioSession("ambient"); // mix with Spotify, never interrupt it
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    /* no audio support */
  }
  try {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch (e) {
    /* ignore */
  }
}

function playBeeps() {
  try {
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      const t = audioCtx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  } catch (e) {
    /* ignore */
  }
}

function beep() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended")
    audioCtx
      .resume()
      .then(playBeeps)
      .catch(() => {});
  else playBeeps();
}
