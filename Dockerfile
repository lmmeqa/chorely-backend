# backend/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app

# ─── everything is *already* in /backend context ───
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src        
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
EXPOSE 4000
