[Back to the portfolio](../../README.md)

# Travian Settlement Planner

Forecasts when accumulated culture points reach the next settlement threshold.

**Skills demonstrated:** JavaScript, Kalman-filter estimation, event-driven celebration simulation, Chrome storage and alarms.

## Source guide

`shared.js` provides parsing and estimation utilities; `content.js` reads page data; `background.js` manages scheduled updates; `popup.js` presents predictions and controls.

## Inspect or load locally

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. The manifest lists the requested permissions and supported sites. Review those permissions before use with a game account.

The original extension manifest uses the name Travian CP Predictor. Predictions depend on observed production and the configured celebrations.

This is a source snapshot of a personal extension. No live game interactions were performed while assembling this portfolio. Original application code is preserved.
