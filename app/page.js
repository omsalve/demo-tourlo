import DemoBoot from './demo-boot.js';

// Static shell for the sales gallery. lib/demo/main.js finds these elements by id and owns
// them after boot, so this component must stay free of state and never re-render.
export default function Page() {
  return (
    <>
      <div id="app">
        <canvas id="tower-canvas" aria-label="3D model of the tower. Drag to orbit, tap a floor to see inventory." />
        <div id="tower-labels" aria-hidden="false" />

        <header className="topbar">
          <div className="brand">
            <span className="wordmark">
              Tourlo <span className="brand-residences">Demo Residences</span>
            </span>
            <span className="project">Mumbai · A new perspective on home</span>
          </div>
          <nav className="header-nav" aria-label="Explore the residences">
            <button id="btn-guide">Guided visit</button>
            <button id="btn-residences">Residences</button>
            <button id="btn-saved">
              Saved homes <span id="saved-count">0</span>
            </button>
            <a className="btn btn-gold btn-sm cta-book" data-cta="topbar">Enquire</a>
          </nav>
        </header>

        <div className="floor-tip" id="floor-tip" hidden />

        <div className="bottom-controls">
          <button className="pill-btn" id="btn-filters" type="button" aria-haspopup="dialog" aria-label="Filters">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span>Filters</span>
            <span className="badge" id="filter-count" hidden>0</span>
          </button>
          <div className="hint" id="hint">
            <span className="hint-main">Tap a floor to explore</span>
            <span className="hint-sub" id="hint-sub" />
            <span id="inventory-status">Sample availability</span>
          </div>
          <button className="pill-btn icon-only" id="btn-daynight" type="button" aria-pressed="false" aria-label="Switch to night view">
            <svg className="ico-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
            <svg className="ico-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
        </div>

        <aside className="sheet" id="panel" role="dialog" aria-modal="false" aria-labelledby="panel-title" hidden>
          <button className="sheet-handle" id="panel-handle" type="button" aria-label="Expand or collapse panel"><span /></button>
          <div className="sheet-inner" id="panel-body" />
        </aside>

        <aside className="sheet sheet-filters" id="filters" role="dialog" aria-modal="false" aria-labelledby="filters-title" hidden>
          <button className="sheet-handle" type="button" data-close-filters="" aria-label="Close filters"><span /></button>
          <div className="sheet-inner" id="filters-body" />
        </aside>

        <div className="loader-screen" id="boot-loader">
          <span className="wordmark">Tourlo</span>
          <div className="bar"><span /></div>
        </div>
      </div>

      <section className="viewer" id="viewer" hidden aria-label="360 view">
        <canvas id="viewer-canvas" />
        <div className="viewer-hotspots" id="viewer-hotspots" />
        <div className="viewer-fade" id="viewer-fade" />
        <div className="viewer-top">
          <div className="viewer-title">
            <span className="eyebrow" id="viewer-tour" />
            <span className="room" id="viewer-room" />
          </div>
          <div className="viewer-actions">
            <button className="pill-btn icon-only" id="btn-gyro" type="button" hidden aria-pressed="false" aria-label="Use motion to look around">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M3 9c-1 2-1 4 0 6M21 9c1 2 1 4 0 6" /></svg>
            </button>
            <button className="pill-btn icon-only" id="btn-viewer-close" type="button" aria-label="Close 360 view">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <div className="viewer-loader" id="viewer-loader" hidden><span className="spinner" /><span>Loading view</span></div>
        <div className="viewer-hint" id="viewer-hint">Drag to look around</div>
        <div className="viewer-bottom">
          <div className="rooms" id="viewer-rooms" role="tablist" />
        </div>
        <div className="dev-readout" id="dev-readout" hidden />
      </section>

      <div className="modal" id="lead-modal" hidden role="dialog" aria-modal="true" aria-labelledby="lead-title">
        <div className="modal-card">
          <div id="lead-content" />
        </div>
      </div>

      <div className="modal" id="final-modal" hidden role="dialog" aria-modal="true" aria-labelledby="final-title">
        <div className="modal-card final-card">
          <span className="eyebrow">Tourlo Demo Residences</span>
          <h2 id="final-title">Could this be your next address?</h2>
          <p>Explore another home, build your shortlist or leave your details to speak with our team.</p>
          <a className="btn btn-gold btn-block cta-book" data-cta="final_card">Enquire about a residence</a>
          <button className="btn btn-ghost btn-block" type="button" id="final-close">Keep exploring</button>
        </div>
      </div>

      <div className="lightbox" id="lightbox" hidden>
        {/* src is set by main.js when the balcony view opens. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="lightbox-img" alt="Representative neighbourhood outlook" />
        <p className="view-caption">Representative outlook. Actual views vary by floor and facing.</p>
        <button className="pill-btn icon-only lightbox-close" id="lightbox-close" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="toast" id="toast" role="status" aria-live="polite" />

      <DemoBoot />
    </>
  );
}
