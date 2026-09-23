/* BOOTSTRAP DE ESTRUTURA DO hefisto-staging — SOMENTE SCHEMA, ZERO DADO REAL.

   PARA QUE SERVE
   Criar no staging o mínimo de estrutura que o agente de IA precisa consultar:
   RBAC, unidades, insumos/estoque, fichas técnicas, produção, colaboradores e
   ponto, contas a pagar e lançamentos. Com isso dá para logar com um usuário
   de teste e ver o Héfisto responder com dado de verdade — dado de MENTIRA,
   criado pelo 0002, nunca copiado de produção.

   O QUE ISTO NÃO É
   Não é o baseline de produção. O baseline só pode sair de um dump
   schema-only do cerebro-erp (db/baseline/README.md), e ele ainda não existe.
   Este arquivo foi montado a partir do que o repositório cria e do que o
   código realmente consulta. Onde produção divergir, o baseline manda — e
   quando ele chegar, este bootstrap é descartado.

   ONDE RODAR
   SQL Editor do projeto hefisto-staging. NUNCA em produção: o bloco 0 recusa
   rodar se achar sinal de banco de produção.

   Idempotente: rodar de novo não faz nada. Nenhum DROP, nenhum DELETE.
*/

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 0 — TRAVAS
   ═══════════════════════════════════════════════════════════════════════════ */
do $$
declare
  v_vendas integer := 0;
  v_tipo text;
  v_faltantes text;
begin
  /* Um staging pode ter dados sintéticos, mas não milhares de vendas reais.
     Se houver, alguém apontou este script para o lugar errado. */
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='vendas') then
    execute 'select count(*) from public.vendas' into v_vendas;
    if v_vendas > 500 then
      raise exception 'RECUSADO: este banco tem % vendas. Isto parece produção, e este script é do staging.', v_vendas;
    end if;
  end if;

  /* O bootstrap mínimo que já existe no staging precisa estar coerente com o
     resto do ERP. CREATE TABLE IF NOT EXISTS não conserta tabela torta. */
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='unidades')
     and not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='unidades' and column_name='id' and data_type='text'
     ) then
    raise exception 'PREFLIGHT: public.unidades.id precisa ser TEXT (é assim em todo o ERP).';
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='produtos')
     and not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='produtos' and column_name='id' and data_type='uuid'
     ) then
    raise exception 'PREFLIGHT: public.produtos.id precisa ser UUID (a camada de integrações depende disso).';
  end if;

  /* Se produtos.unidade_id já existe, ele tem de ser text — é assim que casa
     com unidades.id. Tipo divergente não se conserta em silêncio: para. */
  select data_type into v_tipo from information_schema.columns
   where table_schema='public' and table_name='produtos' and column_name='unidade_id';
  if v_tipo is not null and v_tipo <> 'text' then
    raise exception 'PREFLIGHT: public.produtos.unidade_id é % e precisa ser text. Corrija antes (migração explícita), não deixe este script adivinhar.', v_tipo;
  end if;

  select data_type into v_tipo from information_schema.columns
   where table_schema='public' and table_name='unidades' and column_name='empresa_id';
  if v_tipo is not null and v_tipo <> 'uuid' then
    raise exception 'PREFLIGHT: public.unidades.empresa_id é % e precisa ser uuid.', v_tipo;
  end if;

  /* Coluna obrigatória que já existe nessas tabelas e que este script não
     preenche faria o seed falhar no meio. Melhor descobrir agora. */
  select string_agg(table_name || '.' || column_name, ', ') into v_faltantes
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('unidades','produtos')
    and is_nullable = 'NO'
    and column_default is null
    and column_name not in ('id','nome','cor','ativo','created_at','empresa_id',
                            'unidade_id','nome_produto','ficha_id','preco_venda','departamento','categoria');
  if v_faltantes is not null then
    raise exception 'PREFLIGHT: estas colunas são obrigatórias e este script não sabe preencher: %. Me diga quais são e eu ajusto o seed.', v_faltantes;
  end if;
