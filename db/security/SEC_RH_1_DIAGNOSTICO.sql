/* SEC-RH-1 · DIAGNÓSTICO — somente leitura.
   ═══════════════════════════════════════════════════════════════════════════

   Rode ANTES da contenção, no SQL Editor do projeto de produção
   (sezccspqxgklicfndwxx). Nenhuma linha é alterada; nenhum dado de pessoa é
   impresso.

   Contexto: em 24-25/09/2026 foi confirmado, usando SOMENTE a chave anônima
   pública (a mesma que vai no bundle do site) e SEM LOGIN, que 22 tabelas de
   RH devolvem dado. Este arquivo mostra POR QUE — se é falta de RLS, grant
   direto ao anon, ou grant ao PUBLIC herdado.

   A distinção importa: a contenção correta é diferente em cada caso.
*/

/* ═══ 1. RLS, owner e contagem de policies, por tabela ══════════════════════ */
with alvo(tabela) as (values
  ('colaboradores'),('funcionarios'),('holerites'),('func_documentos'),
  ('advertencias'),('rh_advertencias_colab'),('rh_atestados'),('rh_bonificacoes'),
  ('rh_espelho_fechado'),('rh_consumo_funcionarios'),('rh_historico_promocoes'),
  ('rh_treinamentos_colab'),('rh_reunioes_colab'),('producoes'),('rh_atas'),
  ('rh_atas_reuniao'),('rh_historico'),('registro_ponto'),('registros_ponto'),
  ('ponto_marcacao'),('rh_banco_horas'),('rh_cargos'),('rh_feriados'),
  ('rh_folgas_esporadicas'),('rh_recibos_prestacao'),('rh_regulamentos'),
  ('rh_tipos_bonificacao'),('treinamentos'),('escalas_dia'),('documentos_rh'),
  ('extras_cadastros'),('producao_diaria'),('avisos'),('cursos'),('usuarios_erp')
)
select a.tabela,
       c.oid is not null                        as existe,
       c.relrowsecurity                         as rls_ligada,
       c.relforcerowsecurity                    as rls_forcada,
       pg_get_userbyid(c.relowner)              as owner,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = a.tabela) as policies
  from alvo a
  left join pg_class c
    on c.relname = a.tabela
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
 order by c.relrowsecurity nulls last, a.tabela;

/* LEITURA
   rls_ligada = false  → RLS desligada: quem tem GRANT lê a tabela inteira.
   rls_ligada = true e policies = 0 → ninguém lê (nem o app).
   rls_ligada = true e policies > 0 → depende do USING; ver bloco 4. */

/* ═══ 2. Privilégios efetivos de anon e authenticated ═══════════════════════
   has_table_privilege resolve herança: se o privilégio vier de PUBLIC, aqui
   aparece como true mesmo sem grant direto ao anon. É por isso que o bloco 3
   existe. */
with alvo(tabela) as (values
  ('colaboradores'),('funcionarios'),('holerites'),('func_documentos'),
  ('advertencias'),('rh_advertencias_colab'),('rh_atestados'),('rh_bonificacoes'),
  ('rh_espelho_fechado'),('rh_consumo_funcionarios'),('producoes'),('rh_atas'),
  ('rh_atas_reuniao'),('rh_historico'),('registro_ponto'),('ponto_marcacao'),
  ('rh_banco_horas'),('rh_cargos'),('rh_feriados'),('rh_folgas_esporadicas'),
  ('rh_recibos_prestacao'),('rh_regulamentos'),('rh_tipos_bonificacao'),
  ('treinamentos'),('escalas_dia'),('documentos_rh'),('extras_cadastros'),
  ('producao_diaria'),('avisos'),('cursos'),('usuarios_erp')
)
select a.tabela,
       has_table_privilege('anon',          'public.' || a.tabela, 'SELECT') as anon_select,
       has_table_privilege('anon',          'public.' || a.tabela, 'INSERT') as anon_insert,
       has_table_privilege('anon',          'public.' || a.tabela, 'UPDATE') as anon_update,
       has_table_privilege('anon',          'public.' || a.tabela, 'DELETE') as anon_delete,
       has_table_privilege('authenticated', 'public.' || a.tabela, 'SELECT') as auth_select,
       has_table_privilege('authenticated', 'public.' || a.tabela, 'INSERT') as auth_insert
  from alvo a
 where exists (select 1 from pg_class c
                where c.relname = a.tabela and c.relnamespace = 'public'::regnamespace)
 order by anon_select desc, anon_insert desc, a.tabela;

/* ATENÇÃO: qualquer `anon_insert`, `anon_update` ou `anon_delete` verdadeiro é
   escrita anônima — mais grave que a leitura. */

