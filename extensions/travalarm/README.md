[Back to the portfolio](../../README.md)

# TravAlarm

Tracks game events and schedules browser notifications and audio alerts.

**Skills demonstrated:** JavaScript, Manifest V3 service workers, Chrome alarms, persistent storage and Offscreen audio.

## Source guide

`state.js`, `fetchers.js` and `scanners.js` handle event data; `ui.js` renders controls; `background.js` and `offscreen.js` handle alerts.

## Inspect or load locally

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. The manifest lists the requested permissions and supported sites. Review those permissions before use with a game account.

Requires a supported Travian page and an active game session for live event data.

This is a source snapshot of a personal extension. No live game interactions were performed while assembling this portfolio. Original application code is preserved.
