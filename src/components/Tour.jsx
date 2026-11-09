'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Set NEXT_PUBLIC_BASE_PATH (e.g. "/tour") when hosting under a sub-path.
const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`;

// Current/Future pairs: map each scene id to its partner + its role.
function buildPairs(statusPairs = []) {
  const pairOf = {};
  for (const p of statusPairs) {
    const current = p.current ?? p.a;
    const future = p.future ?? p.b;
    pairOf[current] = { other: future, role: 'current' };
    pairOf[future] = { other: current, role: 'future' };
  }
  return pairOf;
}

export default function Tour() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  const [tour, setTour] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  const [missing, setMissing] = useState(false);

  const scenesById = useMemo(
    () => Object.fromEntries((tour?.scenes ?? []).map((s) => [s.id, s])),
    [tour],
  );
  const pairOf = useMemo(() => buildPairs(tour?.statusPairs), [tour]);

  // Load tour.json, then create the viewer (browser only).
  useEffect(() => {
    let cancelled = false;
    let viewer;

    (async () => {
      const data = await fetch(`${BASE}data/tour.json`).then((r) => r.json());
      const [{ Viewer }, { MarkersPlugin }, { AutorotatePlugin }] = await Promise.all([
        import('@photo-sphere-viewer/core'),
        import('@photo-sphere-viewer/markers-plugin'),
        import('@photo-sphere-viewer/autorotate-plugin'),
      ]);
      if (cancelled) return;

      const byId = Object.fromEntries(data.scenes.map((s) => [s.id, s]));
      const hashId = new URLSearchParams(location.hash.slice(1)).get('scene');
      const startId = byId[hashId] ? hashId : data.startScene;

      viewer = new Viewer({
        container: containerRef.current,
        panorama: `${BASE}${byId[startId].panorama}`,
        defaultZoomLvl: 0,
        navbar: ['zoom', 'fullscreen'],
        plugins: [
          MarkersPlugin, // hotspots go here next (see CLAUDE.md roadmap)
          [AutorotatePlugin, { autostartDelay: null, autorotateSpeed: '1rpm' }],
        ],
      });
      viewer.addEventListener('panorama-error', () => setMissing(true));
      viewer.addEventListener('panorama-loaded', () => setMissing(false));

      viewerRef.current = viewer;
      setTour(data);
      setCurrentId(startId);
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Close any open dropdown when clicking outside the category menu.
  useEffect(() => {
    const onClick = (e) => {
      if (!e.target.closest('.cat')) setOpenCat(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  function goTo(id) {
    const scene = scenesById[id];
    if (!scene || !viewerRef.current) return;
    setCurrentId(id);
    viewerRef.current.setPanorama(`${BASE}${scene.panorama}`, { transition: 800, showLoader: false });
    history.replaceState(null, '', `#scene=${id}`);
    setActiveCat(scene.category);
  }

  const scene = scenesById[currentId];
  const pair = pairOf[currentId];

  return (
    <>
      <div id="viewer" ref={containerRef} />

      <header className="ui-title">
        <h1 id="scene-title">{scene ? scene.name : 'Loading'}</h1>
        <p id="scene-sub">{scene ? scene.category : ''}</p>
        <button id="status-toggle" className="pill" hidden={!pair} onClick={() => pair && goTo(pair.other)}>
          {pair ? (pair.role === 'future' ? 'Show current site' : 'Show future project') : ''}
        </button>
      </header>

      <nav className="ui-top" id="category-menu" aria-label="Scene categories">
        {tour?.categories.map((cat) => (
          <div key={cat} className={openCat === cat ? 'cat open' : 'cat'}>
            <button
              className={activeCat === cat ? 'cat-btn active' : 'cat-btn'}
              data-cat={cat}
              onClick={() => setOpenCat((open) => (open === cat ? null : cat))}
            >
              {cat}
            </button>
            <div className="dropdown">
              {tour.scenes
                .filter((s) => s.category === cat)
                .map((s) => (
                  <button
                    key={s.id}
                    className="thumb"
                    onClick={() => {
                      goTo(s.id);
                      setOpenCat(null);
                    }}
                  >
                    <img src={`${BASE}${s.panorama}`} alt="" loading="lazy" />
                    <span>{s.name}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="missing" id="missing" hidden={!missing}>
        Panorama files not found. Run <code>npm run fetch:panos</code> first.
      </div>
    </>
  );
}
