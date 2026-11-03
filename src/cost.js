import { inr, inrFull } from './format.js';

export function costSheet(unit, pricing) {
  const floorRise = unit.carpetArea * pricing.floorRisePerSqftPerFloor * (unit.floor - 1);
  const plc = pricing.plc[unit.facing] || 0;
  const base = unit.price - floorRise - plc;
  const agreement = unit.price;
  const gst = agreement * pricing.gstRate;
  const stamp = agreement * pricing.stampDutyRate;
  const reg = pricing.registration;
  return { base, floorRise, plc, agreement, gst, stamp, reg, total: agreement + gst + stamp + reg };
}

export function costSheetHTML(unit, pricing) {
  const c = costSheet(unit, pricing);
  const pct = (r) => `${+(r * 100).toFixed(2)}%`;
  const row = (label, value, note = '') =>
    `<tr><td>${label}${note ? `<small>${note}</small>` : ''}</td><td>${inrFull(value)}</td></tr>`;
  return `
    <div class="card">
      <h3>Cost sheet <span class="tag">Indicative</span></h3>
      <table class="cost-table">
        ${row('Base price', c.base, `${unit.carpetArea.toLocaleString('en-IN')} sq ft carpet`)}
        ${row('Floor rise', c.floorRise, `₹${pricing.floorRisePerSqftPerFloor} per sq ft per floor above 1st`)}
        ${row('PLC', c.plc, c.plc ? `Preferred location, ${unit.facing} facing` : 'Not applicable for this unit')}
        <tr class="sub"><td>Agreement value</td><td>${inrFull(c.agreement)}</td></tr>
        ${row(`GST ${pct(pricing.gstRate)}`, c.gst)}
        ${row(`Stamp duty ${pct(pricing.stampDutyRate)}`, c.stamp)}
        ${row('Registration', c.reg)}
        <tr class="total"><td>All inclusive</td><td>${inr(c.total)}</td></tr>
      </table>
      <p class="fineprint">Indicative only, for demonstration. Actual charges, taxes and government levies are as per the final agreement and applicable law at the time of booking.</p>
    </div>`;
}