/* ═══ 3. De ONDE vem o privilégio: grant direto ou PUBLIC ═══════════════════
   Decide a forma da contenção. Revogar de `anon` não adianta nada se o grant
   estiver em PUBLIC — e revogar de PUBLIC tem estouro maior, porque
   `authenticated` também herda de PUBLIC. */
select table_name as tabela, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'PUBLIC', 'public', 'service_role')
   and table_name in (
     'colaboradores','funcionarios','holerites','func_documentos','advertencias',
     'rh_advertencias_colab','rh_atestados','rh_bonificacoes','rh_espelho_fechado',
     'rh_consumo_funcionarios','producoes','rh_atas','rh_atas_reuniao','rh_historico',
     'registro_ponto','ponto_marcacao','rh_banco_horas','rh_cargos','rh_feriados',
     'rh_folgas_esporadicas','rh_recibos_prestacao','rh_regulamentos',
     'rh_tipos_bonificacao','treinamentos','escalas_dia','documentos_rh',
     'extras_cadastros','producao_diaria','avisos','cursos','usuarios_erp')
 group by table_name, grantee
 order by table_name, grantee;

/* ═══ 4. Policies existentes, com USING e WITH CHECK ════════════════════════ */
select tablename as tabela, policyname, cmd, roles,
       qual       as usando,
       with_check as com_check
  from pg_policies
 where schemaname = 'public'
   and tablename in (
     'colaboradores','funcionarios','holerites','func_documentos','advertencias',
     'rh_advertencias_colab','rh_atestados','rh_bonificacoes','rh_espelho_fechado',
     'rh_consumo_funcionarios','producoes','rh_atas','rh_atas_reuniao','rh_historico',
     'registro_ponto','ponto_marcacao','rh_banco_horas','rh_cargos','rh_feriados',
     'rh_folgas_esporadicas','rh_recibos_prestacao','rh_regulamentos',
     'rh_tipos_bonificacao','treinamentos','escalas_dia','documentos_rh',
     'extras_cadastros','producao_diaria','avisos','cursos','usuarios_erp')
 order by tabela, policyname;

/* Policy com `qual = true` e role `{public}` é permissiva para todo mundo,
   inclusive anon. Vale tanto quanto não ter RLS. */

/* ═══ 5. Privilégios padrão futuros ═════════════════════════════════════════
   Se houver DEFAULT PRIVILEGES concedendo a anon, toda tabela NOVA nasce
   exposta — e a contenção de hoje não impede a de amanhã. */
select r.rolname as concedente, n.nspname as schema, d.defaclobjtype as tipo,
       pg_catalog.array_to_string(d.defaclacl, E'\n') as acl_padrao
  from pg_default_acl d
  left join pg_roles r on r.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public' or n.nspname is null;

/* ═══ 6. Funções SECURITY DEFINER que tocam RH ══════════════════════════════
   Função SECURITY DEFINER roda com os direitos de quem a criou: se anon puder
   executá-la, ela contorna RLS e grant. O search_path também importa — sem
   `set search_path`, dá para sequestrar a resolução de nomes. */
select p.proname as funcao,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seguranca,
       coalesce(array_to_string(p.proconfig, ', '), '(sem search_path fixo)')  as config,
       pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_executa
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and (p.proname ~* 'rh_|colaborador|funcionario|ponto|folha|holerite|atestado|espelho|banco_horas|escala|extra|treinamento|auth_|papel|unidade|pode_ver|session_context')
 order by p.prosecdef desc, anon_executa desc, p.proname;

/* ATENÇÃO: linha com seguranca = DEFINER e anon_executa = true é um caminho de
   leitura anônima que sobrevive ao REVOKE das tabelas. Precisa de tratamento
   próprio. */

/* ═══ 7. As funções de autorização, como estão hoje ═════════════════════════
   O hotfix em fix/rls-autorizacao-servidor troca a leitura de
   auth.jwt()->'user_metadata' (que o próprio usuário escreve) por consulta a
   usuarios_erp. Este bloco mostra o que está no banco AGORA. */
select p.proname as funcao,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seguranca,
       (pg_get_functiondef(p.oid) ilike '%user_metadata%')  as usa_user_metadata,
       (pg_get_functiondef(p.oid) ilike '%app_metadata%')   as usa_app_metadata,
       (pg_get_functiondef(p.oid) ilike '%usuarios_erp%')   as consulta_usuarios_erp
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('auth_papel', 'auth_unidade_id', 'pode_ver_todas',
                     'hefisto_session_context', 'hefisto_user_in_unit',
                     'hefisto_user_in_unit_strict', 'hefisto_user_in_company')
 order by p.proname;

/* `usa_user_metadata = true` confirma que a autorização ainda depende de um
   campo que o usuário controla. */
