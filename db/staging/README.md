# Preparar o `hefisto-staging` para testar o agente de IA

Três arquivos, nesta ordem, no **SQL Editor do hefisto-staging**. Nenhum deles
roda sozinho: quem executa é você — eu não tenho credencial deste projeto.

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `0001_bootstrap_estrutura_staging.sql` | Cria a estrutura: RBAC, unidades, insumos/estoque, fichas, produção, colaboradores/ponto, contas a pagar e lançamentos. Mais as funções de autorização e RLS por unidade. **Só schema.** |
| 2 | `0002_seed_sintetico_staging.sql` | Preenche com dados **inventados** (Restaurante Teste A/B, "Insumo A"), para o agente ter o que ler. Nenhuma linha vem de produção. |
| 3 | `0003_usuario_de_teste.sql` | Liga um usuário do Auth ao cadastro do ERP. Antes de rodar, crie o login em Authentication → Users e troque o e-mail no topo do arquivo. |

## Isto **não** é o baseline de produção

O baseline só pode sair de um dump schema-only do `cerebro-erp`
(ver `db/baseline/README.md`), e ele ainda não existe. Este bootstrap foi
montado a partir do que o repositório cria e do que o código realmente
consulta — é suficiente para testar o agente, não para reproduzir produção.
Quando o baseline chegar, este diretório é descartado.

## O que já está provado (local, PGlite)

`node scripts/test_bootstrap_staging.mjs <caminho do @electric-sql/pglite>` →
**20/20**: o bootstrap aplica num banco vazio, roda duas vezes sem duplicar,
cria as 18 tabelas e as 6 funções, o usuário de teste recebe contexto de
sessão com 8 permissões, usuário bloqueado e login sem cadastro **não** recebem
contexto, a unidade B fica invisível para quem é da A, `anon` não lê o estoque,
usuário comum não se promove, e as consultas das nove tools de dados voltam
linha.

## Depois de rodar

Confira com os blocos de conferência no fim de cada arquivo. O do `0003` tem a
consulta que responde se o login de teste ficou certo e se
`hefisto_session_context()` devolve o JSON esperado.

## O que ainda falta para o agente responder no preview

As variáveis de ambiente do Preview na Vercel (`NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` deste projeto, `OPENAI_API_KEY`,
`OPENAI_MODEL`) e um deploy novo — sem isso o preview continua sem enxergar
projeto nenhum.
