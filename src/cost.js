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

export function emi(principal, annualRate, years) {
  const n = years * 12;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

export function emiHTML() {
  const slider = (id, label, min, max, step, value) => `
    <div class="slider">
      <label for="${id}"><span>${label}</span><output id="${id}-out"></output></label>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"/>
    </div>`;
  return `
    <div class="card" id="emi-card">
      <h3>EMI calculator <span class="tag">Indicative</span></h3>
      <div class="emi-out">
        <div><div class="emi-value" id="emi-value"></div><div class="emi-label">per month</div></div>
      </div>
      ${slider('emi-loan', 'Loan amount', 10, 90, 5, 80)}
      ${slider('emi-rate', 'Interest rate', 6.5, 12, 0.05, 8.5)}
      ${slider('emi-tenure', 'Tenure', 5, 30, 1, 20)}
      <div class="emi-breakdown">
        <div>Loan<strong id="emi-principal"></strong></div>
        <div>Down payment<strong id="emi-down"></strong></div>
        <div>Total interest<strong id="emi-interest"></strong></div>
      </div>
      <p class="fineprint">Loan is calculated on the agreement value. Actual eligibility and rates depend on the lender.</p>
    </div>`;
}

export function bindEmi(root, agreementValue, onUse) {
  const $ = (id) => root.querySelector(`#${id}`);
  const loan = $('emi-loan');
  const rate = $('emi-rate');
  const tenure = $('emi-tenure');
  let used = false;
  const fill = (el) => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  const update = () => {
    const principal = (agreementValue * loan.value) / 100;
    const m = emi(principal, +rate.value, +tenure.value);
    $('emi-loan-out').textContent = `${loan.value}% · ${inr(principal)}`;
    $('emi-rate-out').textContent = `${(+rate.value).toFixed(2)}%`;
    $('emi-tenure-out').textContent = `${tenure.value} years`;
    $('emi-value').textContent = inrFull(m);
    $('emi-principal').textContent = inr(principal);
    $('emi-down').textContent = inr(agreementValue - principal);
    $('emi-interest').textContent = inr(m * tenure.value * 12 - principal);
    [loan, rate, tenure].forEach(fill);
  };
  [loan, rate, tenure].forEach((el) =>
    el.addEventListener('input', () => {
      update();
      if (!used) {
        used = true;
        onUse?.();
      }
    })
  );
  update();
}
