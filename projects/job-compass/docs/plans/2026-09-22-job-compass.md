# Job Compass Implementation Plan

**Goal:** Build Miguel's private job discovery dashboard, Gmail reply tracker and Brave application companion, with human review before submission.

**Architecture:** A single-user FastAPI service owns SQLite persistence, source polling, scoring and Gmail OAuth. A same-origin dashboard controls the workflow. A Manifest V3 Brave companion imports the active listing and fills approved contact details without submitting forms. Initial execution is local; scheduled work requires the service to be running. Hosted operation requires authentication/TLS and is a later deployment step, not silently enabled.

**Tech stack:** Python, FastAPI, SQLite, httpx, vanilla JavaScript/CSS, Chromium Manifest V3, pytest and Playwright.

## Approved scope

Junior development and tech internships first; technical/customer support second. Lisbon or remote with Portugal eligibility. English and Portuguese CV variants. Gmail read-only reply tracking. Review before application submission or email sending. No automated submission switch in the first build.

## Tasks

1. `tests/test_engine.py`, `app/engine.py`: test canonical URLs, cross-source duplicate candidates, eligibility, seniority exclusions, truthful drafts and ambiguous email matching. Run pytest; implement pure matching functions.
2. `app/store.py`, `app/sources.py`: implement SQLite transactions, source adapters (Remotive, Greenhouse, Lever, Ashby), per-source timestamps/errors and six-hour discovery cooldown. Public employer APIs require configured company boards; they are not global searches. Seed real researched board identifiers. Keep broad job sites as browser-import/search shortcuts, not fake automatic connectors.
3. `app/gmail.py`: implement OAuth state/PKCE, encrypted token persistence, incremental sync with bounded initial search, pagination, deduplication, expired-cursor recovery and read-only scope. Messages never instruct application actions. Ambiguous replies require user linking; deterministic categories are suggestions, not authoritative decisions.
4. `app/main.py`: serve dashboard and protected APIs, local-only Host/Origin checks, server-side reviewed draft snapshots, CV downloads, explicit submitted confirmation, extension pairing token and periodic tasks. Test stale approval and unauthorised access.
5. `web/index.html`, `web/app.js`, `web/styles.css`: build responsive dark dashboard with discovery, shortlist/review, applications, inbox, sources and settings; editable drafts and visible sync status. Render external text safely.
6. `extension/`: implement active-tab import, explicit pairing, approved application retrieval, conservative contact autofill and selected CV attachment. Never click submit, consent boxes or eligibility answers. Unknown forms retain a manual path.
7. `tests/test_api.py`, `tests/browser_smoke.py`: run unit/integration tests, real source sync, browser workflow tests, small-screen layout and Brave companion checks in an isolated profile. Document verified results and setup boundaries.

## Research

Net-Empregos, Indeed, SAPO Emprego and IEFP appear in Similarweb's June 2026 Portugal category ranking; LinkedIn is classified separately and included for professional hiring. ITJobs and Landing.Jobs are tech-focused additions. Treat rankings as estimates, not a September census.

- https://www.similarweb.com/pt/top-websites/portugal/jobs-and-career/
- https://www.itjobs.pt/
- https://landing.jobs/
- https://github.com/remotive-com/remote-jobs-api
- https://docs.greenhouse.io/job-board.html
- https://github.com/lever/postings-api
- https://developers.ashbyhq.com/docs/public-job-posting-api
- https://developers.google.com/workspace/gmail/api/guides/sync
- https://developers.google.com/workspace/gmail/api/auth/scopes

## Boundaries

No Gmail access occurs before Google authorisation. OAuth client credentials must be provided by the user through Settings. No paid services, hosted deployment, browser-profile modification or external application submissions are part of this initial build. Personal data and copied CVs stay in ignored `data/`. Remote jobs without clear geographic eligibility are marked for checking, not treated as confirmed matches.
