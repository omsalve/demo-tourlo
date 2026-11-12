const pick = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim()) || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Accept either the NEXT_PUBLIC_* names or the original VITE_* names.
  env: {
    NEXT_PUBLIC_LEAD_WEBHOOK: pick('NEXT_PUBLIC_LEAD_WEBHOOK', 'VITE_LEAD_WEBHOOK'),
    NEXT_PUBLIC_GA_ID: pick('NEXT_PUBLIC_GA_ID', 'VITE_GA_ID'),
    NEXT_PUBLIC_BOOKING_URL: pick('NEXT_PUBLIC_BOOKING_URL', 'VITE_BOOKING_URL'),
  },
  async headers() {
    return [
      {
        // Embeddable on any site (tourlo.in iframe). To restrict, use
        // "frame-ancestors https://tourlo.in https://*.tourlo.in".
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'Permissions-Policy', value: 'gyroscope=*, accelerometer=*, magnetometer=*' },
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
