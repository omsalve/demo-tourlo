// Photoreal tower explorer: rendered stills with an SVG floor overlay.
// Same public API as the Three.js Tower in tower.js, so main.js can use either.
import { url, config } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Maps the unit square onto a quad (Heckbert's square to quad projection).
// Corners: tl (0,0), tr (1,0), br (1,1), bl (0,1). Exact for flat facades.
function squareToQuad({ tl, tr, br, bl }) {
  const [x0, y0] = tl;
  const [x1, y1] = tr;
  const [x2, y2] = br;
  const [x3, y3] = bl;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w];
  };
}

const ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

export class PhotoTower {
  constructor(container, data, { onFloorClick, onFloorHover, onReady } = {}) {
    this.data = data;
    this.floors = data.floors;
    this.W = data.width;
    this.H = data.height;
    this.onFloorClick = onFloorClick;
    this.onFloorHover = onFloorHover;
    this.defaultNight = true;
    this.night = true;
    this.viewIndex = 0;
    this.selectedFloor = null;
    this.filterMatches = null;
    this.availability = null;
    this.unit = null;
    this.inset = { right: 0, bottom: 0 };

    const stage = document.createElement('div');
    stage.className = 'photo-stage';
    stage.innerHTML = `
      <div class="photo-world">
        ${data.views
          .map(
            (v, i) => `<div class="photo-view${i === 0 ? ' is-active' : ''}" data-view="${i}">
              <img class="ph-dusk" alt="" decoding="async" ${i === 0 ? `src="${url(v.dusk)}" fetchpriority="high"` : ''}/>
              <img class="ph-day" alt="" decoding="async"/>
            </div>`
          )
          .join('')}
        <svg class="floor-overlay" viewBox="0 0 ${this.W} ${this.H}" preserveAspectRatio="xMidYMid slice" aria-label="Tower floors"></svg>
      </div>
      ${
        data.views.length > 1
          ? `<button class="photo-arrow prev" type="button" aria-label="Previous view">${ARROW_L}</button>
      <button class="photo-arrow next" type="button" aria-label="Next view">${ARROW_R}</button>
      <div class="photo-dots" aria-hidden="true">${data.views.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>`
          : ''
      }`;
    container.appendChild(stage);
    this.stage = stage;
    this.world = stage.querySelector('.photo-world');
    this.svg = stage.querySelector('.floor-overlay');

    stage.querySelector('.prev')?.addEventListener('click', () => this.rotate(-1));
    stage.querySelector('.next')?.addEventListener('click', () => this.rotate(1));
    this.bindPointer();
    this.buildFloors();

    const first = stage.querySelector('.photo-view .ph-dusk');
    const ready = () => {
      onReady?.();
      // Warm the cache for the other angles and the day versions once the hero is up.
      setTimeout(() => this.preloadAll(), 600);
    };
    if (first.complete && first.naturalWidth) setTimeout(ready, 0);
    else {
      first.addEventListener('load', ready, { once: true });
      first.addEventListener('error', ready, { once: true });
    }
  }

  get view() {
    return this.data.views[this.viewIndex];
  }

  // Loads what the visitor is likely to see next: this view in the other light, and the
  // neighbouring angles in the current light. Keeps the first load light on 4G.
  preloadAll() {
    const n = this.data.views.length;
    const i = this.viewIndex;
    this.load(i, !this.night);
    this.load((i + 1) % n, this.night);
    this.load((i - 1 + n) % n, this.night);
  }

  load(i, dusk) {
    const el = this.stage.querySelector(`.photo-view[data-view="${i}"]`);
    const img = el.querySelector(dusk ? '.ph-dusk' : '.ph-day');
    if (!img.getAttribute('src')) img.src = url(dusk ? this.data.views[i].dusk : this.data.views[i].day);
  }

  ensureLoaded(i) {
    this.load(i, this.night);
    setTimeout(() => this.preloadAll(), 400);
  }

  /* ---------- Floors ---------- */

  buildFloors() {
    const faces = this.view.faces.map(squareToQuad);
    const n = this.floors;
    const fmt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    this.floorCenters = new Map();
    let svg = '';
    for (let f = 1; f <= n; f++) {
      const vt = 1 - f / n;
      const vb = 1 - (f - 1) / n;
      let sumX = 0;
      let sumY = 0;
      const polys = faces
        .map((P) => {
          const pts = [P(0, vt), P(1, vt), P(1, vb), P(0, vb)];
          sumX += pts.reduce((s, p) => s + p[0], 0) / 4;
          sumY += pts.reduce((s, p) => s + p[1], 0) / 4;
          return `<polygon points="${pts.map(fmt).join(' ')}"/>`;
        })
        .join('');
      this.floorCenters.set(f, { x: sumX / faces.length, y: sumY / faces.length });
      svg += `<g class="floor" data-floor="${f}">${polys}</g>`;
    }
    svg += '<g class="unit-hl" aria-hidden="true"></g>';
    this.svg.innerHTML = svg;
    this.applyStates();
    this.drawUnit();
  }

  // The part of each visible facade that belongs to a unit, as [u0, u1] across the face.
  // Faces carry a compass "side" in tower-views.json (left face S, right face E here).
  // Type A: one home per side, so the whole face. Type B: two homes facing E and W; the
  // E home also wraps the half of the S face nearest the E corner, the W home the other half.
  unitSpans(unit) {
    return this.view.faces.map((face) => {
      if (unit.type !== 'B') return face.side === unit.facing ? [0, 1] : null;
      if (face.side === unit.facing) return [0, 1];
      if (face.side === 'S' || face.side === 'N') {
        // Which end of this face touches the E side depends on where the E face sits in the photo.
        const eIndex = this.view.faces.findIndex((f) => f.side === 'E');
        const myIndex = this.view.faces.indexOf(face);
        const eOnRight = eIndex > myIndex;
        const towardE = eOnRight ? [0.5, 1] : [0, 0.5];
        const towardW = eOnRight ? [0, 0.5] : [0.5, 1];
        return unit.facing === 'E' ? towardE : unit.facing === 'W' ? towardW : null;
      }
      return null;
    });
  }

  drawUnit() {
    const layer = this.svg.querySelector('.unit-hl');
    if (!layer) return;
    const u = this.unit;
    this.svg.classList.toggle('has-unit', !!u && this.unitSpans(u).some(Boolean));
    if (!u) {
      layer.innerHTML = '';
      return;
    }
    const n = this.floors;
    const vt = 1 - u.floor / n;
    const vb = 1 - (u.floor - 1) / n;
    const fmt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const spans = this.unitSpans(u);
    layer.innerHTML = this.view.faces
      .map((face, i) => {
        const span = spans[i];
        if (!span) return '';
        const P = squareToQuad(face);
        const pts = [P(span[0], vt), P(span[1], vt), P(span[1], vb), P(span[0], vb)];
        return `<polygon points="${pts.map(fmt).join(' ')}"/>`;
      })
      .join('');
  }

  applyStates() {
    const filtering = this.filterMatches instanceof Map;
    this.svg.classList.toggle('is-filtering', filtering);
    this.svg.querySelectorAll('.floor').forEach((g) => {
      const f = +g.dataset.floor;
      g.classList.toggle('is-selected', f === this.selectedFloor);
      g.classList.toggle('is-match', filtering && !!this.filterMatches.get(f));
      const av = this.availability?.get(f);
      g.classList.toggle('av-available', av === 'available');
      g.classList.toggle('av-held', av === 'held');
      g.classList.toggle('av-sold', av === 'sold');
    });
    this.svg.classList.toggle('show-availability', !!this.availability);
  }

  // Slow push in when the landing opens. Uses the CSS scale property so it stacks with the
  // translate and zoom transforms, and the floor overlay moves with the photo.
  playIntro() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.world.classList.add('is-intro');
    this.world.addEventListener('animationend', () => this.world.classList.remove('is-intro'), { once: true });
  }

