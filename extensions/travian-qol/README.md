# Travian QoL

Combines independently configurable improvements to the Travian interface.

**Skills demonstrated:** Modular JavaScript, DOM integration, Chrome storage and options UI.

## Source guide

`lib/registry.js` registers features; `features/` contains sorting, resource totals, loot calculations, to-do lists and other modules; `options/` exposes settings.

## Inspect or load locally

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. The manifest lists the requested permissions and supported sites. Review those permissions before use with a game account.

Each feature in `features/` registers itself with the registry and can be switched on or off from the options page.
