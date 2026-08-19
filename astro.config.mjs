// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.7beacons.com',
  integrations: [react()],
  // The three admin tools used to be three separate pages/logins; now
  // they're tabs on one console. These keep old bookmarks/muscle memory
  // landing somewhere useful instead of a dead 404.
  redirects: {
    '/fm/admin': '/admin?tab=files',
    '/timeradmin': '/admin?tab=timers',
    '/deaddrop': '/admin?tab=deaddrop',
  },
  security: {
    csp: {
      // Astro auto-hashes its own inline scripts/styles (including island
      // hydration runtime) and merges these in; no 'unsafe-inline' needed.
      directives: [
        "default-src 'self'",
        // data:/blob: for MapLibre's rendered tile bitmaps; blob: workers
        // and tiles.openfreemap.org connect-src are for the /map page.
        // storage.googleapis.com connect-src is for /fm/admin's uploads --
        // the admin UI PUTs large files directly to a signed GCS URL,
        // bypassing mcp-fileserver's own Cloud Run request-size limit.
        // mcp-fileserver origin is for /fm's image previews.
        "img-src 'self' data: blob: https://i.pravatar.cc https://mcp-fileserver-751371770492.us-central1.run.app",
        // audio/video previews on /fm -- there's no "audio-src"/
        // "video-src"; media-src is the real directive, and with none
        // declared at all it falls back to default-src 'self', which would
        // silently block this origin. storage.googleapis.com is for video/
        // audio playback specifically: those <source> elements point at a
        // short-lived signed GCS URL (?format=signed-url), not the proxied
        // mcp-fileserver route, since Cloud Run doesn't support the HTTP
        // Range requests video playback/seeking needs.
        "media-src 'self' https://mcp-fileserver-751371770492.us-central1.run.app https://storage.googleapis.com",
        // /dbs loads Barlow Condensed + JetBrains Mono from Google Fonts --
        // fonts.googleapis.com serves the @font-face CSS (see styleDirective
        // below for that stylesheet link itself), fonts.gstatic.com serves
        // the actual woff2 files those @font-face rules point at.
        "font-src 'self' https://fonts.gstatic.com",
        "worker-src blob:",
        // YouTube Live embed for /project-4's public wildlife cam; mcp-fileserver
        // origin added for /fm's PDF preview via <iframe> (not
        // <embed>/<object>, so this belongs under frame-src, not object-src).
        // challenges.cloudflare.com renders the actual Turnstile challenge
        // (/fm/admin's login) in its own iframe -- that's real infrastructure
        // on Cloudflare's side, not something that can be vendored in.
        "frame-src https://www.youtube.com https://mcp-fileserver-751371770492.us-central1.run.app https://challenges.cloudflare.com",
        "child-src blob:",
        // mcp-fileserver-...run.app is /fm's file explorer (separate
        // repo/service, github.com/bcns-staging/mcp-fileserver).
        // challenges.cloudflare.com is Turnstile's own token-verification
        // traffic (see frame-src above for why it's needed at all).
        "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://www.marineregions.org https://bcns-graphql-api-751371770492.us-central1.run.app https://mcp-fileserver-751371770492.us-central1.run.app https://storage.googleapis.com http://localhost:4000 https://challenges.cloudflare.com",
        "form-action 'self'",
        "base-uri 'none'",
      ],
      // Turnstile's script (challenges.cloudflare.com/turnstile/v0/api.js,
      // loaded on /fm/admin only) and whatever it injects for its own
      // widget UI can't be covered by Astro's auto-generated hashes, since
      // that content isn't known at build time -- these two explicitly
      // allowlist the domain instead, alongside (not instead of) the
      // per-page hashes Astro keeps adding automatically.
      scriptDirective: {
        resources: ["'self'", "https://challenges.cloudflare.com"],
      },
      styleDirective: {
        // fonts.googleapis.com is /dbs's Google Fonts stylesheet link (see
        // font-src above for the actual font files that stylesheet points at).
        resources: ["'self'", "https://challenges.cloudflare.com", "https://fonts.googleapis.com"],
      },
    },
  },
});