end $$;

/* gen_random_uuid() é nativo do Postgres desde a versão 13 (o Supabase roda
   15+), então não precisamos exigir a extensão pgcrypto aqui — exigir só
   atrapalharia quem quiser conferir este arquivo num Postgres enxuto. */

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 — EMPRESA, UNIDADE, SETOR
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

/* unidades já existe no staging mínimo, provavelmente só com `id`.
   CREATE TABLE IF NOT EXISTS não completa tabela existente — por isso cada
   coluna vem no ALTER logo abaixo. Nenhuma delas entra como NOT NULL: numa
   tabela com linhas isso quebraria; preenchemos o que dá e seguimos. */
create table if not exists public.unidades (
  id text primary key
);
alter table public.unidades add column if not exists nome text;
alter table public.unidades add column if not exists cor text default '#10B981';
alter table public.unidades add column if not exists ativo boolean default true;
alter table public.unidades add column if not exists created_at timestamptz default now();
alter table public.unidades add column if not exists empresa_id uuid;

/* Unidade que já existia e ficou sem nome recebe o próprio id: melhor um nome
   feio na tela do que uma tela vazia. */
update public.unidades set nome = id where nome is null;
update public.unidades set ativo = true where ativo is null;

/* A FK para empresas só entra se ainda não existir (e só depois de empresas). */
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name
    where tc.table_schema='public' and tc.table_name='unidades'
      and tc.constraint_type='FOREIGN KEY' and k.column_name='empresa_id'
  ) then
    alter table public.unidades add constraint unidades_empresa_fk
      foreign key (empresa_id) references public.empresas(id);
  end if;
end $$;

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  unidade_id text references public.unidades(id) on delete cascade,
  nome text not null,
  codigo text,
  created_at timestamptz not null default now()
);

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 — RBAC (é daqui que sai papel, permissão e unidade)
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  descricao text,
  tipo text not null default 'personalizado',
  version integer not null default 1,
  is_current boolean not null default true,
  sistema boolean not null default false,
  permissoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.perfil_permissoes (
  perfil_id uuid not null references public.perfis_acesso(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  primary key (perfil_id, permission_key)
);

create table if not exists public.usuarios_erp (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  login text not null unique,
  unidade_principal_id text references public.unidades(id) on delete set null,
  setor_principal_id uuid references public.setores(id) on delete set null,
  cargo text,
  perfil_id uuid references public.perfis_acesso(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo','bloqueado','desativado')),
  tipo_acesso text not null default 'funcionario'
    check (tipo_acesso in ('administrador','gerente','supervisor','funcionario','personalizado','setor','consulta','terminal_ponto')),
  pagina_inicial text not null default '/dashboard',
  super_admin boolean not null default false,
  exigir_troca_senha boolean not null default false,
  encerrar_sessoes_anteriores boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuario_permissoes (
  usuario_id uuid not null references public.usuarios_erp(id) on delete cascade,
  permission_key text not null,
  effect text not null default 'allow' check (effect in ('allow','deny')),
  created_at timestamptz not null default now(),
  primary key (usuario_id, permission_key)
);

create table if not exists public.usuario_escopos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_erp(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  unidade_id text references public.unidades(id) on delete cascade,
  setor_id uuid references public.setores(id) on delete cascade,
  data_scope text not null default 'setor'
    check (data_scope in ('proprio','setor','unidade','empresa','todos')),
  created_at timestamptz not null default now()
);

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 — OPERAÇÃO: insumos, estoque, fichas, produção
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  nome text not null,
  marca text,
  departamento text check (departamento in ('cozinha','bar')),
  categoria text,
  unidade_medida text not null default 'kg',
  custo_unitario numeric not null default 0,
  estoque_minimo numeric default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists insumos_unidade_idx on public.insumos (unidade_id, departamento);

create table if not exists public.estoque_atual (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  insumo_id uuid references public.insumos(id) on delete cascade,
  quantidade_atual numeric not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, insumo_id)
);

create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  nome_receita text not null,
  codigo text,
  categoria text,
  departamento text check (departamento in ('cozinha','bar')),
  eh_base boolean not null default false,
  tipo_base text,
  rendimento_porcoes numeric default 1,
  rendimento_unidade text default 'kg',
  peso_porcao_g numeric,
  peso_final_g numeric,
  tempo_preparo integer,
  modo_preparo text,
  responsavel text,
  imagem text,
  preco_venda numeric,
  cmv_meta numeric default 30,
  versao text default '1.0',
  status text default 'ativa',
  alergenicos_pode_conter text,
  validade_dias integer,
  atualizado_em timestamptz default now(),
  created_at timestamptz not null default now()
);
create index if not exists fichas_unidade_idx on public.fichas_tecnicas (unidade_id, departamento);

create table if not exists public.fichas_ingredientes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid references public.fichas_tecnicas(id) on delete cascade,
  insumo_id uuid references public.insumos(id) on delete set null,
  subficha_id uuid references public.fichas_tecnicas(id) on delete set null,
  quantidade numeric not null default 0,
  fator_correcao numeric default 0,
  unidade text,
  created_at timestamptz not null default now()
);
create index if not exists fichas_ingredientes_ficha_idx on public.fichas_ingredientes (ficha_id);

