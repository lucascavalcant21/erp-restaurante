# Arquitetura atual

_Levantada do código em 08/10/2026 (branch `claude/fervent-bell-t363k5`). Caminhos relativos à raiz do repositório._

## Stack

- **Next.js 15.5 (App Router) + React 18.3**, Tailwind 3.4.
  - `package.json` se chama `fooderrp` (v1.0.0-rc.1, Node ≥ 20).
- **Supabase** (Postgres 17.6, projeto `sezccspqxgklicfndwxx`, sa-east-1): Auth, Postgres com RLS e RPCs, Storage e Realtime.
- **Vercel:** projeto `erp-restaurante`, time `lucas-cavalcante`, domínio de produção `app.hefisto.com.br`.
  - `vercel.json` usa `builds` legados: `backend_cloud_code/server.js` (Express, `@vercel/node`) e `@vercel/next`.
  - Um regex manda só uma lista de rotas `/api/*` para o Next (`hefisto`, `etiquetas/*`, `channels/*`, `ia-*`, `rh/*`, `public/*`, `ifood/*`). O resto de `/api/*` e `/webhook/*` vai para o Express legado.
  - Crons: `/api/triggers/verificar` (Express) e `/api/etiquetas/financeiro/drenar`.
- **Anthropic SDK** `@anthropic-ai/sdk` só no Intelligence Core (`app/lib/intelligence/providers/anthropic.mjs`).
  - As rotas `ia-*` e `api/hefisto` chamam a API por `fetch`, com modelos fixos no código.
- **Legado:** Express "CEREBRO ERP" em `backend_cloud_code/` (Firebase Admin), `nodemon` no `npm run dev`.

## Autenticação e sessão

- **Navegador:** `app/lib/supabase.js`, chave anon e sessão persistida. A config vem de `app/lib/config/supabase-public.mjs`, que impede staging de apontar para o projeto de produção.
- **Servidor:** `app/lib/server/supabase-server.mjs`, service role (`SUPABASE_SERVICE_ROLE_KEY`). Lança erro se carregado no navegador.
- **`app/lib/auth.js`:** `lerSessao` chama o RPC `hefisto_session_context`, que marca a sessão como `gerenciado: true`.
- **`app/context/ERPContext.js`:** sessão, unidade ativa (localStorage `erp_unidade_ativa`), dados de estoque e etiquetas, realtime (`app/lib/realtime.js`).

## Módulos (`app/dashboard/`)

| Área | Rota principal | Lógica |
|---|---|---|
| Operação / estoque | `/dashboard/operacao/estoque` | `estoque-movimento.mjs`, `estoques-multiplos.js`, `contagem-estoque.mjs`, `inventario-saldo.mjs`, `cmv-real.mjs` |
| Compras | `/dashboard/operacao/compras` | `compras-domain.js`, `compras.mjs`, `compras-estoque.mjs` |
| Fichas técnicas | `/dashboard/operacao/fichas` | `ficha-*.mjs`, `custo-rendimento.mjs` |
| Produção / etiquetas | `/dashboard/operacao/...` | `producao-calculos.mjs`, `etiquetas.js`, `impressao*.js` |
| Financeiro | `/dashboard/financeiro` | `contas-pagar.mjs`, `contas-receber.mjs`, `dre-gerencial.mjs`, `cmv-*.mjs`, `cmo.mjs`, `recebiveis.js` |
| RH / ponto | `/dashboard/rh`, `/dashboard/ponto` | `rh.js`, `ponto.js`, `jornada-*.mjs`, `afd-layout.mjs`, `aej-layout.mjs` |
| Reservas & eventos | `/dashboard/reservas-eventos` | `evento-orcamento.mjs`, `evento-financeiro.mjs` |
| Salão / caixa / cozinha | `/dashboard/salao`, `/dashboard/mesas`, `/dashboard/cozinha` | `caixas.js`, `vendas.js`, `mesas.js`, `kds.js` |
| Clientes / marketing | `/dashboard/clientes`, `/dashboard/marketing/cupons` | `clientes.js` |
| Gestão / config | `/dashboard/gestao`, `/dashboard/configuracoes` | `access-control.js`, `permissions-catalog.mjs` |
| **Inteligência** | `/dashboard/inteligencia` | `app/lib/intelligence/*` (ver [[INTELLIGENCE_CORE]]) |

## Permissões (RBAC)

- **Catálogo:** `app/lib/permissions-catalog.mjs`. Chaves `modulo.pagina.acao`, curingas `*`, `mod.*` e `mod.pag.*`. A rota mais específica vence (`canAccessRoute`).
- **Guarda das páginas:** `ProtecaoPermissao` em `app/dashboard/layout.js`.
  - Só aplica rota quando `sessao.gerenciado`; sessão legada passa. É dívida: [[DEBITO_TECNICO]].
- **Banco:** `hefisto_user_can`, `hefisto_user_has_permission` e `hefisto_user_in_unit` (`docs/controle-acesso-rbac.sql`).
  - É a fonte da verdade para servidor e RLS.
  - A trava `app/lib/permissions-catalog.test.mjs` impede tela nova sem entrada no catálogo.

## APIs (`app/api`)

| Rotas | O que fazem | Proteção |
|---|---|---|
| `intelligence/*` | Intelligence Core | Bearer token, unidade conferida no banco, porta `dashboard.intelligence.view`, limite por usuário |
| `ia-*` (17) | Ajudantes de IA de uma chamada (fichas, cardápio, ata, checklist…) | **Sem checagem de sessão** ([[SEGURANCA]]) |
| `public/*` | Portais públicos | Limite por IP |
| `admin/access-control`, `auth/policy` | Usuários, perfis e política de login | Service role + token do chamador |
| `ifood/webhook` | Webhook do iFood | HMAC |
| `channels/whatsapp/webhook` | Webhook da Meta | Parcial ([[INTEGRACOES]]) |
| `saas/export` | Exportação | **Sem auth** ([[SEGURANCA]]) |

## Testes e qualidade

- `npm run test:intelligence`: Intelligence Core, `node:test`, 130 testes.
- `app/lib/*.test.mjs`: cerca de 50 arquivos (262 testes `node:test` e scripts próprios).
- `npm run test:agent`: agente autônomo (15).
- **SQL real local:** PGlite, `PGLITE=<caminho de @electric-sql/pglite>`. Detalhes em [[TESTES]].
- **Sem CI** (`.github/` não existe), sem lint nem TypeScript. Ver [[DEBITO_TECNICO]].

## Documentação existente

Raiz, cerca de 40 Markdown:
- `PROJECT_CONTEXT.md`, `ARCHITECTURE_HEFISTO.md`, `RUNBOOK_PRODUCAO_HEFISTO.md`, `PENDENCIAS.md`;
- relatórios `RELATORIO-*`;
- `docs/` (SQL de esquema, `ai/`, `intelligence/`, `seguranca/`).

Este cérebro **resume e aponta** para eles; não os substitui.
