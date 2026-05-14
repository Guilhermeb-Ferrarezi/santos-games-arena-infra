# Guia de Estrutura de Logs HTTP

Este documento define um formato padrao de logs HTTP para projetos que gravam eventos em MongoDB.

O objetivo e permitir que diferentes projetos compartilhem o mesmo esquema de persistencia, mantendo consistencia de leitura, filtragem e visualizacao.

## Objetivo

Se um backend, API ou servico precisar persistir logs HTTP em MongoDB de forma padronizada, ele deve:

1. gravar no banco `logs`
2. usar uma collection propria
3. seguir o schema descrito abaixo

## Banco e collection

- Banco Mongo: `logs`
- Uma collection por projeto
- Convencao recomendada de nome:

```text
<slug_do_projeto>_logs
```

Exemplos:

```text
sga_home_logs
santos_tech_home_logs
meu_gateway_pix_logs
portal_aluno_logs
```

Recomendacoes:
- use nomes estaveis
- evite espacos
- prefira `snake_case`
- termine sempre com `_logs`

## Documento padrao de log

Cada request HTTP persistida deve seguir este formato base:

```json
{
  "type": "http_request",
  "occurredAt": "2026-05-09T01:37:56.957Z",
  "method": "POST",
  "url": "https://api.exemplo.com/v1/login",
  "path": "/v1/login",
  "route": "/v1/login",
  "statusCode": 200,
  "durationMs": 304,
  "ip": "127.0.0.1",
  "hostname": "api.exemplo.com",
  "userAgent": "Mozilla/5.0 ...",
  "user": {
    "id": "user-id",
    "name": "Guilherme",
    "email": "guibferraezi@gmail.com",
    "role": "admin"
  },
  "requestBody": {
    "email": "guibferraezi@gmail.com",
    "password": "[REDACTED]"
  },
  "responseBody": {
    "message": "Login realizado com sucesso!"
  },
  "request": {
    "params": {},
    "query": {},
    "body": {},
    "headers": {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 ...",
      "origin": "http://localhost:5173",
      "referer": "http://localhost:5173/",
      "authorization": "[REDACTED]",
      "cookie": "[REDACTED]"
    }
  },
  "response": {
    "statusCode": 200,
    "body": {
      "message": "Login realizado com sucesso!"
    }
  }
}
```

## Campos minimos recomendados

Os campos mais importantes sao:

- `type`
- `occurredAt`
- `method`
- `url` ou `path`
- `user.id` / `user.name` quando existir autor autenticado
- `statusCode`
- `durationMs`
- `ip`
- `request`
- `response`

## Uso esperado dos campos

O schema acima foi pensado para suportar:

- tabela de logs:
  - status <- `statusCode`
  - metodo <- `method`
  - endpoint <- `path`, `route` ou pathname derivado de `url`
  - autor <- `user.name` com fallback para `user.id`
  - ip <- `ip`
  - tempo <- `durationMs`
  - data <- `occurredAt`

- modal de detalhes:
  - autor da acao <- `user.name` com fallback para `user.id`
  - request <- `request` ou `requestBody`
  - response <- `response.body` ou `responseBody`
  - endpoint completo <- `url`

- resumo por projeto:
  - total de logs <- contagem de documentos
  - ultimo evento <- maior `occurredAt`
  - ultimo metodo/status <- ultimo documento da collection

## Regras de seguranca

Antes de persistir, redija dados sensiveis.

Padrao recomendado de chaves sensiveis:

- `password`
- `token`
- `secret`
- `authorization`
- `cookie`
- `session`
- `key`

Valor recomendado:

```json
"[REDACTED]"
```

## Regras de armazenamento

Cada projeto pode decidir sua propria politica de retencao, mas a recomendacao eh:

- gravar `POST`, `PUT`, `PATCH` e `DELETE`
- gravar `GET` com erro
- ignorar `GET` muito ruidoso
- ignorar endpoints de observabilidade, healthcheck ou polling

Exemplos de rotas normalmente boas para ignorar:

- `/api/logs`
- `/api/user/me`
- `/api/health`

## Variaveis de ambiente sugeridas

Se o projeto usar middleware dedicado para logs, estas variaveis sao uteis:

```env
LOGS_MONGO_DB_NAME=logs
LOGS_HTTP_COLLECTION=meu_projeto_logs
LOGS_ROUTE_BLACKLIST=/api/logs
LOGS_GET_ROUTE_BLACKLIST=/api/user/me,/api/health
```

## Middleware recomendado

Fluxo sugerido:

1. capturar o horario de inicio da request
2. interceptar `res.json` e `res.send`
3. esperar `res.on("finish")`
4. calcular `durationMs`
5. aplicar blacklist e regra de retencao
6. redigir campos sensiveis
7. montar o documento no formato padrao
8. inserir na collection do projeto dentro do DB `logs`

## Como integrar um novo projeto

Para adicionar um novo projeto ao padrao:

1. escolha um nome de collection, por exemplo `meu_novo_projeto_logs`
2. grave os logs no banco `logs`
3. siga o schema padrao acima

## Metadados opcionais

Se quiser enriquecer informacoes de exibicao, uma collection separada de metadados pode ser usada.

Shape sugerido:

```json
{
  "name": "Meu Projeto",
  "slug": "meu-projeto",
  "apiKey": "key_xxx",
  "collectionName": "meu_projeto_logs",
  "createdAt": "2026-05-09T01:37:56.957Z"
}
```

Esses metadados sao opcionais.

Sem isso, nome e slug ainda podem ser derivados a partir do nome da collection.