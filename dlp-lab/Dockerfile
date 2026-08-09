# Build context is the repo root (see docker build -f dlp-lab/Dockerfile .)
# so this can reuse the same trusted-cert bundle as the main site's Dockerfile.
FROM node:22-alpine
WORKDIR /app

COPY certs/ /tmp/extra-certs/
RUN for f in /tmp/extra-certs/*.crt; do [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; done; \
    rm -rf /tmp/extra-certs
ENV NODE_OPTIONS=--use-system-ca
ENV NODE_ENV=production

COPY dlp-lab/package.json dlp-lab/package-lock.json* ./
RUN npm install --omit=dev

COPY dlp-lab/lib ./lib
COPY dlp-lab/public ./public
COPY dlp-lab/routes ./routes
COPY dlp-lab/server.js ./server.js
COPY dlp-lab/eng.traineddata ./eng.traineddata

EXPOSE 8080
CMD ["node", "server.js"]
