# Build context is the repo root (see docker build -f graphql-api/Dockerfile .)
# so this can reuse the same trusted-cert bundle as the main site's Dockerfile.

# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY certs/ /tmp/extra-certs/
RUN for f in /tmp/extra-certs/*.crt; do [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; done; \
    rm -rf /tmp/extra-certs
ENV NODE_OPTIONS=--use-system-ca

COPY graphql-api/package.json graphql-api/package-lock.json* ./
RUN npm install

COPY graphql-api/tsconfig.json ./
COPY graphql-api/src/ ./src/
RUN npm run build

# --- runtime stage ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY certs/ /tmp/extra-certs/
RUN for f in /tmp/extra-certs/*.crt; do [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; done; \
    rm -rf /tmp/extra-certs
ENV NODE_OPTIONS=--use-system-ca

COPY graphql-api/package.json graphql-api/package-lock.json* ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.js"]
