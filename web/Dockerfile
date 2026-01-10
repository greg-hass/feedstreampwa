FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["sh", "-lc", "rm -rf /out/* && cp -a /app/build/. /out/ && echo '✅ Build output copied to /out'"]