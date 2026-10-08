---
id: HDEV-000
titulo: Missão 000 — sistema autônomo de desenvolvimento
fase: infra
status: DONE
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 1
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-000 — Missão 000: sistema autônomo de desenvolvimento

## Objetivo

Transformar o projeto num sistema em que o agente trabalha sozinho por longos períodos: memória (`docs/brain`), `CLAUDE.md`, roadmap, missões, runner, watchdog, relatório noturno e documentação de uso.

## Critério de pronto

- [x] Memória do projeto preenchida com o estado real (`docs/brain`)
- [x] `CLAUDE.md` consolidado (papel, autonomia, limites, dados, evidência)
- [x] Roadmap HI-01 a HI-07
- [x] Sistema de missões (Markdown + frontmatter, estados, prioridade, dependências, bloqueadores)
- [x] Status atual, acessos necessários, relatório noturno (modelo)
- [x] Runner (`npm run hefisto:agent`) e vigia (`npm run hefisto:noite`)
- [x] Watchdog/status (`npm run hefisto:status`)
- [x] HDEV-001 READY
- [x] `docs/autonomous/COMO_USAR.md`
- [x] Testes dos scripts e nenhuma regressão

## Arquivos afetados

`CLAUDE.md`, `.claude/`, `docs/brain/**`, `docs/autonomous/COMO_USAR.md`, `scripts/hefisto-agent/**`, `package.json`, `.gitignore`

## Testes obrigatórios

`npm run test:agent` · `npm run test:intelligence` · `node app/lib/permissions-catalog.test.mjs` · `npm run build`

## Resultado

Sistema criado. Relatório: [[2026-10-08-HDEV-000]].

## Evidências

- `npm run test:agent`: 15/15. TESTADO LOCAL. O runner rodou de ponta a ponta com motor falso: dependência, anti-loop, STOP, dry-run e motor ausente.
- Regressão: `test:intelligence` 130/130, catálogo de permissões OK, build OK. TESTADO LOCAL.
- `npm run hefisto:agent -- --dry-run` escolhe a HDEV-001. TESTADO LOCAL.
- Contrato do motor com o Claude Code real: TESTADO LOCAL.
  - `claude -p --output-format json --permission-mode acceptEdits --max-budget-usd … --allowedTools … --disallowedTools …` respondeu sem erro.
  - O runner leu `HEFISTO_RESULTADO` (US$ 0,08, 1 turno).
- Uma missão inteira rodada pelo runner com o motor real: NÃO VALIDADO. Fica para a primeira noite; conferir o relatório gerado.

## Histórico

- 2026-10-08 criada e concluída na sessão interativa
