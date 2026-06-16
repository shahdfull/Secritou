FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
COPY server/prisma ./server/prisma
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server ./server
COPY shared ./shared
COPY package.json package-lock.json ./
RUN npm run prisma:generate --workspace server && npm run build --workspace shared && npm run build --workspace server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY server/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
