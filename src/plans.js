// Indicative floor plans drawn as SVG. Units are roughly 10 px per foot.

const FILL = {
  bed: '#e8dfcf',
  living: '#efe7d8',
  wet: '#d9e1e3',
  service: '#e3ddd2',
  outdoor: '#dfe5d3',
  stair: '#e2dccf',
  void: '#f6f2ea',
};

const INK = '#2a2723';
const SOFT = '#9d958a';

function room(x, y, w, h, name, dim, kind = 'living') {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const small = w < 75 || h < 70;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILL[kind]}" stroke="${INK}" stroke-width="2"/>
    <text x="${cx}" y="${cy - (dim ? 3 : -4)}" text-anchor="middle" class="rn${small ? ' sm' : ''}">${name}</text>
    ${dim ? `<text x="${cx}" y="${cy + 11}" text-anchor="middle" class="rd">${dim}</text>` : ''}`;
}

// Door leaf with swing arc. (x, y) is the hinge; angle rotates the whole symbol.
function door(x, y, r = 26, angle = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    <line x1="0" y1="0" x2="${r}" y2="0" stroke="${INK}" stroke-width="1.6"/>
    <path d="M ${r} 0 A ${r} ${r} 0 0 1 0 ${r}" fill="none" stroke="${SOFT}" stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="0" y1="0" x2="0" y2="${r}" stroke="#f6f2ea" stroke-width="3"/>
  </g>`;
}

// Window on an exterior wall: horizontal when w > h.
function win(x, y, w, h) {
  const horiz = w > h;
  const lines = horiz
    ? `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${INK}" stroke-width="1"/>`
    : `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${INK}" stroke-width="1"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fbf8f2" stroke="${INK}" stroke-width="1"/>${lines}`;
}

const bed = (x, y, w = 56, h = 66) => `
  <g stroke="${SOFT}" stroke-width="1.2" fill="#f7f2e8">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>
    <rect x="${x + 5}" y="${y + 4}" width="${w / 2 - 8}" height="12" rx="3"/>
    <rect x="${x + w / 2 + 3}" y="${y + 4}" width="${w / 2 - 8}" height="12" rx="3"/>
  </g>`;

const sofa = (x, y, w = 80) => `
  <g stroke="${SOFT}" stroke-width="1.2" fill="#f7f2e8">
    <rect x="${x}" y="${y}" width="${w}" height="24" rx="5"/>
    <rect x="${x + w / 2 - 22}" y="${y - 34}" width="44" height="24" rx="4"/>
  </g>`;

const dining = (cx, cy, seats = 6) => {
  const w = seats > 6 ? 70 : 54;
  let chairs = '';
  const n = seats / 2;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (w / n) * (i + 0.5) - 6;
    chairs += `<rect x="${x}" y="${cy - 25}" width="12" height="9" rx="2"/><rect x="${x}" y="${cy + 16}" width="12" height="9" rx="2"/>`;
  }
  return `<g stroke="${SOFT}" stroke-width="1.2" fill="#f7f2e8"><rect x="${cx - w / 2}" y="${cy - 13}" width="${w}" height="26" rx="4"/>${chairs}</g>`;
};

const counter = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ece5d8" stroke="${SOFT}" stroke-width="1.2"/>`;

const stairs = (x, y, w, h, steps = 9, label = 'UP') => {
  let s = '';
  for (let i = 1; i < steps; i++) {
    const yy = y + (h / steps) * i;
    s += `<line x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="${SOFT}" stroke-width="1"/>`;
  }
  return `${s}<path d="M ${x + w / 2} ${y + h - 8} L ${x + w / 2} ${y + 10} M ${x + w / 2 - 5} ${y + 16} L ${x + w / 2} ${y + 10} L ${x + w / 2 + 5} ${y + 16}" stroke="${INK}" stroke-width="1.3" fill="none"/>
    <text x="${x + w / 2}" y="${y + h + 12}" text-anchor="middle" class="rd">${label}</text>`;
};

const compass = (x, y) => `
  <g transform="translate(${x} ${y})">
    <circle r="15" fill="none" stroke="${SOFT}" stroke-width="1"/>
    <path d="M 0 -11 L 5 5 L 0 2 L -5 5 Z" fill="${INK}"/>
    <text y="-19" text-anchor="middle" class="rd" style="font-weight:700">N</text>
  </g>`;

const STYLE = `<style>
  .rn{font:700 11px Manrope,system-ui,sans-serif;fill:${INK};letter-spacing:.02em}
  .rn.sm{font-size:9px}
  .rd{font:500 9px Manrope,system-ui,sans-serif;fill:#6d665c}
  .tt{font:700 12px Manrope,system-ui,sans-serif;fill:${INK};letter-spacing:.12em}
  .note{font:600 10px Manrope,system-ui,sans-serif;fill:#8a8277;letter-spacing:.08em}
</style>`;

