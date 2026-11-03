import { config, url } from './config.js';
import { session } from './storage.js';
import { initAnalytics, track, trackTimeSpent } from './analytics.js';
import { inr, sqft, FACING, STATUS, ordinal, esc } from './format.js';
import { planFor, floorplate } from './plans.js';
import { costSheetHTML } from './cost.js';
import { LeadGate } from './lead.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');

const ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  pano: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9.5" ry="4.5"/><path d="M12 2.5v19"/><circle cx="12" cy="12" r="9.5"/></svg>',
  view: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/></svg>',
};

const state = {
  inventory: null,
  tours: null,
  byFloor: new Map(),
  floor: null,
  unit: null,
  filters: { bhk: null, status: new Set(), facing: new Set(), price: null },
  priceBounds: [0, 0],
  balcony: false,
  roomsSeen: new Set(),
  night: false,
};

let tower;
let viewer;
let lead;

/* ---------------- Boot ---------------- */

async function boot() {
  initAnalytics();
  setupCTAs();
  setupToast();

  lead = new LeadGate({
    getContext: () => ({ lastFloor: state.floor, lastUnit: state.unit?.unit || null, roomsViewed: [...state.roomsSeen] }),
  });
  trackTimeSpent(() => lead.activeSeconds);

  let inventory;
  let hotspots;
  try {
    [inventory, hotspots] = await Promise.all([
      fetch(url('data/inventory.json')).then((r) => r.json()),
      fetch(url('data/hotspots.json')).then((r) => r.json()),
    ]);
  } catch (e) {
    console.error(e);
    $('#boot-loader').innerHTML = '<span class="wordmark">Tourlo</span><p class="error-note">We could not load the project data. Please refresh the page.</p>';
    return;
  }
  state.inventory = inventory;
  state.tours = hotspots.tours;
  for (const [id, t] of Object.entries(state.tours)) t.id = id;
  for (const u of inventory.units) {
    if (!state.byFloor.has(u.floor)) state.byFloor.set(u.floor, []);
    state.byFloor.get(u.floor).push(u);
  }
  const prices = inventory.units.map((u) => u.price);
  const step = 2500000;
  state.priceBounds = [Math.floor(Math.min(...prices) / step) * step, Math.ceil(Math.max(...prices) / step) * step];
  updateHint();
  checkBalcony();

  try {
    tower = await createTower();
  } catch (e) {
    console.error(e);
    $('#boot-loader').innerHTML = '<span class="wordmark">Tourlo</span><p class="error-note">This device could not start the tower view. Please try a recent version of Chrome or Safari.</p>';
    return;
  }
  setupSiteNav();
  setupIntro();
  setupDayNight();
  setupPanel();
  setupFilters();

  window.addEventListener('resize', () => {
    tower.resize();
    updateInset();
  });

  if (!state.photo) hideBootLoader();
}

function hideBootLoader() {
  const el = $('#boot-loader');
  if (!el) return;
  requestAnimationFrame(() => {
    el.classList.add('is-done');
    setTimeout(() => el.remove(), 700);
  });
}

// Photoreal stills by default; the Three.js massing model with ?view=3d or if the stills cannot load.
async function createTower() {
  const handlers = {
    onFloorClick: (f) => lead.guard(() => openFloor(f, 'tower')) && openFloor(f, 'tower'),
    onFloorHover: showFloorTip,
  };
  const want3d = new URLSearchParams(location.search).get('view') === '3d';
  if (!want3d) {
    try {
      const views = await fetch(url('data/tower-views.json')).then((r) => r.json());
      const { PhotoTower } = await import('./photo-tower.js');
      state.photo = true;
      $('#tower-canvas').hidden = true;
      const t = new PhotoTower(app, views, {
        ...handlers,
        onReady: () => {
          hideBootLoader();
          setTimeout(() => t.sweep(), 500);
        },
      });
      app.insertBefore(t.stage, $('#tower-labels'));
      t.onRotate = (view) => track('view_rotate', { view });
      setNight(t.defaultNight);
      return t;
    } catch (e) {
      console.warn('Photo tower unavailable, falling back to 3D', e);
      state.photo = false;
      $('#tower-canvas').hidden = false;
    }
  }
  const { Tower } = await import('./tower.js');
  const t = new Tower($('#tower-canvas'), { ...handlers, onAmenityPosition: placeAmenity });
  setupAmenityHotspot();
  return t;
}

/* ---------------- CTA, toast ---------------- */

