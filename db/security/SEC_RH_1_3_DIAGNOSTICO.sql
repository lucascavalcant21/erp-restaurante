/* SEC-RH-1.3 · DIAGNÓSTICO — somente leitura.
   ═══════════════════════════════════════════════════════════════════════════

   Rode no SQL Editor do projeto de PRODUÇÃO (sezccspqxgklicfndwxx), ANTES do
   SEC_RH_1_3_CONTENCAO.sql, e de novo DEPOIS dele (os blocos 1 e 2 são a
   conferência pós-contenção pedida no PASSO 6).

   Nenhum bloco altera o banco. Nenhum bloco devolve linha de pessoa: só
   catálogo (pg_class, pg_policies, pg_proc, storage.buckets) e contagens.

   Cada bloco é independente — rode um de cada vez e exporte o resultado.

   Sobre a lista de tabelas: ela NÃO é presumida. O CTE `rh` junta
   (a) as 37 que o SEC-RH-1 já sondou pelo PostgREST e
   (b) toda tabela do schema public cujo nome tenha cara de RH.
   A coluna `achada_por` diz qual das duas regras a trouxe — uma tabela
   achada só pelo padrão de nome precisa de olho humano antes do REVOKE.
*/

/* ═══ 1. LISTA CANÔNICA + PRIVILÉGIOS EFETIVOS (PASSOS 2 e 6) ═══════════════
   has_table_privilege resolve herança (PUBLIC, membership). É o que vale.
   `linhas_aprox` vem das estatísticas, não de count(*): não lê a tabela. */
with nomes(tabela) as (values
  ('advertencias'),('avisos'),('colaboradores'),('cursos'),('documentos_rh'),
  ('escalas_dia'),('extras_cadastros'),('func_documentos'),('funcionarios'),
  ('holerites'),('ponto_comprovante_envio'),('ponto_marcacao'),('producao_diaria'),
  ('producoes'),('registro_ponto'),('registros_ponto'),('rh_advertencias_colab'),
  ('rh_atas'),('rh_atas_reuniao'),('rh_atestados'),('rh_banco_horas'),
  ('rh_bonificacoes'),('rh_cargos'),('rh_consumo_funcionarios'),
  ('rh_espelho_fechado'),('rh_feriados'),('rh_folgas_esporadicas'),('rh_historico'),
  ('rh_historico_promocoes'),('rh_ponto_liberado'),('rh_recibos_prestacao'),
  ('rh_regulamentos'),('rh_reunioes_colab'),('rh_tipos_bonificacao'),
  ('rh_treinamentos_colab'),('treinamentos'),('usuarios_erp')
),
rh as (
  select c.oid, c.relname as tabela,
         case when c.relname in (select tabela from nomes) then 'lista SEC-RH-1'
              else 'padrão de nome' end as achada_por
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p')
     and (c.relname in (select tabela from nomes)
          or c.relname ~* '(^rh_|colaborad|funcionar|ponto|holerite|folha_|atestad|espelho|banco_horas|escala|extras_|treinament|advertenc|bonifica|biometr|ferias|folga|recibo|salari|admiss|demiss|rescis)')
)
select rh.tabela,
       rh.achada_por,
       greatest(coalesce(s.n_live_tup, 0), c.reltuples::bigint, 0) as linhas_aprox,
       has_table_privilege('anon',          rh.oid, 'SELECT')    as anon_select,
       has_table_privilege('anon',          rh.oid, 'INSERT')    as anon_insert,
       has_table_privilege('anon',          rh.oid, 'UPDATE')    as anon_update,
       has_table_privilege('anon',          rh.oid, 'DELETE')    as anon_delete,
       has_table_privilege('authenticated', rh.oid, 'SELECT')    as auth_select,
       has_table_privilege('authenticated', rh.oid, 'INSERT')    as auth_insert,
       has_table_privilege('authenticated', rh.oid, 'UPDATE')    as auth_update,
       has_table_privilege('authenticated', rh.oid, 'DELETE')    as auth_delete,
       c.relrowsecurity                                          as rls,
       c.relforcerowsecurity                                     as force_rls,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = rh.tabela) as policies
  from rh
  join pg_class c on c.oid = rh.oid
  left join pg_stat_user_tables s on s.relid = rh.oid
 order by (has_table_privilege('anon', rh.oid, 'SELECT')
        or has_table_privilege('anon', rh.oid, 'INSERT')
        or has_table_privilege('anon', rh.oid, 'UPDATE')
        or has_table_privilege('anon', rh.oid, 'DELETE')) desc,
          rh.tabela;

/* As 37 da lista que NÃO existem aparecem aqui — para o relatório dizer
   "inexistente" com base no catálogo, não no 404 do PostgREST. */
