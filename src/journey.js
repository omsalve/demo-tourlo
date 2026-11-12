import { session } from './storage.js';

export const STOPS = [
  { title: 'Arrival', copy: 'A first look at your address. Look around the plaza, then discover the amenities.', next: 'Discover amenities' },
  { title: 'Amenities', copy: 'Space to unwind. Explore the garden and rooftop, then find a home that suits you.', next: 'Find your home' },
  { title: 'Choose a home', copy: 'Choose a floor or browse residences. Save the homes you would like to compare.', next: 'Step inside' },
  { title: 'Step inside', copy: 'Look around your selected home. Move between rooms at your own pace.', next: 'Compare saved homes' },
  { title: 'Compare', copy: 'Review your saved homes side by side. Return to any residence to explore further.', next: 'Explore more homes' },
];

export class GuidedJourney {
  constructor({ onStep, onExit, onChange }) {
    this.onStep = onStep;
    this.onExit = onExit;
    this.onChange = onChange;
    this.active = false;
    this.step = 0;
    const el = document.createElement('section');
    el.id = 'guided-journey';
    el.hidden = true;
    el.setAttribute('aria-label', 'Your guided visit');
    el.innerHTML = `<div class="journey-detail"><div><span class="eyebrow" data-progress></span><p data-copy></p></div><div class="journey-actions"><button class="btn btn-ghost btn-sm" data-prev>Back</button><button class="btn btn-gold btn-sm" data-next></button><button class="icon-btn" data-exit aria-label="Leave guided visit">×</button></div></div><nav class="journey-steps" aria-label="Visit stages">${STOPS.map((s,i)=>`<button type="button" data-step="${i}"><span>${i+1}</span><strong>${s.title}</strong></button>`).join('')}</nav>`;
    document.body.append(el);
    this.el = el;
    el.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>this.go(+b.dataset.step)));
    el.querySelector('[data-next]').addEventListener('click',()=>this.go(this.step===4?2:this.step+1));
    el.querySelector('[data-prev]').addEventListener('click',()=>this.go(this.step-1));
    el.querySelector('[data-exit]').addEventListener('click',()=>this.stop());
  }
  start(step=0) { this.active=true; this.el.hidden=false; document.body.classList.add('is-guided'); this.go(step); }
  async go(step) {
    if(step<0||step>=STOPS.length||this.busy) return;
    this.busy=true;
    try { const accepted=await this.onStep(step); if(accepted!==false) this.setStep(step); }
    finally { this.busy=false; }
  }
  setStep(step) {
    this.step=step;
    session.set('tourlo_journey_step',String(step));
    this.el.querySelector('[data-progress]').textContent=`Your guided visit · ${step+1} of ${STOPS.length}`;
    this.el.querySelector('[data-copy]').textContent=STOPS[step].copy;
    this.el.querySelector('[data-next]').textContent=STOPS[step].next;
    this.el.querySelector('[data-prev]').disabled=step===0;
    this.el.querySelectorAll('[data-step]').forEach((b,i)=>{b.setAttribute('aria-current',i===step?'step':'false');b.classList.toggle('is-complete',i<step);});
    this.onChange?.(step);
  }
  stop() { this.active=false; this.el.hidden=true; document.body.classList.remove('is-guided'); this.onExit?.(); }
}
