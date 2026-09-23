# BASELINE DO BANCO DE DADOS HÉFISTO ERP

> **AVISO IMPORTANTE DE SEGURANÇA E ARQUITETURA:**
> Este diretório é reservado para a reconstrução limpa e canônica da estrutura (schema-only) do banco de dados do HÉFISTO ERP.
> NENHUM SQL inventado ou parcial (como `docs/schema-completo.sql` ou `db/TODAS_AS_MIGRACOES.sql`) deve ser utilizado como baseline.

---

## Procedimento para Obtenção do Baseline Real (Schema-Only)

O baseline oficial será gerado a partir de um dump **exclusivamente de estrutura (schema-only)** do banco de produção (`cerebro-erp`), **SEM DADOS**.

### O que SERÁ incluído no baseline:
- Schemas (`public`, `hefisto_privado`, etc.)
- Extensões PostgreSQL utilizadas
- Tabelas, colunas, tipos e valores default
- Primary Keys, Foreign Keys, UNIQUE e CHECK constraints
- Índices e sequências
- Funções, RPCs e Triggers
- Configurações RLS (`ENABLE ROW LEVEL SECURITY`) e RLS Policies
- Grants de permissão para `authenticated` e `service_role`

### O que NUNCA será incluído no baseline:
- Dados de clientes, funcionários, usuários, vendas ou compras
- Tabela `auth.users`, senhas, tokens ou refresh tokens
- Segredos (`integration_secrets`, chaves API, webhooks)
- Arquivos de storage ou metadados de buckets

---

## Instruções para Execução Manual (Instruções para o Usuário)

Quando solicitado, execute um dos comandos abaixo em seu terminal local autenticado com privilégios de administração:

### Opção A — Utilizando Supabase CLI (Recomendado):

```bash
# Login no Supabase CLI (caso ainda não esteja logado)
supabase login

# Link com o projeto de produção cerebro-erp (ref: sezccspqxgklicfndwxx)
supabase link --project-ref sezccspqxgklicfndwxx

# Exportar apenas a estrutura do schema public para o arquivo de baseline
supabase db dump --schema public --file db/baseline/0001_baseline_schema.sql
```

### Opção B — Utilizando `pg_dump` via Connection String Segura:

```bash
# Executar pg_dump com a flag --schema-only (-s) e revogação de dados (-a omitido)
pg_dump -h db.sezccspqxgklicfndwxx.supabase.co -U postgres -s -d postgres -n public > db/baseline/0001_baseline_schema.sql
```

Após a geração do arquivo `db/baseline/0001_baseline_schema.sql` pelo usuário, a estrutura do projeto poderá ser reconstruída de forma 100% determinística.
