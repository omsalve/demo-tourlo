# CLAUDE.md

Project brief for Claude Code. Read this first on every session.

## What we are building

A lightweight, browser-based 360 real estate tour, a small-scale replica of the GHR Callisto tour (built by 360EYE in 3DVista Virtual Tour Pro). It is a prototype for **Tourlo** (tourlo.in), an immersive sales tool for real estate developers. Long term it should beat the reference on sales features: live inventory, unit picking, lead capture.

Reference tour: https://360eye.in/gallery/3d/GHRCallisto/index.html
Full decode of the reference (every menu, hotspot, file, pipeline): see `docs/reference-decode.md`.

## Stack

- Next.js 16 (App Router, plain JS, React 19), static export (`output: 'export'`)
- Photo Sphere Viewer 5.15.1 (`@photo-sphere-viewer/*`) on three.js 0.185.1
- Panoramas load as tiled cubemaps (`cubemap-tiles-adapter`): a 512 px base, then 1024 and 2048 px tiles stream in as you look around
- Plugins in use: markers, autorotate. Planned: virtual-tour, map (floorplan minimap), gallery
- Static output (`npm run build` produces `out/`), deployable to Netlify / Vercel / S3
- PSV touches the DOM, so the viewer lives in a client component and PSV is imported inside `useEffect`
- Sub-path hosting: build with `NEXT_PUBLIC_BASE_PATH=/your-path`

Keep all PSV packages on the same exact version. Check `three` matches PSV's dependency before upgrading.

## Commands

```
npm install
npm run fetch:panos      # downloads 70 test panoramas (thumbnail + cube tiles up to 2048 px/face, about 300 MB)
npm run dev              # local dev server (http://localhost:3000)
npm run build            # static production build into out/
npm run preview          # serve out/ on http://localhost:4173
```

## Layout

```
data/ghr_callisto_pano_links.csv   source list of 70 panoramas (direct URLs)
scripts/fetch_panos.py             downloader (stdlib Python, retries, skips existing)
public/data/tour.json              scene graph the viewer reads (edit this, not Tour.jsx, to add scenes)
public/assets/panos/               downloaded panoramas (gitignored)
src/app/layout.js                  root layout, page title, global CSS imports
src/app/page.js                    renders <Tour />
src/components/Tour.jsx            viewer + UI logic (client component)
src/style.css                      UI styles
next.config.mjs                    static export + optional basePath
docs/                              reference decode, notes
```

## Data model (`public/data/tour.json`)

- `project`: name, contact, location (placeholders now)
- `categories`: top menu order
- `scenes[]`: `{ id, category, name, thumb, tiles }`. `id` = `<nn>_<slug>`, matches the file name. `thumb` is the 724x362 menu image; `tiles` is the folder holding `<face>/<level>/<row>_<col>.jpg` (faces f b l r u d, levels 0/1/2 = 512/1024/2048 px)
- `statusPairs[]`: Current vs Future pairs of the same drone view. `current` / `future` hold scene ids. `verified: false` means the roles are a guess: confirm by looking at both images (the "future" one has the CGI towers composited in) and set `verified: true`
- `startScene`: scene id loaded first

Future fields to add, in this order: `scene.hotspots[]` (yaw, pitch, target or info), `scene.info` (room size label), `floorplans[]` with per-scene x/y, `units[]` for inventory.

## Asset rules (important)

- The 70 panoramas belong to GHR Infra / 360EYE. **Internal testing only.** Never commit them, never deploy them publicly, never show them to a client.
- `public/assets/panos/` must stay in `.gitignore`. Repo stays private.
- For anything public, swap in our own captures or CC0 assets (Poly Haven HDRIs: https://polyhaven.com/hdris).

## Done so far (v0.1)

- Full-screen viewer, smooth transitions between scenes
- Top category menu with thumbnail dropdowns (Aerial, Ground, Balcony, Flat, Office)
- Title + category subtitle per scene
- Current / Future toggle on paired aerial scenes
- Bottom bar: Contact panel, Location panel, Share (copies deep link), Auto-rotate
- Deep links: `#scene=<id>`
- Mobile layout (menus move to the bottom)
- "Run fetch:panos" message if files are missing

## Roadmap (do these in order, one PR each)

1. **Verify status pairs**: view each Aerial pair, set `current` / `future` / `verified` in tour.json.
2. **Navigation hotspots**: switch to the Virtual Tour plugin. Add links between Flat rooms (Drawing Room to Master Bedroom, etc.). Positions (yaw/pitch) set by eye; add a dev-only "click to log yaw/pitch" helper to speed this up.
3. **Info hotspots**: room name + dimensions as markers (e.g. "Drawing Room 11'5\" x 12'0\"").
4. **Floorplan minimap**: Map plugin with a floorplan image, dot per scene, heading cone, click to jump.
5. **Photo + video gallery**: lightbox with tabs.
6. **Brochure / RERA**: PDF popup viewer.
7. **Help overlay**: first-visit coach marks explaining each UI zone.
8. **Tourlo features (beyond the reference)**:
   - Tower stacking plan: click a unit, see its balcony view, plan, price, status
   - Lead capture gated on brochure download / price reveal
   - Dated construction progress timeline instead of one "Current" shot
   - Analytics events per scene and per unit

## Conventions

- Plain, readable JS. Small functions. No new dependencies without a reason in the PR description.
- Content lives in `tour.json`; code reads data, never hard-codes scene names.
- UI copy: short, plain English. Do not use em dashes or en dashes in any UI text or docs.
- Test on a 390px-wide mobile viewport and a desktop viewport before calling a UI task done.
- Commit messages: imperative, one line summary, e.g. `Add floorplan minimap`.
