// Voice and typed commands ("take me to the rooftop", "show floor 12", "night view").
// Speech recognition runs in the browser (Web Speech API), so there is no backend or key.
// Browsers without it (Firefox, some in-app browsers) get the same commands as a text box.

const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const SUGGESTIONS = [
  'Take me to the rooftop',
  'Show me the lobby',
  'Go to floor 12',
  'Show available 3 BHK',
  'Open the sky villa',
  'Night view',
];

const NUMBER_WORDS = {
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5,
  six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10,
  eleven: 11, eleventh: 11, twelve: 12, twelfth: 12, thirteen: 13, thirteenth: 13, fourteen: 14,
  fourteenth: 14, fifteen: 15, fifteenth: 15, sixteen: 16, sixteenth: 16, seventeen: 17, seventeenth: 17,
  eighteen: 18, eighteenth: 18, nineteen: 19, nineteenth: 19, twenty: 20, twentieth: 20,
};

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}`).test(text));

// Turns what was heard into one action. Order matters: the most specific matches come first.
export function parseCommand(raw) {
  const text = ` ${raw.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;

  const unit = text.match(/\b(?:unit|flat|apartment|home)\s*(?:number\s*)?(\d{3,4})\b/);
  if (unit) return { type: 'unit', unit: unit[1] };

  const floorDigits = text.match(/\b(?:floor|level)\s*(?:number\s*)?(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:floor|level)\b/);
  if (floorDigits) return { type: 'floor', floor: +(floorDigits[1] || floorDigits[2]) };
  const floorWord = text.match(/\b(?:floor|level)\s+(\w+)\b|\b(\w+)\s+(?:floor|level)\b/);
  const fw = floorWord && NUMBER_WORDS[floorWord[1] || floorWord[2]];
  if (fw) return { type: 'floor', floor: fw };
  if (has(text, ['top floor', 'highest floor', 'penthouse'])) return { type: 'floor', floor: 'top' };

  if (has(text, ['close', 'exit', 'go back', 'back to the tower', 'back to tower', 'home page', 'homepage', 'start again']))
    return { type: 'home' };

  if (has(text, ['book', 'demo', 'call me', 'contact', 'talk to', 'sales team'])) return { type: 'book' };

  if (has(text, ['night', 'evening', 'dusk', 'dark'])) return { type: 'night', on: true };
  if (has(text, ['day view', 'daytime', 'daylight', 'morning', 'sunlight', 'day'])) return { type: 'night', on: false };

  const bhk = /\b(3|three) ?bhk|type a\b/.test(text) ? 3 : /\b(4|four) ?bhk|sky ?villa|villa|duplex|type b\b/.test(text) ? 4 : null;
  const wantsList = has(text, ['available', 'availability', 'inventory', 'what is left', 'whats left', 'vacant', 'unsold', 'show me all', 'filter', 'find']);
  if (wantsList && bhk) return { type: 'filter', bhk };
  if (wantsList) return { type: 'availability' };

  if (has(text, ['balcony', 'view from'])) return { type: 'balcony' };
  if (has(text, ['rooftop', 'roof top', 'rough top', 'ruff top', 'roof', 'terrace', 'top of the building', 'sky deck'])) return { type: 'room', tour: 'site', room: 'ext_rooftop' };
  if (has(text, ['lobby', 'reception', 'inside the building', 'entrance hall'])) return { type: 'room', tour: 'site', room: 'ext_lobby' };
  if (has(text, ['garden', 'podium', 'pool', 'swimming', 'amenit', 'clubhouse', 'landscap'])) return { type: 'room', tour: 'site', room: 'ext_podium' };
  if (has(text, ['aerial', 'drone', 'bird', 'location', 'neighbourhood', 'neighborhood', 'surrounding', 'area around', 'map'])) return { type: 'room', tour: 'site', room: 'ext_aerial' };
  if (has(text, ['metro', 'station', 'train', 'transport', 'connectivity'])) return { type: 'room', tour: 'site', room: 'ext_station' };
  if (has(text, ['plaza', 'arrival', 'drop off', 'dropoff', 'entry', 'outside', 'exterior', 'front of'])) return { type: 'room', tour: 'site', room: 'ext_plaza' };

  if (bhk === 4) {
    if (has(text, ['lounge', 'double height'])) return { type: 'room', tour: 'typeB', room: 'typeB_lounge' };
    if (has(text, ['stair', 'dining'])) return { type: 'room', tour: 'typeB', room: 'typeB_stair_dining' };
    return { type: 'room', tour: 'typeB', room: 'typeB_living' };
  }
  if (has(text, ['study', 'office', 'work from home'])) return { type: 'room', tour: 'typeA', room: 'typeA_study' };
  if (has(text, ['dining'])) return { type: 'room', tour: 'typeA', room: 'typeA_living_dining' };
  if (bhk === 3 || has(text, ['living room', 'inside', 'interior', 'apartment', 'flat', 'home', 'house', 'walkthrough', 'sample']))
    return { type: 'room', tour: 'typeA', room: 'typeA_living' };

  return { type: 'unknown' };
}

