# Reviewer guide

[Back to the portfolio](../README.md)

This collection contains eight independent projects. There is no shared install step: open a project's README for its environment and setup. Start with Job Compass for backend integration or Build Lab for React and calculation logic.

## Where to read first

| Project | Start with | Folder map |
| --- | --- | --- |
| [Job Compass](../projects/job-compass/) | `app/engine.py`, then `app/main.py` | `app/` contains matching, persistence, source adapters and Gmail integration; `web/` is the dashboard; `extension/` is the Brave companion; `tests/` contains automated checks; `scripts/` contains optional Windows startup helpers; `docs/` records development history. |
| [Build Lab](../projects/build-lab/) | `src/engine/buildModel.js`, then `src/Builder.jsx` | `src/engine/` implements build calculations; `src/catalogs/` contains catalogs; `tests/` covers calculations and `tests/ui/` browser interactions; `public/images/` holds game-related assets; `research/` holds attributed upstream inputs. |
| [Workout Tracker](../projects/workout-tracker/) | `app/js/state.js`, then `app/js/main.js` | `app/js/` contains screen and state modules; `app/icons/` contains app icons; `app/media/` contains attributed exercise images; `app/sw.js` handles offline caching. |
| [Settlement Planner](../extensions/settlement-planner/) | `shared.js` | The flat structure separates shared estimation utilities, background scheduling, page reading and popup UI. |
| [TravAlarm](../extensions/travalarm/) | `state.js`, then `scanners.js` | The flat structure separates data fetching, scanning, rendering, notifications and offscreen audio. Script loading order is declared in the manifest and HTML. |
| [Travian QoL](../extensions/travian-qol/) | `lib/registry.js`, then `content.js` | `features/` contains independently registered modules; `options/` contains settings; `lib/` defines the registry contract. Feature directory names describe their roles. |
| [Night Mode](../extensions/night-mode/) | `popup.js`, then `content.js` | The flat structure contains the popup, theme logic, icon and extension manifest. |
| [BMW M4 ADRO](../projects/bmw-m4-adro/) | `README.md`, then `releases.json` | A published-mod case study and release inventory. This is not a Blender source checkout; the supplied packages contained no editable Blender file. |

## Source and generated material

- Build Lab's `research/nba2k27-builder-dataset/` groups upstream data by animations, badges, bodies, cap breakers, overall, reference and takeovers. `research/locker-chunks/` contains external calculation inputs used by the app. These are attributed inputs, not original portfolio code.
- `node_modules/`, `dist/`, Python caches and local environments may appear after running a project. They are ignored and are not part of the committed portfolio.
- Job Compass creates private state under ignored `data/`, which is not supplied with a clone.
- Development plans under Job Compass are historical records. They describe the original workspace and earlier milestones; the current README and validation notes take precedence.
- See [attribution](../ATTRIBUTION.md) for third-party media and data. Original working repositories remain separate from this curated snapshot.

## Review scope and checks

The September 2026 cleanup checks folder contents, Markdown links, local extension assets, Python parsing and JavaScript syntax. Selected compact source modules are formatted for readability, with syntax-tree comparisons used to verify unchanged logic. Tests and build results are recorded in [validation](VALIDATION.md).

This is a light review, not a security audit or a guarantee of compatibility with current game pages. The extensions require browser APIs and an appropriate page/session. Live game actions are not exercised by the portfolio checks.
