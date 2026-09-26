# Original builder parity

Scope: the linked MyPlayer builder, editing and sharing tools. Full parity remains incomplete.

| Feature | Current status |
|---|---|
| All 21 ratings, sliders, numeric input, steppers, hover preference | Implemented |
| Combined / Attributes / Cap Breakers views | Implemented |
| Body editor and legal dependent ranges | Implemented for 45 captured position/height combinations |
| Body-dependent caps and changed-cap highlighting | Complete original-client table for 9,485 legal bodies |
| Linked increases and decreases | Active height-specific positive-delta rules, cascading through the graph |
| Automatic linked changes and atomic undo | Implemented for rating and body changes; notices and automatic adjustment highlights hidden at user request |
| OVR pricing and upgrade budget | Captured tuning;256 mixed and 75 uniform vectors match within 1e-4 |
| Completed99 / room to grow | Uses affordable legal increases; excludes unresolved links and unknown caps |
| Lock behavior | Partial: minimums enforced, lowering a prerequisite reduces dependents; zero-delta SWB meaning unresolved |
| Five-step cap-breaker gains | Recovered original client formula with all 15 whole-build player profiles |
| Cap allocation interactions | Planned counts up to 5, exact rung gains and exact body-ceiling headroom |
| Full badge catalog and creation tiers | 53×4, height and ordered attribute predicates; Legend requires Synergy |
| Tokens, tier costs, next-token thresholds | Exact position-and-height token tables; tier costs and ladders match the original client |
| Badge slots | Recovered deterministic 20-slot allocator; all categories resolve for every supported build |
| Animation catalog | All 2,914 captured entries;115 exact public height matches; other size/season conditions unverified |
| Takeovers | All 24 public entries, AND/OR predicates and progression notes |
| Search/category/status filters | Implemented; unknown eligibility distinct from met/not met |
| Reset/local saves/comparison/revert | Implemented; damaged snapshots recovered independently |
| Live URLs/original b= import | Implemented; legal body/cap normalization, immediate URL update avoids reload rollback |
| X/Instagram images |1200×675 and 1080×1350 PNG, body caps and measured projections |
| Responsive/keyboard/dialogs | Verified in Edge; no horizontal overflow from 360–1440px |

## Source differences

Reference body:81 in /185 lb /84 in wingspan. Downloaded ratings were all 25; later URL/screenshot specify populated values.

| Value at populated reference | Original | August 22 capture |
|---|---:|---:|
| Driving Dunk cap |93|95|
| Perimeter Defense cap |89|92|
| Block cap |91|92|
| Post at Close Shot77 |40 shown|32 minimum under recovered dependency data|
| Finishing tokens |7|8|
| Rebounding tokens |7|6|
| Physical tokens |8|9|

The recovered client tuning supersedes the earlier sampled cap and token approximations. Dependencies now use the recovered Locker Codes client table (`research/locker-chunks/We27uoMs.js`), including the 81-inch Close Shot → Post Control delta of 45. This matches the supplied in-game 87 Mid-Range / 77 Close Shot / 42 Post Control spread. Imports preserve original ratings, surface linked-rule conflicts and offer reconciliation.

## Missing source

The remaining confirmed gaps are some animation size/season gates and any future live-tuning changes. The game manifest points to packed assets, not a recovered rules table.

Supplemental source: https://github.com/lightmatmul/nba2k27-builder-dataset at 18f692eaaa611e6daf9427a3d5a5f97ae0423bba. Extraction: `research/downloaded-page.json`. Readable values: `research/downloaded-build-report.md`.

Attribute locks: all 21 rows have persistent lock toggles and gold labels/ratings. Direct edits are disabled, linked edits and body changes that move a locked rating are rejected, and unlocking restores normal editing.
