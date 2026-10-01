import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, X } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { attributes, badges, byId, changesBetween, clamp } from "./data";
import { dependencyRules } from "./engine/ruleset";
import {
  attributeIncreaseCosts,
  buildCaps,
  changeBody,
  editRating,
  minimizeAttribute,
  minimizeUnlocked,
  overallStatus,
} from "./engine/buildModel";
import { badgeEconomy, badgeSummary, nextBadge } from "./catalogs";
import { capSequence, projectedRatings } from "./engine/capProjections";
import { buildUrl, parseBuildLink } from "./share";
import { loadSession, saveSession } from "./storage";
import { BodyPlanner } from "./components/BodyPlanner";
import { BottomBar } from "./components/BottomBar";
import { BuildEditor } from "./components/BuildEditor";
import { CapsModal } from "./components/CapsModal";
import { ExportCard } from "./components/ExportCard";
import { Inspector } from "./components/Inspector";
import { ConfirmModal, Modal } from "./components/Modal";
import { RenameModal, SaveModal } from "./components/NameModals";
import { RulesModal } from "./components/RulesModal";
import { SavedBuilds } from "./components/SavedBuilds";
import { ImportModal, ShareModal } from "./components/ShareModal";
import { TopBar } from "./components/TopBar";
import { PAGE_SIZE } from "./components/UnlocksPanel";

const HISTORY_LIMIT = 50;
const MAX_SAVED = 50;
const TOAST_MS = 6000;

