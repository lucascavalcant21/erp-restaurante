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

## DA-007 — Conectores no agente da noite: só leitura, com guarda determinística (08/10/2026)

- **Decisão:** o agente da noite usa os conectores do claude.ai (Supabase, Vercel) só para ler.
  - O motor roda em `dontAsk`: o que não está na lista de leitura é negado.
  - O `execute_sql` fica fora da lista e só roda se o gancho `scripts/hefisto-agent/guarda-sql.mjs` aprovar. A guarda:
    - aceita só leitura;
    - aceita só o projeto do Héfisto;
    - embrulha a consulta em `begin transaction read only … rollback`.
  - As regras vão no arquivo `--settings` (`.hefisto-agent/motor-settings.json`), porque na linha de comando estourariam o limite de 8191 caracteres do cmd do Windows.
- **Por quê:** ninguém está olhando à noite. Prioridade SEGURANÇA > INTEGRIDADE DOS DADOS. Escrita de teste no banco real (`do $$ … raise exception $$`) depende de o bloco chegar no `raise`; um erro do agente gravaria em produção.
- **Falha fechada:** se a guarda quebrar, o modo `dontAsk` nega o SQL. TESTADO LOCAL com o Claude Code real.
- **Evidência (08/10):**
  - TESTADO NO SUPABASE REAL:
    - leitura com `set local role authenticated` dentro do embrulho devolve linhas;
    - `create table` dentro do embrulho: "cannot execute CREATE TABLE in a read-only transaction";
    - nada ficou criado.
  - TESTADO LOCAL, com o Claude Code 2.1.294 real e um servidor MCP de teste "supabase-teste":
    - o `select` chegou embrulhado;
    - o `delete` e o `select 1; commit; delete …` foram recusados e não chegaram ao servidor;
    - o `apply_migration` e o `create_branch` nem apareceram para o agente;
    - a sonda do `hefisto:preparar` descobriu o prefixo real.
  - NÃO VALIDADO: os nomes exatos dos conectores do claude.ai no computador do dono. A sonda do preparar descobre e grava esses nomes.


## DA-008 — Política de publicação e banco: AUTO SAFE / APPROVAL REQUIRED (08/10/2026)

- **Decisão:** um motor só (`scripts/hefisto-agent/politica.mjs`) classifica toda alteração em LOW/MEDIUM/HIGH/CRITICAL e decide AUTO_SAFE, APPROVAL_REQUIRED ou BLOCKED. O runner o aplica em cada rodada (`publicacao.mjs`): preview (push), migração (classificação + ensaio) e produção (missão DONE). Regras em [[POLITICA_PUBLICACAO]].
- **Pedidos ao dono** em `06_OPERACAO/APROVACOES_PENDENTES.md` (texto versionado, legível no Obsidian), com o formato pedido (ID, missão, ação, ambiente, risco, motivo, impacto, rollback, evidências, comando, status). O agente pede; aprovar é só do dono (trava por `HEFISTO_AGENT=1` e `disallowedTools`).
- **Padrões seguros:** preview automático ligado; produção e aplicar migração automáticos **desligados**. As chaves só liberam o que já é LOW/MEDIUM com tudo verde. CRITICAL, HIGH em produção, migração REVIEW/CRITICAL e falta de rollback pedem o dono sempre.
- **Por quê:** o pedido do dono (HDEV-PUBLISH-001) preserva os defaults seguros. A concessão de escrita em produção ao agente sem supervisão continua pendente em [[DECISOES_PRODUTO]]: ligar a chave não dá a ferramenta (`apply_migration`, `gh pr merge` seguem negados).
- **Push segurado:** com teste/build falhando, segredo no bundle, RLS inseguro ou conflito, o runner não envia o branch (o Vercel geraria um preview do código quebrado). A memória fica commitada localmente e sobe na próxima rodada verde.
- **Evidência:** TESTADO LOCAL (`npm run test:agent`: 56/56 com PGLITE; inclui runner real com repositório Git e remoto: teste falhando não chega ao remoto). Classificador calibrado nos 150 arquivos de `db/`. NÃO VALIDADO: preview real e aplicação no Supabase pela política (o runner não tem essas ferramentas).

## DA-009 — Isolamento por unidade: uma policy padrão `sec_unidade` (08/10/2026)

- **Decisão:** as tabelas com `unidade_id` passam a ter UMA policy, `sec_unidade`, para `authenticated`:
  `(select hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(hefisto_unidades_do_usuario()))`.
  - `hefisto_ve_todas_unidades()`: super admin ou escopo `todos`;
  - `hefisto_unidades_do_usuario()`: unidade principal + escopos de unidade;
  - usuário inativo ou bloqueado: nada; escopo `empresa`: nada (falha fechada, ver S-14).
- **Por quê:** substitui 4 formas abertas e o padrão antigo `pode_ver_todas() or unidade_id = auth_unidade_id()`, que só enxerga UMA unidade por usuário e deixava linhas sem unidade visíveis para todos. Calculada uma vez por consulta (subconsulta não correlacionada), não por linha.
- **Tabela nova com `unidade_id` usa essa policy.** O teste `npm run test:seguranca` e a política de publicação recusam policy aberta.
- **Evidência:** TESTADO LOCAL (PGlite com as policies reais). Aplicação no banco real: aguarda APR-001.
