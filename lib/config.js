// NEXT_PUBLIC_* values are inlined at build time. next.config.mjs also maps the
// older VITE_* names onto them, so either name works in Vercel.
export const config = {
  leadWebhook: (process.env.NEXT_PUBLIC_LEAD_WEBHOOK || '').trim(),
  gaId: (process.env.NEXT_PUBLIC_GA_ID || '').trim(),
  bookingUrl: (process.env.NEXT_PUBLIC_BOOKING_URL || '').trim() || 'https://tourlo.in',
  dev: new URLSearchParams(location.search).get('dev') === '1',
};

// Runtime files live in public/ so they can be edited without touching code.
export const url = (p) => new URL(p, document.baseURI).href;

export const isSmallScreen = () => Math.min(window.screen.width, window.screen.height) < 768 || window.innerWidth < 768;
