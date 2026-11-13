import { config } from './config.js';
import { session } from './storage.js';
import { track } from './analytics.js';

const KEY = 'tourlo_demo_unlocked';
const PREVIEW_KEY = 'tourlo_preview_access';
const ACTIVE_LIMIT = 60; // seconds of interaction before the form appears
const ROLES = ['Developer', 'Sales', 'CP', 'Other'];

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export class LeadGate {
  constructor({ getContext } = {}) {
    this.modal = document.getElementById('lead-modal');
    this.content = document.getElementById('lead-content');
    this.getContext = getContext || (() => ({}));
    this.unlocked = session.get(KEY) === '1' || (config.previewEnabled && session.get(PREVIEW_KEY) === '1');
    this.required = false; // becomes true once a trigger fires
    this.activeSeconds = 0;
    this.lastInteraction = -Infinity;
    this.submissionId = null;
    this.pending = null;

    const mark = () => (this.lastInteraction = performance.now());
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, mark, { passive: true, capture: true })
    );
    // Counts seconds in which the visitor actually interacted recently.
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.modal.hidden && performance.now() - this.lastInteraction < 12000) this.activeSeconds++;
      if (!this.unlocked && !this.required && this.activeSeconds >= ACTIVE_LIMIT) this.trigger('time');
    }, 1000);
  }

  get locked() {
    return !this.unlocked && this.required;
  }

  trigger(reason) {
    if (this.unlocked) return;
    this.required = true;
    this.reason = reason;
    // Do not interrupt a 360 room mid load; the next gated action will show it.
    this.show();
  }

  // Wrap any gated action. Returns true if it may proceed right now.
  guard(action) {
    if (!this.locked) return true;
    this.pending = action;
    this.show();
    return false;
  }

  show() {
    if (!this.modal.hidden) return;
    this.returnFocus = document.activeElement;
    this.renderForm();
    this.modal.hidden = false;
    setTimeout(() => this.content.querySelector('input')?.focus({ preventScroll: true }), 50);
  }

  hide() {
    this.modal.hidden = true;
    this.returnFocus?.focus?.();
  }

  renderForm() {
    this.content.innerHTML = `
      <span class="eyebrow">Keep exploring</span>
      <h2 id="lead-title">Unlock the full walkthrough</h2>
      <p>Share a few details to keep exploring every floor, unit and 360 room. We will only use them to follow up about Tourlo.</p>
      <form class="form-grid" novalidate>
        <div class="field"><label for="lf-name">Name</label><input id="lf-name" name="name" autocomplete="name" required/><div class="err">Please enter your name</div></div>
        <div class="field"><label for="lf-company">Company</label><input id="lf-company" name="company" autocomplete="organization" required/><div class="err">Please enter your company</div></div>
        <div class="field"><label for="lf-phone">Phone</label><input id="lf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+91" required/><div class="err">Please enter a valid phone number</div></div>
        <div class="field"><label for="lf-email">Work email</label><input id="lf-email" name="email" type="email" inputmode="email" autocomplete="email" required/><div class="err">Please enter a valid email</div></div>
        <div class="field" data-role-field>
          <label>Your role</label>
          <div class="roles" role="radiogroup" aria-label="Your role">
            ${ROLES.map((r) => `<button type="button" class="chip" role="radio" aria-checked="false" aria-pressed="false" data-role="${r}">${r}</button>`).join('')}
          </div>
          <div class="err">Please pick your role</div>
        </div>
        <p class="lead-error" role="alert" hidden></p>
        <div class="form-actions">
          <button class="btn btn-gold btn-block" type="submit">Continue exploring</button>
          ${config.previewEnabled ? '<button class="btn btn-ghost btn-block" type="button" data-preview>Continue preview without submitting</button><p class="privacy">Explore the full preview without sending your details.</p>' : ''}
          <button class="btn btn-ghost btn-block" type="button" data-later>Not now</button>
        </div>
        <p class="privacy">No spam. Your details stay with the Tourlo team.</p>
      </form>`;
    const form = this.content.querySelector('form');
    let role = '';
    form.querySelectorAll('[data-role]').forEach((b) =>
      b.addEventListener('click', () => {
        role = b.dataset.role;
        form.querySelectorAll('[data-role]').forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-pressed', String(on));
          x.setAttribute('aria-checked', String(on));
        });
        form.querySelector('[data-role-field]').classList.remove('has-error');
      })
    );
    form.querySelector('[data-later]').addEventListener('click', () => {
      this.pending = null;
      this.hide();
    });
    form.querySelector('[data-preview]')?.addEventListener('click', () => {
      this.unlocked = true;
      this.required = false;
      session.set(PREVIEW_KEY, '1');
      track('preview_continue', { trigger: this.reason || 'unknown' });
      const action = this.pending;
      this.pending = null;
      this.hide();
      this.content.replaceChildren();
      action?.();
    });
    form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('has-error'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.role = role;
      const checks = {
        name: (data.name || '').trim().length >= 2,
        company: (data.company || '').trim().length >= 2,
        phone: (data.phone || '').replace(/[^\d]/g, '').length >= 10,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || '').trim()),
      };
      let ok = true;
      for (const [k, valid] of Object.entries(checks)) {
        form.querySelector(`[name="${k}"]`).closest('.field').classList.toggle('has-error', !valid);
        ok = ok && valid;
      }
      if (!role) {
        form.querySelector('[data-role-field]').classList.add('has-error');
        ok = false;
      }
      if (!ok) {
        form.querySelector('.has-error input, .has-error button')?.focus();
        return;
      }
      this.submit(data, form.querySelector('[type="submit"]'));
    });
  }

  async submit(data, btn) {
    btn.disabled = true;
    const previewButton = this.content.querySelector('[data-preview]');
    if (previewButton) previewButton.disabled = true;
    btn.textContent = 'Unlocking';
    const payload = {
      name: data.name.trim(),
      company: data.company.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      role: data.role,
      requestId: this.submissionId ||= crypto.randomUUID(),
      project: 'Tourlo Demo Residences',
      source: 'tourlo-web-demo',
      trigger: this.reason || 'unknown',
      page: location.href,
      referrer: document.referrer || null,
      submittedAt: new Date().toISOString(),
      activeSeconds: this.activeSeconds,
      ...this.getContext(),
    };
    try { await sendLead(payload); } catch (error) {
      const message=this.content.querySelector('.lead-error');
      message.hidden=false; message.textContent=error.message || 'Your details could not be saved. Please try again.';
      if (previewButton) previewButton.disabled = false;
      btn.disabled=false; btn.textContent='Try again'; return;
    }
    this.submissionId=null;
    track('lead_submit', { role: payload.role, trigger: payload.trigger });
    this.unlocked = true;
    session.set(KEY, '1');
    this.content.innerHTML = `
      <div class="lead-done">
        <div class="check">${CHECK}</div>
        <h2 id="lead-title">Thank you, ${escapeHTML(payload.name.split(' ')[0])}</h2>
        <p>Your details have been saved. Continue your visit from where you left off.</p>
        <button class="btn btn-gold btn-block" type="button" data-done>Continue</button>
      </div>`;
    const done = () => {
      this.hide();
      const action = this.pending;
      this.pending = null;
      action?.();
    };
    this.content.querySelector('[data-done]').addEventListener('click', done);
    this.content.querySelector('[data-done]').focus();
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function sendLead(payload) {
  const response=await fetch(config.leadWebhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || result.ok!==true) throw new Error(result.error || 'Your details could not be saved. Please try again.');
  return result;
}
