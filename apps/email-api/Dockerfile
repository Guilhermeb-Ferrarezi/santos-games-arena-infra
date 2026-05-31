# Stage 1: Build emails-web (SPA)
FROM oven/bun:1-alpine AS frontend
WORKDIR /web
COPY apps/emails-web/package.json ./
RUN bun install
COPY apps/emails-web/ .
ARG VITE_AUTH_API_URL=https://auth.santos-games.com
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
RUN bun run build

# Stage 2: Build email-api (Go)
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY apps/email-api/go.mod apps/email-api/go.sum ./
RUN go mod download
COPY apps/email-api/ .
COPY --from=frontend /web/dist ./dist
RUN CGO_ENABLED=0 GOOS=linux go build -o email-api .

# Stage 3: Runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/email-api .
EXPOSE 3005
CMD ["./email-api"]
