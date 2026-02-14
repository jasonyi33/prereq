FROM node:20-slim AS base

WORKDIR /app

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
