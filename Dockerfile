FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY server ./server
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV NAS_TRANSFER_DIR=/app/nas/transfer
ENV NAS_MUSIC_DIR=/app/nas/music
ENV DOCKER_SOCKET_PATH=/var/run/docker.sock

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src/data ./src/data

RUN mkdir -p /app/data /app/nas/transfer /app/nas/music

EXPOSE 3000

CMD ["node", "server/index.js"]
