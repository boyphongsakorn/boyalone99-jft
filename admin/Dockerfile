# Admin frontend — local only
# Build:  docker build -t boyalone99-admin ./admin
# Run:    docker run --rm -p 4001:4001 -e PORT=4001 boyalone99-admin
# Needs backend on http://localhost:3000 (see backend/.env)
# NOTE: if backend also runs in Docker, run with --network host or
# -e BACKEND_URL and rebuild, or use docker-compose below.

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4001
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --prod --frozen-lockfile
EXPOSE 4001
CMD ["node", "dist/boyalone99-jft/server/server.mjs"]
