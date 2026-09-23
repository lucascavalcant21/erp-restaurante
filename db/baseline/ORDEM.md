# Ordem para montar um Héfisto do zero

Esta é a sequência pretendida. **Nada dela foi executado ainda**, e o passo 1
depende de um arquivo que só existe depois que o dono gerar o dump do schema
real (ver [README.md](README.md)).

| # | Passo | Arquivo | Estado |
|---|---|---|---|
| 1 | Baseline do schema real (schema only) | `db/baseline/0001_baseline_schema.sql` | **não existe ainda** — depende do dump de produção |
| 2 | Diferenças entre o baseline e o bootstrap mínimo do staging | `db/baseline/0002_ajuste_bootstrap_staging.sql` | a escrever, depois do passo 1 |
| 3 | Buckets de Storage (`anexos`, `rh-docs`, `notas-fiscais`, `eventos-banners`) e suas policies | `db/baseline/0003_storage_buckets.sql` | a escrever — hoje `rh-docs` e `notas-fiscais` não são criados por nenhum SQL |
| 4 | Migrações de feature que o baseline não contiver | `db/migracao_*.sql`, `docs/*.sql` | conferir uma a uma contra o baseline |
| 5 | Autorização por servidor | `db/migracao_rls_autorizacao_servidor.sql` | escrita, UNIT_TESTED, não aplicada |
| 6 | Proteção das tabelas de autorização | `db/security/0002_proteger_tabelas_autorizacao.sql` | escrita, UNIT_TESTED, não aplicada |
| 7 | `hefisto_session_context` fechada por padrão | `db/security/0003_session_context_fail_closed.sql` | escrita, UNIT_TESTED, não aplicada |
| 8 | Policies por unidade nas tabelas de negócio (as 67 `using (true)`) | a escrever | depende de backfill de `unidade_id` |
| 9 | Camada canônica de integrações | `db/migracao_integracoes_canonica.sql` | validada no staging mínimo; **está fora do Git** (untracked na pasta compartilhada) |
| 10 | Seed sintético (unidades fictícias, catálogo de teste, usuário de teste) | a escrever | nenhum dado vindo de produção |

## Regras que valem para todos os passos

- Toda migração é idempotente e comentada com `/* */`.
- `unidade_id` é `text` em todo o banco, nunca `uuid`.
- Migração nova entra na fila do `PENDENCIAS.md` no mesmo commit que a cria.
- Nada é aplicado em produção sem passar antes por um staging reconstruído
  pelo baseline.

## Sobre o `hefisto-staging` de hoje

Ele **não é um clone estrutural do Héfisto**. Tem só um bootstrap mínimo:
`unidades`, `produtos`, `usuario_unidades`, `vendas` e `pedidos`, mais as
quatro tabelas `integration_*`. Falta o resto do ERP.

`usuario_unidades` foi criada **artificialmente** para o preflight da migração
de integrações passar. Ela **não é a arquitetura oficial** de autorização —
a candidata oficial é `usuarios_erp` + `usuario_escopos`. Quando o staging for
reconstruído pelo baseline, `usuario_unidades` será removida ou ignorada, e a
migração de integrações será corrigida para ler o modelo oficial.

Por isso os passos 5, 6 e 7 **não devem ser aplicados no staging atual**: as
tabelas que eles exigem (`usuarios_erp`, `usuario_escopos`, `perfis_acesso`,
`unidades.empresa_id`) ainda não existem lá, e os preflights vão recusar.
