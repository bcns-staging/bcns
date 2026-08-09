# Build context is the repo root (see docker build -f mail-lab/Dockerfile .)
# so this can reuse the same trusted-cert bundle as the main site's Dockerfile.
FROM node:22-alpine
WORKDIR /app

COPY certs/ /tmp/extra-certs/
RUN for f in /tmp/extra-certs/*.crt; do [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; done; \
    rm -rf /tmp/extra-certs
ENV NODE_OPTIONS=--use-system-ca
ENV NODE_ENV=production

COPY mail-lab/package.json mail-lab/package-lock.json* ./
RUN npm install --omit=dev

COPY mail-lab/lib ./lib
COPY mail-lab/public ./public
COPY mail-lab/routes ./routes
COPY mail-lab/server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
