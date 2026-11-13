import { Manrope } from 'next/font/google';
import '../lib/demo/styles.css';
import '../lib/demo/v2.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata = {
  title: 'Tourlo Demo Residences | Interactive sales gallery',
  description:
    'Explore Tourlo Demo Residences, Mumbai: live inventory on a 3D tower, unit plans, cost sheets and 360 walkthroughs.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b0c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