const DIM = (a, b) => `${a}'0" × ${b}'0"`;

export function planTypeA() {
  const ox = 20;
  const oy = 30;
  const g = `
    <g transform="translate(${ox} ${oy})">
      ${room(0, 0, 130, 130, 'Bedroom 2', DIM(13, 13), 'bed')}
      ${room(130, 0, 60, 75, 'Bath', DIM(6, 7), 'wet')}
      ${room(130, 75, 60, 55, '', '', 'service')}
      ${room(190, 0, 110, 130, 'Bedroom 3', DIM(11, 13), 'bed')}
      ${room(300, 0, 140, 150, 'Master bedroom', DIM(14, 15), 'bed')}
      ${room(0, 130, 110, 100, 'Kitchen', DIM(11, 10), 'service')}
      ${room(0, 230, 110, 70, 'Utility', DIM(11, 7), 'service')}
      ${room(110, 130, 190, 170, 'Living and dining', DIM(19, 17), 'living')}
      ${room(300, 150, 80, 80, 'Bath', DIM(8, 8), 'wet')}
      ${room(380, 150, 60, 80, 'Walk in', DIM(6, 8), 'service')}
      ${room(300, 230, 140, 70, 'Foyer', DIM(14, 7), 'living')}
      ${room(110, 300, 190, 50, 'Balcony', DIM(19, 5), 'outdoor')}
      <rect x="0" y="0" width="440" height="300" fill="none" stroke="${INK}" stroke-width="6"/>
      ${bed(36, 40)}${bed(222, 40)}${bed(334, 44, 70, 74)}
      ${sofa(140, 270, 90)}${dining(232, 190)}
      ${counter(6, 136, 16, 88)}${counter(22, 136, 80, 16)}
      ${win(30, -3, 70, 6)}${win(215, -3, 60, 6)}${win(335, -3, 80, 6)}${win(-3, 160, 6, 50)}${win(437, 40, 6, 70)}
      ${door(130, 98, 24, -90)}${door(190, 104, 24, 180)}${door(300, 128, 20, 180)}${door(110, 210, 24, -90)}${door(340, 230, 22, -90)}
      <line x1="140" y1="300" x2="270" y2="300" stroke="#fbf8f2" stroke-width="5"/>
      <line x1="140" y1="300" x2="270" y2="300" stroke="${INK}" stroke-width="1"/>
      <path d="M 440 255 L 452 255 M 440 285 L 452 285" stroke="${INK}" stroke-width="2"/>
      <text x="456" y="274" class="rd">Entry</text>
    </g>`;
  return `<svg viewBox="0 0 500 430" role="img" aria-label="Indicative 3 BHK floor plan">${STYLE}
    ${g}
    ${compass(470, 42)}
    <text x="20" y="410" class="note">INDICATIVE PLAN · NOT TO SCALE</text>
  </svg>`;
}

