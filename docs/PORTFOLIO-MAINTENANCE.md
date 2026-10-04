# Maintaining this portfolio

This repository holds portfolio copies of personal projects. Each project is developed in its own working repository, then copied here deliberately and reviewed before committing.

## Organisation

- `projects/`: Job Compass, Build Lab, PC Remote and Workout Tracker. The M4 mod is linked to its Nexus Mods page only.
- Travian extensions: links to [the public repository](https://github.com/mikeywikey-coding/travian-extensions); no extension copies are stored here.
- `assets/`: the header and screenshots used by the READMEs.
- `docs/`: reviewer guide, validation notes, snapshot provenance and this guide.
- `ATTRIBUTION.md`: third-party sources and ownership notes.

## Updating a project

1. Copy the changed source in from the working repository. Record its commit in `SNAPSHOT-PROVENANCE.json`.
2. Run `npm run lint`, `npm run format:check` and `npm test` from the root, plus the project's own checks: Build Lab `npm test` and `npm run test:ui`; Job Compass and PC Remote `black --check .` and `python -m pytest`; Job Compass also `node --test tests/*.cjs`.
3. Update the project's README if features or commands changed.
4. Open a pull request and let CI pass before merging.

Build Lab and Workout Tracker are kept identical to the [miguel-rocha-portfolio](https://github.com/mikeywikey-coding/miguel-rocha-portfolio) repository; change them there first, then copy them across.

## Travian extensions

**ALWAYS publish every extension change to [travian-extensions](https://github.com/mikeywikey-coding/travian-extensions).** Update the installed development source and public runtime files together, update affected guides and screenshots, and commit and push the public changes before declaring completion. Report any publishing blocker. Keep this portfolio linked to that repository; do not reintroduce extension snapshots. The user has provided standing authorization to publish requested extension changes.

## Never committed

Installed dependencies, browser profiles, local agent settings, deployment credentials, personal CV documents, Job Compass's `data/` directory, PC Remote's local configuration and paired devices, and large mod archives stay out of the repository. `.gitignore` covers the common cases; review the diff for anything else.
