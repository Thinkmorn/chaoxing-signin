# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
    git unzip curl build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.4

WORKDIR /build

# Copy dependency manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/chaoxing-core/package.json packages/chaoxing-core/
COPY packages/napcat-shell/package.json packages/napcat-shell/
COPY packages/napcat-core/package.json packages/napcat-core/
COPY packages/napcat-common/package.json packages/napcat-common/
COPY packages/napcat-adapter/package.json packages/napcat-adapter/
COPY packages/napcat-onebot/package.json packages/napcat-onebot/
COPY packages/napcat-protocol/package.json packages/napcat-protocol/
COPY packages/napcat-protobuf/package.json packages/napcat-protobuf/
COPY packages/napcat-pty/package.json packages/napcat-pty/
COPY packages/napcat-dpapi/package.json packages/napcat-dpapi/
COPY packages/napcat-database/package.json packages/napcat-database/
COPY packages/napcat-image-size/package.json packages/napcat-image-size/
COPY packages/napcat-qrcode/package.json packages/napcat-qrcode/
COPY packages/napcat-webui-backend/package.json packages/napcat-webui-backend/
COPY packages/napcat-vite/package.json packages/napcat-vite/
COPY packages/napcat-napi-loader/package.json packages/napcat-napi-loader/

# Install dependencies (includes prebuild-install for node-pty)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY tsconfig.base.json ./
COPY packages/ packages/

# Build napcat-shell (produces dist/napcat.mjs + native binaries)
RUN cd packages/napcat-shell && npx vite build

# Build chaoxing-core (tsc compile)
RUN cd packages/chaoxing-core && node scripts/build.js

# Remove any config files that might have been copied during build (env.json, storage.json)
# These contain credentials and must NOT be baked into the image
RUN rm -f packages/chaoxing-core/dist/env.json && \
    rm -f packages/chaoxing-core/dist/configs/storage.json

# Download NapCat Shell (Linux)
RUN node packages/chaoxing-core/dist/scripts/download-napcat.js --non-interactive

# Overlay custom napcat-shell build into NapCat runtime
RUN if [ -f packages/napcat-shell/dist/napcat.mjs ]; then \
      cp packages/napcat-shell/dist/napcat.mjs napcat/napcat/napcat.mjs; \
    fi && \
    if [ -d packages/napcat-shell/dist/native ]; then \
      cp -r packages/napcat-shell/dist/native/* napcat/napcat/native/ 2>/dev/null || true; \
    fi && \
    if [ -d packages/napcat-shell/dist/worker ]; then \
      cp -r packages/napcat-shell/dist/worker/* napcat/napcat/worker/ 2>/dev/null || true; \
    fi && \
    if [ -d packages/napcat-shell/dist/config ]; then \
      cp -r packages/napcat-shell/dist/config/* napcat/napcat/config/ 2>/dev/null || true; \
    fi

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules (production only)
COPY --from=builder /build/node_modules ./node_modules

# Copy workspace structure
COPY --from=builder /build/packages ./packages

# Copy NapCat runtime (bundled Node + native addons)
COPY --from=builder /build/napcat ./napcat

# Copy root shim files
COPY --from=builder /build/start-all.js ./
COPY --from=builder /build/start.js ./
COPY --from=builder /build/monitor.js ./
COPY --from=builder /build/qqbot.js ./
COPY --from=builder /build/download-napcat.js ./
COPY --from=builder /build/package.json ./
COPY --from=builder /build/pnpm-workspace.yaml ./

# Copy entrypoint script
COPY dockr-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create runtime directories
RUN mkdir -p /app/configs

EXPOSE 3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "packages/chaoxing-core/dist/scripts/start-all.js"]