  // A short sweep up the tower on load so visitors see the floors are interactive.
  sweep() {
    const groups = [...this.svg.querySelectorAll('.floor')];
    groups.forEach((g, i) => {
      setTimeout(() => {
        g.classList.add('is-sweep');
        setTimeout(() => g.classList.remove('is-sweep'), 420);
      }, 300 + i * 45);
    });
  }

  /* ---------- Interaction ---------- */

  bindPointer() {
    let down = null;
    const floorAt = (e) => e.target.closest?.('.floor');

    this.stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.photo-arrow')) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.stage.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const quick = performance.now() - down.t < 700;
      down = null;
      // Horizontal swipe rotates around the tower.
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        this.rotate(dx < 0 ? 1 : -1);
        return;
      }
      if (Math.hypot(dx, dy) > 10 || !quick) return;
      if (config.dev) this.logPoint(e);
      const g = floorAt(e);
      if (g) this.onFloorClick?.(+g.dataset.floor);
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const g = floorAt(e);
      const f = g ? +g.dataset.floor : null;
      if (f !== this.hoverFloor) {
        this.svg.querySelector('.floor.is-hover')?.classList.remove('is-hover');
        g?.classList.add('is-hover');
        this.hoverFloor = f;
        this.stage.style.cursor = f ? 'pointer' : '';
      }
      this.onFloorHover?.(f, e.clientX, e.clientY);
    });
    this.svg.addEventListener('pointerleave', () => {
      this.svg.querySelector('.floor.is-hover')?.classList.remove('is-hover');
      this.hoverFloor = null;
      this.onFloorHover?.(null);
    });
    window.addEventListener('keydown', (e) => {
      if (this.stage.offsetParent === null || e.target.closest?.('input, .sheet, .modal')) return;
      if (e.key === 'ArrowLeft') this.rotate(-1);
      if (e.key === 'ArrowRight') this.rotate(1);
    });
  }

  logPoint(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    const msg = `[${Math.round(p.x)}, ${Math.round(p.y)}]`;
    console.log(`[dev] view ${this.view.id} image point ${msg}`);
    navigator.clipboard?.writeText(msg).catch(() => {});
    window.dispatchEvent(new CustomEvent('toast', { detail: `View ${this.view.id}: ${msg}` }));
  }

  rotate(step) {
    const n = this.data.views.length;
    if (n < 2) return;
    this.showView((this.viewIndex + step + n) % n);
    this.onRotate?.(this.view.id);
  }

  showView(i) {
    this.viewIndex = i;
    this.ensureLoaded(i);
    this.stage.querySelectorAll('.photo-view').forEach((el, k) => el.classList.toggle('is-active', k === i));
    this.stage.querySelectorAll('.photo-dots span').forEach((el, k) => el.classList.toggle('on', k === i));
    this.buildFloors();
    this.applyInset();
  }

  /* ---------- Public API (matches tower.js) ---------- */

  setNight(on) {
    this.night = on;
    this.ensureLoaded(this.viewIndex);
    this.stage.classList.toggle('is-day', !on);
  }

  setFilterMatches(states) {
    this.filterMatches = states;
    this.applyStates();
  }

  selectFloor(floor) {
    this.selectedFloor = floor;
    if (!floor) this.unit = null;
    this.applyStates();
    this.drawUnit();
    this.applyInset();
  }

  // states: Map floor -> 'available' | 'held' | 'sold', or null to hide the colours.
  setAvailability(states) {
    this.availability = states;
    this.applyStates();
  }

  // Outlines one home on the facade. Returns false when it is on a side hidden in this photo.
  highlightUnit(unit) {
    this.unit = unit;
    this.drawUnit();
    return !unit || this.unitSpans(unit).some(Boolean);
  }

  setInset(right, bottom) {
    this.inset = { right, bottom };
    this.applyInset();
  }

  // Keeps the tower in the area not covered by panels, and zooms in on the selected floor.
  applyInset() {
    const { right, bottom } = this.inset;
    const sw = this.stage.clientWidth;
    const sh = this.stage.clientHeight;
    const cover = Math.max(sw / this.W, sh / this.H);
    const s = this.selectedFloor ? (sw < 900 ? 1.3 : 1.4) : 1;
    const c = this.selectedFloor ? this.floorCenters.get(this.selectedFloor) : { x: this.W / 2, y: this.H * 0.45 };
    // Where that point sits on screen before the zoom, and where we want it: the middle of the uncovered area.
    const px = (c.x - this.W / 2) * cover + sw / 2;
    const py = (c.y - this.H / 2) * cover + sh / 2;
    const targetX = this.selectedFloor ? (sw - right) / 2 : sw / 2 - right / 2;
    const targetY = bottom > 0 || this.selectedFloor ? (sh - bottom) / 2 : py;
    // The zoom scales around the stage centre; solve for the translate that lands the point on target.
    let tx = targetX - sw / 2 - (px - sw / 2) * s;
    let ty = targetY - sh / 2 - (py - sh / 2) * s;
    // Never pull the photo far enough to show an empty edge, except behind the panels.
    const spareX = ((s - 1) * sw) / 2;
    const spareY = ((s - 1) * sh) / 2;
    tx = Math.min(spareX, Math.max(-spareX - right, tx));
    ty = Math.min(spareY, Math.max(-spareY - bottom, ty));
    this.world.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s})`;
  }

  setActive() {}

  resize() {
    this.applyInset();
  }
}
