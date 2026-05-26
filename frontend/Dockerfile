FROM node:22-slim AS builder

WORKDIR /app

ENV CI=true

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm fetch
RUN pnpm install --offline

COPY . .

RUN pnpm build

# Production image
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]