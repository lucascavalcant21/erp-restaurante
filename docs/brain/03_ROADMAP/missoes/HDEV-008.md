---
id: HDEV-008
titulo: SEG — Fechar RLS de colaboradores/registro_ponto e isolar tabelas multiempresa
fase: seguranca
status: BACKLOG
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-008 — SEG: fechar RLS crítico e isolar tabelas multiempresa

## Objetivo

Corrigir os achados S-01, S-02, S-04 e S-05 de [[SEGURANCA]] sem quebrar o ERP:
- `colaboradores` e `registro_ponto` com RLS ligado e policies por unidade/permissão;
- trocar os `using (true)` por regras com `hefisto_user_can`;
- exigir sessão nas rotas `ia-*` e em `saas/export`.

**Mudar RLS em produção é ação crítica:** precisa de aprovação do dono (BLQ-005).

Enquanto não houver aprovação, só se pode preparar:
- SQL aditivo com preflight e verificação;
- testes em PGlite;
- mapa de telas afetadas.

## Critério de pronto

- [ ] Migração com preflight (aborta se a base não for a esperada), transação, verificação pós e rollback documentado
- [ ] Teste em PGlite reproduzindo as policies de produção: quem precisa ler continua lendo (RH, ponto, telas de estoque) e quem não precisa deixa de ler
- [ ] Teste de isolamento com segundo tenant (como no HI-02)
- [ ] Aprovação do dono registrada antes de aplicar
- [ ] Aplicado e verificado: TESTADO NO SUPABASE REAL

## Arquivos afetados

`db/security/SEC_*` (novo), `app/api/ia-*`, `app/api/saas/export`, testes.

## Testes obrigatórios

Testes de RH, ponto e estoque existentes · `npm run test:intelligence` · catálogo de permissões · build.

## Resultado

- 08/10: a parte de RLS (S-01, S-02) passou para [[HDEV-SEC-001]]. A migração SEC-RLS-1 foi aplicada em 08/10 (APR-001). Aqui ficam as rotas `ia-*` e `saas/export` (S-04, S-05).

## Evidências

## Histórico
