/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `npm run build` writes plain files to out/ (Netlify / Vercel / S3).
  output: 'export',
  // Optional sub-path hosting, e.g. NEXT_PUBLIC_BASE_PATH=/tour npm run build
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

export default nextConfig;
