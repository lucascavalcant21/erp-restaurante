---
name: hefisto-financeiro
description: Financeiro do Héfisto (contas a pagar e a receber, pagamentos, recebimentos, estornos, caixa, DRE gerencial, fluxo de caixa, conciliação, recebíveis, Central Financeira). Use ao mexer em app/dashboard/financeiro, fin_* ou contas_pagar, ou ao corrigir/limpar lançamento financeiro.
---

# Financeiro

Antes de banco ou migração, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Regras do banco

- `fin_pagamentos` e `fin_recebimentos` são **imutáveis**. Lançamento errado se corrige com estorno, nunca com UPDATE/DELETE.
- Escrita só pelas RPCs:
  - `fin_registrar_pagamento`, `fin_registrar_recebimento`;
  - `fin_estornar_pagamento`, `fin_estornar_recebimento`;
  - `fin_cancelar_conta_pagar`.
- As RPCs exigem `auth.uid()`. Um script fora do app precisa de `request.jwt.claims` com um usuário real e `role authenticated`, e isso só roda com aprovação.
- `fin_conta_pagar_recalcular` devolve a conta para `pendente` quando não sobra pagamento ativo.

## Onde está

| O quê | Onde |
|---|---|
| Contas a pagar / receber | `app/lib/contas-pagar.mjs`, `contas-receber.mjs` |
| Central e DRE | `app/lib/central-financeira.mjs`, `dre-gerencial.mjs`, `dre-dados.js` |
| Acesso a dados | `app/lib/financeiro.js`, `financeiro-domain.js` |
| Base do esquema | `db/F2_1_FUNDACAO_FINANCEIRA.sql` (e o rollback ao lado, que **não** se roda sem o dono) |

## Números

- Todo valor é determinístico (código + SQL testados) e tem natureza (REAL, ESTIMATIVA, PROJEÇÃO…). Sem dado: **DADOS INSUFICIENTES**.
- Data "de hoje" nos testes: fixe-a (`fin_hoje()` sobrescrito no PGlite, como em `contas-pagar.test.mjs`).

## Testes

Com `PGLITE`: `node app/lib/contas-pagar.test.mjs`, `node app/lib/contas-receber.test.mjs`. Sem banco: `node --test app/lib/central-financeira.test.mjs app/lib/dre-gerencial.test.mjs`.

## Precisa do dono, sempre

- Qualquer pagamento, recebimento, transferência, estorno ou cancelamento real. Monte a lista com IDs e valores, prepare o script com preflight (modelo: `db/LIMPEZA_TESTES_FIN_20261011.sql`) e **espere a aprovação da lista**.
- O agente nunca move dinheiro de verdade nem lança pagamento em sistema externo.