function setupCTAs() {
  document.querySelectorAll('.cta-book').forEach((a) => {
    a.href = config.bookingUrl;
    a.addEventListener('click', () => track('book_demo_click', { location: a.dataset.cta }));
  });
  $('#final-close').addEventListener('click', () => ($('#final-modal').hidden = true));
  $('#final-modal').addEventListener('click', (e) => {
    if (e.target.id === 'final-modal') e.currentTarget.hidden = true;
  });
}

function setupToast() {
  const el = $('#toast');
  let t;
  window.addEventListener('toast', (e) => {
    el.textContent = e.detail;
    el.classList.add('is-on');
    clearTimeout(t);
    t = setTimeout(() => el.classList.remove('is-on'), 2600);
  });
}

const toast = (msg) => window.dispatchEvent(new CustomEvent('toast', { detail: msg }));

/* ---------------- Tower overlays ---------------- */

function setupAmenityHotspot() {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'amenity-hotspot';
  el.innerHTML = `<span class="dot">${ICON.leaf}</span><span>Landscaped Garden</span>`;
  el.addEventListener('click', () => openTour('site', 'ext_podium'));
  $('#tower-labels').appendChild(el);
  state.amenityEl = el;
}

function placeAmenity(x, y, visible) {
  const el = state.amenityEl;
  if (!el) return;
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  el.style.opacity = visible ? '1' : '0';
  el.style.pointerEvents = visible ? 'auto' : 'none';
}

function showFloorTip(floor, x, y) {
  const tip = $('#floor-tip');
  if (!floor) {
    tip.hidden = true;
    return;
  }
  const units = state.byFloor.get(floor) || [];
  const avail = units.filter((u) => u.status === 'available').length;
  tip.innerHTML = `<strong>Floor ${floor}</strong> · ${units[0]?.bhk} BHK · ${avail} of ${units.length} available`;
  tip.style.transform = `translate(${x + 14}px, ${y}px) translateY(-50%)`;
  tip.hidden = false;
}

function setupDayNight() {
  $('#btn-daynight').addEventListener('click', () => {
    setNight(!state.night);
    toast(state.night ? 'Night view' : 'Day view');
  });
}

function setNight(on) {
  const btn = $('#btn-daynight');
  state.night = on;
  app.classList.toggle('is-night', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Switch to day view' : 'Switch to night view');
  tower?.setNight(on);
}

const SITE_STOPS = [
  ['ext_plaza', 'Arrival plaza'],
  ['ext_lobby', 'Lobby'],
  ['ext_podium', 'Podium garden'],
  ['ext_rooftop', 'Rooftop'],
  ['ext_aerial', 'Aerial view'],
  ['ext_station', 'Metro station'],
];

function setupSiteNav() {
  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Walk the site');
  nav.innerHTML = `<span class="site-nav-label">Walk the site</span>${SITE_STOPS.map(
    ([id, label]) => `<button type="button" class="site-chip" data-room="${id}">${ICON.pano}${label}</button>`
  ).join('')}`;
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-room]');
    if (b) openTour('site', b.dataset.room);
  });
  $('.bottom-controls').before(nav);
}

function setupIntro() {
  if (!state.photo || session.get('tourlo_intro_seen') === '1') return;
  const el = document.createElement('section');
  el.className = 'intro-card';
  el.innerHTML = `
    <span class="eyebrow">Tourlo Demo Residences, Mumbai</span>
    <h1>24 storeys of light, greenery and city views</h1>
    <p>3 BHK residences and 4 BHK sky villas beside the metro. Tap any floor to see live availability, or walk the site in 360.</p>
    <div class="intro-actions">
      <button class="btn btn-gold" type="button" data-intro="explore">Explore the tower</button>
      <button class="btn btn-ghost" type="button" data-intro="walk">Walk the site</button>
    </div>`;
  const close = () => {
    session.set('tourlo_intro_seen', '1');
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 400);
  };
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-intro]')?.dataset.intro;
    if (!a) return;
    close();
    if (a === 'explore') tower.sweep?.();
    if (a === 'walk') openTour('site', 'ext_plaza');
  });
  app.querySelector('.photo-stage')?.addEventListener('pointerdown', close, { once: true });
  app.appendChild(el);
}

function updateHint() {
  const units = state.inventory.units;
  const avail = units.filter((u) => u.status === 'available').length;
  $('#hint-sub').textContent = `${avail} of ${units.length} homes available`;
}

