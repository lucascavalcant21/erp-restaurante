# Héfisto Intelligence Core

_Estado em 08/10/2026. O código está no PR #127 (branch `claude/fervent-bell-t363k5`, **não mesclado**). As evidências completas estão em `docs/intelligence/HI02_EVIDENCIAS.md`._

## Fluxo de uma pergunta

```
/api/intelligence/ask (server/http.mjs: atenderInteligencia)
  1. sessão: token validado no Supabase Auth
  2. contexto: unidade do cabeçalho conferida NO BANCO
       hefisto_contexto_requisicao (Fase 1B) — ausente no banco real
       → fallback context/contexto-legado.mjs (hefisto_session_context + hefisto_user_in_unit + unidades.empresa_id)
  3. porta: hefisto_user_can('dashboard.intelligence.view', unidade)
  4. Context Engine → banco escopado (context/db-escopado.mjs)
       força unidade_id em toda consulta e derruba a resposta se vier linha de outra unidade
  5. comandos: interpretador por regras (commands/interpretador-regras.mjs);
       o modelo (providers/anthropic.mjs) só quando as regras não entendem;
       o modelo recebe só o texto e o módulo da tela
  6. agentes especialistas (agents/) → Metrics Engine (metrics/) determinístico
  7. resposta com blocos (métrica com fonte, período, consulta, unidade, confiança, natureza)
  8. auditoria (audit/): intelligence_eventos, gravado pela service role e imutável
```

## Peças

| Pasta | O que faz |
|---|---|
| `core/` | Contratos de métrica (natureza REAL/ESTIMATIVA/PROJEÇÃO/SIMULAÇÃO/HIPÓTESE/META/SUGESTÃO), níveis, períodos |
| `context/` | Contexto da requisição, escopo, banco escopado, fallback sem a 1B |
| `metrics/` | Faturamento, compras, custos (CMV/CMO), estoque (saldo, validade, divergências, perdas), financeiro, metas, produtos |
| `agents/` | Orquestrador + especialistas (vendas, financeiro, estoque, operação) |
| `anomalies/` + `insights/` | Detectores, baseline, ranking criticidade × impacto × confiança, Daily Brief, perguntas abertas |
| `commands/` | Catálogo de intenções, interpretador, command bus, conversa com referência ("por quê?") |
| `actions/` | Ações confirmáveis; hoje só `stock.registerLoss`, que usa `estoque_movimentar` real |
| `memory/` | Feedback estruturado, preferências e metas por unidade |
| `audit/` | Store Supabase (produção) e memória (testes) |
| `voice/` | Web Speech API no navegador |
| UI | `app/dashboard/inteligencia` (Central + Configurações) e `app/components/intelligence/*` (painel, conversa, cartões, contexto de tela) |

## Banco (IC_01 v ic-01.2): aplicado em produção em 07/10/2026

`intelligence_eventos` (imutável), `intelligence_acoes` (chave de idempotência única), `intelligence_feedback`, `intelligence_preferencias`.
- RLS ligado.
- Grants mínimos.
- Impressão digital `d55eda66f4eddaf4d90ce66743131071`.

## O que está validado, e onde

| Capacidade | Evidência |
|---|---|
| Migração, RLS, grants, policies e triggers | TESTADO NO SUPABASE REAL |
| Porta por perfil (dono e gerente 200; consulta, cozinheiro e sem cadastro 403) | TESTADO NO SUPABASE REAL (`hefisto_user_can` com a identidade real) |
| 10 perguntas e Daily Brief com dados reais | TESTADO NO SUPABASE REAL. Dados lidos sob RLS do gerente; o motor real rodou local |
| Perda + idempotência + auditoria pela `estoque_movimentar` real | TESTADO NO SUPABASE REAL, em transação desfeita, com produto de teste |
| Isolamento com segundo tenant | TESTADO NO SUPABASE REAL, em transação desfeita |
| Casca HTTP (401, 403, 400) | TESTADO LOCAL, com o contexto real do banco |
| Telas (Central, Configurações, contexto de tela, conversa) | TESTADO EM MOCK |
| Chamada HTTP autenticada no deploy | **NÃO VALIDADO**: sem rede/acesso ao domínio ([[ACESSOS_NECESSARIOS]]) |
| Chamada real à Anthropic | **NÃO VALIDADO**: a chave existe no Vercel; falta chamar pelo deploy |
| Produção (merge + smoke) | **NÃO VALIDADO**: PR #127 em rascunho ([[BLOQUEADORES]]) |

## Limites conhecidos

- A Fase 1B (`hefisto_contexto_requisicao`) não existe no banco; vale o fallback.
- Quando a 1B for aplicada, o caminho principal assume sozinho.
- Etiquetas: o total vem de `count`; a lista mostra as 50 mais antigas.
- Sem faturamento lançado (`fin_faturamento_diario` vazio), as perguntas de venda saem DADOS INSUFICIENTES. É o certo.

## Próximo passo

[[HDEV-001]] conclui o HI-02: deploy e smoke autenticado. Depois, [[HDEV-002]]: HI-03 REAL × ESPERADO.
