# Decisões arquiteturais

Formato: **DA-NNN — título (data)**: contexto → decisão → consequência.

## DA-001 — Cálculo determinístico; modelo de linguagem só interpreta (out/2026)

- **Contexto:** respostas de negócio sobre dinheiro e estoque não podem variar nem ser inventadas.
- **Decisão:** métricas em `app/lib/intelligence/metrics/*` (código + SQL testados). O modelo (Anthropic) só entra quando o interpretador por regras não entende a frase, e recebe só o texto e o módulo da tela, nenhum dado do banco.
- **Consequência:** as 10 perguntas funcionam sem chave de IA. O custo de IA é baixo. Sem base, a resposta é DADOS INSUFICIENTES.

## DA-002 — Tenant resolvido no banco; banco escopado com verificação linha a linha (out/2026)

- **Decisão:**
  - A unidade do cabeçalho é conferida por `hefisto_user_in_unit`; a empresa vem de `unidades.empresa_id`; o corpo da requisição é ignorado.
  - Toda consulta recebe `.eq("unidade_id", …)`. Uma linha de outra unidade derruba a resposta (`ErroDeIsolamento`).
- **Por quê:** as policies antigas (`using (true)`, `pode_ver_todas`) não isolam. Validado com um segundo tenant real em 07/10.

## DA-003 — Fallback de contexto sem a Fase 1B (07/10/2026)

- **Contexto:** o banco real não tem `hefisto_contexto_requisicao`. Sem ela, toda chamada daria 503.
- **Decisão:** quando o RPC não existe (PGRST202/42883), montar o mesmo contexto com `hefisto_session_context` + `hefisto_user_in_unit` (`context/contexto-legado.mjs`). Qualquer outro erro falha fechado. A decisão de cada ação continua em `hefisto_user_can`.
- **Consequência:** quando a 1B for aplicada, o caminho principal assume sem mudança de código.

## DA-004 — Ações só pela função do domínio, com idempotência e auditoria (out/2026)

- **Decisão:**
  - A perda pela conversa grava por `registrarMovimento` → `estoque_movimentar`, a mesma da tela.
  - Chave `ia:<acaoId>`.
  - `intelligence_acoes` com chave única por usuário e unidade.
  - `intelligence_eventos` imutável, por privilégio e por trigger.
- **Validado:** TESTADO NO SUPABASE REAL, em transação desfeita.

## DA-005 — Memória do projeto dentro do repositório (`docs/brain`) (08/10/2026)

- **Contexto:** o agente roda na nuvem e no computador do dono; o vault pessoal do Obsidian não é alcançável da nuvem.
- **Decisão:** cérebro em Markdown versionado. O Obsidian abre a pasta como vault. Missões com frontmatter, que aparecem como propriedades.
- **Consequência:** a memória viaja com o código e o histórico fica no git.

## DA-006 — Agente autônomo sobre o Claude Code headless (08/10/2026)

- **Decisão:** o runner (`scripts/hefisto-agent/runner.mjs`) orquestra; quem trabalha é o `claude -p` com:
  - lista de ferramentas permitidas e proibidas;
  - teto de gasto por rodada;
  - travas anti-loop.
- **Por quê:** não reinventar um agente; usar o mecanismo oficial e testado.
- **Na nuvem:** uma Rotina agendada inicia uma sessão com o ciclo (`docs/autonomous/COMO_USAR.md`).
