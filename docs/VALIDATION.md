# Portfolio snapshot validation

## Presentation update — 26 September 2026

- Added a locally rendered SVG masthead and fresh Job Compass and Build Lab screenshots; inspected all three visually.
- Job Compass used an isolated temporary database with three fictional jobs, automation disabled and Gmail disconnected. The existing personal service was untouched.
- Both screenshot sessions reported no JavaScript page errors. Build Lab's static preview returned a missing favicon; its application assets loaded successfully.
- Checked landing-page and project README relative links, SVG XML and the presentation diff. Application source was not changed; the earlier test results below were not rerun for documentation edits.

## Source snapshot checks

Checked on 25-26 September 2026 while assembling this new repository:

- Build Lab: clean dependency installation, production build and all 52 Node.js calculation tests passed. The build reports a bundle-size warning. Browser tests were not rerun for this packaging change.
- Job Compass: all 38 pytest tests passed using the existing development Python environment against this snapshot. Two dependency deprecation warnings remain. No real applications were submitted or mailbox access performed during these checks.
- Five browser extension manifests (four Travian extensions and the Job Compass companion) resolve their declared scripts, styles, icons and popup pages.
- All included Python source files parse successfully.
- Main portfolio and project README relative links resolve.
- The 544 candidate Git files were checked for common credential patterns, personal document/database filenames and files over 10 MB. No findings. This is a limited packaging check, not a full security audit.
- Git whitespace checks report pre-existing trailing whitespace in some copied project sources; these snapshots preserve the original code.
- Both M4 release sizes and SHA-256 hashes match the documented inventory. Packages remain on Nexus Mods and are not committed.

No live game sessions, employer form tests or full Workout Tracker browser tests were performed during portfolio assembly. Job Compass requires fresh local configuration; its runtime data, Gmail credentials, CV PDFs and pairing keys are excluded.
