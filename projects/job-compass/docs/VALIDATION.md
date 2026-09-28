# Validation record — updated 27 September 2026

## Browser queue and submission recording — 27 September

45 pytest tests and 8 Node queue tests pass. Companion, isolated workflow and real-worker Brave fixture smoke checks pass. Worker coverage includes tab opening/filling, CV attachment, persistent progress, duplicate prevention, pause, permission denial, closed tabs, changed approvals, interrupted opening, tab capacity and bounded service retries. Submission recording requires explicit user confirmation and the current approval revision; repeat requests are rejected. The filler validates the approved URL inside the page to cover navigation races.

The first worker browser test accidentally reached a fictional Lever URL because Chromium did not intercept its initial extension-created navigation. No personal data was used or submitted. The test now blocks DNS for that host and reloads through fixture interception. Real employer form compatibility, user permission prompts, browser restarts and automatic submission are not certified by these tests. Automatic submission is not implemented.


## Unblocked preparation update — 26 September

44 pytest tests and the isolated browser workflow pass. Preparation now drafts all untouched new/saved jobs without a score, qualification, skills or five-item cutoff. Missing CV files are reported in activity and still block approval. Tests cover preserved flags, general CV selection for support roles, pause behavior, missing CV drafting, archived jobs, existing edits and full batches. Submission remains manual pending the user’s separate choice.

## Automatic preparation queue — 26 September

42 pytest tests pass (two existing dependency warnings). New tests cover eligibility selection, paused checks, missing CV, repeat runs, preserved edits and five-item batches. The isolated browser review workflow also passes. Preparation uses conditional updates and creates drafts only; no approvals or submissions are automated.

## Confirmed-answer autofill — 26 September

39 pytest tests pass (two existing dependency warnings). Companion and isolated workflow smoke checks pass. New tests first failed on missing approval answers and missing browser fills, then passed after implementation. Coverage includes approved-answer snapshots, access revoked after answer changes, profile links, availability, retained values, rejected non-HTTP links, skipped salary/eligibility/consent and zero submissions. JavaScript syntax passes. Employer compatibility is still fixture-tested; no live submissions or mailbox access were performed.


## Startup and confirmed-answer milestone — 25 September

Installed the current user's **Job Compass** Windows sign-in task. Its action runs `.venv/Scripts/pythonw.exe -m app.service` from the repository directory, with no execution time limit and failure retries at one-minute intervals. A first direct Uvicorn launch failed because console-free Python has no stdout; a reproducible logging error identified the cause. The corrected entry point uses a rotating local file log and was successfully launched through Task Scheduler. The task reported Running and `/api/health` returned HTTP 200 with the scheduler active. A future Windows sign-in and an actual crash/retry cycle have not been observed yet.

Settings now includes a blank confirmed-answer bank. An isolated browser workflow saved a fixture answer; API tests verify explicit confirmation, rejection of unknown keys and invalidation of existing approvals. These answers are not yet used by the companion. No personal eligibility or salary values were inferred or populated. The live Settings layout was inspected.

Fresh checks: **38 pytest tests passed**, two existing dependency warnings; desktop/mobile dashboard check passed; isolated application workflow and answer saving passed. A save/approve timing issue in that workflow was fixed by showing save confirmation after the refreshed draft is displayed. Startup scripts and documentation are versioned; personal data and runtime logs remain ignored.

## Reviewed application autofill update — 23 September 2026

The Brave companion now opens a selected approved job in a new tab. Once the user opens the employer's application form and clicks Fill, it targets the application form, recognizes common nested/labelled contact and cover-letter fields, and attaches the approved PDF to a resume input even when the site's upload widget hides that input. The matching job's `/apply` and `/application` paths are accepted. The employer tab remains open; the companion does not submit, answer eligibility/salary questions, tick consent, or solve CAPTCHA.

Read-only inspection of current Greenhouse, Lever and Ashby pages showed a standard Greenhouse form, a Lever `/apply` form, and an Ashby `/application` panel without an HTML `<form>` element. The companion includes a scoped Ashby panel selector. Controlled Brave fixtures covered nested field names, form selection alongside a newsletter form, hidden CV upload, an Ashby-style panel, URL binding, and zero submissions. Real personal details were not entered on employer pages. Current live compatibility and custom questions still need user-reviewed trials.

