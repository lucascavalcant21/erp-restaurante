/* AUDITORIA DA AUTORIZAÇÃO REAL — SOMENTE LEITURA DE CATÁLOGO.

   Rode no SQL Editor do projeto que quiser auditar (produção ou staging) e me
   mande a saída de cada bloco. Nenhuma consulta aqui lê dado de usuário: só
   information_schema e pg_catalog — estrutura, RLS, policies, grants e dono de
   função. Nada altera nada.

   Se alguma consulta devolver coluna com conteúdo que pareça pessoal (nome,
   e-mail, login), NÃO me mande: é sinal de que algo saiu do previsto.

   Blocos:
     1. as tabelas existem?            5. policies
     2. colunas e tipos               6. grants por papel
     3. constraints (PK/FK/unique)    7. funções de autorização: dono e EXECUTE
     4. índices e RLS ligado          8. resumo em uma linha
*/

/* ── 1. As tabelas de autorização existem? ────────────────────────────────── */
select t.table_name,
       (select count(*) from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t.table_name) as colunas
from (values
  ('usuarios_erp'), ('usuario_escopos'), ('perfis_acesso'),
  ('perfil_permissoes'), ('usuario_permissoes'), ('empresas'), ('setores'),
  ('unidades'), ('usuario_unidades')
) as t(table_name)
left join information_schema.tables it
  on it.table_schema = 'public' and it.table_name = t.table_name
order by 1;

/* ── 2. Colunas e tipos ───────────────────────────────────────────────────── */
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('usuarios_erp','usuario_escopos','perfis_acesso',
                     'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
order by table_name, ordinal_position;

/* ── 3. Constraints: PK, FK e unique ──────────────────────────────────────── */
select tc.table_name, tc.constraint_type, tc.constraint_name,
       string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as colunas,
       ccu.table_name as referencia_tabela,
       ccu.column_name as referencia_coluna
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and tc.constraint_type = 'FOREIGN KEY'
where tc.table_schema = 'public'
  and tc.table_name in ('usuarios_erp','usuario_escopos','perfis_acesso',
                        'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
group by 1,2,3,5,6
order by 1,2,3;

/* ── 4. Índices e RLS ─────────────────────────────────────────────────────── */
select c.relname as tabela, c.relrowsecurity as rls_ligado, c.relforcerowsecurity as rls_forcado,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname in ('usuarios_erp','usuario_escopos','perfis_acesso',
                    'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
order by 1;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('usuarios_erp','usuario_escopos','perfis_acesso',
                    'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
order by 1,2;

/* ── 5. Policies (o texto exato de cada uma) ──────────────────────────────── */
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('usuarios_erp','usuario_escopos','perfis_acesso',
                    'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
order by tablename, policyname;

/* ── 6. Grants por papel ──────────────────────────────────────────────────── */
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','service_role','PUBLIC','public')
  and table_name in ('usuarios_erp','usuario_escopos','perfis_acesso',
                     'perfil_permissoes','usuario_permissoes','empresas','setores','unidades')
group by 1,2
order by 1,2;

/* ── 7. Funções de autorização: existência, dono, security definer e EXECUTE ─ */
select p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_userbyid(p.proowner) as dono,
       p.prosecdef as security_definer,
       p.provolatile as volatilidade,
       coalesce(array_to_string(p.proconfig, ', '), '(sem search_path fixo)') as config,
       coalesce(array_to_string(p.proacl::text[], ' | '), '(acl padrão: todos podem executar)') as execute_grants
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'hefisto_usuario_valido',
    'hefisto_unidades_do_usuario',
    'hefisto_user_has_permission',
    'hefisto_user_in_unit',
    'hefisto_user_in_unit_strict',
    'hefisto_user_in_company',
    'hefisto_user_can',
    'hefisto_session_context',
    'auth_papel',
    'auth_unidade_id',
    'pode_ver_todas'
  )
order by 1;

/* Elas ainda leem o JWT? (o hotfix de autorização troca isto por cadastro) */
select p.proname, p.prosrc ilike '%user_metadata%' as le_user_metadata
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('auth_papel','auth_unidade_id','pode_ver_todas','hefisto_session_context')
order by 1;

/* ── 8. Resumo ────────────────────────────────────────────────────────────── */
select
  (select count(*) from information_schema.tables
    where table_schema='public'
      and table_name in ('usuarios_erp','usuario_escopos','perfis_acesso','perfil_permissoes','usuario_permissoes')) as tabelas_authz_presentes,
  (select count(*) from pg_policies where schemaname='public') as policies_no_banco,
  (select count(*) from pg_policies where schemaname='public' and qual ilike '%unidade_id is null%') as policies_com_unidade_nula,
  (select count(*) from information_schema.role_table_grants
    where table_schema='public' and grantee='anon') as grants_para_anon,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='unidades' and column_name='empresa_id') as unidades_tem_empresa_id;
