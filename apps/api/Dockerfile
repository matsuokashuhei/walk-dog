FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
COPY test ./test

EXPOSE 3000

CMD ["npm", "run", "dev"]
