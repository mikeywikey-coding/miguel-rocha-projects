# Reviewed application autofill

Miguel chose Greenhouse, Lever and Ashby as the first application sites. He will review and submit each application himself. Job Compass should leave the employer tab open with approved details filled, so his remaining work is to check them and answer site-specific questions.

The alternatives were a generic fill on every page, provider API submission, or a scoped browser companion. Generic filling risks touching newsletter and unrelated forms. Provider submission would bypass the requested final review and needs employer-side privileges. The selected approach extends the paired Brave companion: it opens a selected approved listing, requires an exact job URL or that job's `/apply` or `/application` path, and fills only a clearly identified application form or Ashby application panel.

The dashboard remains the source of truth for profile details, cover-letter text, CV choice and approval. The existing server check rejects stale approvals and changed CV files. The companion preserves existing values and fills only recognized name, email, phone, cover-letter and CV controls. It reports fields it skipped, leaves salary, eligibility, consent and custom answers to Miguel, and never triggers submission. If a form cannot be identified, it asks him to open the application form and try again.

Controlled Brave tests cover nested and labelled fields, a page with an unrelated newsletter form, hidden CV upload inputs, Ashby's form-less panel, same-job path matching and no submissions. Read-only inspection of public employer pages informed these fixtures. A real employer-page trial with Miguel's approved materials remains the next validation step.
