FROM node:20-alpine AS builder

WORKDIR /app

# Copy the monorepo context from root to build
COPY worker/package*.json ./worker/
COPY backend/prisma/schema.prisma ./backend/prisma/
RUN cd worker && npm install

COPY worker/ ./worker/
RUN cd worker && npx prisma generate --schema=../backend/prisma/schema.prisma
RUN cd worker && npx tsc

FROM node:20-alpine

WORKDIR /app

COPY worker/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/worker/dist ./dist
COPY --from=builder /app/worker/node_modules/@prisma/client ./node_modules/@prisma/client

CMD ["node", "dist/main.js"]