/* produtos também já existe no staging (a camada de integrações exige
   produtos.id uuid). Mesmo tratamento: a tabela nasce só com o id e cada
   coluna que o ERP usa entra por ALTER, sem NOT NULL e sem apagar nada. */
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid()
);
alter table public.produtos add column if not exists unidade_id text;
alter table public.produtos add column if not exists nome_produto text;
alter table public.produtos add column if not exists ficha_id uuid;
alter table public.produtos add column if not exists preco_venda numeric;
alter table public.produtos add column if not exists departamento text;
alter table public.produtos add column if not exists categoria text;
alter table public.produtos add column if not exists ativo boolean default true;
alter table public.produtos add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name
    where tc.table_schema='public' and tc.table_name='produtos'
      and tc.constraint_type='FOREIGN KEY' and k.column_name='ficha_id'
  ) then
    alter table public.produtos add constraint produtos_ficha_fk
      foreign key (ficha_id) references public.fichas_tecnicas(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name
    where tc.table_schema='public' and tc.table_name='produtos'
      and tc.constraint_type='FOREIGN KEY' and k.column_name='unidade_id'
  ) then
    alter table public.produtos add constraint produtos_unidade_fk
      foreign key (unidade_id) references public.unidades(id) on delete cascade;
  end if;
end $$;

create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  departamento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.producao_diaria (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  ficha_id uuid references public.fichas_tecnicas(id) on delete set null,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  quantidade numeric not null default 0,
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists producao_unidade_dia_idx on public.producao_diaria (unidade_id, created_at);

create table if not exists public.registro_ponto (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  data_referencia date not null,
  entrada time,
  saida time,
  intervalo_inicio time,
  intervalo_fim time,
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists ponto_unidade_dia_idx on public.registro_ponto (unidade_id, data_referencia);

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 — FINANCEIRO
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  descricao text,
  fornecedor text,
  categoria text,
  valor numeric not null default 0,
  data_vencimento date,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  created_at timestamptz not null default now()
);
create index if not exists contas_unidade_venc_idx on public.contas_pagar (unidade_id, data_vencimento);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida')),
  categoria text,
  descricao text,
  valor numeric not null default 0,
  data date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists lancamentos_unidade_data_idx on public.lancamentos (unidade_id, data);

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 5 — FUNÇÕES DE AUTORIZAÇÃO
   Lêem o cadastro, nunca o JWT. São as mesmas do hotfix de autorização.
   ═══════════════════════════════════════════════════════════════════════════ */
create or replace function public.hefisto_permission_match(granted text, wanted text)
returns boolean language sql immutable as $$
  select granted = '*'
    or granted = wanted
    or granted = split_part(wanted,'.',1) || '.*'
    or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*'
$$;

create or replace function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from usuarios_erp u
    where u.auth_user_id = p_auth_user_id
      and u.status = 'ativo'
      and (
        u.super_admin
        or exists (
          select 1 from usuario_permissoes up
          where up.usuario_id = u.id and up.effect = 'allow'
            and hefisto_permission_match(up.permission_key, p_permission)
        )
        or (
          exists (
            select 1 from perfil_permissoes pp
            where pp.perfil_id = u.perfil_id
              and hefisto_permission_match(pp.permission_key, p_permission)
          )
          and not exists (
            select 1 from usuario_permissoes d
            where d.usuario_id = u.id and d.effect = 'deny'
              and hefisto_permission_match(d.permission_key, p_permission)
          )
        )
      )
  )
