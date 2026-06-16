FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/package.json
COPY shared/package.json ./shared/package.json
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY client ./client
COPY shared ./shared
COPY package.json package-lock.json ./
RUN npm run build --workspace shared && npm run build --workspace client

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