async function checkBalcony() {
  try {
    const res = await fetch(url('assets/views/balcony_view.jpg'), { method: 'HEAD' });
    state.balcony = res.ok && (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    state.balcony = false;
  }
}

/* ---------------- Sheets ---------------- */

const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

function openSheet(el) {
  if (!el.hidden) return;
  el.hidden = false;
  el.classList.add('is-entering');
  el.getBoundingClientRect();
  requestAnimationFrame(() => el.classList.remove('is-entering'));
  app.classList.add('has-sheet');
  updateInset();
}

function closeSheet(el) {
  if (el.hidden) return;
  el.classList.add('is-entering');
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('is-entering', 'is-expanded');
    if ($('#panel').hidden && $('#filters').hidden) app.classList.remove('has-sheet');
    updateInset();
  }, 300);
  if (el.id === 'panel') {
    state.floor = null;
    state.unit = null;
    tower.selectFloor(null);
  }
  updateInset(el);
}

function updateInset(closing) {
  if (!tower) return;
  const panel = $('#panel');
  const filters = $('#filters');
  const open = (el) => !el.hidden && el !== closing;
  if (isDesktop()) {
    const right = open(panel) ? panel.offsetWidth + 16 : 0;
    const left = open(filters) ? filters.offsetWidth + 16 : 0;
    tower.setInset(right - left, 0);
  } else {
    const sheet = open(panel) ? panel : open(filters) ? filters : null;
    tower.setInset(0, sheet ? Math.min(sheet.offsetHeight, window.innerHeight * 0.62) : 0);
  }
}

function setupPanel() {
  const panel = $('#panel');
  const handle = $('#panel-handle');
  bindSheetDrag(handle, panel);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !$('#viewer').hidden || !$('#lead-modal').hidden) return;
    if (!$('#lightbox').hidden) return closeLightbox();
    if (!$('#filters').hidden) return closeSheet($('#filters'));
    if (state.unit) return openFloor(state.floor);
    closeSheet(panel);
  });
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'close') closeSheet(panel);
    if (a === 'floor-up') guarded(() => openFloor(Math.min(24, state.floor + 1), 'stepper'));
    if (a === 'floor-down') guarded(() => openFloor(Math.max(1, state.floor - 1), 'stepper'));
    if (a === 'unit') guarded(() => openUnit(t.dataset.unit));
    if (a === 'back') openFloor(state.floor);
    if (a === 'step-inside') openTour(state.unit.type === 'B' ? 'typeB' : 'typeA');
    if (a === 'balcony') openLightbox();
  });
  panel.addEventListener('keydown', (e) => {
    const g = e.target.closest('.floorplate .u');
    if (g && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      guarded(() => openUnit(g.dataset.unit));
    }
  });
  panel.addEventListener('click', (e) => {
    const g = e.target.closest('.floorplate .u');
    if (g) guarded(() => openUnit(g.dataset.unit));
  });
}

// Runs fn now, or after the lead form is completed when the gate is active.
function guarded(fn) {
  if (lead.guard(fn)) fn();
}

function bindSheetDrag(handle, sheet) {
  let start = null;
  handle.addEventListener('pointerdown', (e) => {
    start = { y: e.clientY };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dy = e.clientY - start.y;
    start = null;
    if (dy > 60) {
      if (sheet.classList.contains('is-expanded')) sheet.classList.remove('is-expanded');
      else closeSheet(sheet);
    } else if (dy < -40) sheet.classList.add('is-expanded');
    else if (Math.abs(dy) < 6) sheet.classList.toggle('is-expanded');
    setTimeout(() => updateInset(), 360);
  });
}

/* ---------------- Floor panel ---------------- */

function matches(u) {
  const f = state.filters;
  if (f.bhk && u.bhk !== f.bhk) return false;
  if (f.status.size && !f.status.has(u.status)) return false;
  if (f.facing.size && !f.facing.has(u.facing)) return false;
  if (f.price && (u.price < f.price[0] || u.price > f.price[1])) return false;
  return true;
}

const filtersActive = () => {
  const f = state.filters;
  return !!(f.bhk || f.status.size || f.facing.size || f.price);
};

