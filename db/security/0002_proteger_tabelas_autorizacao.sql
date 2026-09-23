/* PROPOSTA (NÃO EXECUTADA): fechar as tabelas que decidem autorização.

   POR QUE
   Depois do hotfix, quem responde "qual é o seu papel e a sua unidade" é o
   cadastro: usuarios_erp, usuario_escopos, perfis_acesso, perfil_permissoes e
   usuario_permissoes. Se um usuário comum puder escrever nessas tabelas pelo
   PostgREST, ele volta a escolher a própria autorização — só que por outro
   caminho. E hoje ele pode LER todas elas: db/migracao_controle_acesso.sql
   cria, em perfis_acesso, usuarios_erp, usuario_escopos e
   permissoes_auditoria, uma policy de SELECT "to authenticated using (true)".
   Isso entrega a quem tiver qualquer login o mapa inteiro de quem é quem, com
   login, cargo, IPs liberados, janelas de horário e bloqueios.

   O QUE ESTA MIGRAÇÃO FAZ
   1. Tira do anon qualquer privilégio nessas tabelas.
   2. Tira de authenticated INSERT/UPDATE/DELETE no nível de privilégio — não
      só de policy. Assim, se amanhã alguém criar uma policy permissiva por
      engano, ainda falta o GRANT.
   3. Troca a leitura "using (true)" por leitura da PRÓPRIA linha.
   4. Deixa service_role intacto: é por ele que a rota administrativa
      (/api/admin/access-control, server-only) escreve.

   O QUE ELA NÃO FAZ
   Não cria RPC de escrita, não muda nenhuma policy das tabelas de negócio e
   não mexe em dado. A administração continua exatamente como está hoje: rota
   de servidor com service_role, que já verifica sessão e permissão por ação.

   ANTES DE RODAR
   Rode a prévia do bloco 1. Ela lista o que existe hoje de policy e de
   privilégio nessas tabelas — inclusive alguma que este repositório não
   conhece. Se aparecer policy de INSERT/UPDATE/DELETE para authenticated,
   PARE e investigue: é escalada aberta, e some silenciosamente se você apenas
   rodar isto por cima.

   Idempotente. Ainda não aplicada em lugar nenhum.
*/

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 — PRÉVIA (rode sozinha, não altera nada)
   ═══════════════════════════════════════════════════════════════════════════

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('empresas','setores','perfis_acesso','perfil_permissoes',
                    'usuarios_erp','usuario_permissoes','usuario_escopos',
                    'acessos_auditoria','permissoes_auditoria')
order by tablename, policyname;

select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','service_role','public')
  and table_name in ('empresas','setores','perfis_acesso','perfil_permissoes',
                     'usuarios_erp','usuario_permissoes','usuario_escopos',
                     'acessos_auditoria','permissoes_auditoria')
group by 1,2
order by 1,2;

select relname, relrowsecurity as rls_ligado, relforcerowsecurity as rls_forcado
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('empresas','setores','perfis_acesso','perfil_permissoes',
                  'usuarios_erp','usuario_permissoes','usuario_escopos',
                  'acessos_auditoria','permissoes_auditoria')
order by 1;

   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 — RLS LIGADO E ANON FORA
   ═══════════════════════════════════════════════════════════════════════════ */
do $$
declare t text;
begin
  foreach t in array array[
    'empresas','setores','perfis_acesso','perfil_permissoes','usuarios_erp',
    'usuario_permissoes','usuario_escopos','acessos_auditoria','permissoes_auditoria'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke all on public.%I from public', t);
      /* Escrita de autorização não passa por navegador, em hipótese nenhuma. */
      execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
      execute format('grant all on public.%I to service_role', t);
    end if;
  end loop;
end $$;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 — LEITURA SÓ DA PRÓPRIA LINHA
   As telas de administração leem por service_role, então elas não dependem
   destas policies. O app do dia a dia lê o próprio contexto por
   hefisto_session_context(), que é SECURITY DEFINER e também não depende.
   ═══════════════════════════════════════════════════════════════════════════ */

/* usuarios_erp: cada um enxerga a si mesmo. */
drop policy if exists usuarios_erp_leitura on public.usuarios_erp;
drop policy if exists usuarios_erp_leitura_propria on public.usuarios_erp;
create policy usuarios_erp_leitura_propria on public.usuarios_erp
  for select to authenticated
  using (auth_user_id = auth.uid());

/* usuario_escopos: só os escopos do próprio cadastro. */
drop policy if exists usuario_escopos_leitura on public.usuario_escopos;
drop policy if exists usuario_escopos_leitura_propria on public.usuario_escopos;
create policy usuario_escopos_leitura_propria on public.usuario_escopos
  for select to authenticated
  using (exists (
    select 1 from public.usuarios_erp u
    where u.id = usuario_escopos.usuario_id
      and u.auth_user_id = auth.uid()
  ));

/* perfis_acesso: só o perfil que o usuário realmente tem. O catálogo inteiro
   de perfis é assunto da tela administrativa, que lê por service_role. */
drop policy if exists perfis_acesso_leitura on public.perfis_acesso;
drop policy if exists perfis_acesso_leitura_propria on public.perfis_acesso;
create policy perfis_acesso_leitura_propria on public.perfis_acesso
  for select to authenticated
  using (exists (
    select 1 from public.usuarios_erp u
    where u.auth_user_id = auth.uid()
      and u.perfil_id = perfis_acesso.id
  ));

/* Auditoria de permissões não é leitura de usuário comum. */
drop policy if exists permissoes_auditoria_leitura on public.permissoes_auditoria;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 — CONFERÊNCIA (rode depois, separadamente)
   ═══════════════════════════════════════════════════════════════════════════

   Nenhuma policy de escrita para authenticated deve sobrar:

select tablename, policyname, cmd, roles
from pg_policies
where schemaname='public'
  and tablename in ('perfis_acesso','usuarios_erp','usuario_escopos','usuario_permissoes','perfil_permissoes')
  and cmd <> 'SELECT'
order by 1,2;

   Esperado: zero linhas.

   E authenticated não pode ter INSERT/UPDATE/DELETE:

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated'
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  and table_name in ('perfis_acesso','usuarios_erp','usuario_escopos','usuario_permissoes','perfil_permissoes')
order by 1;

   Esperado: zero linhas.

   ═══════════════════════════════════════════════════════════════════════════ */
