---
id: HDEV-PUBLISH-001
titulo: Política de publicação e banco (AUTO SAFE / APPROVAL REQUIRED) no agente autônomo
status: DONE
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-PUBLISH-001 — Política de publicação e banco

## Objetivo

Dar ao agente autônomo uma política formal para publicar e mexer no banco, com dois modos (AUTO SAFE e APPROVAL REQUIRED) e risco LOW/MEDIUM/HIGH/CRITICAL. Integrada ao runner atual, sem outro agente, sem duplicar o runner e sem quebrar a fila de missões. Pedido do dono em 08/10/2026.

## Critério de pronto

| Item | Situação |
|---|---|
| Motor de decisão existe | ✅ `scripts/hefisto-agent/politica.mjs` (`avaliarPolitica`) |
| Runner usa a política | ✅ `publicacao.mjs` chamado em toda rodada |
| Vercel respeita | ✅ push do preview só se AUTO_SAFE; produção vira pedido |
| Supabase respeita | ✅ toda migração do diff é classificada, ensaiada e vira pedido |
| Aprovações persistidas | ✅ `06_OPERACAO/APROVACOES_PENDENTES.md` |
| Status mostra o estado | ✅ `npm run hefisto:status` |
| Testes passam / build passa | ✅ ver Evidências |
| Documentação | ✅ [[POLITICA_PUBLICACAO]], DA-008, `COMO_USAR.md`, `prompt.md` |
| Sem regressão no agente | ✅ os 32 testes antigos continuam passando |

## Arquivos afetados

`scripts/hefisto-agent/politica.mjs` (novo), `publicacao.mjs` (novo), `aprovacoes.mjs` (novo), `runner.mjs`, `status.mjs`, `lib.mjs` (id `HDEV-PUBLISH-001`), `config.json` (`publicacao`, caminhos, travas), `prompt.md`, `__tests__/politica.test.mjs` (novo), `__tests__/agente.test.mjs`, `scripts/qa/smoke-intelligence.mjs` (`HEFISTO_REGISTRAR_PREVIEW`), `package.json` (`hefisto:aprovacoes`, `hefisto:politica`), docs.

## Testes obrigatórios

`npm run test:agent` (com e sem PGLITE) · `npm run test:qa` · `npm run test:intelligence` · `node app/lib/permissions-catalog.test.mjs` · `npm run build`.

## Resultado

- **O agente pode publicar sozinho:**
  - o push do branch de trabalho (que gera o preview no Vercel), quando o risco é LOW/MEDIUM e os testes, o build e a varredura de segredo no bundle passaram;
  - documentação e memória.
- **Continua com o dono, com pedido registrado:**
  - produção (merge na `main`);
  - aplicar qualquer migração no Supabase real;
  - tudo HIGH/CRITICAL e a lista do CLAUDE.md.
  - O pedido traz risco, motivo, impacto, rollback, evidências e comando. O agente para só aquela etapa.
- **Segura o push** quando teste ou build falha, há segredo no bundle, RLS inseguro ou conflito. Antes, o runner enviava sempre.
- **Classificador de migrações** calibrado nos 150 arquivos de `db/`. Achou 24 antigos com policy `using (true)` ou RLS desligado (S-13 em [[SEGURANCA]]).
- **Padrões seguros mantidos:**
  - produção automática desligada;
  - aplicar migração automática desligado.
  - Ligar a chave não dá ferramenta ao agente: a concessão de escrita em produção continua pendente em [[DECISOES_PRODUTO]].
- **WhatsApp:** interface pronta (`processarComando("APROVAR APR-001", { autorizado })`). Não ligada a canal (fica para [[HDEV-007]]).

## Evidências

| Item | Evidência |
|---|---|
| Motor: LOW→AUTO_SAFE; migração aditiva→AUTO_SAFE (chave ligada); DROP→APPROVAL; RLS inseguro, teste, build, tenant, segredo, conflito, branch velho→BLOCKED; HIGH→APPROVAL; CRITICAL→APPROVAL (BLOCKED se houver trava) | TESTADO LOCAL (`politica.test.mjs`) |
| Classificação SAFE/REVIEW/CRITICAL, inclusive dentro de `DO $$` e ignorando texto/comentário | TESTADO LOCAL |
| Dry-run com PGlite (sintaxe ok, erro de sintaxe, dependência ausente) | TESTADO LOCAL com PGLITE |
| Calibração nos 150 arquivos reais de `db/` | TESTADO LOCAL (análise estática; não diz o que está aplicado no banco) |
| Aprovações: pedir, não duplicar, transições, agente não aprova, canal futuro só autorizado | TESTADO LOCAL |
| Runner real com Git e remoto: teste falhando → push segurado, status e relatório registram | TESTADO LOCAL (`agente.test.mjs`) |
| `npm run test:agent` | TESTADO LOCAL: 56/56 com PGLITE |
| `npm run hefisto:status` / `hefisto:aprovacoes` no repositório | TESTADO LOCAL |
| Push real gerando preview no Vercel pela política | NÃO VALIDADO (próxima rodada do runner) |
| Aplicar migração / promover produção pela política | NÃO VALIDADO (sem ferramenta, por decisão; pedido ao dono) |

## Histórico

- 2026-10-08 criada e concluída em sessão acompanhada (pedido do dono)
