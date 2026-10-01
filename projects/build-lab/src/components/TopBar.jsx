import { CaretDown, FloppyDisk, ShareNetwork } from "@phosphor-icons/react";

export function TopBar({ view, onView, savedCount, spent, onOpenModal, onSave }) {
  return (
    <header className="topbar">
      <a
        className="wordmark"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onView("builder");
        }}
      >
        BUILD LAB
      </a>
      <span className="game-label">
        NBA <b>2K27</b>
      </span>
      <nav aria-label="Main navigation">
        <button className={view === "builder" ? "active" : ""} onClick={() => onView("builder")}>
          Builder
        </button>
        <button className={view === "saved" ? "active" : ""} onClick={() => onView("saved")}>
          Saved builds{savedCount > 0 && <span className="nav-count">{savedCount}</span>}
        </button>
        <button className="mobile-nav-action" onClick={() => onOpenModal("caps")}>
          Cap breakers
        </button>
        <button className="mobile-nav-action" onClick={() => onOpenModal("share")}>
          Share
        </button>
      </nav>
      <div className="header-actions">
        <button className="cap-button" onClick={() => onOpenModal("caps")}>
          Cap breakers <span className="count">{spent}</span>
          <CaretDown size={14} />
        </button>
        <button
          className="icon-button share-top"
          aria-label="Share build"
          onClick={() => onOpenModal("share")}
        >
          <ShareNetwork size={20} />
        </button>
        <button className="primary save-button" onClick={onSave}>
          Save build <FloppyDisk size={20} />
        </button>
      </div>
    </header>
  );
}
