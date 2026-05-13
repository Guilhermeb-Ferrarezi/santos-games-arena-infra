# Publicação com DNS Direto

Este projeto agora assume publicação direta por DNS, sem Cloudflare Tunnel.

## Fluxo

- `auth.santos-games.com` aponta por DNS para o host público do Contabo/Easypanel.
- O serviço público é o `sga-auth-web`, servido em Nginx na porta `80`.
- O `sga-auth-web` faz proxy de `/api` para o serviço interno `sga-auth-api:3001`.

## DNS

No provedor de DNS, configure:

- `auth.santos-games.com` -> IP público do servidor Contabo

Se usar proxy/CDN na frente, ele precisa entregar a porta 80 do origin sem criar redirecionamento de volta para o mesmo host.

## Easypanel

- Anexe o domínio `auth.santos-games.com` ao app `sga-auth-web`.
- Confirme que o app está escutando na porta `80`.
- Confirme que o backend `sga-auth-api` está na mesma rede interna do app web.

## Variáveis

```env
AUTH_PUBLIC_URL=https://auth.santos-games.com
AUTH_WEB_PUBLIC_URL=https://auth.santos-games.com
VITE_AUTH_API_URL=https://auth.santos-games.com
AUTH_COOKIE_DOMAIN=.santos-games.com
CORS_ORIGINS=https://auth.santos-games.com
```

## Validar

```bash
curl -I https://auth.santos-games.com
curl https://auth.santos-games.com/api/health
```
