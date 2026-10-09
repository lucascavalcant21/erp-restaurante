# Bugs

Formato: **B-NNN**, situação, onde foi visto, evidência da correção.

## Abertos

| ID | Bug | Onde | Gravidade |
|---|---|---|---|
| B-005 | `SAIPOS_INTEGRATION_SECRET` (adapter) × `SAIPOS_INTEGRACAO_SECRET` (registro): nome de variável divergente | `app/lib/integrations/saipos/adapter.mjs`, `app/lib/server/integracoes.mjs` | MÉDIO |
| B-006 | RPCs chamados sem definição no repositório: `salvar_ficha_tecnica_atomica`, `conciliar_recebivel_banco` | `app/lib/recebiveis.js:89` | MÉDIO (risco de divergência com produção) |
| B-007 | Dados: 2 lotes com saldo (36.000 e 18.036 un, estoque Bar) de produtos que não existem no cadastro da unidade | Banco real, 07/10 | MÉDIO (o Héfisto agora mostra; precisa de decisão de limpeza) |
| B-008 | Dados: 653 etiquetas ativas já vencidas (desde jul/2026) | Banco real, 07/10 | BAIXO (operacional: dar baixa) |

## Corrigidos

| ID | Bug | Correção | Evidência |
|---|---|---|---|
| B-001 | Validade respondia DADOS INSUFICIENTES com 653 etiquetas vencidas (lotes sem validade) | Etiquetas lidas antes, total via `count` | `4544a83`. TESTADO LOCAL + dado real |
| B-002 | Divergência saldo × lotes não pegava lote sem linha de saldo | Lotes órfãos entram com saldo 0 | `4544a83`. TESTADO LOCAL + dado real |
| B-003 | Toda chamada autenticada da inteligência daria 503 (banco sem a Fase 1B) | Fallback de contexto (DA-003) | `214dfea`. TESTADO LOCAL + porta TESTADO NO SUPABASE REAL |
| B-004 | 4 telas de eventos/orçamento caíam na entrada genérica `/dashboard` (qualquer funcionário abria) | Entradas `eventos.overview` e `eventos.quote` | `73b4643`. TESTADO LOCAL |
| B-009 | Colunas inexistentes (`vw_compras.data_recebimento`, `colaboradores.ativo`) nas métricas | Colunas ajustadas ao banco real | `d94bda5`. TESTADO NO SUPABASE REAL |
| B-010 | `npm run test:agent` falhava no Windows: o teste do prompt esperava `/` no caminho da missão | Regex aceita `/` ou `\` | `b8a398a`. TESTADO LOCAL (Windows, 30/30) |
| B-011 | `pago_em` da nota gravado com a data UTC (`toISOString`): pagamento lançado entre 21h e 24h fica com a data de amanhã. Aberto: usar a data de São Paulo, como `fin_hoje()` | `app/dashboard/operacao/notas/page.js:89` | BAIXA |
| B-012 | 4 testes (contas a pagar/receber, compras, contagem) calculavam "hoje" em UTC e falhavam entre 21h e 24h contra `fin_hoje()` (São Paulo). **Corrigido** na HDEV-SEC-002 (TESTADO LOCAL) | `app/lib/*-estoque.test.mjs`, `contas-*.test.mjs` | Teste |
| B-013 | `vercel.json` só manda para o Next uma lista fixa de rotas `/api`; o resto cai no servidor antigo e dá 404. As APIs do Intelligence Core estavam fora (**corrigido** antes do merge do PR #127; trava `app/lib/rotas-vercel.test.mjs`). Continuam fora, já em produção antes: admin/access-control, auth/policy, comprovante-email, fiscal/emitir, hefisto/automation/cron, ia-cardapio-fichas, ia-evidencia, ia-ficha-assistente, integrations*, ocr, versao e saas/export (este **sem autenticação**, S-05: não liberar antes de corrigir) | `vercel.json` | ALTA (telas de gestão de usuários e emissão fiscal sem API em produção) |
