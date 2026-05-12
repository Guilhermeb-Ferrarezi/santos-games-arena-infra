FROM oven/bun:1.3.13 AS deps
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

FROM oven/bun:1.3.13 AS build
WORKDIR /app

ARG VITE_AUTH_API_URL
ENV VITE_AUTH_API_URL=${VITE_AUTH_API_URL}

COPY --from=deps /app ./

WORKDIR /app/apps/auth-web
RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY apps/auth-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/auth-web/dist /usr/share/nginx/html

EXPOSE 80
