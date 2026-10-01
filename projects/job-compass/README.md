# Job Compass

A private job-search workspace for Lisbon and remote opportunities: a dashboard, scheduled discovery, Gmail reply tracking and a Brave browser companion. Application materials require review; the companion never clicks Submit.

![Job Compass with fictional sample jobs](../../assets/job-compass.png)

_Isolated demo workspace. No mailbox data or personal applications are shown._

## Run on Windows

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.\start.cmd
```

Open **http://127.0.0.1:8123**. Use this exact address for Gmail OAuth. The service binds to loopback and is intended for one person on this PC. Do not expose it to a network or public hosting without adding authentication and TLS.

The service searches automatically on startup, then checks every five minutes for work due. Each automatic job source has a six-hour minimum interval, including manual checks. Gmail checks every five minutes. The service must stay running and does not run when the PC is off.

For automatic startup on this Windows account, run `scripts/install-startup.ps1`. It installs the **Job Compass** sign-in task, launches without a console, and configures retries after failure. This was installed and its launch verified on Miguel's PC on 25 September 2026. Logs rotate under ignored `data/service.log`. To remove startup, run `scripts/remove-startup.ps1`; that does not stop an already running service. Avoid starting a second copy while the scheduled service is running. `/api/health` reports whether the scheduler task is alive, whether checks are enabled, and when its latest cycle started; it does not prove that every external source succeeded.

To restart after an update, run `scripts/restart.ps1`. It waits for the previous server to release port 8123 before starting the scheduled task, then checks service health.

## What works

- Live adapters for Remotive and selected company boards on Greenhouse, Lever and Ashby, with per-source errors and timestamps. ITJobs automatic search is available after a read-only API key is saved in Settings.
- Lisbon / Portugal-compatible remote filtering, junior and internship prioritisation, support-role option, known skill overlap and explicit qualification flags.
- URL and exact company/title/location duplicate detection; import from Brave or a dashboard form.
- Persistent shortlist, editable draft letters, CV selection, reviewed profile snapshots, stale-approval protection and CV-file hash checking.
- Confirmed application answers in Settings for eligibility, availability, salary and profile links. Blank fields remain unknown. Changes clear existing approvals. The answer bank is stored locally and copied into each approval. The companion fills exact matching LinkedIn, GitHub, portfolio and availability text fields; salary, eligibility and ambiguous questions remain manual.
- Explicit English or Portuguese draft choice, paired with the corresponding CV; regenerating a draft asks before replacing edits and clears its approval.
- Manual confirmation of submission; Gmail matching and suggested reply classifications; explicit review of ambiguous matches and status changes.
- Encrypted Google OAuth credentials and tokens at rest, OAuth state/PKCE, recent-message initial sync, incremental sync, pagination and expired-history recovery.
- Brave extension with active-tab listing capture, one-click opening of an approved job, and conservative contact/cover-letter filling and CV attachment for approved applications. It recognizes common nested and labelled fields on Greenhouse, Lever and Ashby forms, selects the application form when a page has several forms, and can attach a CV to a hidden upload input. Confirmed profile links and availability can also be filled from the approval snapshot. No automatic submit, consent ticking, eligibility answers or CAPTCHA handling.

## Source coverage

**Automatic:** Remotive, Dashlane via Greenhouse, Pipedrive and Emma via Lever, cargo.one and Bounce via Ashby. ITJobs becomes automatic when you save its read-only API key in Settings; until then its browse link remains available. These employer boards are starting points, not a comprehensive index. Add more company identifiers under Job sources. Roles returned today may differ from search-engine results or previous snapshots.

**Website collectors:** LinkedIn, Net-Empregos, Landing.Jobs, SAPO Emprego, IEFP Online, Teamlyzer, Expresso Emprego, Portal Emprego, Randstad and Adecco have scheduled collectors. Searches cover bounded keyword results and first result pages. SAPO collects homepage listings; Landing collects its first 50 listings. These are not exhaustive indexes.

**Indeed through Brave (companion 0.5.0):** Reload the unpacked extension at `brave://extensions`, open the companion, and choose **Enable / resume Indeed**. Grant access to `pt.indeed.com` when Brave asks. Pairing, Brave, and the dashboard must stay available. Four searches cover junior development, internships and technical support in Lisbon plus remote junior development in Portugal, reading up to 60 unique cards per cycle. Checks run every six hours, using one reusable tab. Results are matched, deduplicated by Indeed job ID, and drafted for review. Card snippets are not full job descriptions. A security check, unreadable page, or interrupted navigation pauses discovery and leaves the tab for inspection. Use **Show Indeed search tab**, resolve it yourself, then resume. No applications are submitted. Dashboard/global pause also applies. The source becomes a companion source after its first reported result.