$$;

/* Acesso por linha, fechado por padrão: nulo não é "de todos". */
create or replace function public.hefisto_user_in_company(p_user_id uuid, p_unidade_id text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when p_user_id is null or p_unidade_id is null then false
    else exists (
      select 1
      from usuarios_erp u
      join usuario_escopos e on e.usuario_id = u.id
      join unidades un on un.id = p_unidade_id
      where u.auth_user_id = p_user_id and u.status = 'ativo'
        and e.data_scope = 'empresa'
        and e.empresa_id is not null and un.empresa_id is not null
        and un.empresa_id = e.empresa_id
    )
  end
$$;

create or replace function public.hefisto_user_in_unit_strict(p_user_id uuid, p_unidade_id text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when p_user_id is null or p_unidade_id is null then false
    else exists (
      select 1 from usuarios_erp u
      where u.auth_user_id = p_user_id and u.status = 'ativo'
        and (
          u.super_admin
          or u.unidade_principal_id = p_unidade_id
          or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and e.unidade_id = p_unidade_id)
          or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and e.data_scope = 'todos')
          or public.hefisto_user_in_company(p_user_id, p_unidade_id)
        )
    )
  end
$$;

create or replace function public.hefisto_user_can(p_permission text, p_unidade_id text default null)
returns boolean language sql security definer stable set search_path = public as $$
  select hefisto_user_has_permission(auth.uid(), p_permission)
     and hefisto_user_in_unit_strict(auth.uid(), p_unidade_id)
$$;

/* Contexto da sessão — já na versão fechada: usuário inativo ou inexistente
   não recebe contexto nenhum. */
create or replace function public.hefisto_session_context()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  v_user usuarios_erp%rowtype;
  v_permissions jsonb;
  v_scopes jsonb;
  v_profile_name text;
begin
  select * into v_user from usuarios_erp where auth_user_id = auth.uid() and status = 'ativo';
  if not found then return null; end if;

  if v_user.super_admin then
    v_permissions := '"*"'::jsonb;
  else
    select coalesce(jsonb_agg(distinct permission_key), '[]'::jsonb) into v_permissions
    from (
      select pp.permission_key from perfil_permissoes pp
      where pp.perfil_id = v_user.perfil_id
        and not exists (
          select 1 from usuario_permissoes d
          where d.usuario_id = v_user.id and d.effect = 'deny'
            and hefisto_permission_match(d.permission_key, pp.permission_key)
        )
      union
      select up.permission_key from usuario_permissoes up
      where up.usuario_id = v_user.id and up.effect = 'allow'
    ) p;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_scopes
    from usuario_escopos e where e.usuario_id = v_user.id;
  select nome into v_profile_name from perfis_acesso where id = v_user.perfil_id;

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
revoke all on function public.hefisto_user_in_unit_strict(uuid,text) from public;
revoke all on function public.hefisto_user_in_company(uuid,text) from public;
revoke all on function public.hefisto_user_can(text,text) from public;
grant execute on function public.hefisto_session_context() to authenticated, service_role;
grant execute on function public.hefisto_user_has_permission(uuid,text) to service_role;
grant execute on function public.hefisto_user_in_unit_strict(uuid,text) to authenticated, service_role;
grant execute on function public.hefisto_user_in_company(uuid,text) to authenticated, service_role;
grant execute on function public.hefisto_user_can(text,text) to authenticated, service_role;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 6 — RLS POR UNIDADE
   O agente consulta como o próprio usuário: sem policy, ele vê zero linha.
   Aqui o staging já nasce no modelo certo — leitura só das unidades do
   cadastro, escrita só por service role.
   ═══════════════════════════════════════════════════════════════════════════ */