const plural = (count, one, many) => (count === 1 ? one : many);
const sameName = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** The app's single stateful component: owns the build, its history, the library and the UI state. */
export function Builder() {
  const [session] = useState(loadSession);
  const [build, setBuild] = useState(session.current);
  const [comparison, setComparison] = useState(session.comparison);
  const [saved, setSaved] = useState(session.saved);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(session.notice);
  const [modal, setModal] = useState(null);

  const [view, setView] = useState("builder");
  const [tab, setTab] = useState("changes");
  const [editorMode, setEditorMode] = useState("combined");
  const [hoverSteppers, setHoverSteppers] = useState(true);
  const [compare, setCompare] = useState(true);
  const [selected, setSelected] = useState("dunk");
  const [unlocks, setUnlockState] = useState({
    type: "badges",
    query: "",
    filter: "all",
    category: "all",
    attribute: null,
    limit: PAGE_SIZE,
  });
  const [badge, setBadge] = useState(() =>
    badges.find((b) => b.name === "Posterizer" && b.tier === "Gold"),
  );
  const [exportFormat, setExportFormat] = useState("landscape");
  const [exportBusy, setExportBusy] = useState(false);
  const exportRef = useRef(null);

  const changes = changesBetween(build, comparison);
  const spent = Object.values(build.breakers).reduce((sum, n) => sum + n, 0);
  const caps = useMemo(() => buildCaps(build.body), [build.body]);
  // The browser tests swap the ruleset module for a fixed rule list, hence the array case.
  const rules = useMemo(
    () =>
      typeof dependencyRules === "function" ? dependencyRules(build.body.height) : dependencyRules,
    [build.body.height],
  );
  const overall = useMemo(() => overallStatus(build, rules), [build, rules]);
  const increaseCosts = useMemo(() => attributeIncreaseCosts(build, rules), [build, rules]);
  const projection = useMemo(() => projectedRatings(build), [build]);
  const economy = useMemo(
    () => badgeEconomy(build.ratings, build.body),
    [build.ratings, build.body],
  );
  const shareUrl = buildUrl(build);

  useEffect(() => {
    if (!saveSession({ current: build, comparison, saved }))
      // Storage is the external system here; reporting its failure is the effect's job.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Browser storage is unavailable. Use Share to keep a copy of this build.");
  }, [build, comparison, saved]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    window.history.replaceState(null, "", buildUrl(build));
  }, [build]);

  const openModal = (type, data = {}) => setModal({ type, ...data });
  const closeModal = () => setModal(null);
  const setUnlocks = (patch) => setUnlockState((current) => ({ ...current, ...patch }));

  /** Records an undoable edit. */
  function update(next) {
    setHistory((h) => [...h.slice(1 - HISTORY_LIMIT), build]);
    setBuild(next);
  }

  function undo() {
    if (!history.length) return;
    setBuild(history.at(-1));
    setHistory(history.slice(0, -1));
  }

  /** Focuses an attribute and lists the badges it unlocks in the inspector. */
  function showAttributeBadges(id) {
    const group = byId[id].group;
    setSelected(id);
    setTab("unlocks");
    // Repeated edits to the same attribute keep the user's search; a new attribute starts fresh.
    if (unlocks.attribute === id && badge?.badgeId) {
      setUnlocks({ type: "badges", category: group });
      return;
    }
    setUnlocks({
      type: "badges",
      category: group,
      attribute: id,
      query: "",
      filter: "all",
      limit: PAGE_SIZE,
    });
    const upcoming = nextBadge(id, build.ratings, build.body);
    const related =
      badges.find((t) => t.badgeId === upcoming?.item?.badgeId) ||
      badges.find((t) => t.requirements.some(([requirement]) => requirement === id));
    const firstInGroup = badgeSummary(build.ratings, build.body)
      .filter((b) => b.group === group)
      .sort((a, b) => a.name.localeCompare(b.name, "en"))[0];
    if (related || firstInGroup) setBadge(related || firstInGroup);
  }

  /** Applies a rating edit and returns the rating that was actually accepted. */
  function setRating(id, value) {
    showAttributeBadges(id);
    const result = editRating(build, id, value, rules);
    if (JSON.stringify(result.build) !== JSON.stringify(build)) update(result.build);
    if (result.constrained) {
      const blocked = result.blockedBy?.map((key) => byId[key]?.name).filter(Boolean) || [];
      const direction = value < build.ratings[id] ? "lowering" : "changing";
      setToast(
        result.lockLimited && blocked.length
          ? `${blocked.join(", ")} ${plural(blocked.length, "is", "are")} locked and ${plural(blocked.length, "prevents", "prevent")} ${direction} ${byId[id].name}.`
          : result.budgetLimited
            ? "The overall budget limits this upgrade. Lower another rating to make room."
            : "A linked attribute cap limits this rating.",
      );
    }
    return result.build.ratings[id];
  }

  function minimizeRating(id) {
    showAttributeBadges(id);
    const result = minimizeAttribute(build, id, rules);
    if (!result.changed) {
      setToast(`${byId[id].name} is already at its lowest value with the current locks.`);
      return;
    }
    update(result.build);
    setToast(
      `${byId[id].name} minimized to ${result.build.ratings[id]}. Locked ratings stayed fixed.`,
    );
  }

  function minimizeBuild() {
    const result = minimizeUnlocked(build, rules);
    if (result.lockLimited) {
      setToast(
        "The locked ratings conflict with the active linked rules. Adjust a lock before minimizing.",
      );
      return;
    }
    if (!result.changed) {
      setToast("Unlocked attributes are already at their lowest legal values.");
      return;
    }
    const removed = attributes.reduce(
      (sum, a) => sum + build.ratings[a.id] - result.build.ratings[a.id],
      0,
    );
    update(result.build);
    setToast(`Removed ${removed} unused attribute points. Locked ratings stayed fixed.`);
  }

  function applyBody(body) {
    const result = changeBody(build, body);
    if (JSON.stringify(result.build) !== JSON.stringify(build)) update(result.build);
    const released = result.releasedLocks.length;
    if (released)
      setToast(
        `Body applied. Cleared ${released} conflicting ${plural(released, "lock", "locks")}.`,
      );
  }

  function breakerLimit(id) {
    return Math.min(
      capSequence(build, id)?.filter((n) => n > 0).length ?? 5,
      (caps[id] ?? 25) - build.ratings[id],
    );
  }

  function setBreakers(id, count) {
    update({ ...build, breakers: { ...build.breakers, [id]: clamp(count, 0, breakerLimit(id)) } });
  }

  function commitSave(next, replaceId = null) {
    const snapshot = {
      id: replaceId || crypto.randomUUID(),
      date: new Date().toISOString(),
      build: structuredClone(next),
    };
    setSaved((list) =>
      replaceId
        ? list.map((item) => (item.id === replaceId ? snapshot : item))
        : [snapshot, ...list].slice(0, MAX_SAVED),
    );
    setBuild(next);
    setComparison(structuredClone(next));
    setHistory([]);
    closeModal();
    setToast(replaceId ? "Saved build replaced." : "Build saved in this browser.");
  }

  function saveAs(name) {
    const next = { ...build, name };
    const duplicate = saved.find((item) => sameName(item.build.name, name));
    if (duplicate) openModal("overwrite", { replaceId: duplicate.id, next });
    else commitSave(next);
  }

  function renameSaved(id, name) {
    if (saved.some((item) => item.id !== id && sameName(item.build.name, name))) {
      setToast("A saved build already uses that name. Choose a different name.");
      return;
    }
    setSaved((list) =>
      list.map((item) => (item.id === id ? { ...item, build: { ...item.build, name } } : item)),
    );
    closeModal();
    setToast("Saved build renamed.");
  }

  function importBuild(text) {
    update(parseBuildLink(text));
    closeModal();
    setView("builder");
    setToast("Build imported. Body limits apply; Undo restores the previous draft.");
  }

  async function exportImage() {
    if (!exportRef.current || exportBusy) return;
    setExportBusy(true);
    try {
      await document.fonts.ready;
      const data = await toPng(exportRef.current, {
        pixelRatio: 1,
        backgroundColor: "#10171c",
        preferredFontFormat: "woff2",
      });
      const link = document.createElement("a");
      link.href = data;
      link.download = `build-lab-${exportFormat}.png`;
      link.click();
      setToast("Build image downloaded.");
    } catch {
      setToast("Image export failed. Your build is safe; try again or copy its link.");
    } finally {
      setExportBusy(false);
    }
  }

  const attributeActions = {
    showAttributeBadges,
    focusAttribute: setSelected,
    setLocks: (locks) => update({ ...build, locks }),
    setRating,
    minimizeRating,
    setBreakers,
    breakerLimit,
    selectBadge: setBadge,
  };

  return (
    <div className={`app-shell ${hoverSteppers ? "" : "always-steppers"} mode-${editorMode}`}>
      <TopBar
        view={view}
        onView={setView}
        savedCount={saved.length}
        spent={spent}
        onOpenModal={openModal}
        onSave={() => openModal("save", { name: build.name })}
      />
      {view === "builder" ? (
        <main className="workspace">
          <BuildEditor
            build={build}
            comparison={comparison}
            caps={caps}
            overall={overall}
            economy={economy}
            projection={projection}
            increaseCosts={increaseCosts}
            spent={spent}
            selected={selected}
            compare={compare}
            editorMode={editorMode}
            onEditorMode={setEditorMode}
            hoverSteppers={hoverSteppers}
            onHoverSteppers={setHoverSteppers}
            actions={attributeActions}
            onMinimizeBuild={minimizeBuild}
            onResetLocks={() => {
              update({ ...build, locks: {} });
              setToast("All attribute locks cleared.");
            }}
            onOpenModal={openModal}
            onRename={() => openModal("rename")}
            onCategory={(category) => {
              setTab("unlocks");
              setUnlocks({ type: "badges", category, query: "" });
            }}
          />
          <Inspector
            tab={tab}
            onTab={setTab}
            build={build}
            caps={caps}
            overall={overall}
            spent={spent}
            changes={changes}
            compare={compare}
            onShowComparison={() => setCompare(true)}
            unlocks={unlocks}
            setUnlocks={setUnlocks}
            badge={badge}
            onSelectBadge={setBadge}
            onSelectAttribute={showAttributeBadges}
          />
        </main>
      ) : (
        <SavedBuilds
          saved={saved}
          onBack={() => setView("builder")}
          onCompare={(snapshot) => {
            setComparison(structuredClone(snapshot.build));
            setView("builder");
            setTab("changes");
            setCompare(true);
            setToast(`Comparing your draft with ${snapshot.build.name}.`);
          }}
          onRename={(snapshot) =>
            openModal("rename-saved", { id: snapshot.id, name: snapshot.build.name })
          }
          onOpen={(snapshot) => {
            update(structuredClone(snapshot.build));
            setComparison(structuredClone(snapshot.build));
            setView("builder");
            setToast("Saved build loaded. Your previous draft is available with Undo.");
          }}
          onDelete={(snapshot) => openModal("delete", { id: snapshot.id })}
        />
      )}
      <BottomBar
        overall={overall}
        changeCount={changes.length}
        canUndo={history.length > 0}
        onUndo={undo}
        onRevert={() => openModal("revert")}
        onRules={() => openModal("rules")}
        compare={compare}
        onCompare={(next) => {
          setCompare(next);
          if (next) setTab("changes");
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={19} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === "save" && (
        <SaveModal initialName={modal.name} onSave={saveAs} onClose={closeModal} />
      )}
      {modal?.type === "overwrite" && (
        <Modal title="Replace saved build?" onClose={closeModal}>
          <p className="muted">
            A saved build already uses this name. Replace it with your current build, or go back and
            choose another name.
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => openModal("save", { name: modal.next.name })}
            >
              Choose another name
            </button>
            <button className="primary" onClick={() => commitSave(modal.next, modal.replaceId)}>
              Replace build
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "rename" && (
        <RenameModal
          title="Name your build"
          initialName={build.name}
          onRename={(name) => {
            update({ ...build, name });
            closeModal();
          }}
          onClose={closeModal}
        />
      )}
      {modal?.type === "rename-saved" && (
        <RenameModal
          title="Rename saved build"
          initialName={modal.name}
          onRename={(name) => renameSaved(modal.id, name)}
          onClose={closeModal}
          cancellable
        />
      )}
      {modal?.type === "share" && (
        <ShareModal
          shareUrl={shareUrl}
          exportFormat={exportFormat}
          onExportFormat={setExportFormat}
          exportBusy={exportBusy}
          onExport={exportImage}
          onImport={() => openModal("import")}
          onCopyFailed={() =>
            setToast("Copy unavailable. Select the link above and copy it manually.")
          }
          onClose={closeModal}
        />
      )}
      {modal?.type === "import" && <ImportModal onImport={importBuild} onClose={closeModal} />}
      {modal?.type === "reset" && (
        <ConfirmModal
          title="Reset all attributes?"
          confirmLabel="Reset attributes"
          onClose={closeModal}
          onConfirm={() => {
            update({
              ...build,
              ratings: Object.fromEntries(attributes.map((a) => [a.id, 25])),
              breakers: {},
              locks: {},
            });
            closeModal();
            setToast("All attributes and locks reset.");
          }}
        >
          Set every attribute to 25, clear cap breakers, and remove all rating locks. Your body
          settings and saved builds stay available. Undo restores this draft.
        </ConfirmModal>
      )}
      {modal?.type === "rules" && (
        <RulesModal
          violations={overall.violations}
          onApplyRules={() => {
            applyBody(build.body);
            closeModal();
          }}
          onClose={closeModal}
        />
      )}
      {modal?.type === "body" && (
        <Modal title="Body & badge potential" wide onClose={closeModal}>
          <BodyPlanner
            build={build}
            onCancel={closeModal}
            onApply={(body) => {
              applyBody(body);
              closeModal();
            }}
          />
        </Modal>
      )}
      {modal?.type === "caps" && (
        <CapsModal
          build={build}
          caps={caps}
          projection={projection}
          spent={spent}
          breakerLimit={breakerLimit}
          onChange={setBreakers}
          onSelectAttribute={showAttributeBadges}
          onClose={closeModal}
        />
      )}
      {modal?.type === "revert" && (
        <ConfirmModal
          title="Revert your changes?"
          cancelLabel="Keep editing"
          confirmLabel="Revert changes"
          onClose={closeModal}
          onConfirm={() => {
            update(structuredClone(comparison));
            closeModal();
          }}
        >
          Restore the build you are comparing against. You can undo this action.
        </ConfirmModal>
      )}
      {modal?.type === "delete" && (
        <ConfirmModal
          title="Delete saved build?"
          confirmLabel="Delete snapshot"
          confirmClass="danger-button"
          onClose={closeModal}
          onConfirm={() => {
            setSaved((list) => list.filter((item) => item.id !== modal.id));
            closeModal();
            setToast("Saved snapshot deleted.");
          }}
        >
          This removes the saved snapshot from this browser. Your current draft stays open.
        </ConfirmModal>
      )}
      <ExportCard ref={exportRef} build={build} format={exportFormat} />
    </div>
  );
}