function openFloor(floor, source) {
  const units = state.byFloor.get(floor);
  if (!units) return;
  if (source) track('floor_click', { floor, source });
  state.floor = floor;
  state.unit = null;
  tower.selectFloor(floor);
  if (!isDesktop()) closeSheet($('#filters'));
  const villa = units[0].type === 'B';
  const avail = units.filter((u) => u.status === 'available').length;
  const filtering = filtersActive();
  $('#panel-body').innerHTML = `
    <div class="panel-head">
      <div>
        <span class="eyebrow">${ordinal(floor)} floor</span>
        <h2 id="panel-title">${villa ? 'Type B Sky Villas' : 'Type A Residences'}</h2>
        <p>${units[0].bhk} BHK${villa ? ' duplex' : ''} · ${units.length} homes · ${avail} available</p>
      </div>
      <div class="head-actions">
        <button class="icon-btn" type="button" data-action="floor-down" aria-label="Floor below" ${floor <= 1 ? 'disabled' : ''}>${ICON.down}</button>
        <button class="icon-btn" type="button" data-action="floor-up" aria-label="Floor above" ${floor >= 24 ? 'disabled' : ''}>${ICON.up}</button>
        <button class="icon-btn" type="button" data-action="close" aria-label="Close panel">${ICON.close}</button>
      </div>
    </div>
    <div class="legend">
      <span class="s-available"><i></i>Available</span>
      <span class="s-held"><i></i>On hold</span>
      <span class="s-sold"><i></i>Sold</span>
      ${filtering ? '<span>Dimmed units do not match your filters</span>' : ''}
    </div>
    ${floorplate(units, { matches: filtering ? matches : null })}
    <div class="unit-list">
      ${units
        .map(
          (u) => `<button class="unit-card${filtering && !matches(u) ? ' is-dim' : ''}" type="button" data-action="unit" data-unit="${u.unit}">
            <span class="u-no">Unit ${u.unit}</span>
            <span class="u-price">${inr(u.price)}</span>
            <span class="u-meta">${u.bhk} BHK · ${sqft(u.carpetArea)} · ${FACING[u.facing]}</span>
            <span class="u-status status-tag s-${u.status}"><span class="status-dot"></span>${STATUS[u.status]}</span>
          </button>`
        )
        .join('')}
    </div>`;
  $('#panel-body').scrollTop = 0;
  openSheet($('#panel'));
}

function openUnit(unitNo) {
  const u = state.inventory.units.find((x) => x.unit === unitNo);
  if (!u) return;
  state.unit = u;
  track('unit_open', { unit: u.unit, floor: u.floor, type: u.type, status: u.status });
  const villa = u.type === 'B';
  const showBalcony = state.balcony && !villa;
  $('#panel-body').innerHTML = `
    <button class="back-link" type="button" data-action="back">${ICON.back}${ordinal(u.floor)} floor</button>
    <div class="unit-hero">
      <div>
        <span class="eyebrow">${u.typeName}</span>
        <h2 id="panel-title">Unit ${u.unit}</h2>
        <span class="status-pill s-${u.status}"><span class="status-dot"></span>${STATUS[u.status]}</span>
      </div>
      <div class="price">${inr(u.price)}<small>Agreement value</small></div>
    </div>
    <div class="unit-actions">
      <button class="btn btn-gold btn-block" type="button" data-action="step-inside">${ICON.pano}Step inside</button>
      ${showBalcony ? `<button class="btn btn-ghost btn-block" type="button" data-action="balcony">${ICON.view}View from balcony</button>` : ''}
    </div>
    <div class="card">
      <h3>${villa ? '4 BHK duplex' : '3 BHK'} <span class="tag">Indicative plan</span></h3>
      <div class="plan-wrap${villa ? ' is-wide' : ''}">${planFor(u.type)}</div>
    </div>
    <div class="card">
      <h3>Specifications</h3>
      <dl class="specs">
        <div><dt>Configuration</dt><dd>${u.bhk} BHK${villa ? ' duplex' : ''}</dd></div>
        <div><dt>Carpet area</dt><dd>${sqft(u.carpetArea)}</dd></div>
        <div><dt>Floor</dt><dd>${villa ? `${ordinal(u.floor)}, sky villa` : ordinal(u.floor)}</dd></div>
        <div><dt>Facing</dt><dd>${FACING[u.facing]}</dd></div>
        <div><dt>Status</dt><dd>${STATUS[u.status]}</dd></div>
        <div><dt>Price</dt><dd>${inr(u.price)}</dd></div>
      </dl>
    </div>
    ${costSheetHTML(u, state.inventory.pricing)}
    <div class="card">
      <h3>See this with your own project</h3>
      <p class="fineprint" style="margin:0 0 12px">Tourlo turns your inventory, plans and renders into a live sales gallery like this one.</p>
      <a class="btn btn-gold btn-block cta-book" data-cta="unit_view" href="${esc(config.bookingUrl)}" target="_blank" rel="noopener">Book a full live demo</a>
    </div>`;
  $('#panel-body').querySelector('.cta-book').addEventListener('click', () => track('book_demo_click', { location: 'unit_view' }));
  $('#panel-body').scrollTop = 0;
  openSheet($('#panel'));
}