**Jobrapido through Brave (companion 0.6.0):** Reload the extension, then choose **Enable / resume Jobrapido** and grant access to `pt.jobrapido.com`. It uses the same four searches, six-hour schedule, 60-listing limit, and independent pause/resume controls as Indeed. Live search-card extraction was verified on 28 September 2026. Cards supply title, company, location and a stable Jobrapido link; they do not supply full descriptions. Jobrapido becomes automatic in the dashboard after its first companion report. Activation and the first complete scheduled import still need verification on your installed extension.

**Not connected automatically:** Jooble requires a Portugal-specific API key. Manual capture remains available.

ITJobs publishes a read-only API at https://www.itjobs.pt/api. Request a key there and save it under Settings → ITJobs automatic search. The key is encrypted under the ignored local `data/` directory; it is never returned by `/api/state`. Once configured, Job Compass queries ITJobs for junior, internship and trainee listings every six hours and runs its normal Lisbon/remote and skills checks before adding matches. The source can be switched off or its key removed in the dashboard.

Remotive listings retain Remotive attribution and the original Remotive URL. The discovery interval follows the provider's recommended low-frequency access. No listings are republished to external boards.

Matching is deterministic and explainable, not an assessment of hiring probability. Remote labels do not establish work eligibility; uncertain geography and enrolment/degree requirements are flagged. Missing qualifications are never added to the profile automatically. When matching rules change, unreviewed new jobs are rechecked; jobs that no longer fit are archived, while saved applications stay intact. Draft letters are editable templates, not AI-written personalised applications.

## CVs and personal data

Set contact details and confirmed skills in Settings. Place the four PDFs under ignored `data/cvs/`:

- `Miguel_Rocha_CV_General.pdf`
- `Miguel_Rocha_CV_General_PT.pdf`
- `Miguel_Rocha_CV_Junior_Developer.pdf`
- `Miguel_Rocha_CV_Junior_Developer_PT.pdf`

The local copy was populated from the latest approved CV files. Contact details, tokens, inbox excerpts, application data, encryption keys and PDFs remain under ignored `data/`; they are not source-control content. The encryption key is on the same PC, so it does not protect against someone who can read the entire data directory. Back up that directory privately.

## Connect Gmail

1. Create a Google Cloud project and enable Gmail API.
2. Configure its OAuth consent screen for personal testing and add your Gmail account as a test user.
3. Create an OAuth **Web application** client. Add `http://127.0.0.1:8123/oauth/gmail/callback` as an authorised redirect URI.
4. Enter the client ID and secret in Job Compass Settings; then choose Continue with Google and grant Gmail read-only access.

Read-only permission covers the mailbox. The first sync searches recruitment-related messages from the last 30 days; subsequent checks use Gmail history. Only relevant message excerpts are stored. Matching uses an already-linked thread or an unambiguous company-and-role match among submitted applications. Unknown messages stay unlinked. Reply categories are suggestions, and the user confirms changes such as interview or rejection.

No Gmail sending, deletion, label changes or read/unread changes are implemented. Disconnect attempts Google token revocation and deletes locally saved tokens, but retains previously stored recruitment messages. Testing-mode Google credentials may need periodic reauthorisation. Public distribution of a Gmail-reading app has additional Google verification requirements; this build is personal and local.

## Install the Brave companion

