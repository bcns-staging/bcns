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
        // mcp-fileserver origin is for /project-6's image previews.
        "img-src 'self' data: blob: https://i.pravatar.cc https://mcp-fileserver-751371770492.us-central1.run.app",
        // audio/video previews on /project-6 -- there's no "audio-src"/
        // "video-src"; media-src is the real directive, and with none
        // declared at all it falls back to default-src 'self', which would
        // silently block this origin.
        "media-src 'self' https://mcp-fileserver-751371770492.us-central1.run.app",
        "worker-src blob:",
        // YouTube Live embed for /project-4's public wildlife cam; mcp-fileserver
        // origin added for /project-6's PDF preview via <iframe> (not
        // <embed>/<object>, so this belongs under frame-src, not object-src).
        "frame-src https://www.youtube.com https://mcp-fileserver-751371770492.us-central1.run.app",
        "child-src blob:",
        // mcp-fileserver-...run.app is /project-6's file explorer (separate
        // repo/service, github.com/bcns-staging/mcp-fileserver).
        "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://www.marineregions.org https://bcns-graphql-api-751371770492.us-central1.run.app https://mcp-fileserver-751371770492.us-central1.run.app http://localhost:4000",
        "form-action 'self'",
        "base-uri 'none'",
      ],
    },
  },
});