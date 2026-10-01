# Workout Tracker

A mobile-first workout tracker for recording sets, reviewing progress and adapting training to the user's equipment and experience. The app's in-app name is Leg Day.

**Stack:** JavaScript modules, HTML, CSS, service worker, localStorage. No build step and no dependencies.

## Features

- Onboarding that builds a programme from the user's level, equipment, split and focus.
- Set logging, rest timers and double progression based on previous sessions.
- Exercise swaps, added and removed exercises, and 8-week training blocks.
- History, personal records, estimated 1RM, bodyweight tracking and JSON backup import/export.
- Installable web app with offline caching.

## Run locally

From this directory, run `python -m http.server 8742 --directory app`, then open `http://localhost:8742`.

## Tests

From the repository root, `npm test` runs `tests/` with Node's test runner. The tests build the programme for every profile the onboarding can produce, and cover save-data migration, training-block maths and the 1RM estimate.

## Source guide

- `app/js/program.js` defines the exercise library and builds programmes from a profile.
- `app/js/state.js` handles persistence, migration of older saves and progression.
- `app/js/stats.js` computes records, volume and streaks.
- Screen modules (`home.js`, `workout.js`, `history.js`, `profile.js`) render each view.
- `app/sw.js` manages offline caching.

All data stays in the browser, so exported backups matter. Exercise photographs come from free-exercise-db; see the root [attribution notes](../../ATTRIBUTION.md).
