FROM node:22-bookworm-slim

# ✅ Instaliraj sistemske alate
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ✅ Kopiraj package fajlove PRVO (Docker cache trik)
COPY package*.json ./

# Ako koristiš yarn.lock — otkomentariši sledeću liniju:
# COPY yarn.lock ./

# ✅ Instaliraj dependencies
RUN npm install --omit=dev

# ✅ Kopiraj ostatak backend-a
COPY . .

# ✅ Instaliraj Rhubarb (Linux)
RUN mkdir -p .bin \
 && curl -L -o /tmp/rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip \
 && unzip -o /tmp/rhubarb.zip -d /tmp/rhubarb \
 && cp /tmp/rhubarb/rhubarb .bin/rhubarb \
 && chmod +x .bin/rhubarb \
 && rm -rf /tmp/rhubarb*

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm","run","start"]