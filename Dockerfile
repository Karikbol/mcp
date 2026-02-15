FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY scripts/docker-entry.sh /docker-entry.sh
RUN chmod +x /docker-entry.sh
EXPOSE 3100
ENV NODE_ENV=production
ENTRYPOINT ["/docker-entry.sh"]