select n.tabela as inexistente
  from (values
  ('advertencias'),('avisos'),('colaboradores'),('cursos'),('documentos_rh'),
  ('escalas_dia'),('extras_cadastros'),('func_documentos'),('funcionarios'),
  ('holerites'),('ponto_comprovante_envio'),('ponto_marcacao'),('producao_diaria'),
  ('producoes'),('registro_ponto'),('registros_ponto'),('rh_advertencias_colab'),
  ('rh_atas'),('rh_atas_reuniao'),('rh_atestados'),('rh_banco_horas'),
  ('rh_bonificacoes'),('rh_cargos'),('rh_consumo_funcionarios'),
  ('rh_espelho_fechado'),('rh_feriados'),('rh_folgas_esporadicas'),('rh_historico'),
  ('rh_historico_promocoes'),('rh_ponto_liberado'),('rh_recibos_prestacao'),
  ('rh_regulamentos'),('rh_reunioes_colab'),('rh_tipos_bonificacao'),
  ('rh_treinamentos_colab'),('treinamentos'),('usuarios_erp')) n(tabela)
 where to_regclass('public.' || quote_ident(n.tabela)) is null
 order by 1;

/* ═══ 2. DE ONDE VEM CADA PRIVILÉGIO (PASSOS 5 e 6) ═════════════════════════
   Lê a ACL crua. `grantee = PUBLIC` é o caso especial: anon E authenticated
   herdam dele, então REVOKE ... FROM anon não o remove.
   Tabela sem ACL explícita (relacl nulo) usa o padrão do Postgres — só o
   owner — e aparece aqui com o owner. */
with rh as (
  select c.oid, c.relname as tabela, c.relowner, c.relacl
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p')
     and c.relname ~* '(^rh_|colaborad|funcionar|ponto|holerite|folha_|atestad|espelho|banco_horas|escala|extras_|treinament|advertenc|bonifica|biometr|ferias|folga|recibo|salari|admiss|demiss|rescis|^documentos_rh$|^producao_diaria$|^producoes$|^avisos$|^cursos$|^usuarios_erp$)'
)
select rh.tabela,
       case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       string_agg(a.privilege_type, ', ' order by a.privilege_type)             as privilegios,
       pg_get_userbyid(a.grantor)                                               as concedido_por,
       case when a.grantee = 0 then 'PUBLIC — anon e authenticated herdam'
            when pg_get_userbyid(a.grantee) in ('anon', 'authenticated') then 'grant direto'
            else 'outro role' end                                               as origem
  from rh,
       lateral aclexplode(coalesce(rh.relacl, acldefault('r', rh.relowner))) a
 where a.grantee = 0
    or pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role')
 group by rh.tabela, a.grantee, a.grantor
 order by rh.tabela, grantee;

/* Roles de que anon e authenticated são MEMBROS. Se aparecer alguma aqui, um
   privilégio pode chegar por herança de role, não só por PUBLIC. */
select pg_get_userbyid(m.member) as membro, pg_get_userbyid(m.roleid) as herda_de,
       m.admin_option
  from pg_auth_members m
 where pg_get_userbyid(m.member) in ('anon', 'authenticated')
 order by 1, 2;

/* ═══ 3. POLICIES DAS TABELAS DE RH ═════════════════════════════════════════
   `aberta_a_todos` = policy que vale para PUBLIC/anon com USING true. Depois
   do REVOKE ela não abre nada ao anon (sem grant o RLS nem é consultado),
   mas continua valendo para authenticated — é assunto do SEC-RH-2. */
select p.tablename as tabela, p.policyname, p.permissive, p.cmd, p.roles,
       p.qual       as usando,
       p.with_check as com_check,
       (('public' = any(p.roles) or 'anon' = any(p.roles))
         and coalesce(p.qual, 'true') = 'true')                          as aberta_a_todos,
       (coalesce(p.qual, '') || coalesce(p.with_check, '')) ilike '%user_metadata%' as usa_user_metadata
  from pg_policies p
 where p.schemaname = 'public'
   and p.tablename ~* '(^rh_|colaborad|funcionar|ponto|holerite|folha_|atestad|espelho|banco_horas|escala|extras_|treinament|advertenc|bonifica|biometr|ferias|folga|recibo|salari|^documentos_rh$|^producao_diaria$|^producoes$|^avisos$|^cursos$|^usuarios_erp$)'
 order by p.tablename, p.policyname;

/* ═══ 4. VIEWS QUE LEEM TABELAS DE RH (PASSO 8) ═════════════════════════════
   Uma view SEM security_invoker roda com os direitos do OWNER: o REVOKE na
   tabela-base não a alcança. Se anon tiver SELECT numa view assim, o dado
   continua saindo — é CRÍTICO mesmo com a tabela bloqueada.
   `tabelas_origem` vem de pg_depend (dependência real), não de nome. */