Latest checks: 35 pytest cases passed (two dependency deprecation warnings); companion and isolated dashboard workflow smoke checks passed; extension JavaScript syntax and Git whitespace checks passed.

The local dashboard is running at http://127.0.0.1:8123 on the user's PC. This record describes observed behaviour, not a hosted availability guarantee.

## Live Gmail connection update

On 22 September 2026, the owner configured a Google Cloud Web application OAuth client for the local callback, added only the Gmail read-only scope, added the owner as a test user, and explicitly approved Google's mailbox consent. Job Compass displayed Gmail as connected. The first real Gmail check completed at about 20:32 Lisbon time and added one message to the review inbox. It was later identified as an Alibaba Cloud promotional newsletter and dismissed as unrelated; the original email was untouched. OAuth credentials and tokens remain in ignored local `data/` storage. Google's Testing status can require reauthorisation after seven days.

## Checks run after the latest changes

| Check | Result | What it proves |
| --- | --- | --- |
| `.venv\Scripts\python -m pytest -q` | 35 passed, 2 dependency deprecation warnings | Matching, source adapters including mocked ITJobs API responses, API review and dismissal controls, encrypted ITJobs key lifecycle, and mocked Gmail sync behaviour. |
| `.venv\Scripts\python tests/workflow_smoke.py` | Passed | Isolated Brave dashboard flow, including Portuguese draft/CV selection, edit, save, approval and explicit submitted confirmation. |
| `.venv\Scripts\python tests/browser_smoke.py` | Passed | Desktop/mobile dashboard, source directory, ITJobs key setup panel, CV links, Replies view, job detail and no browser errors. |
| `.venv\Scripts\python tests/companion_smoke.py` | Passed | Extension loads and pairs in isolated Brave; listing extraction, URL checks and form-fill logic work on controlled fixtures. |
| Node syntax check on `web/app.js` | Passed | Dashboard JavaScript parses. |
| Local HTTP `/api/state` | 200 | Service is listening on loopback with seven additional browse/import sources; the dismissed newsletter is absent from Replies. |

Four of the original eight stored jobs failed the refined eligibility rules and were archived without deletion. The six original automatic feeds showed successful responses. ITJobs is now a seventh automatic source and its first successful live check returned 36 listings, of which 9 became matches. Source counts are fetched listings, not recommendations.

All four English/Portuguese general/developer CV PDFs are present under ignored `data/cvs/` and appear as downloads in Settings.

## Limits of verification

- Gmail cursor recovery and classification edge cases were tested with mocked Google responses. A real connection and first read-only check now succeeded; longer-term refresh, history expiry, and classification accuracy across real employer messages remain to be observed.
- On 23 September 2026, the owner authorised requesting an ITJobs read-only key for the address already connected to Gmail. The key was saved encrypted. A live check returned 36 ITJobs listings and added 9 matches. The first query exposed a combined-term search mistake; the connector now runs separate junior, estágio and trainee searches and deduplicates the results.
- Brave form filling was tested with controlled forms and an isolated browser profile. Compatibility with every employer's form, frame structure and upload widget is not established. No employer form was submitted.
- LinkedIn, Indeed Portugal, Net-Empregos, Landing.Jobs, SAPO, IEFP, Teamlyzer, Expresso Emprego, Jooble Portugal, Jobrapido Portugal, Portal Emprego, Randstad Portugal and Adecco Portugal are browse/import links. ITJobs now has an active automatic feed as well as its browse link.
- Discovery and Gmail checks run only while the local service and PC are on. A Windows sign-in task is now installed; there is no hosted scheduler.
- This is a single-user loopback app. It has no login or TLS and must not be exposed publicly in its current form.

The two pytest warnings come from installed FastAPI/Starlette test dependencies, not from failing assertions. No known runtime warning occurred during the successful server start.


## Queue recovery � 28 September 2026

Companion 0.6.1 adds a 15-second timeout to application-queue dashboard requests, including submission recording. Missing form-reader reports now stop after six checks, keeping the tab open for manual inspection. Two regression tests reproduced the prior indefinite waits and pass with the fixes. All 15 Node queue/discovery tests pass; background JavaScript syntax and whitespace checks pass. No employer applications were filled or submitted during these tests. Reload is required to activate the extension update; allow the current Jobrapido discovery cycle to finish first.
