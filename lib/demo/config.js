// Public build-time settings. next.config.mjs maps NEXT_PUBLIC_* (or the legacy VITE_*) names onto these.
export const config = {
  leadWebhook: '/api/leads',
  gaId: (process.env.TOURLO_GA_ID || '').trim(),
  bookingUrl: (process.env.TOURLO_BOOKING_URL || '').trim() || 'https://tourlo.in',
  dev: new URLSearchParams(location.search).get('dev') === '1',
};

// Runtime files are served from public/ so they can be swapped without touching code.
export const url = (p) => new URL(p, document.baseURI).href;

export const isSmallScreen = () => Math.min(window.screen.width, window.screen.height) < 768 || window.innerWidth < 768;
