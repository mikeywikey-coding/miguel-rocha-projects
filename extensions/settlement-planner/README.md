# Travian Settlement Planner

Forecasts when accumulated culture points reach the next settlement threshold.

**Skills demonstrated:** JavaScript, least-squares trend fitting, event-driven celebration simulation, Chrome storage and alarms.

## Source guide

`shared.js` provides parsing and the prediction model, tested in [`extensions/tests/`](../tests/); `content.js` reads page data; `background.js` manages scheduled updates; `popup.js` presents predictions and controls.

## Inspect or load locally

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. The manifest lists the requested permissions and supported sites. Review those permissions before use with a game account.

The manifest uses the extension's original name, Travian CP Predictor. Predictions depend on observed production and the configured celebrations.
