FROM node:20-slim AS base

# Install libstdc++6 from Debian testing (trixie) — the @zoom/rtms native
# binary needs GLIBCXX_3.4.32 which requires GCC 13+, not available in Bookworm
RUN echo "deb http://deb.debian.org/debian trixie main" > /etc/apt/sources.list.d/trixie.list && \
    apt-get update && \
    apt-get install -y -t trixie libstdc++6 && \
    rm -f /etc/apt/sources.list.d/trixie.list && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create logs directory for @zoom/rtms SDK internal logging
RUN mkdir -p /app/logs

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js (NEXT_PUBLIC_* vars must be set at build time via Render build args)
ARG NEXT_PUBLIC_FLASK_API_URL
ENV NEXT_PUBLIC_FLASK_API_URL=$NEXT_PUBLIC_FLASK_API_URL
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
