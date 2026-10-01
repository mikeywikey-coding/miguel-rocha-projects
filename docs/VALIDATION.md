# Validation

## Automated, on every push

[CI](../.github/workflows/ci.yml) runs these checks:

| Area               | Checks                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole repository   | ESLint and Prettier; Black for Job Compass and PC Remote                                                                                                                                                                                    |
| Build Lab          | Calculation and share-link unit tests, production build, Playwright browser tests (editing, saved builds, layout at several widths, typography)                                                                                             |
| Job Compass        | pytest for the API, job matching and drafting, application preparation, Gmail reply tracking with mocked Google responses, job-source adapters and the background service; Node tests for the Brave companion's discovery and browser queue |
| PC Remote          | pytest for host and origin checks, PIN pairing and device tokens, failed-attempt limits and command validation, with the Windows input layer stubbed                                                                                        |
| Workout Tracker    | Programme generation for every onboarding profile, save migration, training-block maths, 1RM estimates                                                                                                                                      |
| Browser extensions | Settlement Planner parsing and prediction model; TravAlarm duration parsing, alarm naming and HTML escaping. Scripts load as they do in the browser.                                                                                        |

## Manual checks

These need a real environment and are not automated:

- Extensions against live Travian pages. Their DOM scraping depends on the game's markup.
- Workout Tracker's offline caching and install flow on a phone.
- Job Compass against real job boards, employer forms and a real Gmail account. Its own [validation record](../projects/job-compass/docs/VALIDATION.md) describes those checks.
- PC Remote with a real phone and the Windows input layer (mouse, keyboard, volume and power), which the tests replace with a stub.

Exercise media and third-party datasets are checked by hand when they change; see [ATTRIBUTION.md](../ATTRIBUTION.md).
