# Santos Games Infra

Este repositório concentra a nova base de infraestrutura da Santos Games.

O objetivo principal é construir serviços compartilhados para a plataforma, começando por uma API de autenticação centralizada em Bun, TypeScript e Fastify e documentação com Swagger/openapi. A API deve atender os produtos da Santos Games com um fluxo comum de login, sessão, cookies, integrações externas e contratos reutilizáveis.

## Escopo Atual

- `apps/auth-api`: nova API de autenticação.
- `packages/env`: pacote compartilhado para validação e normalização de variáveis de ambiente.
- `packages/auth-contracts`: contratos e tipos compartilhados entre serviços e frontends.
- PostgreSQL: banco principal da plataforma.
- Redis: suporte para sessão, cache e fluxos temporários de autenticação.

## Papel da API .NET

A pasta `dotnet-primary-api` existe apenas como referência técnica do banco atual.

Ela deve ser usada para consultar:

- migrations existentes;
- entidades e relacionamentos;
- nomes de tabelas e colunas;
- regras de domínio já refletidas no schema;
- histórico da estrutura usada pela plataforma de campeonatos.

As migrations do banco devem continuar sendo criadas e executadas pela API .NET. A nova infraestrutura em Bun/TypeScript deve consumir o schema existente e, quando precisar de mudanças estruturais no banco, coordenar essas alterações com o projeto .NET.

Ela não é o backend principal a ser evoluído neste repositório. Alterações nela devem ser evitadas, a menos que o objetivo seja apenas preservar ou atualizar o material de referência.

## Direção Técnica

A nova infraestrutura deve seguir estes princípios:

- serviços pequenos e bem delimitados;
- contratos compartilhados em pacotes internos;
- validação forte de ambiente na inicialização;
- uso de Postgres e Redis por URL;
- APIs documentadas e testáveis;
- compatibilidade com deploy em containers;
- reaproveitamento do schema atual quando fizer sentido;
- migrations centralizadas no projeto .NET.

## Estado Inicial

O monorepo já possui o esqueleto inicial:

- `package.json` com workspaces `apps/*` e `packages/*`;
- `apps/auth-api` com dependências planejadas;
- teste inicial para `parseAuthApiEnv`;
- `dotnet-primary-api` importada como referência de schema/migrations.

O próximo passo é implementar a base mínima da `auth-api`, começando pela configuração de ambiente e pelos pacotes compartilhados necessários para que os testes passem.

## Arquivos `.env`

O `.env` principal fica na raiz do monorepo e e carregado pelos apps em `apps/*`.

- `.env`: valores usados pelos apps Bun/Vite e pelo `docker-compose.yml`.
- `dotnet-primary-api/.env`: valores da API .NET e migrations EF, porque este projeto e uma referencia externa ao monorepo Bun.

Os arquivos `.env.example` mostram o formato esperado sem segredos reais.

Em desenvolvimento local, o `auth-web` pode deixar `VITE_AUTH_API_URL` vazio para usar `AUTH_PUBLIC_URL` como alvo do proxy do Vite.
