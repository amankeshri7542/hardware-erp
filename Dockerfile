# ─── Stage 1: Build frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
# VITE_API_URL left empty → uses /api (nginx proxy handles it)
RUN npm run build

# ─── Stage 2: Backend runtime ─────────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /app

# Install Chrome for Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --silent
COPY backend/ ./

# Copy built frontend into backend's static serving path
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]
