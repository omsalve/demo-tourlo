import { config } from './config.js';

let enabled = false;

export function initAnalytics() {
  if (!config.gaId) return;
  enabled = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', config.gaId, { cookie_flags: 'SameSite=None;Secure' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.gaId)}`;
  document.head.appendChild(s);
}

export function track(name, params = {}) {
  if (config.dev) console.info('[analytics]', name, params);
  if (!enabled || !window.gtag) return;
  window.gtag('event', name, params);
}

// Reports engaged seconds each time the page is hidden (tab switch, close, navigate).
export function trackTimeSpent(getSeconds) {
  let reported = 0;
  const send = () => {
    const total = Math.round(getSeconds());
    const delta = total - reported;
    if (delta < 1) return;
    reported = total;
    track('time_spent', { seconds: delta, total_seconds: total, transport_type: 'beacon' });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  window.addEventListener('pagehide', send);
}
