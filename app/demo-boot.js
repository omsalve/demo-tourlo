'use client';

import { useEffect } from 'react';

// The sales gallery is framework-free DOM code in lib/demo. It is imported only in the
// browser, after React has hydrated the static markup in page.js. Module evaluation runs
// boot() exactly once, even when React strict mode calls this effect twice in development.
export default function DemoBoot() {
  useEffect(() => {
    import('../lib/demo/main.js');
  }, []);
  return null;
}
