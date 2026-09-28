# Confirmed-answer autofill

The next step toward automation uses the answer bank already confirmed in Settings. Approval freezes these answers alongside the profile, letter and CV. Changes to answers continue to invalidate approval.

The companion fills exact, unambiguous text/URL fields for LinkedIn, GitHub, portfolio and availability. It preserves existing values and rejects non-HTTP links. A specific visible question overrides a generic input name. Unknown, salary, eligibility, consent, date-picker and select questions remain manual; no submit action is added.

Validation: first reproduce missing snapshots and absent answer filling with failing tests, then verify snapshot retrieval and revocation, controlled browser filling, ambiguous questions, invalid links, retained values and zero submissions. Existing snapshots without answers remain usable for contact/CV filling; reapproval adds confirmed answers.
