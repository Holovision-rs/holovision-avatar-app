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
# If you use yarn:
# COPY yarn.lock ./

# Install prod deps only
RUN npm ci --omit=dev


# ----------------------------------------
# 2) RUNTIME STAGE (small + production)
# ----------------------------------------
FROM node:22-bookworm-slim AS runtime

# System deps (ffmpeg + tools for rhubarb install)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY . .

# Install Rhubarb (Linux) - robust binary discovery
RUN set -eux; \
    mkdir -p .bin; \
    curl -L -o /tmp/rhubarb.zip "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip"; \
    unzip -o /tmp/rhubarb.zip -d /tmp/rhubarb; \
    RHUBARB_BIN="$(find /tmp/rhubarb -type f -name rhubarb -perm -u+x | head -n 1)"; \
    echo "Found rhubarb at: ${RHUBARB_BIN}"; \
    test -n "${RHUBARB_BIN}"; \
    cp "${RHUBARB_BIN}" .bin/rhubarb; \
    chmod +x .bin/rhubarb; \
    rm -rf /tmp/rhubarb /tmp/rhubarb.zip

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node","server.js"]