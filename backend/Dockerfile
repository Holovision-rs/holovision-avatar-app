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

# ✅ Prod deps only (faster, less noise)
RUN npm install --omit=dev --no-audit --no-fund


# ----------------------------------------
# 2) RUNTIME STAGE (small + production)
# ----------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg sox libsox-fmt-all curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bring deps + app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ✅ Required runtime folders
RUN mkdir -p audios tmp .bin

# ✅ Rhubarb + res (PocketSphinx models) - ROBUST
RUN set -eux; \
  curl -L -o /tmp/rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip; \
  unzip -o /tmp/rhubarb.zip -d /tmp/rhubarb; \
  RHUBARB_BIN="$(find /tmp/rhubarb -type f -name rhubarb -perm -u+x | head -n 1)"; \
  RHUBARB_ROOT="$(dirname "$RHUBARB_BIN")"; \
  echo "Rhubarb bin: $RHUBARB_BIN"; \
  echo "Rhubarb root: $RHUBARB_ROOT"; \
  cp "$RHUBARB_BIN" .bin/rhubarb; \
  chmod +x .bin/rhubarb; \
  cp -R "$RHUBARB_ROOT/res" .bin/res; \
  test -f .bin/res/sphinx/acoustic-model/mdef; \
  rm -rf /tmp/rhubarb /tmp/rhubarb.zip

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node","server.js"]