[Back to the portfolio](../../README.md)

# Workout Tracker

A mobile-first workout tracker for recording sets, reviewing progress and adapting training to the user's equipment and experience.

**Stack:** JavaScript modules, HTML, CSS, service worker, localStorage.

## Features

- Set logging, rest timers and progression based on previous sessions.
- Exercise alternatives and training splits.
- Workout history, bodyweight tracking and JSON backup import/export.
- Installable web app with offline caching and responsive screens.

## Run locally

From this directory, run `python -m http.server 8742 --directory app`, then open `http://localhost:8742`.

## Source guide

`app/js/state.js` handles persistence and progression; `program.js` defines exercises and programmes. Screen modules cover workouts, history and profile settings. `app/sw.js` manages offline caching.

This is a local-data app. Browser storage can be cleared, so exported backups matter. The portfolio name is Workout Tracker; some original interface text still says Leg Day.

The exercise media originates from free-exercise-db; see the root attribution notes. Deployment credentials and the original automated deployment scripts are excluded.
