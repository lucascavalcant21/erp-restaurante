---
id: HDEV-001
titulo: Concluir HEFISTO INTELLIGENCE HI-02 no ambiente mais real disponível
fase: HI-02
status: READY
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-001 — Concluir HI-02 no ambiente mais real disponível

## Objetivo

Levar o Intelligence Core (PR #127, branch `claude/fervent-bell-t363k5`) até produção com evidência real. **Usar o código atual: NÃO recriar.**

O que já foi feito e validado está em `docs/intelligence/HI02_EVIDENCIAS.md` e em [[INTELLIGENCE_CORE]].

## Critério de pronto

| Item | Situação em 08/10 |
|---|---|
| Supabase real validado | ✅ TESTADO NO SUPABASE REAL |
| Migração IC_01 aplicada + verificação + impressão digital | ✅ TESTADO NO SUPABASE REAL (`d55eda66…`) |
| Permissões (porta por perfil) | ✅ TESTADO NO SUPABASE REAL |
| APIs: 401/403/400 pela casca | ✅ TESTADO LOCAL com contexto real |
| APIs: 200/403 com sessão real **no deploy** | ⛔ BLQ-001 + BLQ-003 |
| 10 perguntas com dados reais | ✅ TESTADO NO SUPABASE REAL (motor local) |
| Daily Brief com dados reais | ✅ TESTADO NO SUPABASE REAL (motor local) |
| Contexto de tela em navegador real | ⏳ TESTADO EM MOCK. Falta preview autenticado (BLQ-001/003) |
| Perda controlada + idempotência + auditoria | ✅ TESTADO NO SUPABASE REAL (transação desfeita) |
| Isolamento entre empresas | ✅ TESTADO NO SUPABASE REAL (transação desfeita) |
| Anthropic: uma chamada real | ⛔ chave existe no Vercel; falta chamar pelo deploy (BLQ-001/003) |
| Preview/deploy + smoke em produção | ⛔ BLQ-001..004 |

## O que o agente pode fazer AGORA (independe dos acessos)

1. **Harness de QA com Playwright** em `scripts/qa/`:
   - Precisa: login com usuário de teste (variáveis `HEFISTO_QA_EMAIL`/`HEFISTO_QA_SENHA` só do ambiente, nunca no repositório), Central, as 10 perguntas pela tela, Configurações, celular (390×844), console sem erro e screenshots.
   - Roda contra `next dev` com API simulada (TESTADO EM MOCK) e fica pronto para `BASE_URL` do preview.
2. **Smoke de API sem navegador** (`scripts/qa/smoke-intelligence.mjs`):
   - Sem token: 401.
   - Com token: brief 200, ask "Quanto vendi hoje?" 200 com fonte e unidade, cabeçalho de outra unidade 403, history 200.
   - Pronto para rodar quando houver rede e credencial.
3. **Checklist de deploy + rollback** em [[DEPLOYS]]:
   - Promover o PR.
   - Smoke.
   - Plano de volta (instant rollback para o deploy de produção anterior).
4. **Manter o PR #127 verde:** trazer a `main`, rodar testes e build, revisar o diff (o PR tem ~10 mil linhas; fazer uma revisão própria e registrar riscos).
5. **Perfil de navegador dedicado** `hefisto-agent`: documentar em `docs/autonomous/COMO_USAR.md` (nunca o perfil pessoal).

Quando só sobrarem itens ⛔, marque **BLOCKED** apontando BLQ-001..004 e siga para a próxima missão.

## Arquivos afetados

`scripts/qa/**` (novo), `docs/brain/06_OPERACAO/DEPLOYS.md`, `docs/intelligence/*`, `package.json` (scripts de QA), PR #127.

## Testes obrigatórios

`npm run test:intelligence` (com PGLITE) · `npm run test:agent` · `node app/lib/permissions-catalog.test.mjs` · `npm run build` · os novos testes de QA.

## Resultado

## Evidências

## Histórico

- 2026-10-08 criada a partir do HI-02 (validação real feita; deploy bloqueado por acesso)
