const env = import.meta.env;

export const config = {
  leadWebhook: (env.VITE_LEAD_WEBHOOK || '').trim(),
  gaId: (env.VITE_GA_ID || '').trim(),
  bookingUrl: (env.VITE_BOOKING_URL || '').trim() || 'https://tourlo.in',
  dev: new URLSearchParams(location.search).get('dev') === '1',
};

// Runtime files live next to index.html so they can be edited after deploy.
export const url = (p) => new URL(p, document.baseURI).href;

export const isSmallScreen = () => Math.min(window.screen.width, window.screen.height) < 768 || window.innerWidth < 768;
