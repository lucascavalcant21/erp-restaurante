/* ROLLBACK do hotfix de autorização.

   ATENÇÃO: isto restaura a versão VULNERÁVEL das três funções, a que lê
   user_metadata do JWT. Com ela no ar, qualquer usuário logado pode se
   declarar 'admin' pelo próprio app e enxergar todas as unidades, e quem não
   tem unidade no metadata também vê tudo.

   Use só se o hotfix tiver travado o acesso de quem precisa trabalhar e não
   der para arrumar o cadastro na hora (usuarios_erp.super_admin, escopo
   'todos'/'empresa' ou unidade_principal_id). Volte para a versão segura
   assim que o cadastro estiver certo.
*/

create or replace function public.auth_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'papel'),
    ''
  );
$$;

create or replace function public.auth_unidade_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'unidade', 'todas'),
    ''
  );
$$;

create or replace function public.pode_ver_todas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_papel() in ('admin', 'financeiro')
    or auth_unidade_id() = ''
    or auth_unidade_id() is null;
$$;

grant execute on function public.auth_papel() to authenticated, service_role;
grant execute on function public.auth_unidade_id() to authenticated, service_role;
grant execute on function public.pode_ver_todas() to authenticated, service_role;