do $$
declare t text;
begin
  foreach t in array array[
    'insumos','estoque_atual','fichas_tecnicas','produtos','colaboradores',
    'producao_diaria','registro_ponto','contas_pagar','lancamentos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t||'_leitura_unidade', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (hefisto_user_in_unit_strict(auth.uid(), unidade_id))',
      t||'_leitura_unidade', t
    );
  end loop;
end $$;

/* fichas_ingredientes não tem unidade_id: o escopo vem da ficha. */
alter table public.fichas_ingredientes enable row level security;
revoke all on public.fichas_ingredientes from anon;
grant select on public.fichas_ingredientes to authenticated;
grant all on public.fichas_ingredientes to service_role;
drop policy if exists fichas_ingredientes_leitura on public.fichas_ingredientes;
create policy fichas_ingredientes_leitura on public.fichas_ingredientes
  for select to authenticated
  using (exists (
    select 1 from public.fichas_tecnicas f
    where f.id = fichas_ingredientes.ficha_id
      and hefisto_user_in_unit_strict(auth.uid(), f.unidade_id)
  ));

/* unidades: todo mundo logado lê (o seletor de unidade precisa). */
alter table public.unidades enable row level security;
revoke all on public.unidades from anon;
grant select on public.unidades to authenticated;
grant all on public.unidades to service_role;
drop policy if exists unidades_leitura on public.unidades;
create policy unidades_leitura on public.unidades for select to authenticated using (true);

/* Tabelas de autorização: leitura só da própria linha, escrita só service role. */
do $$
declare t text;
begin
  foreach t in array array['empresas','setores','perfis_acesso','perfil_permissoes','usuarios_erp','usuario_permissoes','usuario_escopos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant select on public.usuarios_erp to authenticated;
drop policy if exists usuarios_erp_leitura_propria on public.usuarios_erp;
create policy usuarios_erp_leitura_propria on public.usuarios_erp
  for select to authenticated using (auth_user_id = auth.uid());

grant select on public.usuario_escopos to authenticated;
drop policy if exists usuario_escopos_leitura_propria on public.usuario_escopos;
create policy usuario_escopos_leitura_propria on public.usuario_escopos
  for select to authenticated using (exists (
    select 1 from public.usuarios_erp u
    where u.id = usuario_escopos.usuario_id and u.auth_user_id = auth.uid()
  ));

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 7 — CONFERÊNCIA (rode depois, separadamente)
   ═══════════════════════════════════════════════════════════════════════════

select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('empresas','unidades','setores','perfis_acesso','perfil_permissoes',
                     'usuarios_erp','usuario_permissoes','usuario_escopos','insumos','estoque_atual',
                     'fichas_tecnicas','fichas_ingredientes','produtos','colaboradores',
                     'producao_diaria','registro_ponto','contas_pagar','lancamentos')
order by 1;
   Esperado: 18 linhas.

select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname like 'hefisto\_%' order by 1;
   Esperado: hefisto_permission_match, hefisto_session_context, hefisto_user_can,
             hefisto_user_has_permission, hefisto_user_in_company,
             hefisto_user_in_unit_strict.

   ═══════════════════════════════════════════════════════════════════════════ */
