// Regenerates public/data/inventory.json with seeded dummy data.
// Usage: npm run inventory
// After generating you can hand edit public/data/inventory.json freely; the app reads it at runtime.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Small deterministic PRNG so the output is stable between runs.
let seed = 20261028;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const pricing = {
  note: 'All prices are indicative and for demo purposes only.',
  floorRisePerSqftPerFloor: 60,
  plc: { N: 0, E: 350000, S: 0, W: 250000 },
  gstRate: 0.05,
  stampDutyRate: 0.06,
  registration: 30000,
};

// Base rate in INR per sq ft of carpet area.
const baseRate = { A: 24500, B: 31000 };

const typeA = [
  { pos: 1, facing: 'N', carpet: 1185 },
  { pos: 2, facing: 'E', carpet: 1240 },
  { pos: 3, facing: 'S', carpet: 1185 },
  { pos: 4, facing: 'W', carpet: 1240 },
];
const typeB = [
  { pos: 1, facing: 'E', carpet: 2960 },
  { pos: 2, facing: 'W', carpet: 3085 },
];

const units = [];
for (let floor = 1; floor <= 24; floor++) {
  const isB = floor > 20;
  for (const u of isB ? typeB : typeA) {
    const type = isB ? 'B' : 'A';
    const carpet = u.carpet;
    const base = Math.round((carpet * baseRate[type]) / 1000) * 1000;
    const floorRise = carpet * pricing.floorRisePerSqftPerFloor * (floor - 1);
    const plc = pricing.plc[u.facing];
    units.push({
      unit: `${floor}${String(u.pos).padStart(2, '0')}`,
      floor,
      type,
      typeName: isB ? 'Type B Sky Villa' : 'Type A Residence',
      bhk: isB ? 4 : 3,
      duplex: isB,
      carpetArea: carpet,
      facing: u.facing,
      status: 'available',
      price: base + floorRise + plc,
    });
  }
}

// Status mix: roughly 55% available, 15% held, 30% sold.
// Lower floors sell first, so bias "sold" towards them for realism.
const n = units.length;
const soldTarget = Math.round(n * 0.3);
const heldTarget = Math.round(n * 0.15);
const scored = units.map((u, i) => ({ i, score: rand() + (24 - u.floor) / 40 }));
scored.sort((a, b) => b.score - a.score);
scored.slice(0, soldTarget).forEach(({ i }) => (units[i].status = 'sold'));
const rest = scored.slice(soldTarget).map(({ i }) => i);
for (let k = rest.length - 1; k > 0; k--) {
  const j = Math.floor(rand() * (k + 1));
  [rest[k], rest[j]] = [rest[j], rest[k]];
}
rest.slice(0, heldTarget).forEach((i) => (units[i].status = 'held'));

const out = {
  project: 'Tourlo Demo Residences',
  city: 'Mumbai',
  currency: 'INR',
  updated: new Date().toISOString().slice(0, 10),
  pricing,
  units,
};

await writeFile(path.join(root, 'public/data/inventory.json'), JSON.stringify(out, null, 2) + '\n');
const count = (s) => units.filter((u) => u.status === s).length;
console.log(`Wrote ${n} units: ${count('available')} available, ${count('held')} held, ${count('sold')} sold.`);
