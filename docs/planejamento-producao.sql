-- Planejamento, execucao, contagem e saldo de producao.
-- Idempotente: pode ser executado novamente no SQL Editor do Supabase.
--
-- Regras centrais:
--   * no maximo um lote ativo por unidade/departamento/ficha/data;
--   * toda baixa, finalizacao, devolucao ou contagem acontece em uma RPC atomica;
--   * ingredientes e custos ficam congelados no lote para preservar o historico;
--   * saldos de produto pronto usam sempre a unidade-base g, ml ou un.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Acesso: fonte de autorizacao controlada exclusivamente pelo banco.
-- Nunca confiar em user_metadata para papel ou unidade, pois esse conteudo
-- pode ser alterado pelo proprio usuario no Supabase Auth.
-- ---------------------------------------------------------------------------

create table if not exists public.producao_acessos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  papel       text not null,
  unidade_id  text references public.unidades(id) on delete cascade,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint producao_acessos_papel_ck check (papel in ('admin', 'unidade')),
  constraint producao_acessos_escopo_ck check (
    (papel = 'admin' and unidade_id is null)
    or (papel = 'unidade' and unidade_id is not null)
  )
);

create unique index if not exists producao_acessos_admin_uidx
  on public.producao_acessos (usuario_id)
  where papel = 'admin';

create unique index if not exists producao_acessos_unidade_uidx
  on public.producao_acessos (usuario_id, unidade_id)
  where papel = 'unidade';

-- Nesta fase o modulo foi autorizado apenas para o proprietario do ERP.
-- Novos acessos devem ser concedidos nessa tabela por uma operacao
-- administrativa no servidor, nunca pelo navegador do usuario.
insert into public.producao_acessos (usuario_id, papel, unidade_id, ativo)
select u.id, 'admin', null, true
  from auth.users u
 where lower(u.email) = 'lucascavalcant21@gmail.com'
   and not exists (
     select 1
       from public.producao_acessos a
      where a.usuario_id = u.id
        and a.papel = 'admin'
   );

update public.producao_acessos a
   set ativo = true,
       updated_at = now()
  from auth.users u
 where u.id = a.usuario_id
   and lower(u.email) = 'lucascavalcant21@gmail.com'
   and a.papel = 'admin';

alter table public.producao_acessos enable row level security;
revoke all on public.producao_acessos from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas de operacao
-- ---------------------------------------------------------------------------

create table if not exists public.producao_lotes (
  id                              uuid primary key default gen_random_uuid(),
  unidade_id                      text not null references public.unidades(id) on delete cascade,
  departamento                    text not null,
  ficha_id                        uuid not null references public.fichas_tecnicas(id) on delete restrict,
  ficha_nome                      text not null default '',
  data_producao                   date not null,
  status                          text not null default 'planejado',

  quantidade_planejada            numeric not null default 0,
  unidade_planejada               text not null default 'un',
  quantidade_planejada_base       numeric not null default 0,
  unidade_base                    text not null default 'un',
  estoque_pronto_informado_base   numeric not null default 0,

  media_dia_base                  numeric not null default 0,
  media_semana_base               numeric not null default 0,
  media_mes_base                  numeric not null default 0,
  margem_seguranca_pct            numeric not null default 0,

  responsavel_planejado_id        uuid,
  responsavel_planejado_nome      text,
  colaborador_id                  uuid,
  colaborador_nome                text,

  quantidade_produzida            numeric,
  unidade_produzida               text,
  quantidade_produzida_base       numeric,

  custo_previsto                  numeric not null default 0,
  custo_real                      numeric,
  ingredientes_previstos          jsonb not null default '[]'::jsonb,
  ingredientes_baixados           jsonb not null default '[]'::jsonb,

  origem                          text not null default 'manual',
  transcricao_audio               text,
  observacoes                     text,
  motivo_cancelamento             text,
  considerar_na_media             boolean not null default true,

  -- Flags tecnicas tornam as RPCs idempotentes mesmo diante de repeticao de
  -- requisicao, duplo clique ou perda da resposta HTTP depois do commit.
  baixa_estoque_aplicada          boolean not null default false,
  saldo_producao_aplicado         boolean not null default false,
  devolucao_estoque_aplicada      boolean not null default false,

  criado_por                      uuid default auth.uid(),
  iniciado_por                    uuid,
  finalizado_por                  uuid,
  cancelado_por                   uuid,
  iniciado_em                     timestamptz,
  finalizado_em                   timestamptz,
  cancelado_em                    timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint producao_lotes_departamento_ck
    check (btrim(departamento) <> ''),
  constraint producao_lotes_status_ck
    check (status in ('planejado', 'em_producao', 'concluido', 'cancelado')),
  constraint producao_lotes_unidade_base_ck
    check (unidade_base in ('g', 'ml', 'un')),
  constraint producao_lotes_origem_ck
    check (origem in ('manual', 'audio', 'sistema', 'importacao')),
  constraint producao_lotes_quantidades_ck
    check (
      quantidade_planejada >= 0
      and quantidade_planejada_base >= 0
      and estoque_pronto_informado_base >= 0
      and media_dia_base >= 0
      and media_semana_base >= 0
      and media_mes_base >= 0
      and margem_seguranca_pct >= 0
      and (quantidade_produzida is null or quantidade_produzida >= 0)
      and (quantidade_produzida_base is null or quantidade_produzida_base >= 0)
      and custo_previsto >= 0
      and (custo_real is null or custo_real >= 0)
    ),
  constraint producao_lotes_ingredientes_previstos_array_ck
    check (jsonb_typeof(ingredientes_previstos) = 'array'),
  constraint producao_lotes_ingredientes_baixados_array_ck
    check (jsonb_typeof(ingredientes_baixados) = 'array')
);

