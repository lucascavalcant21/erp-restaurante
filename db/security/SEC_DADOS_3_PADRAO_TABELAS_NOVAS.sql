/* SEC-DADOS-3 · TABELAS NOVAS NASCEM FECHADAS PARA O ANON
   ═══════════════════════════════════════════════════════════════════════════

   Por padrão o Supabase dá TODAS as permissões ao anon em toda tabela e
   sequência criada no schema public. Depois das SEC-DADOS-1 e 2, o anon não
   tem acesso a nada — mas a próxima tabela criada (por migração, pelo SQL
   Editor ou pelo outro fluxo) nasceria aberta de novo.

   Este arquivo muda o PADRÃO (pg_default_acl) para os donos das tabelas
   (postgres e, se permitido, supabase_admin): tabelas e sequências novas
   deixam de receber permissão para o anon. authenticated e service_role
   continuam recebendo como sempre.

   Funções não entram: o Postgres dá EXECUTE a PUBLIC por padrão, fora do
   pg_default_acl; tirar o anon ali não muda nada, e mexer em PUBLIC afetaria
   os usuários logados. RPC pública continua exigindo "revoke ... from public"
   + grant explícito, como já é feito.

   Não altera nenhuma tabela existente. Cria e apaga uma tabela de teste
   (_sec_teste_tabela_nova) para provar o efeito. Idempotente.
*/

create temp table _sec_resultado (ordem int, item text, valor text);

insert into _sec_resultado
select 1, 'ANTES · padrão de ' || pg_get_userbyid(d.defaclrole) || ' (' ||
          case d.defaclobjtype when 'r' then 'tabelas' when 'S' then 'sequências' when 'f' then 'funções' else d.defaclobjtype::text end || ')',
       coalesce((select string_agg(distinct a.privilege_type, ', ') from aclexplode(d.defaclacl) a
                  where a.grantee = 'anon'::regrole), 'anon sem permissão')
  from pg_default_acl d
 where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype in ('r', 'S');

do $$
declare dono text;
begin
  foreach dono in array array['postgres', 'supabase_admin'] loop
    if not exists (select 1 from pg_roles where rolname = dono) then continue; end if;
    begin
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon', dono);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon', dono);
      insert into _sec_resultado values (2, 'trava aplicada para tabelas criadas por ' || dono, 'ok');
    exception when insufficient_privilege then
      insert into _sec_resultado values (2, 'trava para tabelas criadas por ' || dono, 'SEM PERMISSÃO — não alterado');
    end;
  end loop;

  -- Prova: uma tabela nova, criada agora, nasce fechada para o anon?
  create table public._sec_teste_tabela_nova (id int);
  insert into _sec_resultado values
    (3, 'tabela nova · anon SELECT', has_table_privilege('anon', 'public._sec_teste_tabela_nova', 'SELECT')::text),
    (3, 'tabela nova · anon INSERT', has_table_privilege('anon', 'public._sec_teste_tabela_nova', 'INSERT')::text),
    (3, 'tabela nova · authenticated SELECT', has_table_privilege('authenticated', 'public._sec_teste_tabela_nova', 'SELECT')::text);
  drop table public._sec_teste_tabela_nova;
end $$;

select item, valor from _sec_resultado order by ordem, item;

/* ROLLBACK (volta a dar tudo ao anon em tabelas novas — não recomendado):
     alter default privileges for role postgres in schema public grant all on tables to anon;
     alter default privileges for role postgres in schema public grant all on sequences to anon; */
