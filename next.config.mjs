// Public settings are inlined into the browser bundle at build time. Either the Next.js
// names or the legacy Vite names work, so existing Vercel environment variables keep working.
// GOOGLE_SCRIPT_URL / GOOGLE_SCRIPT_SECRET are server-only and are deliberately not listed here.
const pick = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim()) || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    TOURLO_GA_ID: pick('NEXT_PUBLIC_GA_ID', 'VITE_GA_ID'),
    TOURLO_BOOKING_URL: pick('NEXT_PUBLIC_BOOKING_URL', 'VITE_BOOKING_URL'),
  },
  async headers() {
    return [
      {
        // Embeddable on tourlo.in (and anywhere else) inside an iframe; sensors and mic for the 360 viewer and voice guide.
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'Permissions-Policy', value: 'gyroscope=*, accelerometer=*, magnetometer=*, microphone=*' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/data/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=60, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