1. Open `brave://extensions`, enable Developer mode and choose Load unpacked.
2. Select the `extension` folder in this project.
3. In dashboard Settings, reveal the pairing key; paste it into the extension popup.
4. On a listing, choose Read current listing, review the captured fields and confirm import.
5. Prepare, edit and approve an application in the dashboard. Reload the extension from `brave://extensions` after updating its files.
6. Select the approved application in the companion and choose **Open selected job in Brave**. On the employer page, open its application form, then choose **Fill reviewed details & CV** in the companion. The listing, `/apply` and `/application` paths for the same job are accepted.
7. To include changed answers, save them in Settings and approve the application again. Older approvals without an answer snapshot fill contact details and the CV only. Reload the companion after upgrading to version 0.3.0.
8. The employer tab stays open. Review every field and attachment, complete unanswered questions, submit yourself and confirm submission in the dashboard.

The extension intentionally rejects different job URLs. Some sites use unrelated application paths, nested frames or custom fields: use manual copy/paste and CV download for those forms. Existing field values are preserved. Pairing keys grant access to approved materials and should be kept private; reset pairing in Settings to invalidate old keys.

## Automatic browser queue (companion 0.4.0)

Reload the extension in `brave://extensions`, then open its popup and choose **Enable automatic queue**. Brave requests optional access to Greenhouse, Lever and Ashby. The worker checks every minute, opens approved applications and fills reviewed details/CVs without needing the popup open. It keeps up to three application tabs available for review. The local service and Brave must remain running.

The queue shows progress, fields needing attention and a **Show application tab** control. Temporary service failures retry up to three checks; form loading gets up to six checks. **Pause queue** stops further work and keeps tabs open. Closed attempts stay recorded to prevent duplicates. An interrupted opening needs a manual check before retrying. Unsupported websites remain visible with a manual-help message.

After submitting on the employer website, use **Record submitted** and confirm that you saw its success message. This records the result in the dashboard; it does not submit the form. Changes to approval invalidate old queue attempts. The queue never guesses unknown answers, ticks consent or clicks Submit. Old filled tabs can contain outdated information after an approval changes; review the queue warning before using them.

## Development and validation

```powershell
.venv\Scripts\python -m pytest -q
# With the local dashboard running:
.venv\Scripts\python tests/browser_smoke.py
.venv\Scripts\python tests/workflow_smoke.py
.venv\Scripts\python tests/companion_smoke.py
.venv\Scripts\python tests/queue_browser_smoke.py
node --test tests/test_queue.cjs
```

Browser checks use the locally installed Brave executable in isolated profiles. Workflow tests use an isolated database and port 8124. Companion form logic is tested on a fixture form, not by submitting to an employer. Real Gmail OAuth and one initial read-only sync were verified after the owner authorised the connection; cursor recovery and error handling are also covered with mocked Google responses.

See `docs/VALIDATION.md` for the latest test run and the exact limits of that evidence.

## Structure

- `app/engine.py`: matching, normalisation, draft templates and email classification.
- `app/sources.py`: public-source adapters and discovery.
- `app/gmail.py`: Gmail OAuth and sync.
- `app/store.py`: persistence and encrypted credential storage.
- `app/main.py`: local APIs, review workflow and scheduler.
- `web/`: responsive dashboard.
- `extension/`: Brave companion.
- `tests/`: unit, API, sync and browser checks.
- `docs/plans/`: implementation plan and source research.

## Automatic preparation

While automatic checks are enabled, every untouched new or saved job in the list gets an English draft. Scores, qualification flags and skill gaps remain visible but do not block drafting. Support jobs use the general CV; development jobs use the developer CV. A missing PDF does not prevent drafting, but must be supplied before approval. Existing drafts, archived jobs and applications in progress are preserved. Pausing automatic checks pauses preparation too. Discovery still follows the configured role and location scope. Nothing is automatically approved or submitted.

## Next milestones

Broader source coverage; structured salary and eligibility questions; better-supported site adapters; hosted authenticated scheduling so checks continue when the PC is off. Fully automatic submissions remain a future, explicitly enabled mode after reviewed workflows prove reliable.