export function planTypeB() {
  const lower = `
    <g transform="translate(56 46)">
      <text x="0" y="-16" class="tt">LOWER LEVEL</text>
      ${room(-40, 0, 40, 280, '', '', 'outdoor')}
      <text x="-20" y="140" text-anchor="middle" class="rn sm" transform="rotate(-90 -20 140)">Sky terrace</text>
      ${room(0, 0, 180, 170, 'Double height living', DIM(18, 17), 'living')}
      ${room(180, 0, 150, 100, 'Dining', DIM(15, 10), 'living')}
      ${room(180, 100, 150, 90, 'Kitchen', DIM(15, 9), 'service')}
      ${room(0, 170, 70, 110, 'Stair', '', 'stair')}
      ${room(70, 170, 55, 50, 'Powder', '', 'wet')}
      ${room(125, 170, 55, 50, 'Store', '', 'service')}
      ${room(70, 220, 110, 60, 'Foyer', '', 'living')}
      ${room(180, 190, 90, 90, 'Bedroom 4', DIM(9, 9), 'bed')}
      ${room(270, 190, 60, 90, 'Bath', '', 'wet')}
      <rect x="0" y="0" width="330" height="280" fill="none" stroke="${INK}" stroke-width="6"/>
      ${sofa(40, 130, 100)}${dining(255, 50, 8)}
      ${counter(314, 106, 12, 78)}${counter(190, 106, 124, 12)}
      ${bed(198, 206, 54, 60)}
      ${stairs(8, 178, 54, 86, 10, 'UP')}
      ${win(-3, 30, 6, 110)}${win(40, -3, 100, 6)}${win(210, -3, 90, 6)}${win(327, 210, 6, 50)}
      ${door(70, 250, 22, -90)}${door(180, 258, 20, -90)}${door(270, 210, 18, 90)}${door(125, 220, 18, -90)}
      <path d="M 120 280 L 120 292 M 160 280 L 160 292" stroke="${INK}" stroke-width="2"/>
      <text x="140" y="304" text-anchor="middle" class="rd">Entry</text>
    </g>`;
  const upper = `
    <g transform="translate(426 46)">
      <text x="0" y="-16" class="tt">UPPER LEVEL</text>
      ${room(0, 0, 180, 80, 'Void over living', '', 'void')}
      <path d="M 4 4 L 176 76 M 176 4 L 4 76" stroke="${SOFT}" stroke-dasharray="4 3" stroke-width="1"/>
      ${room(0, 80, 180, 90, 'Family lounge', DIM(18, 9), 'living')}
      ${room(0, 170, 70, 110, 'Stair', '', 'stair')}
      ${room(70, 170, 110, 110, 'Bedroom 3', DIM(11, 11), 'bed')}
      ${room(180, 0, 150, 130, 'Master bedroom', DIM(15, 13), 'bed')}
      ${room(180, 130, 70, 60, 'Bath', '', 'wet')}
      ${room(250, 130, 80, 60, 'Walk in', '', 'service')}
      ${room(180, 190, 90, 90, 'Bedroom 2', DIM(9, 9), 'bed')}
      ${room(270, 190, 60, 90, 'Bath', '', 'wet')}
      <rect x="0" y="0" width="330" height="280" fill="none" stroke="${INK}" stroke-width="6"/>
      ${bed(220, 30, 70, 76)}${bed(98, 196, 56, 62)}${bed(198, 206, 54, 60)}
      ${sofa(50, 150, 90)}
      ${stairs(8, 178, 54, 86, 10, 'DOWN')}
      ${win(210, -3, 90, 6)}${win(327, 20, 6, 90)}${win(327, 210, 6, 50)}${win(90, 277, 70, 6)}
      ${door(70, 190, 20, 0)}${door(180, 112, 18, 180)}${door(180, 208, 20, 0)}${door(270, 210, 18, 90)}
    </g>`;
  return `<svg viewBox="0 0 790 380" role="img" aria-label="Indicative 4 BHK duplex floor plan">${STYLE}
    ${lower}${upper}
    ${compass(762, 26)}
    <text x="16" y="366" class="note">INDICATIVE PLAN · NOT TO SCALE · 4 BHK ACROSS TWO LEVELS</text>
  </svg>`;
}

export const planFor = (type) => (type === 'B' ? planTypeB() : planTypeA());

// Small floorplate key used in the floor panel: units coloured by status.
export function floorplate(units, { matches } = {}) {
  const villa = units[0]?.type === 'B';
  const W = 300;
  const H = 170;
  const pad = 6;
  const core = { w: 60, h: 40 };
  const colors = { available: 'var(--available)', held: 'var(--held)', sold: 'var(--sold)' };
  let cells;
  if (villa) {
    // 01 faces east (right), 02 faces west (left).
    const half = (W - core.w) / 2 - pad;
    cells = [
      { u: units.find((u) => u.facing === 'E'), x: W / 2 + core.w / 2 + pad / 2, y: pad, w: half, h: H - pad * 2 },
      { u: units.find((u) => u.facing === 'W'), x: pad, y: pad, w: half, h: H - pad * 2 },
    ];
  } else {
    const qw = W / 2 - pad * 1.5;
    const qh = H / 2 - pad * 1.5;
    const pos = { N: [pad, pad], E: [W / 2 + pad / 2, pad], S: [W / 2 + pad / 2, H / 2 + pad / 2], W: [pad, H / 2 + pad / 2] };
    cells = units.map((u) => ({ u, x: pos[u.facing][0], y: pos[u.facing][1], w: qw, h: qh }));
  }
  const body = cells
    .filter((c) => c.u)
    .map(({ u, x, y, w, h }) => {
      const dim = matches && !matches(u);
      const label = `Unit ${u.unit}, ${u.status}`;
      return `<g class="u" data-unit="${u.unit}" tabindex="0" role="button" aria-label="${label}" opacity="${dim ? 0.35 : 1}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${colors[u.status]}" fill-opacity="0.2" stroke="${colors[u.status]}" stroke-width="1.5"/>
        <text x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle" fill="#f3eee6" style="font:700 15px Manrope,sans-serif">${u.unit}</text>
        <text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" fill="#a39e95" style="font:600 10px Manrope,sans-serif;letter-spacing:.08em">${u.facing} FACING</text>
      </g>`;
    })
    .join('');
  return `<svg class="floorplate" viewBox="0 0 ${W} ${H}" role="group" aria-label="Floor key plan">
    ${body}
    <rect x="${W / 2 - core.w / 2}" y="${H / 2 - core.h / 2}" width="${core.w}" height="${core.h}" rx="6" fill="#26262a" stroke="rgba(243,238,230,.18)"/>
    <text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" fill="#6f6b65" style="font:700 9px Manrope,sans-serif;letter-spacing:.14em">CORE</text>
  </svg>`;
}