with rh as (
  select c.oid
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p')
     and c.relname ~* '(^rh_|colaborad|funcionar|ponto|holerite|folha_|atestad|espelho|banco_horas|escala|extras_|treinament|advertenc|bonifica|biometr|ferias|folga|recibo|salari|^documentos_rh$|^producao_diaria$|^producoes$|^usuarios_erp$)'
),
dep as (
  select distinct v.oid as view_oid, t.relname as origem
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid
    join pg_class v   on v.oid = r.ev_class
    join pg_class t   on t.oid = d.refobjid
   where d.classid = 'pg_rewrite'::regclass
     and d.refclassid = 'pg_class'::regclass
     and v.oid <> t.oid
     and v.relkind in ('v', 'm')
     and t.oid in (select oid from rh)
)
select n.nspname || '.' || v.relname                                    as view,
       case v.relkind when 'v' then 'view' else 'materialized' end      as tipo,
       pg_get_userbyid(v.relowner)                                      as owner,
       coalesce(array_to_string(v.reloptions, ', '), '')                ~* 'security_invoker=(true|on|1)' as security_invoker,
       coalesce(array_to_string(v.reloptions, ', '), '')                ~* 'security_barrier=(true|on|1)' as security_barrier,
       has_table_privilege('anon',          v.oid, 'SELECT')            as anon_select,
       has_table_privilege('authenticated', v.oid, 'SELECT')            as auth_select,
       string_agg(dep.origem, ', ' order by dep.origem)                 as tabelas_origem,
       case
         when has_table_privilege('anon', v.oid, 'SELECT') and v.relkind = 'm'      then 'CRÍTICO'
         when has_table_privilege('anon', v.oid, 'SELECT')
          and not (coalesce(array_to_string(v.reloptions, ', '), '') ~* 'security_invoker=(true|on|1)') then 'CRÍTICO'
         when has_table_privilege('anon', v.oid, 'SELECT')                           then 'REVISAR'
         else 'OK'
       end                                                               as risco
  from dep
  join pg_class v     on v.oid = dep.view_oid
  join pg_namespace n on n.oid = v.relnamespace
 group by n.nspname, v.oid, v.relname, v.relkind, v.relowner, v.reloptions
 order by risco, view;

/* ═══ 5. FUNÇÕES QUE TOCAM RH (PASSO 9) ═════════════════════════════════════
   Função é criada com EXECUTE para PUBLIC por padrão — então anon executa
   tudo que não teve `revoke ... from public` explícito. `exec_via_public`
   mostra isso.
   `tabelas_rh` é busca textual no corpo: aponta, não prova. Funções de
   extensão ficam de fora.

   Risco:
     CRÍTICO — SECURITY DEFINER + anon executa + cita tabela de RH
               (contorna o REVOKE das tabelas e o RLS)
     REVISAR — DEFINER sem search_path fixo; ou DEFINER que recebe unidade/
               colaborador por parâmetro (quem garante que o chamador pode?);
               ou lê user_metadata
     OK      — o resto */
with rh as (
  select c.relname
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p', 'v', 'm')
     and c.relname ~* '(^rh_|colaborad|funcionar|ponto|holerite|folha_|atestad|espelho|banco_horas|escala|extras_|treinament|advertenc|bonifica|biometr|ferias|folga|recibo|salari|^documentos_rh$|^producao_diaria$|^producoes$|^usuarios_erp$)'
),
f as (
  select p.oid, p.oid::regprocedure::text as funcao, p.prosecdef, p.proowner,
         p.proconfig, p.proacl, p.prosrc,
         coalesce(array_to_string(p.proargnames, ','), '') as args,
         (select array_agg(rh.relname order by rh.relname)
            from rh where p.prosrc ~* ('\m' || rh.relname || '\M')) as tabelas_rh
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
)
select * from (
  select f.funcao,
         case when f.prosecdef then 'DEFINER' else 'INVOKER' end                   as seguranca,
         pg_get_userbyid(f.proowner)                                               as owner,
         coalesce((select c from unnest(f.proconfig) c where c like 'search_path=%'),
                  '(sem search_path fixo)')                                        as search_path,
         has_function_privilege('anon',          f.oid, 'EXECUTE')                 as anon_executa,
         has_function_privilege('authenticated', f.oid, 'EXECUTE')                 as auth_executa,
         exists (select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                  where a.grantee = 0 and a.privilege_type = 'EXECUTE')            as exec_via_public,
         array_to_string(f.tabelas_rh, ', ')                                       as tabelas_rh,
         concat_ws(', ',
           case when f.prosrc ~* '\mselect\M'                 then 'SELECT' end,
           case when f.prosrc ~* '\minsert\s+into\M'          then 'INSERT' end,
           case when f.prosrc ~* '\mupdate\s+\w'              then 'UPDATE' end,
           case when f.prosrc ~* '\mdelete\s+from\M'          then 'DELETE' end)   as operacoes,
         f.prosrc ilike '%user_metadata%'                                          as usa_user_metadata,
         f.args ~* 'unidade'                                                       as recebe_unidade,
         f.args ~* 'colaborador'                                                   as recebe_colaborador,
         f.args ~* 'funcionario'                                                   as recebe_funcionario,
         case
           when f.prosecdef and has_function_privilege('anon', f.oid, 'EXECUTE')
            and f.tabelas_rh is not null                                           then 'CRÍTICO'
           when f.prosecdef and not exists (select 1 from unnest(f.proconfig) c where c like 'search_path=%')
                                                                                   then 'REVISAR'
           when f.prosecdef and f.args ~* 'unidade|colaborador|funcionario'        then 'REVISAR'
           when f.prosrc ilike '%user_metadata%'                                   then 'REVISAR'
           else 'OK'
         end                                                                       as risco
    from f
   where f.tabelas_rh is not null
      or f.prosecdef
      or f.args ~* 'unidade|colaborador|funcionario'
      or f.prosrc ilike '%user_metadata%'
) x
 order by case x.risco when 'CRÍTICO' then 0 when 'REVISAR' then 1 else 2 end, x.funcao;

