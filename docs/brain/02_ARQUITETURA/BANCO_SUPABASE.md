# Banco (Supabase)

Projeto de produção: `sezccspqxgklicfndwxx` (Postgres 17.6, sa-east-1).
- Uma empresa e uma unidade (`seldeestrela`) em produção em 08/10/2026.
- 16 usuários ativos: 1 super admin, 2 gerente-geral, 11 somente-consulta, 2 cozinheiro.

**Acesso do agente:** pelo conector Supabase do claude.ai (`execute_sql`, `apply_migration`, `get_advisors`).
- A rede do container não alcança `*.supabase.co`.
- O conector trava em qualquer SQL com `DROP` esperando confirmação manual. Ver [[ERROS_QUE_NAO_DEVEM_REPETIR]].

## Onde está o esquema

**Não existe um dump confiável.** `db/baseline/README.md` manda não rodar nada até haver um dump real (schema-only). Também não são confiáveis:
- `docs/schema-completo.sql`;
- `db/TODAS_AS_MIGRACOES.sql`.

Tabelas centrais **sem CREATE no repositório** (só existem em produção): `insumos`, `fichas_ingredientes`, `produtos`, `contas_pagar`, `colaboradores`, `registro_ponto`, `pedidos`, `etiquetas`, `estoque_atual`, `orcamentos_eventos`.

## Fases de SQL e situação

| Grupo | O quê | Situação |
|---|---|---|
| `db/EST_MOV_1..4_*` | Histórico imutável de estoque, `estoque_movimentar`/estorno com PIN, contagem, transferência, compra → estoque | EST-MOV-1 **em produção** (TESTADO NO SUPABASE REAL em 07/10); 2–4 sem confirmação |
| `db/F2_1_FUNDACAO_FINANCEIRA.sql` | `compras`, `estoque_custos`, contagens, `fin_*`, views `vw_fin_*` (security invoker) | Aplicada em 01/10/2026 (relatórios F2.2/F2.3) |
| `db/F2_4B_*`, `F2_4C_*` | Custo médio na compra; faturamento diário opcional | 4B: relatórios conflitantes. 4C: não executada (`fin_faturamento_diario` existe e está vazia) |
| `db/security/SEC_*` | DADOS-1/2/3 (anon), RH-1.x, FIN-1/2, EST-1 | DADOS e RH-1.4 aplicadas; FIN-1 aplicada (arquivo fora do repo); FIN-2 e EST-1 são propostas |
| `db/1b/*` | Fase 1B: contexto da requisição, RLS deny-by-default, biometria privada | **Não aplicada** (o banco real não tem `hefisto_contexto_requisicao`) |
| Fase 1A | Hotfix anon, RBAC de tabelas sensíveis | **Arquivos ausentes do repositório**; os testes da 1B não rodam |
| `db/intelligence/IC_01_*` | Tabelas `intelligence_*` | **Aplicada em 07/10/2026** (ver [[INTELLIGENCE_CORE]]) |
| `db/2c`, `db/3a` | Confirmações do agente legado; identidades do WhatsApp | Sem RLS nem grants no arquivo |
| `db/migracao_*` (~50) | RH, ponto, fichas, insumos, control plane SaaS, integrações | Em geral sem linha de status |

## Funções de acesso (fonte da verdade)

Em `docs/controle-acesso-rbac.sql`:
- `hefisto_user_can(perm, unidade)` = `hefisto_user_has_permission(auth.uid(), perm)` E `hefisto_user_in_unit(auth.uid(), unidade)`. É SECURITY DEFINER.
- `hefisto_user_has_permission` confere status, bloqueio, vigência, dia/horário, super admin e negação explícita.
- `hefisto_session_context()` devolve perfil, permissões e escopos da sessão.
- Políticas antigas usam `pode_ver_todas()` e `auth_unidade_id()` (lêem `usuarios_erp` e `usuario_escopos`).

## RPCs que o app usa

| Área | RPCs | Definidas em |
|---|---|---|
| Estoque | `estoque_movimentar`, `estoque_estornar`, `estoque_ajustar_inventario` | EST_MOV_1 |
| Estoque | `estoque_contagem_corrigir_item` | EST_MOV_2 |
| Estoque | `estoque_transferir` | EST_MOV_3 |
| Compras | `compras_confirmar`, `compras_cancelar` | F2_4B e EST_MOV_4 |
| Financeiro | `fin_registrar_pagamento`, `fin_estornar_pagamento`, `fin_cancelar_conta_pagar`, `fin_registrar_recebimento`, `fin_estornar_recebimento` | F2_1 |
| Sem definição no repositório | `salvar_ficha_tecnica_atomica`, `conciliar_recebivel_banco` | — |

## Testes com SQL real

- **PGlite:** `app/lib/teste-banco-f21.mjs`. Simula `anon`/`authenticated` e `auth.uid()`.
- Ver [[TESTES]].
