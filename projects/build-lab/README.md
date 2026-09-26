[Back to the portfolio](../../README.md)

# Build Lab

A React planner for NBA 2K27 player builds, with linked attribute changes, saved-build comparisons and an undoable editing workflow.

**Stack:** React, JavaScript, Vite, Playwright, Node.js tests.

![Build Lab player-build planning interface](../../assets/build-lab-dashboard.png)

## Features

- Attribute editing, locks, linked calculations and atomic undo.
- Body settings, badge requirements and cap-breaker planning.
- Saved builds, comparisons, URL imports and image exports.
- Separate calculation modules and automated checks.

## Run locally

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`. Run `npm test` for the included calculation tests and `npm run build` for a standalone static build in `dist/client/`.

Browser checks use `npm run test:ui` with the dev server running and Microsoft Edge installed, as specified in `playwright.config.js`.

## Source guide and limitations

`src/engine/` contains the calculation logic and `src/catalogs/` contains compiled catalog data. `tests/` includes calculation and browser tests.

Game rules and data are externally sourced; this is not an official or fully verified reproduction of the game. See [feature parity](feature-parity.md) and the [dataset notes](research/nba2k27-builder-dataset/README.md). Some upstream documentation refers to research material retained only in the original working project.

The portfolio uses a standalone Vite build. Original Sites hosting configuration, deployment identifiers and extraction tools are excluded. The hosting-specific test is excluded; the remaining tests are retained without changes. Three recovered external calculation modules are required by the current implementation and are retained under `research/locker-chunks/`; these are third-party inputs, not original portfolio code.
