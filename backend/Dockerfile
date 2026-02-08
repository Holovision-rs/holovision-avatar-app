# -------------------------------
# 1) DEPS STAGE (cache-friendly)
# -------------------------------
FROM node:22-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only dependency manifests first (best cache)
COPY package*.json ./
# If you use yarn, uncomment:
# COPY yarn.lock ./

# ✅ Use npm install (works without package-lock.json)
RUN npm install --omit=dev


# ----------------------------------------
# 2) RUNTIME STAGE (small + production)
# ----------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p audios

# Install Rhubarb (Linux) - robust binary discovery
# ✅ Instaliraj Rhubarb (Linux) + res folder (PocketSphinx models)
RUN set -eux; \
    mkdir -p .bin; \
    curl -L -o /tmp/rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip; \
    unzip -o /tmp/rhubarb.zip -d /tmp/rhubarb; \
    RHUBARB_DIR="$(find /tmp/rhubarb -type d -name 'Rhubarb-Lip-Sync-*-Linux' | head -n 1)"; \
    echo "Rhubarb dir: ${RHUBARB_DIR}"; \
    cp "${RHUBARB_DIR}/rhubarb" .bin/rhubarb; \
    chmod +x .bin/rhubarb; \
    cp -R "${RHUBARB_DIR}/res" .bin/res; \
    rm -rf /tmp/rhubarb /tmp/rhubarb.zip

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node","server.js"]