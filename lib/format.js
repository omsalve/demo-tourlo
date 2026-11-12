const CR = 1e7;
const LAKH = 1e5;

const trim = (n, digits) => {
  const s = n.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

// 29033000 -> "₹2.9 Cr", 350000 -> "₹3.5 Lakh", 30000 -> "₹30,000"
export function inr(value, { digits = 2 } = {}) {
  const v = Math.round(value);
  if (Math.abs(v) >= CR) return `₹${trim(v / CR, digits)} Cr`;
  if (Math.abs(v) >= LAKH) return `₹${trim(v / LAKH, digits)} Lakh`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export const inrFull = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export const sqft = (n) => `${n.toLocaleString('en-IN')} sq ft`;

export const FACING = { N: 'North', E: 'East', S: 'South', W: 'West' };
export const STATUS = { available: 'Available', held: 'On hold', sold: 'Sold' };

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