-- Lotes concluidos/cancelados ficam no historico e uma nova producao da mesma
-- ficha pode ser aberta no mesmo dia. A exclusividade vale somente enquanto o
-- lote esta ativo.
drop index if exists public.producao_lotes_chave_dia_uidx;
create unique index producao_lotes_chave_dia_uidx
  on public.producao_lotes (unidade_id, departamento, ficha_id, data_producao)
  where status in ('planejado', 'em_producao');

create index if not exists producao_lotes_unidade_data_idx
  on public.producao_lotes (unidade_id, data_producao desc);

create index if not exists producao_lotes_unidade_departamento_data_idx
  on public.producao_lotes (unidade_id, departamento, data_producao desc);

create index if not exists producao_lotes_status_idx
  on public.producao_lotes (unidade_id, status, data_producao desc);

create index if not exists producao_lotes_media_idx
  on public.producao_lotes (unidade_id, ficha_id, data_producao desc)
  where status = 'concluido' and considerar_na_media;

create table if not exists public.producao_saldos (
  unidade_id       text not null references public.unidades(id) on delete cascade,
  ficha_id         uuid not null references public.fichas_tecnicas(id) on delete cascade,
  ficha_nome       text not null default '',
  departamento     text not null,
  quantidade_base  numeric not null default 0,
  unidade_base     text not null,
  ultima_contagem_em timestamptz,
  ultimo_lote_id   uuid references public.producao_lotes(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  primary key (unidade_id, ficha_id),
  constraint producao_saldos_quantidade_ck check (quantidade_base >= 0),
  constraint producao_saldos_unidade_base_ck check (unidade_base in ('g', 'ml', 'un')),
  constraint producao_saldos_departamento_ck check (btrim(departamento) <> '')
);

create index if not exists producao_saldos_departamento_idx
  on public.producao_saldos (unidade_id, departamento, ficha_nome);

create table if not exists public.producao_contagens (
  id                         uuid primary key default gen_random_uuid(),
  unidade_id                 text not null references public.unidades(id) on delete cascade,
  ficha_id                   uuid not null references public.fichas_tecnicas(id) on delete cascade,
  ficha_nome                 text not null default '',
  departamento               text not null,
  lote_id                    uuid references public.producao_lotes(id) on delete set null,
  data_contagem              date not null,
  quantidade_anterior_base   numeric not null default 0,
  quantidade_base            numeric not null,
  diferenca_base             numeric not null,
  unidade_base               text not null,
  origem                     text not null default 'manual',
  transcricao_audio          text,
  colaborador_id             uuid,
  colaborador_nome           text,
  chave_idempotencia         text,
  criado_por                 uuid default auth.uid(),
  created_at                 timestamptz not null default now(),

  constraint producao_contagens_quantidades_ck
    check (quantidade_anterior_base >= 0 and quantidade_base >= 0),
  constraint producao_contagens_unidade_base_ck
    check (unidade_base in ('g', 'ml', 'un')),
  constraint producao_contagens_origem_ck
    check (origem in ('manual', 'audio', 'sistema', 'importacao')),
  constraint producao_contagens_departamento_ck
    check (btrim(departamento) <> '')
);

-- Necessario quando a tabela ja existia antes desta versao da migration.
alter table public.producao_contagens
  add column if not exists chave_idempotencia text;

create index if not exists producao_contagens_unidade_ficha_data_idx
  on public.producao_contagens (unidade_id, ficha_id, data_contagem desc, created_at desc);

create index if not exists producao_contagens_unidade_data_idx
  on public.producao_contagens (unidade_id, data_contagem desc, created_at desc);

create unique index if not exists producao_contagens_idempotencia_uidx
  on public.producao_contagens (unidade_id, chave_idempotencia)
  where chave_idempotencia is not null;

-- ---------------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------------

create or replace function public._producao_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists producao_lotes_set_updated_at on public.producao_lotes;
create trigger producao_lotes_set_updated_at
before update on public.producao_lotes
for each row execute function public._producao_set_updated_at();

drop trigger if exists producao_acessos_set_updated_at on public.producao_acessos;
create trigger producao_acessos_set_updated_at
before update on public.producao_acessos
for each row execute function public._producao_set_updated_at();

drop trigger if exists producao_saldos_set_updated_at on public.producao_saldos;
create trigger producao_saldos_set_updated_at
before update on public.producao_saldos
for each row execute function public._producao_set_updated_at();

-- O escopo vem somente da tabela protegida producao_acessos. Administrador
-- pode operar todas as unidades; os demais precisam de vinculo exato.
create or replace function public._producao_pode_acessar_unidade(p_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
         from public.producao_acessos a
        where a.usuario_id = auth.uid()
          and a.ativo
          and (
            a.papel = 'admin'
            or (a.papel = 'unidade' and a.unidade_id = p_unidade_id)
          )
     );
$$;

revoke all on function public._producao_pode_acessar_unidade(text) from public, anon;
grant execute on function public._producao_pode_acessar_unidade(text) to authenticated;

-- Impede que uma corrida de tela ou uma requisicao manual crie plano com
-- ficha, setor ou responsavel pertencente a outro escopo.
create or replace function public._producao_validar_plano()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_departamento text;
begin
  select coalesce(nullif(btrim(f.departamento), ''), 'cozinha')
    into v_departamento
    from public.fichas_tecnicas f
   where f.id = new.ficha_id
     and f.unidade_id = new.unidade_id;

  if not found then
    raise exception using errcode = '23503', message = 'Ficha inexistente ou pertencente a outra unidade.';
  end if;

  if new.departamento <> v_departamento then
    raise exception using errcode = '23514', message = 'O departamento do lote nao corresponde ao departamento da ficha.';
  end if;

  if new.responsavel_planejado_id is not null
     and not exists (
       select 1
         from public.colaboradores c
        where c.id = new.responsavel_planejado_id
          and c.unidade_id = new.unidade_id
     ) then
    raise exception using errcode = '23503', message = 'Responsavel planejado inexistente ou pertencente a outra unidade.';
  end if;

  return new;
end;
$$;

revoke all on function public._producao_validar_plano() from public, anon, authenticated;

drop trigger if exists producao_lotes_validar_plano on public.producao_lotes;
create trigger producao_lotes_validar_plano
before insert or update of unidade_id, departamento, ficha_id, responsavel_planejado_id
on public.producao_lotes
for each row execute function public._producao_validar_plano();

-- ---------------------------------------------------------------------------
-- RLS: leitura e planejamento para autenticados; mutacoes de saldo e ciclo de
-- vida passam exclusivamente pelas RPCs security definer abaixo.
-- ---------------------------------------------------------------------------

alter table public.producao_lotes enable row level security;
alter table public.producao_saldos enable row level security;
alter table public.producao_contagens enable row level security;

revoke all on public.producao_lotes from anon;
revoke all on public.producao_saldos from anon;
revoke all on public.producao_contagens from anon;

grant select, insert, update, delete on public.producao_lotes to authenticated;
grant select on public.producao_saldos to authenticated;
grant select on public.producao_contagens to authenticated;

drop policy if exists producao_lotes_select_auth on public.producao_lotes;
create policy producao_lotes_select_auth on public.producao_lotes
  for select to authenticated
  using (public._producao_pode_acessar_unidade(unidade_id));

drop policy if exists producao_lotes_insert_planejado_auth on public.producao_lotes;
create policy producao_lotes_insert_planejado_auth on public.producao_lotes
  for insert to authenticated
  with check (
    public._producao_pode_acessar_unidade(unidade_id)
    and status = 'planejado'
    and not baixa_estoque_aplicada
    and not saldo_producao_aplicado
    and not devolucao_estoque_aplicada
  );

drop policy if exists producao_lotes_update_planejado_auth on public.producao_lotes;
create policy producao_lotes_update_planejado_auth on public.producao_lotes
  for update to authenticated
  using (
    public._producao_pode_acessar_unidade(unidade_id)
    and status = 'planejado'
  )
  with check (
    public._producao_pode_acessar_unidade(unidade_id)
    and status = 'planejado'
    and not baixa_estoque_aplicada
    and not saldo_producao_aplicado
    and not devolucao_estoque_aplicada
  );

drop policy if exists producao_lotes_delete_planejado_auth on public.producao_lotes;
create policy producao_lotes_delete_planejado_auth on public.producao_lotes
  for delete to authenticated
  using (
    public._producao_pode_acessar_unidade(unidade_id)
    and status = 'planejado'
  );

drop policy if exists producao_saldos_select_auth on public.producao_saldos;
create policy producao_saldos_select_auth on public.producao_saldos
  for select to authenticated
  using (public._producao_pode_acessar_unidade(unidade_id));

drop policy if exists producao_contagens_select_auth on public.producao_contagens;
create policy producao_contagens_select_auth on public.producao_contagens
  for select to authenticated
  using (public._producao_pode_acessar_unidade(unidade_id));

-- ---------------------------------------------------------------------------
-- Helpers privados
-- ---------------------------------------------------------------------------

create or replace function public._producao_unidade_base(p_unidade text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog, public
as $$
  select case lower(btrim(p_unidade))
    when 'kg' then 'g'
    when 'g' then 'g'
    when 'l' then 'ml'
    when 'lt' then 'ml'
    when 'litro' then 'ml'
    when 'litros' then 'ml'
    when 'ml' then 'ml'
    when 'un' then 'un'
    when 'und' then 'un'
    when 'unidade' then 'un'
    when 'unidades' then 'un'
    when 'porcao' then 'un'
    when 'porcoes' then 'un'
    else null
  end;
$$;

create or replace function public._producao_quantidade_base(
  p_quantidade numeric,
  p_unidade text
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = pg_catalog, public
as $$
  select case lower(btrim(p_unidade))
    when 'kg' then p_quantidade * 1000
    when 'g' then p_quantidade
    when 'l' then p_quantidade * 1000
    when 'lt' then p_quantidade * 1000
    when 'litro' then p_quantidade * 1000
    when 'litros' then p_quantidade * 1000
    when 'ml' then p_quantidade
    when 'un' then p_quantidade
    when 'und' then p_quantidade
    when 'unidade' then p_quantidade
    when 'unidades' then p_quantidade
    when 'porcao' then p_quantidade
    when 'porcoes' then p_quantidade
    else null
  end;
$$;

-- Expande fichas e subfichas em fatores de receita. A linha que fecha um ciclo
-- e devolvida com ciclo=true e nao e expandida novamente, permitindo que a RPC
-- rejeite a arvore antes de tocar no estoque.
create or replace function public._producao_arvore_fichas(
  p_ficha_id uuid,
  p_fator numeric
)
returns table (
  ficha_id uuid,
  fator numeric,
  caminho uuid[],
  ciclo boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with recursive arvore(ficha_id, fator, caminho, ciclo) as (
    select p_ficha_id, p_fator, array[p_ficha_id]::uuid[], false

    union all

    select
      fi.subficha_id,
      a.fator * fi.quantidade / nullif(sf.rendimento_porcoes, 0),
      a.caminho || fi.subficha_id,
      fi.subficha_id = any(a.caminho)
    from arvore a
    join public.fichas_ingredientes fi
      on fi.ficha_id = a.ficha_id
     and fi.subficha_id is not null
    left join public.fichas_tecnicas sf
      on sf.id = fi.subficha_id
    where not a.ciclo
      and fi.quantidade > 0
      and sf.id is not null
      and sf.rendimento_porcoes > 0
  )
  select a.ficha_id, a.fator, a.caminho, a.ciclo
    from arvore a;
$$;

revoke all on function public._producao_set_updated_at() from public, anon, authenticated;
revoke all on function public._producao_unidade_base(text) from public, anon, authenticated;
revoke all on function public._producao_quantidade_base(numeric, text) from public, anon, authenticated;
revoke all on function public._producao_arvore_fichas(uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Iniciar lote: deriva toda a arvore da ficha no banco, bloqueia os insumos e
-- saldos em ordem deterministica e somente depois efetua qualquer baixa.
-- p_ingredientes/p_custo_previsto sao mantidos apenas por compatibilidade e
-- deliberadamente ignorados.
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_producao_lote(
  p_lote_id uuid,
  p_colaborador_id uuid default null,
  p_colaborador_nome text default null,
  p_ingredientes jsonb default null,
  p_custo_previsto numeric default null
)
returns public.producao_lotes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lote                    public.producao_lotes%rowtype;
  v_ficha                   public.fichas_tecnicas%rowtype;
  v_unidade_plano_base      text;
  v_unidade_ficha_base      text;
  v_quantidade_plano_base   numeric;
  v_rendimento_base         numeric;
  v_fator_receita           numeric;
  v_consumos                jsonb;
  v_normalizados            jsonb;
  v_baixados                jsonb;
  v_faltantes               jsonb;
  v_custo_calculado         numeric := 0;
  v_colaborador_id          uuid;
  v_colaborador_nome        text;
  v_responsavel_nome        text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_lote_id is null then
    raise exception using errcode = '22004', message = 'p_lote_id e obrigatorio.';
  end if;

  select l.*
    into v_lote
    from public.producao_lotes l
   where l.id = p_lote_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lote de producao nao encontrado.';
  end if;

  if not public._producao_pode_acessar_unidade(v_lote.unidade_id) then
    raise exception using errcode = '42501', message = 'Usuario sem acesso a unidade deste lote.';
  end if;

  -- Repetir a mesma requisicao nunca baixa estoque novamente.
  if v_lote.status in ('em_producao', 'concluido') then
    return v_lote;
  end if;

  if v_lote.status = 'cancelado' then
    raise exception using errcode = 'P0001', message = 'Lote cancelado nao pode ser iniciado.';
  end if;

  if v_lote.baixa_estoque_aplicada then
    raise exception using errcode = 'P0001', message = 'Lote inconsistente: baixa ja aplicada.';
  end if;

  select f.*
    into v_ficha
    from public.fichas_tecnicas f
   where f.id = v_lote.ficha_id
   for share;

  if not found or v_ficha.unidade_id is distinct from v_lote.unidade_id then
    raise exception using errcode = '23503', message = 'Ficha inexistente ou pertencente a outra unidade.';
  end if;

  if v_lote.quantidade_planejada <= 0 or nullif(btrim(v_lote.unidade_planejada), '') is null then
    raise exception using errcode = '22023', message = 'A quantidade planejada deve ser maior que zero.';
  end if;

  v_unidade_plano_base := public._producao_unidade_base(v_lote.unidade_planejada);
  v_quantidade_plano_base := public._producao_quantidade_base(
    v_lote.quantidade_planejada,
    v_lote.unidade_planejada
  );
  v_unidade_ficha_base := public._producao_unidade_base(v_ficha.rendimento_unidade);
  v_rendimento_base := public._producao_quantidade_base(
    v_ficha.rendimento_porcoes,
    v_ficha.rendimento_unidade
  );

  if v_unidade_plano_base is null or v_quantidade_plano_base is null then
    raise exception using errcode = '22023', message = 'Unidade planejada invalida.';
  end if;

  if v_unidade_ficha_base is null or v_rendimento_base is null or v_rendimento_base <= 0 then
    raise exception using errcode = '22023', message = 'Rendimento ou unidade de rendimento da ficha invalido.';
  end if;

  if v_unidade_plano_base <> v_unidade_ficha_base then
    raise exception using errcode = '22023', message = 'A unidade planejada nao pertence a familia de rendimento da ficha.';
  end if;

  v_fator_receita := v_quantidade_plano_base / v_rendimento_base;
  if v_fator_receita <= 0 then
    raise exception using errcode = '22023', message = 'Fator de producao invalido.';
  end if;

  if exists (
    select 1
      from public._producao_arvore_fichas(v_ficha.id, v_fator_receita) a
     where a.ciclo
  ) then
    raise exception using errcode = '22023', message = 'FICHA_CICLICA: uma subficha referencia a propria arvore.';
  end if;

  -- Toda ficha alcancada deve pertencer a mesma unidade e ter rendimento
  -- valido. Isso impede que uma subficha atravesse a fronteira de uma unidade.
  if exists (
    select 1
      from public._producao_arvore_fichas(v_ficha.id, v_fator_receita) a
      join public.fichas_tecnicas f on f.id = a.ficha_id
     where not a.ciclo
       and (
         f.unidade_id is distinct from v_lote.unidade_id
         or f.rendimento_porcoes is null
         or f.rendimento_porcoes <= 0
         or public._producao_unidade_base(f.rendimento_unidade) is null
       )
  ) then
    raise exception using errcode = '22023', message = 'Subficha com unidade ou rendimento invalido.';
  end if;

  -- Cada linha precisa apontar para exatamente um insumo ou uma subficha.
  if exists (
    select 1
      from public._producao_arvore_fichas(v_ficha.id, v_fator_receita) a
      join public.fichas_ingredientes fi on fi.ficha_id = a.ficha_id
      left join public.insumos i on i.id = fi.insumo_id
      left join public.fichas_tecnicas sf on sf.id = fi.subficha_id
     where not a.ciclo
       and (
         fi.quantidade is null
         or fi.quantidade <= 0
         or (fi.insumo_id is null and fi.subficha_id is null)
         or (fi.insumo_id is not null and fi.subficha_id is not null)
         or (
           fi.insumo_id is not null
           and (i.id is null or i.unidade_id is distinct from v_lote.unidade_id)
         )
         or (
           fi.subficha_id is not null
           and (
             sf.id is null
             or sf.unidade_id is distinct from v_lote.unidade_id
             or sf.rendimento_porcoes is null
             or sf.rendimento_porcoes <= 0
             or public._producao_unidade_base(sf.rendimento_unidade) is null
           )
         )
       )
  ) then
    raise exception using errcode = '22023', message = 'Ficha contem ingrediente ou subficha invalido para esta unidade.';
  end if;

  if exists (
    select 1
      from public._producao_arvore_fichas(v_ficha.id, v_fator_receita) a
     where not a.ciclo
       and not exists (
         select 1 from public.fichas_ingredientes fi where fi.ficha_id = a.ficha_id
       )
  ) then
    raise exception using errcode = '22023', message = 'Ficha ou subficha sem ingredientes.';
  end if;

  -- Os argumentos p_ingredientes e p_custo_previsto existem apenas para
  -- compatibilidade. O navegador nao participa do calculo contabil.
  with consumos as (
    select
      fi.insumo_id,
      sum(fi.quantidade * a.fator) as quantidade
    from public._producao_arvore_fichas(v_ficha.id, v_fator_receita) a
    join public.fichas_ingredientes fi on fi.ficha_id = a.ficha_id
    where not a.ciclo
      and fi.insumo_id is not null
    group by fi.insumo_id
  )
  select jsonb_agg(
           jsonb_build_object('insumo_id', c.insumo_id, 'quantidade', c.quantidade)
           order by c.insumo_id
         )
    into v_consumos
    from consumos c;

  if v_consumos is null or jsonb_array_length(v_consumos) = 0 then
    raise exception using errcode = '22023', message = 'A arvore da ficha nao possui insumos diretos para baixar.';
  end if;

  -- Trava os insumos antes de obter o snapshot de nome/unidade/custo.
  perform i.id
    from public.insumos i
    join jsonb_to_recordset(v_consumos) as c(insumo_id uuid, quantidade numeric)
      on c.insumo_id = i.id
   order by i.id
   for share of i;

  with normalizados as (
    select
      c.insumo_id,
      i.nome,
      i.unidade_medida as unidade,
      c.quantidade,
      greatest(coalesce(i.custo_unitario, 0), 0) as custo_unitario,
      c.quantidade * greatest(coalesce(i.custo_unitario, 0), 0) as custo_total
    from jsonb_to_recordset(v_consumos) as c(insumo_id uuid, quantidade numeric)
    join public.insumos i
      on i.id = c.insumo_id
     and i.unidade_id = v_lote.unidade_id
  )
  select jsonb_agg(
           jsonb_build_object(
             'insumo_id', n.insumo_id,
             'nome', n.nome,
             'unidade', n.unidade,
             'quantidade', n.quantidade,
             'custo_unitario', n.custo_unitario,
             'custo_total', n.custo_total
           ) order by n.insumo_id
         ),
         coalesce(sum(n.custo_total), 0)
    into v_normalizados, v_custo_calculado
    from normalizados n;

  if v_normalizados is null
     or jsonb_array_length(v_normalizados) <> jsonb_array_length(v_consumos) then
    raise exception using errcode = '23503', message = 'Insumo inexistente ou pertencente a outra unidade.';
  end if;

  if v_lote.responsavel_planejado_id is not null then
    select c.nome
      into v_responsavel_nome
      from public.colaboradores c
     where c.id = v_lote.responsavel_planejado_id
       and c.unidade_id = v_lote.unidade_id;

    if not found then
      raise exception using errcode = '23503', message = 'Responsavel planejado inexistente ou pertencente a outra unidade.';
    end if;
  end if;

  v_colaborador_id := coalesce(p_colaborador_id, v_lote.responsavel_planejado_id);
  if v_colaborador_id is not null then
    select c.nome
      into v_colaborador_nome
      from public.colaboradores c
     where c.id = v_colaborador_id
       and c.unidade_id = v_lote.unidade_id;

    if not found then
      raise exception using errcode = '23503', message = 'Colaborador inexistente ou pertencente a outra unidade.';
    end if;
  end if;

  -- Ordem fixa de lock evita deadlock quando dois lotes compartilham insumos.
  perform e.insumo_id
    from public.estoque_atual e
    join jsonb_to_recordset(v_normalizados) as j(insumo_id uuid, quantidade numeric)
      on j.insumo_id = e.insumo_id
     and e.unidade_id = v_lote.unidade_id
   order by e.insumo_id
   for update of e;

  select jsonb_agg(
           jsonb_build_object(
             'insumo_id', j.insumo_id,
             'nome', j.nome,
             'unidade', j.unidade,
             'necessario', j.quantidade,
             'disponivel', coalesce(e.quantidade_atual, 0)
           ) order by j.insumo_id
         )
    into v_faltantes
    from jsonb_to_recordset(v_normalizados)
      as j(insumo_id uuid, nome text, unidade text, quantidade numeric)
    left join public.estoque_atual e
      on e.unidade_id = v_lote.unidade_id
     and e.insumo_id = j.insumo_id
   where coalesce(e.quantidade_atual, 0) < j.quantidade;

  if v_faltantes is not null then
    raise exception using
      errcode = 'P0001',
      message = 'ESTOQUE_INSUFICIENTE',
      detail = v_faltantes::text;
  end if;

  select jsonb_agg(
           j.item || jsonb_build_object(
             'saldo_antes', e.quantidade_atual,
             'saldo_depois', e.quantidade_atual - (j.item ->> 'quantidade')::numeric
           ) order by (j.item ->> 'insumo_id')
         )
    into v_baixados
    from jsonb_array_elements(v_normalizados) j(item)
    join public.estoque_atual e
      on e.unidade_id = v_lote.unidade_id
     and e.insumo_id = (j.item ->> 'insumo_id')::uuid;

  -- Somente agora, depois de todas as validacoes, o estoque e alterado.
  with itens as (
    select insumo_id, quantidade
      from jsonb_to_recordset(v_normalizados)
        as j(insumo_id uuid, quantidade numeric)
  )
  update public.estoque_atual e
     set quantidade_atual = e.quantidade_atual - i.quantidade,
         updated_at = now()
    from itens i
   where e.unidade_id = v_lote.unidade_id
     and e.insumo_id = i.insumo_id;

  update public.producao_lotes
     set status = 'em_producao',
         ficha_nome = coalesce(v_ficha.nome_receita, ''),
         departamento = coalesce(nullif(btrim(v_ficha.departamento), ''), 'cozinha'),
         quantidade_planejada_base = v_quantidade_plano_base,
         unidade_base = v_unidade_plano_base,
         responsavel_planejado_nome = v_responsavel_nome,
         colaborador_id = v_colaborador_id,
         colaborador_nome = v_colaborador_nome,
         ingredientes_previstos = v_normalizados,
         ingredientes_baixados = v_baixados,
         custo_previsto = v_custo_calculado,
         baixa_estoque_aplicada = true,
         iniciado_por = auth.uid(),
         iniciado_em = coalesce(iniciado_em, now())
   where id = v_lote.id
  returning * into v_lote;

  return v_lote;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalizar lote: valida a unidade/peso real e soma uma unica vez ao saldo de
-- produto pronto.
-- ---------------------------------------------------------------------------

create or replace function public.finalizar_producao_lote(
  p_lote_id uuid,
  p_quantidade numeric,
  p_unidade text,
  p_quantidade_base numeric,
  p_observacoes text default null
)
returns public.producao_lotes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lote              public.producao_lotes%rowtype;
  v_base_calculada    numeric;
  v_unidade_base      text;
  v_unidade_saldo     text;
  v_custo_real        numeric := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_lote_id is null or p_quantidade is null or p_quantidade <= 0 or p_unidade is null then
    raise exception using errcode = '22023', message = 'Lote, quantidade e unidade validos sao obrigatorios.';
  end if;

  v_unidade_base := public._producao_unidade_base(p_unidade);
  v_base_calculada := public._producao_quantidade_base(p_quantidade, p_unidade);
  if v_unidade_base is null or v_base_calculada is null then
    raise exception using errcode = '22023', message = 'Unidade produzida invalida.';
  end if;

  if p_quantidade_base is not null
     and abs(p_quantidade_base - v_base_calculada) > greatest(0.000001, abs(v_base_calculada) * 0.000001) then
    raise exception using errcode = '22023', message = 'Quantidade-base nao corresponde a quantidade e unidade informadas.';
  end if;

  select l.*
    into v_lote
    from public.producao_lotes l
   where l.id = p_lote_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lote de producao nao encontrado.';
  end if;

  if not public._producao_pode_acessar_unidade(v_lote.unidade_id) then
    raise exception using errcode = '42501', message = 'Usuario sem acesso a unidade deste lote.';
  end if;

  if v_lote.status = 'concluido' then
    return v_lote;
  end if;

  if v_lote.status = 'cancelado' then
    raise exception using errcode = 'P0001', message = 'Lote cancelado nao pode ser finalizado.';
  end if;

  if v_lote.status <> 'em_producao' or not v_lote.baixa_estoque_aplicada then
    raise exception using errcode = 'P0001', message = 'Inicie a producao e baixe os ingredientes antes de finalizar.';
  end if;

  if v_lote.saldo_producao_aplicado then
    raise exception using errcode = 'P0001', message = 'Lote inconsistente: saldo de producao ja aplicado.';
  end if;

  if v_unidade_base <> v_lote.unidade_base then
    raise exception using errcode = '22023', message = 'A unidade produzida nao e compativel com a unidade-base planejada.';
  end if;

  -- Serializa finalizacoes e contagens da mesma ficha, inclusive quando ainda
  -- nao existe linha em producao_saldos.
  perform pg_advisory_xact_lock(hashtextextended(v_lote.unidade_id || ':' || v_lote.ficha_id::text, 0));

  select s.unidade_base
    into v_unidade_saldo
    from public.producao_saldos s
   where s.unidade_id = v_lote.unidade_id
     and s.ficha_id = v_lote.ficha_id
   for update;

  if found and v_unidade_saldo <> v_lote.unidade_base then
    raise exception using errcode = '22023', message = 'O saldo pronto existente usa outra unidade-base.';
  end if;

  insert into public.producao_saldos (
    unidade_id, ficha_id, ficha_nome, departamento,
    quantidade_base, unidade_base, ultimo_lote_id, updated_at
  ) values (
    v_lote.unidade_id, v_lote.ficha_id, v_lote.ficha_nome, v_lote.departamento,
    v_base_calculada, v_lote.unidade_base, v_lote.id, now()
  )
  on conflict (unidade_id, ficha_id) do update
    set quantidade_base = public.producao_saldos.quantidade_base + excluded.quantidade_base,
        ficha_nome = excluded.ficha_nome,
        departamento = excluded.departamento,
        ultimo_lote_id = excluded.ultimo_lote_id,
        updated_at = now();

  select coalesce(sum(
           coalesce(
             nullif(j.item ->> 'custo_total', '')::numeric,
             coalesce(nullif(j.item ->> 'quantidade', '')::numeric, 0)
               * coalesce(nullif(j.item ->> 'custo_unitario', '')::numeric, 0)
           )
         ), 0)
    into v_custo_real
    from jsonb_array_elements(coalesce(v_lote.ingredientes_baixados, '[]'::jsonb)) j(item);

  update public.producao_lotes
     set status = 'concluido',
         quantidade_produzida = p_quantidade,
         unidade_produzida = p_unidade,
         quantidade_produzida_base = v_base_calculada,
         custo_real = v_custo_real,
         observacoes = coalesce(p_observacoes, observacoes),
         saldo_producao_aplicado = true,
         finalizado_por = auth.uid(),
         finalizado_em = coalesce(finalizado_em, now())
   where id = v_lote.id
  returning * into v_lote;

  return v_lote;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar lote: quando solicitado, devolve exatamente o snapshot efetivamente
-- baixado. O lock do lote e a flag de devolucao impedem estorno duplicado.
-- ---------------------------------------------------------------------------

create or replace function public.cancelar_producao_lote(
  p_lote_id uuid,
  p_devolver_estoque boolean default true,
  p_motivo text default null
)
returns public.producao_lotes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lote public.producao_lotes%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_lote_id is null then
    raise exception using errcode = '22004', message = 'p_lote_id e obrigatorio.';
  end if;

  select l.*
    into v_lote
    from public.producao_lotes l
   where l.id = p_lote_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lote de producao nao encontrado.';
  end if;

  if not public._producao_pode_acessar_unidade(v_lote.unidade_id) then
    raise exception using errcode = '42501', message = 'Usuario sem acesso a unidade deste lote.';
  end if;

  if v_lote.status = 'cancelado' then
    return v_lote;
  end if;

  if v_lote.status = 'concluido' then
    raise exception using errcode = 'P0001', message = 'Lote concluido nao pode ser cancelado.';
  end if;

  if coalesce(p_devolver_estoque, false)
     and v_lote.baixa_estoque_aplicada
     and not v_lote.devolucao_estoque_aplicada then

    if jsonb_typeof(v_lote.ingredientes_baixados) <> 'array' then
      raise exception using errcode = 'P0001', message = 'Snapshot de ingredientes invalido; cancelamento interrompido sem alterar estoque.';
    end if;

    if jsonb_array_length(v_lote.ingredientes_baixados) = 0 then
      raise exception using errcode = 'P0001', message = 'Snapshot de ingredientes ausente; cancelamento interrompido sem alterar estoque.';
    end if;

    perform e.insumo_id
      from public.estoque_atual e
      join jsonb_to_recordset(v_lote.ingredientes_baixados)
        as j(insumo_id uuid, quantidade numeric)
        on j.insumo_id = e.insumo_id
       and e.unidade_id = v_lote.unidade_id
     order by e.insumo_id
     for update of e;

    insert into public.estoque_atual (
      unidade_id, insumo_id, quantidade_atual, updated_at
    )
    select
      v_lote.unidade_id,
      j.insumo_id,
      j.quantidade,
      now()
    from jsonb_to_recordset(v_lote.ingredientes_baixados)
      as j(insumo_id uuid, quantidade numeric)
    where j.insumo_id is not null and j.quantidade > 0
    on conflict (unidade_id, insumo_id) do update
      set quantidade_atual = public.estoque_atual.quantidade_atual + excluded.quantidade_atual,
          updated_at = now();

    v_lote.devolucao_estoque_aplicada := true;
  end if;

  update public.producao_lotes
     set status = 'cancelado',
         motivo_cancelamento = nullif(btrim(p_motivo), ''),
         considerar_na_media = false,
         devolucao_estoque_aplicada = v_lote.devolucao_estoque_aplicada,
         cancelado_por = auth.uid(),
         cancelado_em = coalesce(cancelado_em, now())
   where id = v_lote.id
  returning * into v_lote;

  return v_lote;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registrar contagem: substitui o saldo pronto e grava o antes/depois no mesmo
-- commit. Contagens por audio preservam a transcricao para auditoria.
-- ---------------------------------------------------------------------------

-- Remove a sobrecarga antiga: a nova assinatura continua aceitando as mesmas
-- oito entradas porque a chave adicional tem valor default.
drop function if exists public.registrar_contagem_producao(
  text, uuid, date, numeric, text, text, text, uuid
);

create or replace function public.registrar_contagem_producao(
  p_unidade_id text,
  p_ficha_id uuid,
  p_data date,
  p_quantidade_base numeric,
  p_unidade_base text,
  p_origem text default 'manual',
  p_transcricao text default null,
  p_colaborador uuid default null,
  p_chave_idempotencia text default null
)
returns public.producao_contagens
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ficha              public.fichas_tecnicas%rowtype;
  v_anterior           numeric := 0;
  v_unidade_existente  text;
  v_unidade_ficha      text;
  v_colaborador_nome   text;
  v_chave              text;
  v_hoje               date := (now() at time zone 'America/Sao_Paulo')::date;
  v_contagem           public.producao_contagens%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_unidade_id is null or btrim(p_unidade_id) = '' or p_ficha_id is null or p_data is null then
    raise exception using errcode = '22004', message = 'Unidade, ficha e data sao obrigatorias.';
  end if;

  if not public._producao_pode_acessar_unidade(p_unidade_id) then
    raise exception using errcode = '42501', message = 'Usuario sem acesso a unidade informada.';
  end if;

  if p_data <> v_hoje then
    raise exception using errcode = '22023', message = 'A contagem so pode alterar o saldo na data atual de America/Sao_Paulo.';
  end if;

  if p_quantidade_base is null or p_quantidade_base < 0 then
    raise exception using errcode = '22023', message = 'A quantidade-base da contagem nao pode ser negativa.';
  end if;

  if p_unidade_base not in ('g', 'ml', 'un') then
    raise exception using errcode = '22023', message = 'Unidade-base da contagem invalida.';
  end if;

  if coalesce(p_origem, 'manual') not in ('manual', 'audio', 'sistema', 'importacao') then
    raise exception using errcode = '22023', message = 'Origem da contagem invalida.';
  end if;

  if p_origem = 'audio' and nullif(btrim(p_transcricao), '') is null then
    raise exception using errcode = '22023', message = 'A transcricao e obrigatoria para contagem por audio.';
  end if;

  select f.*
    into v_ficha
    from public.fichas_tecnicas f
   where f.id = p_ficha_id
     and f.unidade_id = p_unidade_id;

  if not found then
    raise exception using errcode = '23503', message = 'Ficha inexistente ou pertencente a outra unidade.';
  end if;

  v_unidade_ficha := public._producao_unidade_base(v_ficha.rendimento_unidade);
  if v_ficha.rendimento_porcoes is null
     or v_ficha.rendimento_porcoes <= 0
     or v_unidade_ficha is null then
    raise exception using errcode = '22023', message = 'Ficha com rendimento ou unidade de rendimento invalido.';
  end if;

  if p_unidade_base <> v_unidade_ficha then
    raise exception using errcode = '22023', message = 'A unidade-base da contagem nao pertence a familia de rendimento da ficha.';
  end if;

  v_chave := nullif(btrim(p_chave_idempotencia), '');
  if v_chave is not null and length(v_chave) > 200 then
    raise exception using errcode = '22023', message = 'A chave de idempotencia deve ter no maximo 200 caracteres.';
  end if;

  if v_chave is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('contagem:' || p_unidade_id || ':' || v_chave, 0)
    );

    select c.*
      into v_contagem
      from public.producao_contagens c
     where c.unidade_id = p_unidade_id
       and c.chave_idempotencia = v_chave;

    if found then
      if v_contagem.ficha_id <> p_ficha_id
         or v_contagem.data_contagem <> p_data
         or v_contagem.quantidade_base <> p_quantidade_base
         or v_contagem.unidade_base <> p_unidade_base
         or v_contagem.origem <> coalesce(p_origem, 'manual')
         or v_contagem.colaborador_id is distinct from p_colaborador then
        raise exception using errcode = '22023', message = 'Chave de idempotencia ja usada por outra contagem.';
      end if;

      return v_contagem;
    end if;
  end if;

  if p_colaborador is not null then
    select c.nome
      into v_colaborador_nome
      from public.colaboradores c
     where c.id = p_colaborador
       and c.unidade_id = p_unidade_id;

    if not found then
      raise exception using errcode = '23503', message = 'Colaborador inexistente ou pertencente a outra unidade.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_unidade_id || ':' || p_ficha_id::text, 0));

  select s.quantidade_base, s.unidade_base
    into v_anterior, v_unidade_existente
    from public.producao_saldos s
   where s.unidade_id = p_unidade_id
     and s.ficha_id = p_ficha_id
   for update;

  if not found then
    v_anterior := 0;
    v_unidade_existente := null;
  elsif v_unidade_existente <> p_unidade_base then
    raise exception using errcode = '22023', message = 'A contagem usa unidade-base diferente do saldo existente.';
  end if;

  insert into public.producao_saldos (
    unidade_id, ficha_id, ficha_nome, departamento,
    quantidade_base, unidade_base, ultima_contagem_em, updated_at
  ) values (
    p_unidade_id, p_ficha_id, coalesce(v_ficha.nome_receita, ''), coalesce(nullif(btrim(v_ficha.departamento), ''), 'cozinha'),
    p_quantidade_base, p_unidade_base, now(), now()
  )
  on conflict (unidade_id, ficha_id) do update
    set quantidade_base = excluded.quantidade_base,
        unidade_base = excluded.unidade_base,
        ficha_nome = excluded.ficha_nome,
        departamento = excluded.departamento,
        ultima_contagem_em = excluded.ultima_contagem_em,
        updated_at = now();

  insert into public.producao_contagens (
    unidade_id, ficha_id, ficha_nome, departamento, data_contagem,
    quantidade_anterior_base, quantidade_base, diferenca_base, unidade_base,
    origem, transcricao_audio, colaborador_id, colaborador_nome,
    chave_idempotencia, criado_por
  ) values (
    p_unidade_id, p_ficha_id, coalesce(v_ficha.nome_receita, ''), coalesce(v_ficha.departamento, 'cozinha'), p_data,
    v_anterior, p_quantidade_base, p_quantidade_base - v_anterior, p_unidade_base,
    coalesce(p_origem, 'manual'), nullif(btrim(p_transcricao), ''), p_colaborador, v_colaborador_nome,
    v_chave, auth.uid()
  )
  returning * into v_contagem;

  return v_contagem;
end;
$$;

-- Funcoes security definer nunca ficam executaveis por PUBLIC/anon.
revoke all on function public.iniciar_producao_lote(uuid, uuid, text, jsonb, numeric) from public, anon;
revoke all on function public.finalizar_producao_lote(uuid, numeric, text, numeric, text) from public, anon;
revoke all on function public.cancelar_producao_lote(uuid, boolean, text) from public, anon;
revoke all on function public.registrar_contagem_producao(text, uuid, date, numeric, text, text, text, uuid, text) from public, anon;

grant execute on function public.iniciar_producao_lote(uuid, uuid, text, jsonb, numeric) to authenticated;
grant execute on function public.finalizar_producao_lote(uuid, numeric, text, numeric, text) to authenticated;
grant execute on function public.cancelar_producao_lote(uuid, boolean, text) to authenticated;
grant execute on function public.registrar_contagem_producao(text, uuid, date, numeric, text, text, text, uuid, text) to authenticated;

comment on table public.producao_lotes is
  'Plano e execucao diaria de producao, com snapshots de medias, custos e ingredientes.';
comment on table public.producao_acessos is
  'Permissoes do modulo de producao mantidas no servidor; nunca derivadas de user_metadata.';
comment on table public.producao_saldos is
  'Saldo atual de produto pronto por unidade e ficha, normalizado em g, ml ou un.';
comment on table public.producao_contagens is
  'Historico auditavel de contagens manuais ou por audio do estoque de produto pronto.';

commit;
