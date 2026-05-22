FROM oven/bun:1.3.13 AS deps
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

FROM oven/bun:1.3.13 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app ./

EXPOSE 3002

CMD ["bun", "apps/checkout-api/src/index.ts"]
