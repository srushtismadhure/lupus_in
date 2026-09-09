# NEPHRA runs as a single persistent Bun server (Bun.serve() with a custom
# router in src/index.ts) — it is not a Next.js/static-site app, so it needs
# a host that runs a long-lived process rather than stateless serverless
# functions. This Dockerfile works unchanged on Railway, Render, Fly.io, or
# any other Docker-based host.

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies first so this layer is cached across builds.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source.
COPY . .
RUN bun run build

ENV NODE_ENV=production

# Bun's serve() reads process.env.PORT automatically; most hosts inject PORT
# at runtime, so no hardcoded port is baked into the image.
EXPOSE 3000

# Required at runtime (set these in the host's dashboard, never bake them
# into the image): FHIR_BASE_URL, FHIR_BEARER_TOKEN, APP_SESSION_SECRET.
CMD ["bun", "src/index.ts"]
