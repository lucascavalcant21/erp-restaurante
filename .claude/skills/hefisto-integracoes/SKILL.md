---
name: hefisto-integracoes
description: Integrações externas do Héfisto (iFood, Saipos, PagSeguro, NF-e/fiscal, OCR, e o contrato IntegrationAdapter). Use ao mexer em app/lib/integrations, ifood.js, pagseguro.js, integracoes-externas.js, app/api/integrations, app/api/ifood ou app/api/fiscal.
---

# Integrações externas

Antes de credencial, webhook ou banco, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Regras

- **Todo provedor estende `IntegrationAdapter`** (`app/lib/integrations/core/adapter.mjs`) e se registra em `core/registry.mjs`. O adapter declara as capacidades e o **status real** (conectado, simulado, desligado). Nunca mostre "conectado" sem conexão de verdade.
- Credenciais do provedor ficam cifradas no servidor (`app/lib/server/crypto-vault.mjs`, `integracoes.mjs`). Nunca no navegador, em log ou no repositório.
- Dado que vem de fora passa pelo `app/lib/integrations/sanitizer.mjs` antes de entrar no banco.
- Pedido externo (iFood) que baixa estoque usa o motor oficial (`estoque_movimentar`), nunca tabela paralela.
- Sem credencial de produção: teste com mock e marque **TESTADO EM MOCK**. Mock nunca vira "funciona".

## Onde está

`app/lib/integrations/{core,ifood,saipos}` · `app/lib/server/integracoes.mjs` · migração canônica `db/migracao_integracoes_canonica.sql` · mapa em `docs/brain/02_ARQUITETURA/INTEGRACOES.md`.

## Testes

`node --test app/lib/server/integracoes.test.mjs` · `node scripts/test_integracoes_canonica_hefisto.mjs`

## Precisa do dono

- Conectar ou desconectar uma conta real.
- Criar ou trocar credencial.
- Ativar cobrança.
- Emitir nota fiscal de verdade.
- Instalar SDK ou serviço externo novo. Antes, verifique a origem, o código, as permissões e os riscos.
