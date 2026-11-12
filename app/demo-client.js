'use client';

import { useEffect } from 'react';

// The demo is plain DOM + Three.js code that wires itself to the markup in
// page.js when lib/main.js is first imported. Importing it after hydration
// keeps it client only; the module cache makes sure it boots once, even when
// React Strict Mode runs effects twice in development.
export default function DemoClient() {
  useEffect(() => {
    import('../lib/main.js');
  }, []);
  return null;
}