/* ═══ 6. FUNÇÕES DE AUTORIZAÇÃO E user_metadata (PASSO 11 — só confirmar) ══
   Não corrige nada. A correção está em fix/rls-autorizacao-servidor e entra
   no SEC-RH-1.4. */
select p.oid::regprocedure::text                             as funcao,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seguranca,
       p.prosrc ilike '%user_metadata%'                     as usa_user_metadata,
       p.prosrc ilike '%app_metadata%'                      as usa_app_metadata,
       p.prosrc ilike '%usuarios_erp%'                      as consulta_usuarios_erp,
       has_function_privilege('anon', p.oid, 'EXECUTE')     as anon_executa
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('auth_papel', 'auth_unidade_id', 'pode_ver_todas',
                     'hefisto_session_context', 'hefisto_user_in_unit',
                     'hefisto_user_in_unit_strict', 'hefisto_user_in_company')
 order by 1;

/* Quantas policies, em QUALQUER tabela, leem user_metadata direto do JWT —
   sem passar pelas funções acima. */
select p.schemaname, p.tablename, p.policyname, p.cmd
  from pg_policies p
 where (coalesce(p.qual, '') || coalesce(p.with_check, '')) ilike '%user_metadata%'
 order by 1, 2, 3;

/* ═══ 7. STORAGE (PASSO 10) ═════════════════════════════════════════════════
   7a · buckets. `public = true` significa: qualquer pessoa com a URL baixa o
   arquivo, sem chave nenhuma, e policy nenhuma é consultada para isso. */
select b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types, b.created_at
  from storage.buckets b
 order by b.public desc, b.id;

/* 7b · policies do storage. Uma policy SELECT para anon/public em
   storage.objects permite LISTAR o bucket — ou seja, descobrir as URLs. */
select p.tablename, p.policyname, p.permissive, p.cmd, p.roles,
       p.qual as usando, p.with_check as com_check
  from pg_policies p
 where p.schemaname = 'storage'
 order by p.tablename, p.policyname;

/* 7c · volume por bucket e pasta de primeiro nível. Pasta com cara de id
   aparece como <id>: nenhum nome de pessoa ou de arquivo sai daqui. */
select o.bucket_id,
       case when split_part(o.name, '/', 1) ~ '^[a-z][a-z_-]*$'
            then split_part(o.name, '/', 1) else '<id>' end as pasta,
       count(*)                                             as objetos
  from storage.objects o
 group by 1, 2
 order by 1, 2;

/* 7d · privilégio de tabela do anon no schema storage. */
select c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
       c.relrowsecurity as rls
  from pg_class c
 where c.relnamespace = 'storage'::regnamespace and c.relname in ('buckets', 'objects');

/* ═══ 8. PRIVILÉGIOS PADRÃO ═════════════════════════════════════════════════
   Grant padrão para anon = toda tabela NOVA nasce exposta, e esta contenção
   não impede a próxima. */
select pg_get_userbyid(d.defaclrole) as concedente,
       coalesce(n.nspname, '(todos)') as schema,
       case d.defaclobjtype when 'r' then 'tabela' when 'S' then 'sequence'
            when 'f' then 'função' when 'T' then 'tipo' else d.defaclobjtype::text end as objeto,
       case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       string_agg(a.privilege_type, ', ' order by a.privilege_type) as privilegios
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace,
       lateral aclexplode(d.defaclacl) a
 where (n.nspname = 'public' or n.nspname is null)
   and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'))
 group by 1, 2, 3, 4
 order by 1, 2, 3, 4;
