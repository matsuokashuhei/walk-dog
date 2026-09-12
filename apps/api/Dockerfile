# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
RUN npm run build

FROM node:24-alpine AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
COPY test ./test
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:24-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && mkdir -p /tmp/dk \
  && cd /tmp/dk \
  && npm init -y \
  && npm install drizzle-kit@0.31.10 --omit=dev \
  && cp -a /tmp/dk/node_modules/. /app/node_modules/ \
  && rm -rf /tmp/dk
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
