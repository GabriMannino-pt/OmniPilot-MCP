# ------------------------------------------------------------------------------
# Build Stage
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

COPY web-dashboard/ ./web-dashboard/
RUN cd web-dashboard && npm ci && npm run build

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Default to stdio MCP transport (Zero Split-Brain)
ENV OMNIPILOT_DISABLE_DASHBOARD=true

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web-dashboard/dist ./web-dashboard/dist

RUN mkdir -p /app/screenshots && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
