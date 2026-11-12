import DemoClient from './demo-client';

// Static shell. lib/main.js finds these elements by id and drives everything
// from there, so ids and classes here must stay in sync with lib/*.js.
export default function Page() {
  return (
    <>
      <div id="app">
        <canvas id="tower-canvas" aria-label="3D model of the tower. Drag to orbit, tap a floor to see inventory." />
        <div id="tower-labels" aria-hidden="false" />

        <header className="topbar">
          <div className="brand">
            <span className="wordmark">Tourlo</span>
            <span className="project">Demo Residences, Mumbai</span>
          </div>
          <a className="btn btn-gold btn-sm cta-book" data-cta="topbar" target="_blank" rel="noopener">
            Book a full live demo
          </a>
        </header>

        <div className="floor-tip" id="floor-tip" hidden />

        <div className="bottom-controls">
          <button className="pill-btn" id="btn-filters" type="button" aria-haspopup="dialog" aria-label="Filters">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <span>Filters</span>
            <span className="badge" id="filter-count" hidden>
              0
            </span>
          </button>
          <div className="hint" id="hint">
            <span className="hint-main">Tap a floor to see live inventory</span>
            <span className="hint-sub" id="hint-sub" />
          </div>
          <button className="pill-btn icon-only" id="btn-daynight" type="button" aria-pressed="false" aria-label="Switch to night view">
            <svg className="ico-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
            </svg>
            <svg className="ico-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
        </div>

        <aside className="sheet" id="panel" role="dialog" aria-modal="false" aria-labelledby="panel-title" hidden>
          <button className="sheet-handle" id="panel-handle" type="button" aria-label="Expand or collapse panel">
            <span />
          </button>
          <div className="sheet-inner" id="panel-body" />
        </aside>

        <aside className="sheet sheet-filters" id="filters" role="dialog" aria-modal="false" aria-labelledby="filters-title" hidden>
          <button className="sheet-handle" type="button" data-close-filters="" aria-label="Close filters">
            <span />
          </button>
          <div className="sheet-inner" id="filters-body" />
        </aside>

        <div className="loader-screen" id="boot-loader">
          <span className="wordmark">Tourlo</span>
          <div className="bar">
            <span />
          </div>
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
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                <path d="M3 9c-1 2-1 4 0 6M21 9c1 2 1 4 0 6" />
              </svg>
            </button>
            <button className="pill-btn icon-only" id="btn-viewer-close" type="button" aria-label="Close 360 view">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="viewer-loader" id="viewer-loader" hidden>
          <span className="spinner" />
          <span>Loading view</span>
        </div>
        <div className="viewer-hint" id="viewer-hint">
          Drag to look around
        </div>
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
          <span className="eyebrow">Tourlo sales gallery</span>
          <h2 id="final-title">Imagine this for your project</h2>
          <p>
            You just walked through a live tower, real time inventory and 360 homes. In a full live demo we show how your sales team
            runs site visits, shares units with buyers and tracks every lead.
          </p>
          <a className="btn btn-gold btn-block cta-book" data-cta="final_card" target="_blank" rel="noopener">
            Book a full live demo
          </a>
          <button className="btn btn-ghost btn-block" type="button" id="final-close">
            Keep exploring
          </button>
        </div>
      </div>

      <div className="lightbox" id="lightbox" hidden>
        {/* src is set at runtime by lib/main.js */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="lightbox-img" alt="View from the balcony" />
        <button className="pill-btn icon-only lightbox-close" id="lightbox-close" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="toast" id="toast" role="status" aria-live="polite" />

      <DemoClient />
    </>
  );
}
