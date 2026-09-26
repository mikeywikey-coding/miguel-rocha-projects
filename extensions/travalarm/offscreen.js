/**
 * TRAVIAN WATCHMAN PRO - OFFSCREEN AUDIO
 * Handles all alarm sound playback via the Chrome Offscreen API.
 * Receives PLAY_SOUND / STOP_SOUND / SET_VOLUME from the background service worker.
 */

const _audioCache = new Map(); // filename → Audio instance
let _playState = "idle"; // "idle" | "playing" | "cooldown"
let _playingSafetyTimer = null;
let _cooldownUntil = 0; // timestamp the current cooldown gap is meant to end
let _volume = 0.8; // 0.0–1.0, default 80%

function _getAudio(file, cooldownMs) {
  if (!_audioCache.has(file)) {
    const audio = new Audio(chrome.runtime.getURL(file));
    audio.loop = false;
    audio.volume = _volume;
    audio.onended = () => {
      clearTimeout(_playingSafetyTimer);
      if (_playState !== "playing") return;
      _playState = "cooldown";
      _cooldownUntil = Date.now() + cooldownMs;
      setTimeout(() => {
        _playState = "idle";
        chrome.runtime.sendMessage({ type: "SOUND_RECHECK" }).catch(() => {});
      }, cooldownMs);
    };
    _audioCache.set(file, audio);
  }
  return _audioCache.get(file);
}

function _playSound(type) {
  const isAttack = type === "attack";
  const audio = isAttack
    ? _getAudio("attack.mp3", 1000)
    : _getAudio("alarm.mp3", 3000);

  // The audio element is the real source of truth — `_playState` is only an
  // in-memory shadow whose idle reset depends on offscreen-document timers
  // (the cooldown setTimeout below, the 15s safety timer). Chrome can throttle
  // those timers while the hidden document is suspended during a no-audio gap,
  // wedging `_playState` at "playing"/"cooldown" forever. Gating solely on it
  // would then drop every PLAY_SOUND — including the background's 60s
  // chrome.alarms safety-net tick — so the alarm stays silent until the user
  // interacts. Re-trigger unless this sound is genuinely mid-playback or still
  // inside its intended cooldown gap; that lets the safety-net tick recover.
  const now = Date.now();
  if (_playState === "playing" && !audio.paused) return;
  if (_playState === "cooldown" && now < _cooldownUntil) return;

  _playState = "playing";

  if (isAttack) {
    const norm = _audioCache.get("alarm.mp3");
    if (norm && !norm.paused) {
      norm.pause();
      norm.currentTime = 0;
    }
  }

  audio.currentTime = 0;

  clearTimeout(_playingSafetyTimer);
  _playingSafetyTimer = setTimeout(() => {
    if (_playState === "playing") {
      _playState = "idle";
      chrome.runtime.sendMessage({ type: "SOUND_RECHECK" }).catch(() => {});
    }
  }, 15000);

  audio.play().catch(() => {
    clearTimeout(_playingSafetyTimer);
    _playState = "idle";
  });
}

function _stopSound() {
  clearTimeout(_playingSafetyTimer);
  for (const audio of _audioCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  _playState = "idle";
}

function _setVolume(pct) {
  const linear = Math.max(0, Math.min(1, pct / 100));
  _volume = Math.pow(linear, 4);
  for (const audio of _audioCache.values()) {
    audio.volume = _volume;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PLAY_SOUND") {
    _playSound(msg.soundType || "normal");
  } else if (msg.type === "STOP_SOUND") {
    _stopSound();
  } else if (msg.type === "SET_VOLUME") {
    _setVolume(msg.volume ?? 80);
  }
});
