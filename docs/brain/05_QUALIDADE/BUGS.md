# Bugs

Formato: **B-NNN**, situação, onde foi visto, evidência da correção.

## Abertos

| ID | Bug | Onde | Gravidade |
|---|---|---|---|
| B-005 | `SAIPOS_INTEGRATION_SECRET` (adapter) × `SAIPOS_INTEGRACAO_SECRET` (registro): nome de variável divergente | `app/lib/integrations/saipos/adapter.mjs`, `app/lib/server/integracoes.mjs` | MÉDIO |
| B-006 | RPCs chamados sem definição no repositório: `salvar_ficha_tecnica_atomica`, `conciliar_recebivel_banco` | `app/lib/recebiveis.js:89` | MÉDIO (risco de divergência com produção) |
| B-007 | Dados: 2 lotes com saldo (36.000 e 18.036 un, estoque Bar) de produtos que não existem no cadastro da unidade | Banco real, 07/10 | MÉDIO (o Héfisto agora mostra; precisa de decisão de limpeza) |
| B-008 | Dados: 653 etiquetas ativas já vencidas (desde jul/2026) | Banco real, 07/10 | BAIXO (operacional: dar baixa) |
| B-019 | Eventos: o banco real não tem `operacao_detalhes`, `historico_pagamentos`, `hora_inicio`, `hora_fim` nem `observacoes` em `eventos` (o SQL de `docs/eventos-custos-equipe.sql` nunca foi aplicado). O orçamento em etapas não grava nada, pagamentos e duplicar falham, a Agenda escondia os eventos e o formulário público de eventos manda `observacoes`. App já trata (aviso claro, Agenda sem a hora, 17/10, TESTADO EM MOCK); a causa fecha com `db/EVENTOS_ORC_1_COLUNAS_DO_ORCAMENTO.sql` (**APR-012**, TESTADO LOCAL no PGlite) | Banco real, 17/10 (information_schema) | ALTA |

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
| B-014 | Auditoria da inteligência grava `canal = "web"` nas consultas que chegam pelo WhatsApp (o gateway chama a mesma casca da Central). Visto no Supabase real em 09/10 (resumo das 12:27). **Corrigido** 09/10: `atenderInteligencia(…, { canal })` marca todo evento e ação do pedido; o WhatsApp passa `whatsapp` (TESTADO LOCAL, http.test) | `app/lib/intelligence/server/http.mjs`, `app/lib/whatsapp/servidor.mjs` | BAIXA (rastreabilidade) |
| B-015 | `continue` pelo WhatsApp iniciava o agente sem console próprio no Windows; o runner morria com 0xC000013A quando o console da ponte recebia Ctrl+C/fechava. **Corrigido** 09/10 (`start /min`, janela própria); TESTADO LOCAL (o agente sobreviveu a comandos com timeout e ao fim da ponte) | `scripts/hefisto-agent/ponte-whatsapp.mjs` | MÉDIA |
| B-016 | Marmitaria: "duplicate key … fichas_tecnicas_codigo_unico_idx" ao cadastrar. A lista de marmitas pedia colunas inexistentes, falhava calada e voltava vazia; o código era "quantidade + 1" no navegador, então toda marmita nova nascia MARM-001. Ingredientes nunca gravados (colunas inexistentes em fichas_ingredientes, erro ignorado). **Corrigido** no PR #168: gravação atômica no banco (marmitaria_salvar_ficha), código sob trava, id do formulário (TESTADO LOCAL no PGlite, ensaio TESTADO NO SUPABASE REAL com rollback; aplicação aguarda APR-005) | `app/lib/marmitaria/*`, `db/MARMITARIA_V2_REFORMULACAO.sql` | ALTA |
| B-018 | Marmitaria: conversão de saldo errada. O banco guarda o saldo na unidade do cadastro (kg, L, un; só garrafa fracionada em ml), mas `fatorSaldo` multiplicava kg/L por 1000. Registrar produção de 10 marmitas com 0,15 kg de arroz baixaria 1.500 kg; "Trazer de outro estoque" moveria 1000× o digitado; o custo por saldo do CMV saía 1000× menor; a baixa por pedido do iFood herdaria o erro. **Sem dano**: em produção 0 lotes, 0 estoques da marmitaria, 0 movimentos (TESTADO NO SUPABASE REAL, 14/10). Corrigido no PR fix/marmitaria-saldo: mesma regra do `_estoque_fator_saldo` do banco | `app/lib/marmitaria/nucleo.mjs`, telas da marmitaria | CRÍTICA |
| B-020 | Marmitaria: desmarcar "No cardápio" fazia a marmita sumir (a base lia por `fetchFichas`, que só traz ficha ativa) e não havia como devolvê-la; o filtro "Fora do cardápio" ficava sempre vazio. **Corrigido** 17/10: leitura à parte das marmitas inativas | `app/lib/marmitaria/dados.js` | ALTA. TESTADO EM MOCK |
| B-021 | Marmitaria: lista de marmitas em 390 px sem o nome da marmita e com o código quebrando letra por letra. **Corrigido** 17/10 | `app/dashboard/marmitaria/marmitas/page.js` | MÉDIA. TESTADO EM MOCK (Playwright 390 px) |
| B-022 | Eventos: lista de reservas com "Filtros", busca, "Kanban" e "…" sem ação; evento e reserva gravavam `responsavel_id` nulo (`useERP()` não tem `user`). **Corrigido** 17/10 | `app/dashboard/reservas-eventos/*` | MÉDIA. TESTADO EM MOCK |
