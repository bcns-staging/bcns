# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# Trust any extra CA cert placed in certs/ (e.g. corporate/antivirus TLS-inspection
# root certs — see README "Local Docker builds behind SSL-inspecting proxies").
# Appended directly to the base image's existing bundle: no-op when certs/ is
# empty, and avoids needing network access (via apk) to install trust tooling,
# which would itself be blocked by an untrusted intercepting proxy.
COPY certs/ /tmp/extra-certs/
RUN for f in /tmp/extra-certs/*.crt; do [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; done; \
    rm -rf /tmp/extra-certs
ENV NODE_OPTIONS=--use-system-ca

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage: serve the static output ---
FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
