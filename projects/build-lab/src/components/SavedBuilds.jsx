import {
  ArrowRight,
  ArrowUUpLeft,
  Basketball,
  FolderOpen,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { formatHeight } from "../data";

/** The saved-builds library page. */
export function SavedBuilds({ saved, onBack, onCompare, onRename, onOpen, onDelete }) {
  return (
    <main className="saved-page">
      <div className="saved-heading">
        <div>
          <span className="eyebrow">YOUR PLAYBOOK</span>
          <h1>Saved builds</h1>
          <p>Keep your ideas. Compare the details. Find your build.</p>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowUUpLeft size={18} />
          Back to builder
        </button>
      </div>
      {saved.length ? (
        <div className="saved-list">
          {saved.map((snapshot) => {
            const { build } = snapshot;
            return (
              <article key={snapshot.id}>
                <div className="saved-build-icon">
                  <Basketball size={26} />
                </div>
                <div className="saved-info">
                  <h2>{build.name}</h2>
                  <p>
                    {build.body.position} · {formatHeight(build.body.height)} · {build.body.weight}{" "}
                    lbs · {formatHeight(build.body.wingspan)} wingspan
                  </p>
                  <small>
                    {new Date(snapshot.date).toLocaleDateString()} · Saved in this browser
                  </small>
                </div>
                <button className="secondary" onClick={() => onCompare(snapshot)}>
                  Compare
                </button>
                <button
                  className="secondary"
                  aria-label={`Rename ${build.name}`}
                  onClick={() => onRename(snapshot)}
                >
                  <PencilSimple size={17} />
                  Rename
                </button>
                <button className="primary" onClick={() => onOpen(snapshot)}>
                  Open <FolderOpen size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${build.name}`}
                  onClick={() => onDelete(snapshot)}
                >
                  <Trash size={18} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state library-empty">
          <FolderOpen size={50} weight="thin" />
          <h2>Your next build starts here.</h2>
          <p>Save your first build to return to it or compare new ideas.</p>
          <button className="primary" onClick={onBack}>
            Open builder <ArrowRight size={18} />
          </button>
        </div>
      )}
    </main>
  );
}
