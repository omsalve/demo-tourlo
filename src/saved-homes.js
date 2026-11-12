import { inr, sqft, FACING, STATUS, esc } from './format.js';
import { planFor } from './plans.js';
import { costSheet } from './cost.js';

const KEY='tourlo_v2_saved_homes';
export class SavedHomes {
  constructor({ getInventory, onOpen, onBrowse, onChange }) {
    this.getInventory=getInventory; this.onOpen=onOpen; this.onBrowse=onBrowse; this.onChange=onChange;
    try { const saved=JSON.parse(localStorage.getItem(KEY)||'[]'); this.ids=Array.isArray(saved)?saved.filter(x=>typeof x==='string').slice(0,3):[]; } catch { this.ids=[]; }
    this.el=document.createElement('section'); this.el.id='saved-homes'; this.el.className='modal'; this.el.hidden=true;
    this.el.setAttribute('role','dialog'); this.el.setAttribute('aria-modal','true'); this.el.setAttribute('aria-labelledby','saved-title'); document.body.append(this.el);
    this.el.addEventListener('click',e=>{
      if(e.target===this.el||e.target.closest('[data-close-saved]')) this.close();
      const b=e.target.closest('[data-open-home]'); if(b){this.close();this.onOpen(b.dataset.openHome);}
      const r=e.target.closest('[data-remove-home]'); if(r){this.toggle(r.dataset.removeHome);this.render();}
      if(e.target.closest('[data-browse-homes]')){this.close();this.onBrowse();}
    });
  }
  has(id){return this.ids.includes(id);}
  toggle(id){
    if(this.has(id)) this.ids=this.ids.filter(x=>x!==id);
    else { if(this.ids.length>=3) return false; this.ids.push(id); }
    try{localStorage.setItem(KEY,JSON.stringify(this.ids));}catch{}
    this.onChange?.(this.ids); return true;
  }
  open(){this.render();this.el.hidden=false;this.el.querySelector('[data-close-saved]').focus();}
  close(){this.el.hidden=true;}
  render(){
    const inventory=this.getInventory();
    const units=this.ids.map(id=>inventory.units.find(u=>u.unit===id)).filter(Boolean);
    this.el.innerHTML=`<div class="modal-card compare-card"><div class="panel-head"><div><span class="eyebrow">Your shortlist</span><h2 id="saved-title">Find the one that feels right</h2><p>Compare up to three homes. Your shortlist stays on this device.</p></div><button type="button" class="icon-btn" data-close-saved aria-label="Close saved homes">×</button></div>${units.length?`<div class="compare-grid" style="--compare-count:${units.length}">${units.map(u=>`<article class="compare-home"><span class="status-tag s-${esc(u.status)}">${STATUS[u.status]}</span><h3>Residence ${esc(u.unit)}</h3><p class="compare-price">${inr(u.price)}</p><div class="compare-plan">${planFor(u.type)}</div><dl class="specs"><div><dt>Configuration</dt><dd>${u.bhk} BHK${u.duplex?' duplex':''}</dd></div><div><dt>Carpet area</dt><dd>${sqft(u.carpetArea)}</dd></div><div><dt>Floor</dt><dd>${u.floor}</dd></div><div><dt>Facing</dt><dd>${FACING[u.facing]}</dd></div><div><dt>Indicative total</dt><dd>${inr(costSheet(u,inventory.pricing).total)}</dd></div></dl><button class="btn btn-gold btn-block" data-open-home="${esc(u.unit)}">Explore this home</button><button class="btn btn-ghost btn-block" data-remove-home="${esc(u.unit)}">Remove</button></article>`).join('')}</div>`:'<div class="shortlist-empty"><span class="empty-mark">♡</span><h3>Your next home starts with a favourite</h3><p>Open a residence and select Save home. Come back here to compare its price, plan, floor and outlook.</p></div>'}<button class="btn btn-ghost" data-browse-homes>Add another home</button><p class="fineprint">Plans and interiors are representative of the home type. Availability and indicative prices may change.</p></div>`;
  }
}
