/* SEC-RH-1.4 · AUTORIZAÇÃO CONFIÁVEL — o banco para de acreditar no user_metadata
   ═══════════════════════════════════════════════════════════════════════════

   O QUE ESTAVA ERRADO (confirmado em produção em 22/09 e de novo em 30/09/2026)
   auth_papel(), auth_unidade_id() e pode_ver_todas() liam
   auth.jwt() -> 'user_metadata', que o PRÓPRIO usuário grava
   (supabase.auth.updateUser({ data })). Qualquer login podia se declarar
   admin/"todas" e enxergar e gravar as unidades de todo mundo nos módulos que
   filtram por unidade (clientes, eventos, vendas, cardápio, campanhas, avisos,
   cursos, advertências, NPS, documentos). E pode_ver_todas() tratava "sem
   unidade" como "vê tudo" — devolvia TRUE até para o anon.

   POR QUE NÃO A "HOTFIX V4" DE db/migracao_rls_autorizacao_servidor.sql
   Ela exige hefisto_usuario_valido() e hefisto_unidades_do_usuario(), que não
   existem em produção: o preflight dela aborta. As funções abaixo são as do
   hotfix de 22/09 (branch fix/rls-autorizacao-servidor, 33/33 no PGlite), que
   só dependem de tabelas e colunas que existem.

   PARTE A — 14 usuários ativos não tinham unidade nem escopo no cadastro do
   servidor: enxergavam os dados só por causa do user_metadata. Sem a Parte A,
   perderiam acesso aos módulos acima no instante da Parte B. Produção tem UMA
   unidade; eles são vinculados a ela (o bloco aborta se houver 0 ou 2+).

   NÃO FAZ: não altera policy, RLS, grants, tabelas de negócio nem dados além
   de usuarios_erp.unidade_principal_id dos 14. A brecha "unidade_id IS NULL"
   das policies rls_unidade e o isolamento por unidade são o SEC-RH-2.

   Backup: sec_backup_usuarios_unidade e sec_backup_funcoes_auth. Rollback no fim.
   Testado em Postgres local: antes, gerente se declara admin e vê tudo; depois,
   a declaração é ignorada, super admin segue vendo tudo, anon recebe false.
*/

/* ── PARTE A · vincular os usuários ativos sem unidade à unidade da loja ── */
begin;

create table if not exists public.sec_backup_usuarios_unidade (
  usuario_id uuid primary key, unidade_principal_id_antes text, salvo_em timestamptz not null default now()
);
alter table public.sec_backup_usuarios_unidade enable row level security;
revoke all on table public.sec_backup_usuarios_unidade from anon, authenticated;

do $$
declare v_unidade text; n int;
begin
  select count(*) into n from public.unidades;
  if n <> 1 then raise exception 'Esperava exatamente 1 unidade cadastrada, há %. Nada foi alterado.', n; end if;
  select id::text into v_unidade from public.unidades;

  insert into public.sec_backup_usuarios_unidade (usuario_id, unidade_principal_id_antes)
  select u.id, u.unidade_principal_id from public.usuarios_erp u
   where u.status = 'ativo' and not coalesce(u.super_admin, false) and u.unidade_principal_id is null
     and not exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id
                      and (e.data_scope in ('todos', 'empresa') or e.unidade_id is not null))
  on conflict do nothing;

  update public.usuarios_erp u set unidade_principal_id = v_unidade
   where u.id in (select usuario_id from public.sec_backup_usuarios_unidade)
     and u.unidade_principal_id is null;
end $$;

commit;

/* ── PARTE B · as três funções passam a ler o cadastro do servidor ── */
begin;

create table if not exists public.sec_backup_funcoes_auth (
  funcao text primary key, definicao text not null, salvo_em timestamptz not null default now()
);
alter table public.sec_backup_funcoes_auth enable row level security;
revoke all on table public.sec_backup_funcoes_auth from anon, authenticated;

insert into public.sec_backup_funcoes_auth (funcao, definicao)
select p.proname, pg_get_functiondef(p.oid) from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('auth_papel', 'auth_unidade_id', 'pode_ver_todas')
on conflict do nothing;

create or replace function public.auth_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
             when u.super_admin then 'admin'
             when u.tipo_acesso = 'administrador' then 'admin'
             else u.tipo_acesso
           end
    from usuarios_erp u
    where u.auth_user_id = auth.uid()
      and u.status = 'ativo'
    limit 1
  ), '');
$$;
create or replace function public.auth_unidade_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.unidade_principal_id
      from usuarios_erp u
      where u.auth_user_id = auth.uid()
        and u.status = 'ativo'
        and u.unidade_principal_id is not null
      limit 1
    ),
    (
      select e.unidade_id
      from usuario_escopos e
      join usuarios_erp u on u.id = e.usuario_id
      where u.auth_user_id = auth.uid()
        and u.status = 'ativo'
        and e.unidade_id is not null
      order by e.unidade_id
      limit 1
    ),
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
  select exists (
    select 1
    from usuarios_erp u
    where u.auth_user_id = auth.uid()
      and u.status = 'ativo'
      and (
        u.super_admin
        or exists (
          select 1 from usuario_escopos e
          where e.usuario_id = u.id
            and e.data_scope in ('todos','empresa')
        )
      )
  );
$$;

commit;

/* ── CONFERÊNCIA ── */
select 'usuários vinculados à unidade agora' as item, count(*)::text as valor from public.sec_backup_usuarios_unidade
union all
select 'funções que ainda leem user_metadata', count(*)::text from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('auth_papel', 'auth_unidade_id', 'pode_ver_todas')
   and p.prosrc ilike '%user_metadata%'
union all
select 'depois: ' || cat, n::text from (
  select case
           when u.status <> 'ativo' then 'sem acesso (inativo)'
           when u.super_admin or exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and e.data_scope in ('todos', 'empresa')) then 'vê todas as unidades'
           when coalesce(u.unidade_principal_id, (select e.unidade_id from public.usuario_escopos e where e.usuario_id = u.id and e.unidade_id is not null limit 1)) is not null then 'só a própria unidade'
           else 'SEM UNIDADE'
         end as cat, count(*) as n
    from public.usuarios_erp u group by 1) x;

/* ROLLBACK
   B (funções): select definicao from public.sec_backup_funcoes_auth;  → rode cada definição
   A (vínculo): update public.usuarios_erp u set unidade_principal_id = b.unidade_principal_id_antes
                  from public.sec_backup_usuarios_unidade b where b.usuario_id = u.id;
   Voltar as funções reabre a escalada por user_metadata. */
