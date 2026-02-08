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
# ✅ Instaliraj Rhubarb (Linux) + RES folder (PocketSphinx)
RUN set -eux; \
    mkdir -p .bin; \
    curl -L -o /tmp/rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip; \
    unzip -o /tmp/rhubarb.zip -d /tmp/rhubarb; \
    RHUBARB_BIN="$(find /tmp/rhubarb -type f -name rhubarb -perm -u+x | head -n 1)"; \
    RHUBARB_DIR="$(dirname "$RHUBARB_BIN")"; \
    echo "Found rhubarb at: ${RHUBARB_BIN}"; \
    echo "Rhubarb dir: ${RHUBARB_DIR}"; \
    cp "${RHUBARB_BIN}" /app/.bin/rhubarb; \
    chmod +x /app/.bin/rhubarb; \
    # ✅ ovo je ključno: kopiraj res/ pored binarija
    cp -R "${RHUBARB_DIR}/res" /app/.bin/res; \
    ls -la /app/.bin; \
    ls -la /app/.bin/res/sphinx || true; \
    rm -rf /tmp/rhubarb /tmp/rhubarb.zip

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node","server.js"]