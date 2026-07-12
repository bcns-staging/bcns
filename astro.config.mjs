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
        "img-src 'self' data:",
        "form-action 'self'",
        "base-uri 'none'",
      ],
    },
  },
});