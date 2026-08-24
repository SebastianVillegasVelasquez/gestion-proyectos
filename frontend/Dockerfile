FROM node:22-slim AS builder

WORKDIR /app

ENV CI=true

# Installs pnpm globally in the builder image to manage Node.js dependencies
RUN npm install -g pnpm

# Copies dependency files to the working directory in the builder image
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Fetches and installs the dependencies defined in the package.json file using pnpm, allowing for offline installation
RUN pnpm fetch
RUN pnpm install --offline

#
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm build

# Production image
FROM nginx:alpine AS prod


# Sets the working directory for the production image to the Nginx configuration directory
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copies the built application files from the builder image to the Nginx HTML directory in the production image
COPY --from=builder /app/dist /usr/share/nginx/html

# Installs the shadow package in the production image to manage user accounts and permissions
RUN apk add --no-cache shadow

RUN useradd --no-create-home --shell /bin/false --uid 1001 appuser
RUN chown -R appuser:appuser /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]

# -- Stage dev: development image for local dev and testing -----------------------------
FROM node:22-slim AS dev

WORKDIR /app

ENV CI=true

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm fetch
RUN pnpm install --offline

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=/api/v1

EXPOSE 5173

CMD ["pnpm", "dev", "--host"]