/* ---------------- Filters ---------------- */

function setupFilters() {
  $('#btn-filters').addEventListener('click', () => {
    const el = $('#filters');
    if (!el.hidden) return closeSheet(el);
    renderFilters();
    if (!isDesktop()) closeSheet($('#panel'));
    openSheet(el);
  });
  $('#filters').querySelector('[data-close-filters]').addEventListener('click', () => closeSheet($('#filters')));
}

function renderFilters() {
  const f = state.filters;
  const [lo, hi] = state.priceBounds;
  const range = f.price || [lo, hi];
  const chip = (group, value, label, on) =>
    `<button class="chip" type="button" data-group="${group}" data-value="${value}" aria-pressed="${on}">${label}</button>`;
  const statusChips = Object.entries(STATUS)
    .map(([k, label]) => chip('status', k, `<span class="status-dot s-${k}"></span>${label}`, f.status.has(k)))
    .join('');
  $('#filters-body').innerHTML = `
    <div class="panel-head">
      <div>
        <span class="eyebrow">Find a home</span>
        <h2 id="filters-title">Filters</h2>
        <p>Matching floors glow on the tower.</p>
      </div>
      <button class="icon-btn" type="button" data-close aria-label="Close filters">${ICON.close}</button>
    </div>
    <div class="filter-group">
      <h4>Configuration</h4>
      <div class="chips">${chip('bhk', '', 'Any', !f.bhk)}${chip('bhk', '3', '3 BHK', f.bhk === 3)}${chip('bhk', '4', '4 BHK sky villa', f.bhk === 4)}</div>
    </div>
    <div class="filter-group">
      <h4>Status</h4>
      <div class="chips">${statusChips}</div>
    </div>
    <div class="filter-group">
      <h4>Price <output id="price-out"></output></h4>
      <div class="dual-range">
        <div class="track"><span id="price-fill"></span></div>
        <input type="range" id="price-min" min="${lo}" max="${hi}" step="2500000" value="${range[0]}" aria-label="Minimum price"/>
        <input type="range" id="price-max" min="${lo}" max="${hi}" step="2500000" value="${range[1]}" aria-label="Maximum price"/>
      </div>
    </div>
    <div class="filter-group">
      <h4>Facing</h4>
      <div class="chips">${Object.entries(FACING).map(([k, label]) => chip('facing', k, label, f.facing.has(k))).join('')}</div>
    </div>
    <div class="filter-result" id="filter-result"></div>
    <div class="filter-actions">
      <button class="btn btn-ghost" type="button" data-reset>Reset</button>
      <button class="btn btn-gold" type="button" data-apply>Show on tower</button>
    </div>`;

  const body = $('#filters-body');
  body.querySelector('[data-close]').addEventListener('click', () => closeSheet($('#filters')));
  body.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      const { group, value } = c.dataset;
      if (group === 'bhk') {
        f.bhk = value ? +value : null;
        body.querySelectorAll('[data-group="bhk"]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      } else {
        const set = f[group];
        set.has(value) ? set.delete(value) : set.add(value);
        c.setAttribute('aria-pressed', String(set.has(value)));
      }
      track('filter_used', { filter: group, value: value || 'any' });
      applyFilters();
    })
  );

  const minEl = $('#price-min');
  const maxEl = $('#price-max');
  const syncPrice = (changed) => {
    let a = +minEl.value;
    let b = +maxEl.value;
    if (a > b) {
      if (changed === minEl) b = a;
      else a = b;
      minEl.value = a;
      maxEl.value = b;
    }
    const pct = (v) => ((v - lo) / (hi - lo || 1)) * 100;
    $('#price-fill').style.left = `${pct(a)}%`;
    $('#price-fill').style.right = `${100 - pct(b)}%`;
    $('#price-out').textContent = `${inr(a)} to ${inr(b)}`;
    f.price = a <= lo && b >= hi ? null : [a, b];
  };
  [minEl, maxEl].forEach((el) => {
    el.addEventListener('input', () => {
      syncPrice(el);
      applyFilters();
    });
    el.addEventListener('change', () => track('filter_used', { filter: 'price', value: `${minEl.value}-${maxEl.value}` }));
  });
  syncPrice();

  body.querySelector('[data-reset]').addEventListener('click', () => {
    state.filters = { bhk: null, status: new Set(), facing: new Set(), price: null };
    track('filter_used', { filter: 'reset', value: 'all' });
    applyFilters();
    renderFilters();
  });
  body.querySelector('[data-apply]').addEventListener('click', () => {
    closeSheet($('#filters'));
    const n = countMatches();
    if (filtersActive()) toast(n.floors ? `${n.floors} floors glowing` : 'No homes match. Try widening your filters.');
  });
  applyFilters();
}

