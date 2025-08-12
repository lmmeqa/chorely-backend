# ---- development image ----
FROM node:18-alpine

WORKDIR /app

# 1. deps first for better layer-caching
COPY package*.json ./
RUN npm install --include=dev

# 2. dev tools
RUN apk add --no-cache postgresql-client

# 3. app source (mounted as a volume in compose)
COPY . .

# 4. run with hot-reload
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "--max-old-space-size=4096", "src/index.ts"]
