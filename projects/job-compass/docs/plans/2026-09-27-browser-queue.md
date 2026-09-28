# Background browser queue

Goal: open and fill approved applications without requiring the popup to remain open. Submission remains manual under the existing user preference.

The Manifest V3 worker stores progress per job and approval revision in extension local storage. A one-minute alarm processes one pending application at a time. At most three tabs remain open for review. Optional access covers only Greenhouse, Lever and Ashby hosts. The queue derives Lever/Ashby application paths, verifies the exact approved URL, fetches reviewed materials just before filling and checks URL identity inside the page again. It never clicks Submit or consent controls.

Persist an opening marker before creating a tab, so worker interruption cannot silently duplicate it. Keep ready and closed attempts as deduplication records. Changed approvals invalidate old attempts. Retry temporary service failures three times and wait up to six checks for a form; otherwise surface a manual-help state with a retry control. Preserve existing form values and allow a user-confirmed submission record to update the dashboard atomically against the approval revision.

Validation uses Node worker mocks, authenticated API tests and an isolated Brave profile with optional site grants represented as required permissions in a temporary manifest copy. The browser test blocks DNS for its fictional employer URL and uses intercepted content. No real applications are submitted. Real employer compatibility and optional-permission UI still need a user-reviewed trial.