export class VoiceAssistant {
  constructor({ onCommand, track }) {
    this.onCommand = onCommand;
    this.track = track || (() => {});
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.SR = SR;
    this.listening = false;
    this.buildPanel();
  }

  // A mic button that can be placed anywhere (tower controls, 360 viewer).
  button(extraClass = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pill-btn icon-only voice-btn ${extraClass}`;
    b.setAttribute('aria-label', 'Ask by voice, for example: take me to the rooftop');
    b.innerHTML = MIC;
    b.addEventListener('click', () => this.open());
    return b;
  }

  buildPanel() {
    const el = document.createElement('div');
    el.className = 'voice-panel';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Voice guide');
    el.innerHTML = `
      <div class="voice-card">
        <button class="icon-btn voice-close" type="button" aria-label="Close">${CLOSE}</button>
        <button class="voice-orb" type="button" aria-label="Start listening">${MIC}</button>
        <p class="voice-status" aria-live="polite"></p>
        <p class="voice-heard"></p>
        <form class="voice-form">
          <input type="text" name="q" autocomplete="off" placeholder="Or type: take me to the lobby" aria-label="Type a command"/>
          <button class="btn btn-gold btn-sm" type="submit">Go</button>
        </form>
        <div class="voice-chips">${SUGGESTIONS.map((s) => `<button type="button" class="chip">${s}</button>`).join('')}</div>
      </div>`;
    document.body.appendChild(el);
    this.panel = el;
    this.status = el.querySelector('.voice-status');
    this.heard = el.querySelector('.voice-heard');
    this.orb = el.querySelector('.voice-orb');
    el.querySelector('.voice-close').addEventListener('click', () => this.close());
    el.addEventListener('click', (e) => e.target === el && this.close());
    this.orb.addEventListener('click', () => (this.listening ? this.stop() : this.listen()));
    el.querySelector('.voice-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.q;
      if (input.value.trim()) this.handle(input.value.trim(), 'typed');
      input.value = '';
    });
    el.querySelectorAll('.voice-chips .chip').forEach((c) => c.addEventListener('click', () => this.handle(c.textContent, 'chip')));
    window.addEventListener('keydown', (e) => e.key === 'Escape' && !el.hidden && this.close());
  }

  open() {
    this.panel.hidden = false;
    this.heard.textContent = '';
    if (this.supported) this.listen();
    else {
      this.orb.disabled = true;
      this.status.textContent = 'Voice is not available in this browser. Type or tap a suggestion.';
      this.panel.querySelector('input').focus();
    }
  }

  close() {
    this.stop();
    this.panel.hidden = true;
  }

  listen() {
    if (!this.supported || this.listening) return;
    const rec = new this.SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    this.rec = rec;
    this.listening = true;
    this.panel.classList.add('is-listening');
    this.status.textContent = 'Listening. Try "take me to the rooftop"';
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (const r of e.results) {
        if (r.isFinal) finalText = r[0].transcript;
        else interim += r[0].transcript;
      }
      this.heard.textContent = `"${finalText || interim}"`;
      if (finalText) {
        // Try the alternatives too, so "rough top" can still be matched as "rooftop".
        const alts = [...e.results[e.results.length - 1]].map((a) => a.transcript);
        const hit = alts.find((a) => parseCommand(a).type !== 'unknown') || finalText;
        this.handle(hit, 'voice');
      }
    };
    rec.onerror = (e) => {
      const msg =
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in the browser, or type below.'
          : e.error === 'no-speech'
            ? 'I did not catch that. Tap the mic and try again.'
            : 'Voice is unavailable right now. Type or tap a suggestion.';
      this.status.textContent = msg;
    };
    rec.onend = () => {
      this.listening = false;
      this.panel.classList.remove('is-listening');
      if (this.status.textContent.startsWith('Listening')) this.status.textContent = 'Tap the mic to speak again';
    };
    try {
      rec.start();
    } catch {
      this.listening = false;
      this.panel.classList.remove('is-listening');
    }
  }

  stop() {
    try {
      this.rec?.stop();
    } catch {
      /* already stopped */
    }
  }

  handle(text, via) {
    const cmd = parseCommand(text);
    this.heard.textContent = `"${text}"`;
    this.track('voice_command', { intent: cmd.type, via, heard: text.slice(0, 80) });
    if (cmd.type === 'unknown') {
      this.status.textContent = 'Sorry, I can take you to the rooftop, lobby, garden, a floor or a home. Try one of these:';
      this.say('Sorry, I did not get that.');
      return;
    }
    const reply = this.onCommand(cmd);
    if (reply === false) {
      this.status.textContent = 'That one is not available here. Try another.';
      return;
    }
    this.say(reply);
    this.close();
  }

  // Short spoken confirmation, if the browser can speak.
  say(text) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      u.rate = 1.05;
      const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-IN') || speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch {
      /* speaking is optional */
    }
  }
}
