import { baseline, initial, normalizeBuild } from "./data.js";
import { parseBuildLink } from "./share.js";

const DRAFT_KEY = "build-lab-v1";
// Keep the library in its own stable key so a future draft/schema migration
// cannot discard saved builds. The key is intentionally independent of the
// app version and is written alongside the current draft snapshot.
const LIBRARY_KEY = "build-lab-saved-builds";
const MAX_SAVED = 50;

const DAMAGED_SNAPSHOT =
  "A damaged snapshot could not be restored. Your other saved builds are available.";
const DRAFT_LOST_WITH_LIBRARY =
  "Could not restore the saved draft. Your saved builds are still available.";
const DRAFT_LOST = "Could not restore the saved draft. The example build is open.";

const readJson = (key) => JSON.parse(localStorage.getItem(key) || "null");

/** Normalizes stored snapshots, skipping any that no longer validate. */
function restoreSnapshots(list) {
  const saved = [];
  let damaged = false;
  for (const snapshot of Array.isArray(list) ? list.slice(0, MAX_SAVED) : []) {
    try {
      saved.push({
        id: String(snapshot.id),
        date: String(snapshot.date),
        build: normalizeBuild(snapshot.build),
      });
    } catch {
      damaged = true;
    }
  }
  return { saved, damaged };
}

function restoreFromStorage() {
  const draft = readJson(DRAFT_KEY);
  const library = readJson(LIBRARY_KEY);

  if (!draft) {
    const { saved, damaged } = restoreSnapshots(library?.saved);
    const notice = saved.length
      ? "Saved builds restored. The example build is open."
      : damaged
        ? DAMAGED_SNAPSHOT
        : "Reference adjusted to the captured linked rules. Changes shows the difference.";
    return { saved, current: initial, comparison: baseline, notice };
  }

  let current = initial;
  let comparison;
  let notice = "";
  try {
    current = normalizeBuild(draft.current);
  } catch {
    notice = DRAFT_LOST_WITH_LIBRARY;
  }
  try {
    comparison = normalizeBuild(draft.comparison);
  } catch {
    comparison = structuredClone(current);
  }
  // Older drafts embedded the library; prefer it when present.
  const snapshots = Array.isArray(draft.saved) && draft.saved.length ? draft.saved : library?.saved;
  const { saved, damaged } = restoreSnapshots(snapshots);
  if (damaged) notice = DAMAGED_SNAPSHOT;
  return { saved, current, comparison, notice };
}

function restoreLibraryOnly() {
  try {
    const { saved } = restoreSnapshots(readJson(LIBRARY_KEY)?.saved);
    return {
      saved,
      current: initial,
      comparison: baseline,
      notice: saved.length ? DRAFT_LOST_WITH_LIBRARY : DRAFT_LOST,
    };
  } catch {
    return { saved: [], current: initial, comparison: baseline, notice: DRAFT_LOST };
  }
}

/**
 * Restores the draft, comparison and saved library, then applies a shared build
 * from the URL if there is one. Never throws: every failure becomes a notice.
 */
export function loadSession() {
  let session;
  try {
    session = restoreFromStorage();
  } catch {
    session = restoreLibraryOnly();
  }

  if (location.hash.startsWith("#build=") || new URLSearchParams(location.search).has("b")) {
    try {
      const incoming = parseBuildLink(location.href);
      if (JSON.stringify(normalizeBuild(session.current)) !== JSON.stringify(incoming)) {
        session.comparison = structuredClone(incoming);
        session.notice = "Shared build loaded. Save it to keep a local copy.";
      }
      session.current = incoming;
    } catch {
      session.notice = "This shared build could not be read. Your local draft is still available.";
    }
  }
  return session;
}

/** Persists the session. Returns false when browser storage is unavailable. */
export function saveSession({ current, comparison, saved }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ current, comparison, saved }));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, saved }));
    return true;
  } catch {
    return false;
  }
}
