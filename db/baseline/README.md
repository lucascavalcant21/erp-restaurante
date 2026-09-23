# Baseline do schema do Héfisto

Hoje **não existe** um arquivo capaz de criar o banco do ERP do zero. O que há
em `db/` e `docs/` são migrações de alteração: 131 tabelas são usadas pelo
código e 49 delas não têm `CREATE TABLE` em lugar nenhum — incluindo
`produtos`, `pedidos`, `insumos`, `colaboradores`, `estoque_atual`,
`registro_ponto`, `fichas_ingredientes` e `contas_pagar`.

Por isso o baseline **não pode ser escrito à mão nem deduzido do repositório**.
Ele tem que sair do schema real de produção, e só o dono do projeto pode
gerá-lo — este repositório não tem, e não deve ter, credencial de produção.

## O que NÃO serve como baseline

| Arquivo | Por quê |
|---|---|
| `docs/schema-completo.sql` | **LEGADO e DESTRUTIVO.** Começa com `DROP TABLE ... CASCADE` em 17 tabelas e descreve o modelo antigo (`ingredientes`, `funcionarios`, `registros_ponto`, `cardapio`), que o código atual não usa mais. Não execute. |
| `db/TODAS_AS_MIGRACOES.sql` | **PARCIAL.** Junta 21 das 68 migrações e tem 106 `ALTER TABLE` contra 22 `CREATE TABLE`: pressupõe um banco que já existe. Não é bootstrap. |

## Como gerar o baseline (você, com a sua credencial)

Objetivo: **SCHEMA ONLY**, sem uma única linha de dado.

Com a CLI do Supabase, logado no projeto de produção:

```bash
supabase db dump --schema public --schema-only -f baseline_bruto.sql
```

Ou, com `pg_dump` e a connection string do projeto:

```bash
pg_dump --schema-only --no-owner --no-privileges --no-comments --schema=public -f baseline_bruto.sql "<connection string>"
```

O dump precisa trazer: extensões, tabelas, colunas e tipos, chaves primárias e
estrangeiras, unique, índices, sequences, funções, triggers, RLS ligado,
policies e os grants relevantes.

Não deve trazer, e você deve conferir antes de me mandar: dados de clientes,
vendas, colaboradores, financeiro; `auth.users` e o schema `auth`; tokens,
segredos ou chaves; objetos e conteúdo de buckets do Storage.

Depois de gerar, **leia o arquivo** antes de commitar — um dump pode carregar
comentário com dado real ou default com informação de negócio. O arquivo entra
aqui como `0001_baseline_schema.sql` e passa a ser a fonte canônica.

## Depois do baseline

1. Comparar o baseline com o bootstrap mínimo que já existe no `hefisto-staging`
   (`unidades`, `produtos`, `usuario_unidades`, `vendas`, `pedidos`), coluna por
   coluna. Diferença vira migração explícita — `CREATE TABLE IF NOT EXISTS` não
   conserta tabela com forma errada.
2. Recriar o `hefisto-staging` a partir do baseline, com seed sintético.
3. Só então aplicar, no staging, `db/migracao_rls_autorizacao_servidor.sql`,
   `db/security/0002_proteger_tabelas_autorizacao.sql` e
   `db/security/0003_session_context_fail_closed.sql`.
4. Por último, a camada de integrações.

A ordem detalhada está em [ORDEM.md](ORDEM.md).
