# Cloudflare Tunnel

Este projeto usa um tunnel gerenciado pela Cloudflare, executado pelo container `cloudflared`.

## Servicos internos

No `docker-compose.yml`, os servicos internos sao:

- Auth Web: `http://auth-web:80`
- Auth API under `/api`: proxied by `auth-web` to `http://auth-api:3001`

## Variaveis

Configure no `.env` da raiz:

```env
CLOUDFLARE_TUNNEL_TOKEN=
AUTH_API_HOSTNAME=auth-api.seu-dominio.com
AUTH_WEB_HOSTNAME=auth.seu-dominio.com
AUTH_PUBLIC_URL=https://auth.seu-dominio.com
AUTH_WEB_PUBLIC_URL=https://auth.seu-dominio.com
VITE_AUTH_API_URL=https://auth.seu-dominio.com
AUTH_COOKIE_DOMAIN=.seu-dominio.com
CORS_ORIGINS=https://auth.seu-dominio.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
STEAM_API_KEY=
```

## Public Hostnames na Cloudflare

No painel Cloudflare Zero Trust, crie ou edite o tunnel e adicione:

| Public hostname | Service |
| --- | --- |
| `auth.seu-dominio.com` | `http://auth-web:80` |

Depois copie o token do tunnel para `CLOUDFLARE_TUNNEL_TOKEN`.

## Rodar

```bash
docker compose up -d --build
```

## Validar

```bash
docker compose logs -f cloudflared
curl -I https://auth.seu-dominio.com
curl https://auth.seu-dominio.com/api/health
```

## OAuth

Os provedores OAuth devem usar os callbacks publicos:

```txt
https://auth.seu-dominio.com/api/auth/oauth/google/callback
https://auth.seu-dominio.com/api/auth/oauth/discord/callback
https://auth.seu-dominio.com/api/auth/oauth/steam/callback
```
