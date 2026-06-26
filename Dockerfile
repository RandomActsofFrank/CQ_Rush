FROM node:18-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:18-alpine AS server

WORKDIR /app

COPY prisma ./prisma
COPY server/package.json server/package-lock.json* ./server/

WORKDIR /app/server
RUN npm ci --omit=dev
RUN npx prisma generate --schema=../prisma/schema.prisma

WORKDIR /app
COPY server/ ./server/
COPY --from=client-build /app/client/build ./client/build

WORKDIR /app/server
ENV NODE_ENV=production

EXPOSE 3002

CMD ["sh", "-c", "npx prisma migrate deploy --schema=../prisma/schema.prisma && node seed.js && node index.js"]
