---
id: HDEV-SEC-002
titulo: Segurança fase 2 — fechar as 33 tabelas restantes, dados sensíveis, pode_ver_todas e dados legados
fase: seguranca
status: BLOCKED
prioridade: 1
dependencias: [HDEV-SEC-001]
bloqueadores: [BLQ-009]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-SEC-002 — Fase 2 do isolamento

## Objetivo

Pedido do dono (08/10/2026):
- fechar as 33 tabelas que ficaram fora da SEC-RLS-1;
- tratar os dados legados e órfãos sem apagar nem reatribuir sem evidência;
- proteger CPF e salário;
- limitar `pode_ver_todas()`;
- separar catálogos globais, da empresa e da unidade;
- tabelas-filhas seguem a mãe.

**Não aplicar em produção sem a APR-002.**

## Critério de pronto

| Item | Situação |
|---|---|
| Auditoria só leitura | ✅ TESTADO NO SUPABASE REAL |
| Mapa das 33 tabelas | ✅ [[SEC_RLS_2_MAPA]] |
| Classificação dos dados legados (LEGADO/ORFAO/AMBIGUO), com evidência | ✅ [[SEC_RLS_2_MAPA]] |
| Migração + rollback + reatribuição separada | ✅ `db/security/SEC_RLS_2_FASE2.sql`, `SEC_RLS_2_ROLLBACK.sql`, `SEC_RLS_2_REATRIBUIR_EVENTO.sql` |
| Os 15 testes obrigatórios (PGlite) | ✅ ver Evidências |
| App sem quebrar (lista de colaboradores, ponto, unidades, tela fiscal, notas) | ✅ TESTADO LOCAL (testes + build) |
| Aplicado no banco real | ⛔ aguarda o dono: **APR-002** (BLQ-009) |

## Arquivos afetados

- **Banco:** `db/security/SEC_RLS_2_FASE2.sql`, `SEC_RLS_2_ROLLBACK.sql`, `SEC_RLS_2_REATRIBUIR_EVENTO.sql`, `AUDITORIA_RLS.sql`.
- **App:**
  - `app/lib/colaboradores-acesso.mjs` (novo);
  - `app/lib/rh.js` (`fetchColaboradores`);
  - `app/lib/ponto.js` (horário pela lista operacional);
  - `app/lib/unidades.js` (colunas sem `token_nfe`; `tokenNfeConfigurado`);
  - `app/dashboard/gestao/fiscal/page.js` (token só de escrita);
  - `app/lib/notas.js` (não grava `todas`).
- **Testes:** `app/lib/seguranca-rls-2.test.mjs` (novo), `seguranca-rls.test.mjs`.
- **Agente:** `scripts/hefisto-agent/politica.mjs` (rollback irmão de maior prefixo).
- **Scripts:** `package.json` (`test:seguranca` em sequência).

## Testes obrigatórios

`PGLITE=… npm run test:seguranca` · `test:agent` · `test:intelligence` · `test:qa` · catálogo de permissões · testes de `app/lib` um a um · `npm run build`. **Sempre um de cada vez** (memória).

## Resultado

Ver [[SEC_RLS_2_MAPA]] (modelo de acesso, as 33 tabelas, dados sensíveis, token_nfe, dados legados, limites).

## Evidências

| Item | Evidência |
|---|---|
| Inventário das 33 tabelas, policies, dados legados com evidência, modelo de empresa e permissões | TESTADO NO SUPABASE REAL (só leitura, 08/10) |
| Os 15 testes obrigatórios (A não vê B; empresa A não vê B; próprio CPF; não vê CPF/salário de colega; RH vê a equipe; dono vê a própria empresa e não a outra; super admin vê tudo; filha segue a mãe; órfão não vaza; ambíguo não reatribuído; `pode_ver_todas` sem bypass; nenhuma policy aberta perigosa; RLS ligado) | TESTADO LOCAL (PGlite, SQL real das fases 1 e 2, 2 empresas) |
| `token_nfe`: navegador não lê; grava; "configurado" só da própria unidade | TESTADO LOCAL (PGlite) |
| Preflight aborta sem mudar nada (sem fase 1, policy desconhecida); reaplicar aborta; rollback volta exatamente ao estado da fase 1; reatribuição só mexe no evento com evidência | TESTADO LOCAL (PGlite) |
| `test:seguranca` 24/24 (em sequência) · `test:agent` 56/56 · `test:intelligence` 130/130 (PGLITE) · `test:qa` 6/6 · catálogo de permissões OK · 55 arquivos de `app/lib` um a um: todos passam | TESTADO LOCAL |
| Falha "preflight aborta" da rodada anterior | Reproduzida isolada: passa (110 s). Causa: os dois arquivos rodando em paralelo com memória crítica. `test:seguranca` agora roda em sequência |
| 4 testes do financeiro/estoque falhando | Causa confirmada: "hoje" em UTC × `fin_hoje()` em São Paulo (falham entre 21h e 24h). Corrigidos; bug B-012. Achado relacionado no app: B-011 (tela de notas) |
| `npm run build` | TESTADO LOCAL: OK com `HEFISTO_BUILD_LEVE=1` (1 processo; a 1ª tentativa caiu por falta de memória na máquina: 0,8 GB livres). Varredura do `.next/static`: nenhum segredo |
| Aplicação no banco real | NÃO VALIDADO (aguarda APR-002) |

## Histórico

- 2026-10-08 criada; auditoria, migração, testes e ajustes do app em sessão acompanhada
