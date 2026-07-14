// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.7beacons.com',
  integrations: [react()],
  security: {
    csp: {
      // Astro auto-hashes its own inline scripts/styles (including island
      // hydration runtime) and merges these in; no 'unsafe-inline' needed.
      directives: [
        "default-src 'self'",
        // data:/blob: for MapLibre's rendered tile bitmaps; blob: workers
        // and tiles.openfreemap.org connect-src are for the /map page.
        "img-src 'self' data: blob:",
        "worker-src blob:",
        "child-src blob:",
        "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://www.marineregions.org",
        "form-action 'self'",
        "base-uri 'none'",
      ],
    },
  },
});