function countMatches() {
  const units = state.inventory.units.filter(matches);
  return { units: units.length, floors: new Set(units.map((u) => u.floor)).size };
}

function applyFilters() {
  const active = filtersActive();
  const f = state.filters;
  const count = (f.bhk ? 1 : 0) + f.status.size + f.facing.size + (f.price ? 1 : 0);
  $('#filter-count').hidden = !active;
  $('#filter-count').textContent = count;
  if (active) {
    const m = new Map();
    for (const u of state.inventory.units) if (matches(u)) m.set(u.floor, true);
    tower.setFilterMatches(m);
  } else tower.setFilterMatches(null);
  const res = $('#filter-result');
  if (res) {
    const n = countMatches();
    res.innerHTML = active
      ? `<strong>${n.units}</strong> homes on <strong>${n.floors}</strong> floors match`
      : `Showing all <strong>${state.inventory.units.length}</strong> homes`;
  }
  // Refresh dimming in an open floor panel.
  if (state.floor && !state.unit && !$('#panel').hidden) {
    const scroll = $('#panel-body').scrollTop;
    openFloor(state.floor);
    $('#panel-body').scrollTop = scroll;
  }
}

/* ---------------- 360 viewer ---------------- */

async function ensureViewer() {
  if (viewer) return viewer;
  const { PanoViewer } = await import('./viewer.js');
  viewer = new PanoViewer($('#viewer'), {
    canEnterRoom: (room) => {
      // Opening a second distinct room is a trigger for the lead form.
      if (!lead.unlocked && !state.roomsSeen.has(room.id) && state.roomsSeen.size >= 1) {
        lead.trigger('second_room');
        lead.pending = () => viewer.go(room.id);
        return false;
      }
      return true;
    },
    onRoomChange: (room, { error } = {}) => {
      if (error) return toast('That view could not be loaded. Please try again.');
      state.roomsSeen.add(room.id);
      track('pano_open', { tour: state.tourId, room: room.id });
    },
    onTourLink: (tourId, roomId) => {
      const tour = state.tours?.[tourId];
      if (!tour) return;
      state.tourId = tourId;
      viewer.start(tour, roomId);
    },
    onClose: () => {
      tower.setActive(true);
      if (session.get('tourlo_final_shown') !== '1') {
        session.set('tourlo_final_shown', '1');
        $('#final-modal').hidden = false;
      }
    },
  });
  return viewer;
}

async function openTour(tourId, roomId) {
  const tour = state.tours?.[tourId];
  if (!tour) return;
  const startRoom = roomId || tour.rooms[0].id;
  const go = async () => {
    // A second room (beyond the first ever viewed) counts as the gate trigger.
    if (!lead.unlocked && state.roomsSeen.size >= 1 && !state.roomsSeen.has(startRoom)) {
      lead.trigger('second_room');
      lead.pending = () => openTour(tourId, roomId);
      return;
    }
    state.tourId = tourId;
    const v = await ensureViewer();
    tower.setActive(false);
    v.start(tour, startRoom);
  };
  if (lead.guard(go)) go();
}

/* ---------------- Balcony lightbox ---------------- */

function openLightbox() {
  $('#lightbox-img').src = url('assets/views/balcony_view.jpg');
  $('#lightbox').hidden = false;
  track('pano_open', { tour: 'balcony_view', room: 'balcony_view' });
}

function closeLightbox() {
  $('#lightbox').hidden = true;
}

$('#lightbox-close').addEventListener('click', closeLightbox);
$('#lightbox').addEventListener('click', (e) => e.target.id === 'lightbox' && closeLightbox());

boot();
