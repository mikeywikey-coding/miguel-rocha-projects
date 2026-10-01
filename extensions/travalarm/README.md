# TravAlarm

Tracks game events and schedules browser notifications and audio alerts.

**Skills demonstrated:** JavaScript, Manifest V3 service workers, Chrome alarms, persistent storage and Offscreen audio.

## Source guide

`state.js`, `fetchers.js` and `scanners.js` handle event data, with parsing helpers in `helpers.js` tested in [`extensions/tests/`](../tests/); `ui.js` renders controls; `background.js` and `offscreen.js` handle alerts.

## Inspect or load locally

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. The manifest lists the requested permissions and supported sites. Review those permissions before use with a game account.

Requires a supported Travian page and an active game session for live event data.
