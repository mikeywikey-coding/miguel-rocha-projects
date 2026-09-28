# Indeed companion discovery plan

**Goal:** Collect visible Indeed search cards on a six-hour schedule through Brave.

**Approved design:** Use the user's ordinary browser session, with optional access only to pt.indeed.com. Keep one discovery tab, persist progress before navigation, and pause on challenges, sign-in, missing cards, or navigation away. No challenge solving or application submission. User can enable, pause, resume, and inspect the tab. The dashboard accepts authenticated, bounded batches, normalizes Indeed job IDs, filters matches, and prepares drafts. Dashboard/global pause applies too.

**Implementation:**
1. Add failing API tests for authentication, host validation, matching and deduplication.
2. Add bounded discovery config/result endpoints and exclude companion sources from server collectors.
3. Add a separate extension worker module, visible controls, optional host permission, and version bump.
4. Test persisted scheduling and challenge pauses with mocked Chrome APIs. Check extraction against the previously observed Indeed DOM.
5. Run existing tests, restart the local service, and verify dashboard health. Activate in Brave only after the site permission is granted; report any required user action accurately.
