# Fase 1B — Fronteira de confiança para o futuro Agent Core

Base: branch `fase-1a/seguranca` (5 commits, nenhuma migração aplicada no
banco em 16/09/2026). A 1B continua na branch `fase-1b/fronteira`, criada a
partir dela. Sem merge, sem push, sem produção, sem Agent Core e sem tools.

## Camadas e o que cada uma confere (nenhuma confia só na anterior)

```
IA (futuro) → Tool Registry (futuro) → Permission Engine → Domain Action → RLS → Banco
                                         authorizeAction     função no      policy por
                                         RequestContext      banco com      permissão +
                                                             checagem       unidade
```

| Camada | Confere | Arquivo |
|---|---|---|
| RequestContext | sessão válida, usuário ativo com perfil ativo, unidade pedida dentro do escopo, empresa **derivada da unidade no banco** (nunca do cliente), permissões efetivas, request id, canal | `app/lib/server/contexto.mjs` + `hefisto_contexto_requisicao()` |
| authorizeAction | chave existe no catálogo; o contexto diz que pode; **o banco confirma** (`hefisto_user_can`) na unidade | `app/lib/server/autorizacao.mjs` |
| Concessão | ninguém dá permissão, perfil ou escopo que não tem; ninguém gerencia usuário fora do próprio escopo; ninguém se promove | `app/lib/server/concessao.mjs` + funções `hefisto_*concess*` |
| Integrações | cada uma com identidade e segredo próprios; webhook por assinatura HMAC do corpo; sem segredo = fechado | `app/lib/server/integracoes.mjs` |
| RLS | todo comando em toda tabela exige regra explícita: permissão do catálogo + unidade (direta ou pela tabela-pai); sem regra = negado | migração 02 |
| Biometria | fora das tabelas comuns, em schema que a API REST não expõe; só funções com permissão leem ou gravam | migrações 03 e 04 |

## Migrações (ordem)

| # | Arquivo | Tipo | Depende de |
|---|---|---|---|
| 01 | `db/1b/01_contexto_escopo_concessao.sql` | substitui funções (com fotografia) | Etapa 3 |
| 02 | `db/1b/02_rls_permissao_e_tabelas_filho.sql` | policies | 01 |
| 03 | `db/1b/03_biometria_e_ponto_isolados.sql` | acrescenta (cópia, funções) | 01 |
| — | deploy do código da 1B | — | 03 |
| 04 | `db/1b/04_biometria_limpeza.sql` | restringe (limpa colunas antigas) | 03 + deploy |

Cada uma tem rollback em `db/1b/rollback_0N_*.sql` e simulação/testes em
`scripts/seguranca/testar-migracoes.mjs`.

## Fora do escopo (de propósito)

Vendas (continua pendente em `docs/arquitetura/VENDAS_FONTE_DA_VERDADE.md`),
Agent Core, tool calling, MCP, WhatsApp/Instagram reais, redesign de telas.
