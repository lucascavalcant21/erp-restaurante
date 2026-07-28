-- ════════════════════════════════════════════════════════════════════════════
-- HEFISTO ERP — Usuários, perfis, permissões, escopos e auditoria
-- Compatível com o Supabase Auth já usado pelo sistema.
-- Execute uma vez no Supabase SQL Editor antes de publicar as novas telas.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into empresas (nome)
select 'Hefisto'
where not exists (select 1 from empresas);

alter table unidades add column if not exists empresa_id uuid references empresas(id);
update unidades
set empresa_id = (select id from empresas order by created_at limit 1)
where empresa_id is null;

create table if not exists setores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  unidade_id text references unidades(id) on delete cascade,
  nome text not null,
  codigo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unidade_id, nome)
);

insert into setores (empresa_id, unidade_id, nome, codigo)
select u.empresa_id, u.id, s.nome, s.codigo
from unidades u
cross join (values
  ('Administração','administracao'), ('Cozinha','cozinha'), ('Bar','bar'),
  ('Salão','salao'), ('Estoque','estoque'), ('RH','rh'),
  ('Financeiro','financeiro'), ('Compras','compras')
) as s(nome, codigo)
on conflict (unidade_id, nome) do nothing;

create table if not exists perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  descricao text,
  tipo text not null default 'personalizado',
  ativo boolean not null default true,
  sistema boolean not null default false,
  is_current boolean not null default true,
  version integer not null default 1,
  supersedes_id uuid references perfis_acesso(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists perfis_acesso_codigo_current_idx
  on perfis_acesso(codigo) where is_current and codigo is not null;

create table if not exists perfil_permissoes (
  perfil_id uuid not null references perfis_acesso(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  primary key (perfil_id, permission_key)
);

create table if not exists usuarios_erp (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  funcionario_id uuid references funcionarios(id) on delete set null,
  avatar_url text,
  email text,
  telefone text,
  login text not null unique,
  setor_principal_id uuid references setores(id) on delete set null,
  cargo text,
  unidade_principal_id text references unidades(id) on delete set null,
  status text not null default 'ativo'
    check (status in ('ativo','bloqueado','desativado')),
  tipo_acesso text not null default 'funcionario'
    check (tipo_acesso in ('administrador','gerente','supervisor','funcionario','personalizado','setor','consulta','terminal_ponto')),
  perfil_id uuid references perfis_acesso(id) on delete set null,
  pagina_inicial text not null default '/dashboard',
  super_admin boolean not null default false,
  exigir_troca_senha boolean not null default true,
  allowed_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  allowed_start_time time,
  allowed_end_time time,
  timezone text not null default 'America/Sao_Paulo',
  max_failed_attempts integer not null default 5,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  encerrar_sessoes_anteriores boolean not null default false,
  allowed_device_ids jsonb not null default '[]'::jsonb,
  acesso_externo boolean not null default true,
  allowed_ips jsonb not null default '[]'::jsonb,
  ultimo_acesso_em timestamptz,
  senha_alterada_em timestamptz,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists usuarios_erp_status_idx on usuarios_erp(status);
create index if not exists usuarios_erp_perfil_idx on usuarios_erp(perfil_id);
create index if not exists usuarios_erp_unidade_idx on usuarios_erp(unidade_principal_id);

create table if not exists usuario_permissoes (
  usuario_id uuid not null references usuarios_erp(id) on delete cascade,
  permission_key text not null,
  effect text not null default 'allow' check (effect in ('allow','deny')),
  created_at timestamptz not null default now(),
  primary key (usuario_id, permission_key)
);

create table if not exists usuario_escopos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios_erp(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  unidade_id text references unidades(id) on delete cascade,
  setor_id uuid references setores(id) on delete cascade,
  data_scope text not null default 'setor'
    check (data_scope in ('proprio','setor','unidade','empresa','todos')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (usuario_id, empresa_id, unidade_id, setor_id)
);

create table if not exists acessos_auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid references usuarios_erp(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  evento text not null,
  sucesso boolean not null default true,
  ip inet,
  user_agent text,
  device_id text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists acessos_auditoria_usuario_idx
  on acessos_auditoria(usuario_id, created_at desc);

create table if not exists permissoes_auditoria (
  id bigint generated always as identity primary key,
  ator_auth_user_id uuid references auth.users(id) on delete set null,
  alvo_tipo text not null,
  alvo_id uuid,
  evento text not null,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);

-- Perfis iniciais reutilizáveis.
insert into perfis_acesso (nome, codigo, descricao, tipo, sistema)
values
  ('Administrador geral','administrador-geral','Acesso completo ao Hefisto.','administrador',true),
  ('Gerente geral','gerente-geral','Gestão operacional, financeira e de equipe.','gerente',true),
  ('Supervisor de cozinha','supervisor-cozinha','Supervisão de cozinha e estoque.','supervisor',true),
  ('Cozinheiro','cozinheiro','Produção, receitas e checklists da cozinha.','funcionario',true),
  ('Auxiliar de cozinha','auxiliar-cozinha','Rotina operacional da cozinha.','funcionario',true),
  ('Bartender','bartender','Operação do bar.','funcionario',true),
  ('Estoquista','estoquista','Estoque, inventário e compras.','funcionario',true),
  ('Garçom','garcom','Salão e mesas.','funcionario',true),
  ('Caixa','caixa','Mesas, vendas e consulta de valores.','funcionario',true),
  ('Recursos humanos','recursos-humanos','Equipe, ponto e folha.','funcionario',true),
  ('Financeiro','financeiro','Rotinas financeiras e relatórios.','funcionario',true),
  ('Compras','compras','Compras, notas e fornecedores.','funcionario',true),
  ('Marketing','marketing','Clientes, campanhas, cupons e NPS.','funcionario',true),
  ('Somente ponto eletrônico','somente-ponto','Terminal exclusivo de ponto.','terminal_ponto',true),
  ('Somente consulta','somente-consulta','Consulta sem alterações.','consulta',true)
on conflict do nothing;

-- Presets por curinga. O montador visual salva chaves explícitas quando editado.
insert into perfil_permissoes (perfil_id, permission_key)
select p.id, x.permission_key
from perfis_acesso p
cross join lateral (
  select unnest(case p.codigo
    when 'administrador-geral' then array['*']
    when 'gerente-geral' then array['dashboard.*','ponto.*','estoque.*','cozinha.*','bar.*','salao.*','rh.*','financeiro.*','compras.*','checklist.*','fichas.*','relatorios.*','tarefas.*','vendas.*','clientes.*','eventos.*','cardapio.*','gestao.*','configuracoes.store.*','configuracoes.units.*']
    when 'supervisor-cozinha' then array['cozinha.*','estoque.*','compras.*','checklist.*','fichas.*']
    when 'cozinheiro' then array['cozinha.recipes.*','cozinha.assembly.*','cozinha.production.*','checklist.execution.*','estoque.overview.view','estoque.labels.*']
    when 'auxiliar-cozinha' then array['cozinha.production.*','cozinha.cleaning.*','checklist.execution.*','estoque.labels.view','estoque.labels.create','estoque.labels.print']
    when 'bartender' then array['bar.*','estoque.overview.view','estoque.entries.view','estoque.entries.create','estoque.inventory.view','estoque.inventory.inventory','checklist.execution.*']
    when 'estoquista' then array['estoque.*','compras.*','relatorios.reports.view','relatorios.reports.export']
    when 'garcom' then array['salao.overview.view','salao.tables.*','checklist.execution.view','checklist.execution.create']
    when 'caixa' then array['dashboard.overview.view','salao.tables.*','financeiro.cashflow.view','financeiro.cashflow.create','financeiro.cashflow.view_values']
    when 'recursos-humanos' then array['rh.*','ponto.*','relatorios.reports.view','relatorios.reports.export']
    when 'financeiro' then array['financeiro.*','relatorios.*','dashboard.overview.view','dashboard.overview.view_values']
    when 'compras' then array['compras.*','estoque.overview.view','estoque.products.view','estoque.products.view_costs']
    when 'marketing' then array['clientes.*','dashboard.overview.view','tarefas.notifications.*']
    when 'somente-ponto' then array['ponto.clock.view','ponto.clock.create']
    when 'somente-consulta' then array['dashboard.overview.view','estoque.overview.view','relatorios.reports.view']
    else array[]::text[]
  end) permission_key
) x
on conflict do nothing;

-- Preserva os usuários existentes do Supabase Auth. Como o cadastro público
-- antigo permitia escolher o próprio papel, somente o PRIMEIRO administrador
-- cronológico vira super administrador; os demais podem ser promovidos por ele.
insert into usuarios_erp (
  auth_user_id, nome, email, login, status, tipo_acesso, perfil_id,
  pagina_inicial, super_admin, exigir_troca_senha, criado_por
)
select
  a.id,
  coalesce(a.raw_user_meta_data->>'nome', split_part(a.email,'@',1)),
  a.email,
  a.login_seguro,
  'ativo',
  case
    when a.papel='admin' and a.admin_rank=1 then 'administrador'
    when a.papel='gerente' or a.papel='admin' then 'gerente'
    else 'funcionario'
  end,
  (select id from perfis_acesso where codigo=case
    when a.papel='admin' and a.admin_rank=1 then 'administrador-geral'
    when a.papel in ('admin','gerente') then 'gerente-geral'
    when a.papel='financeiro' then 'financeiro'
    when a.papel='rh' then 'recursos-humanos'
    when a.papel='estoque' then 'estoquista'
    when a.papel='cozinha' then 'cozinheiro'
    when a.papel='caixa' then 'caixa'
    when a.papel='garcom' then 'garcom'
    when a.papel='marketing' then 'marketing'
    else 'somente-consulta'
  end and is_current limit 1),
  coalesce(a.raw_user_meta_data->>'home','/dashboard'),
  a.papel='admin' and a.admin_rank=1,
  false,
  a.id
from (
  select
    u.*,
    coalesce(u.raw_user_meta_data->>'papel','') as papel,
    sum((coalesce(u.raw_user_meta_data->>'papel','')='admin')::int)
      over (order by u.created_at, u.id) as admin_rank,
    lower(coalesce(u.raw_user_meta_data->>'login', split_part(u.email,'@',1)))
      || case when count(*) over (
        partition by lower(coalesce(u.raw_user_meta_data->>'login', split_part(u.email,'@',1)))
      ) > 1 then '-'||left(u.id::text,8) else '' end as login_seguro
  from auth.users u
) a
on conflict (auth_user_id) do nothing;

update usuarios_erp ue
set unidade_principal_id = u.raw_user_meta_data->>'unidade'
from auth.users u
where ue.auth_user_id=u.id
  and u.raw_user_meta_data->>'unidade' in (select id from unidades)
  and ue.unidade_principal_id is null;

create or replace function public.hefisto_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists usuarios_erp_touch on usuarios_erp;
create trigger usuarios_erp_touch before update on usuarios_erp
for each row execute function public.hefisto_touch_updated_at();
drop trigger if exists perfis_acesso_touch on perfis_acesso;
create trigger perfis_acesso_touch before update on perfis_acesso
for each row execute function public.hefisto_touch_updated_at();

-- Todo novo usuário do Auth ganha um registro bloqueado por padrão. Usuários
-- criados pela API administrativa são preenchidos logo em seguida.
create or replace function public.hefisto_on_auth_user_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into usuarios_erp (
    auth_user_id, nome, email, login, status, tipo_acesso, pagina_inicial,
    exigir_troca_senha
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(new.email,'@',1))),
    'bloqueado',
    'funcionario',
    '/dashboard',
    true
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

drop trigger if exists hefisto_auth_user_created on auth.users;
create trigger hefisto_auth_user_created
after insert on auth.users for each row execute function public.hefisto_on_auth_user_created();

create or replace function public.hefisto_permission_match(granted text, wanted text)
returns boolean language sql immutable as $$
  select granted = '*'
    or granted = wanted
    or granted = split_part(wanted,'.',1) || '.*'
    or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*'
$$;

create or replace function public.hefisto_user_has_permission(
  p_auth_user_id uuid,
  p_permission text
) returns boolean
language plpgsql security definer stable set search_path = public
as $$
declare
  v_user usuarios_erp%rowtype;
  v_local timestamp;
begin
  select * into v_user from usuarios_erp where auth_user_id = p_auth_user_id;
  if not found or v_user.status <> 'ativo' then return false; end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
  if v_user.valid_from is not null and v_user.valid_from > now() then return false; end if;
  if v_user.valid_until is not null and v_user.valid_until < now() then return false; end if;
  v_local := now() at time zone coalesce(v_user.timezone,'America/Sao_Paulo');
  if not (extract(dow from v_local)::smallint = any(v_user.allowed_days)) then return false; end if;
  if v_user.allowed_start_time is not null and v_local::time < v_user.allowed_start_time then return false; end if;
  if v_user.allowed_end_time is not null and v_local::time > v_user.allowed_end_time then return false; end if;
  if v_user.super_admin then return true; end if;
  if exists (
    select 1 from usuario_permissoes up
    where up.usuario_id = v_user.id and up.effect='deny'
      and hefisto_permission_match(up.permission_key, p_permission)
  ) then return false; end if;
  return exists (
    select 1 from usuario_permissoes up
    where up.usuario_id = v_user.id and up.effect='allow'
      and hefisto_permission_match(up.permission_key, p_permission)
  ) or exists (
    select 1 from perfil_permissoes pp
    where pp.perfil_id = v_user.perfil_id
      and hefisto_permission_match(pp.permission_key, p_permission)
  );
end $$;

create or replace function public.hefisto_user_in_unit(
  p_auth_user_id uuid,
  p_unidade_id text
) returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from usuarios_erp u
    where u.auth_user_id = p_auth_user_id
      and (
        u.super_admin
        or p_unidade_id is null
        or u.unidade_principal_id = p_unidade_id
        or exists (
          select 1 from usuario_escopos e
          where e.usuario_id=u.id
            and (e.data_scope in ('todos','empresa') or e.unidade_id=p_unidade_id)
        )
      )
  )
$$;

create or replace function public.hefisto_user_can(
  p_permission text,
  p_unidade_id text default null
) returns boolean
language sql security definer stable set search_path = public
as $$
  select hefisto_user_has_permission(auth.uid(), p_permission)
    and hefisto_user_in_unit(auth.uid(), p_unidade_id)
$$;

create or replace function public.hefisto_session_context()
returns jsonb
language plpgsql security definer stable set search_path = public
as $$
declare
  v_user usuarios_erp%rowtype;
  v_permissions jsonb;
  v_scopes jsonb;
  v_profile_name text;
begin
  select * into v_user from usuarios_erp where auth_user_id = auth.uid();
  if not found then return null; end if;
  if v_user.super_admin then
    v_permissions := '"*"'::jsonb;
  else
    select coalesce(jsonb_agg(distinct permission_key), '[]'::jsonb)
    into v_permissions
    from (
      select pp.permission_key
      from perfil_permissoes pp
      where pp.perfil_id=v_user.perfil_id
        and not exists (
          select 1 from usuario_permissoes d
          where d.usuario_id=v_user.id and d.effect='deny'
            and hefisto_permission_match(d.permission_key, pp.permission_key)
        )
      union
      select up.permission_key from usuario_permissoes up
      where up.usuario_id=v_user.id and up.effect='allow'
    ) p;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
    into v_scopes from usuario_escopos e where e.usuario_id=v_user.id;
  select nome into v_profile_name from perfis_acesso where id=v_user.perfil_id;
  return jsonb_build_object(
    'erp_user_id', v_user.id,
    'nome', v_user.nome,
    'login', v_user.login,
    'email', v_user.email,
    'papel', case when v_user.super_admin then 'admin' else v_user.tipo_acesso end,
    'tipo_acesso', v_user.tipo_acesso,
    'status', v_user.status,
    'super_admin', v_user.super_admin,
    'perfil_id', v_user.perfil_id,
    'perfil', v_profile_name,
    'unidade', v_user.unidade_principal_id,
    'setor_id', v_user.setor_principal_id,
    'home', v_user.pagina_inicial,
    'must_change_password', v_user.exigir_troca_senha,
    'terminate_previous_sessions', v_user.encerrar_sessoes_anteriores,
    'permissions', v_permissions,
    'scopes', v_scopes
  );
end $$;

revoke all on function public.hefisto_session_context() from public;
revoke all on function public.hefisto_user_has_permission(uuid,text) from public;
revoke all on function public.hefisto_user_in_unit(uuid,text) from public;
revoke all on function public.hefisto_user_can(text,text) from public;
grant execute on function public.hefisto_session_context() to authenticated, service_role;
grant execute on function public.hefisto_user_has_permission(uuid,text) to service_role;
grant execute on function public.hefisto_user_in_unit(uuid,text) to authenticated, service_role;
grant execute on function public.hefisto_user_can(text,text) to authenticated, service_role;

create or replace function public.hefisto_mark_password_changed()
returns void
language sql security definer set search_path = public
as $$
  update usuarios_erp
  set exigir_troca_senha=false, senha_alterada_em=now(), failed_attempts=0, locked_until=null
  where auth_user_id=auth.uid()
$$;
revoke all on function public.hefisto_mark_password_changed() from public;
grant execute on function public.hefisto_mark_password_changed() to authenticated, service_role;

-- Tabelas do controle de acesso: ninguém altera diretamente pelo navegador.
-- Escritas passam pela API administrativa com service role.
do $$
declare t text;
begin
  foreach t in array array[
    'empresas','setores','perfis_acesso','perfil_permissoes','usuarios_erp',
    'usuario_permissoes','usuario_escopos','acessos_auditoria','permissoes_auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Defesa no banco para os dados principais. Tudo é bloqueado por padrão e
-- liberado por permissão + escopo de unidade.
do $$
declare
  m record;
  pol record;
begin
  for m in
    select * from (values
      ('estoque','estoque.overview'),
      ('estoque_movimentacoes','estoque.overview'),
      ('ingredientes','estoque.products'),
      ('fornecedores','estoque.suppliers'),
      ('funcionarios','rh.employees'),
      ('registros_ponto','ponto.clock'),
      ('holerites','rh.payroll'),
      ('lancamentos','financeiro.cashflow'),
      ('documentos','financeiro.fiscal')
    ) as x(tabela, permissao)
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=m.tabela)
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=m.tabela and column_name='unidade_id') then
      for pol in select policyname from pg_policies where schemaname='public' and tablename=m.tabela loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, m.tabela);
      end loop;
      execute format('alter table public.%I enable row level security', m.tabela);
      execute format('create policy hefisto_select on public.%I for select to authenticated using (hefisto_user_can(%L, unidade_id))', m.tabela, m.permissao||'.view');
      execute format('create policy hefisto_insert on public.%I for insert to authenticated with check (hefisto_user_can(%L, unidade_id))', m.tabela, m.permissao||'.create');
      execute format('create policy hefisto_update on public.%I for update to authenticated using (hefisto_user_can(%L, unidade_id)) with check (hefisto_user_can(%L, unidade_id))', m.tabela, m.permissao||'.edit', m.permissao||'.edit');
      execute format('create policy hefisto_delete on public.%I for delete to authenticated using (hefisto_user_can(%L, unidade_id))', m.tabela, m.permissao||'.delete');
    end if;
  end loop;
end $$;
