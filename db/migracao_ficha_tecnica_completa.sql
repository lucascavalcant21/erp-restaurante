-- ═══════════════════════════════════════════════════════════════════════════
-- FICHA TÉCNICA PROFISSIONAL — Livro de Receitas
--
-- Amplia `fichas_tecnicas` com os campos de uma ficha técnica de cozinha
-- profissional e cria as tabelas filhas (etapas, equipamentos, alergênicos,
-- armazenamento, montagem e versões).
--
-- NÃO apaga nada e NÃO altera coluna existente: só adiciona. As fichas, os
-- ingredientes, as subfichas (fichas_ingredientes.subficha_id) e o histórico
-- de custos (fichas_custo_historico) continuam exatamente como estão.
--
-- Como rodar: cole inteiro no SQL Editor do Supabase e execute. É idempotente
-- (rodar de novo não faz nada).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. IDENTIFICAÇÃO E PRODUÇÃO — colunas novas em fichas_tecnicas
-- ───────────────────────────────────────────────────────────────────────────
alter table public.fichas_tecnicas
  -- Identificação
  add column if not exists codigo                   text,
  add column if not exists subcategoria             text,
  add column if not exists nome_interno             text,
  add column if not exists nome_comercial           text,
  add column if not exists responsavel              text,
  add column if not exists status                   text not null default 'ativa',
  add column if not exists versao                   text not null default '1.0',
  add column if not exists descricao                text,
  -- Rendimento e produção
  add column if not exists peso_bruto_g             numeric(14,3),
  add column if not exists peso_final_g             numeric(14,3),
  -- `tempo_preparo` já existe na tabela e continua sendo o tempo de preparo.
  -- Aqui entra só o que falta; o tempo total é calculado na tela.
  add column if not exists tempo_coccao_min         integer,
  add column if not exists temperatura_preparo      text,
  add column if not exists temperatura_servico      text,
  -- Custos indiretos (percentual sobre o custo, ou valor fixo por rendimento)
  add column if not exists custo_indireto_tipo      text not null default 'percentual',
  add column if not exists custo_indireto_valor     numeric(14,4) not null default 0,
  -- Alergênicos: o "pode conter" é texto livre, mora na própria ficha
  add column if not exists alergenicos_pode_conter  text,
  -- Montagem
  add column if not exists montagem_foto            text,
  add column if not exists atualizado_em            timestamptz;

-- ── Normalização ANTES das constraints ──────────────────────────────────────
-- A coluna `status` pode já existir com outros valores. Normalizar primeiro,
-- senão o CHECK abaixo derruba a migração inteira.
update public.fichas_tecnicas
set status = case
  when lower(coalesce(status, '')) in ('inativa', 'inativo', 'false') then 'inativa'
  when lower(coalesce(status, '')) = 'rascunho'                       then 'rascunho'
  else 'ativa'
end;

-- A coluna booleana `ativo` existe em algumas instalações e não em outras
-- (a listagem já trata os dois casos). Só usamos se ela estiver lá.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fichas_tecnicas' and column_name = 'ativo'
  ) then
    execute $sql$
      update public.fichas_tecnicas
      set status = 'inativa'
      where ativo is false and status <> 'rascunho'
    $sql$;
  end if;
end $$;

update public.fichas_tecnicas
set versao = '1.0'
where versao is null or trim(versao) = '';

update public.fichas_tecnicas
set custo_indireto_tipo = 'percentual'
where custo_indireto_tipo is null
   or custo_indireto_tipo not in ('percentual', 'fixo');

update public.fichas_tecnicas
set custo_indireto_valor = 0
where custo_indireto_valor is null or custo_indireto_valor < 0;

update public.fichas_tecnicas set peso_bruto_g = null where peso_bruto_g < 0;
update public.fichas_tecnicas set peso_final_g = null where peso_final_g < 0;

-- `status` só aceita os três estados usados pela tela.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fichas_tecnicas_status_check'
      and conrelid = 'public.fichas_tecnicas'::regclass
  ) then
    alter table public.fichas_tecnicas
      add constraint fichas_tecnicas_status_check
      check (status in ('ativa', 'inativa', 'rascunho'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fichas_tecnicas_custo_indireto_tipo_check'
      and conrelid = 'public.fichas_tecnicas'::regclass
  ) then
    alter table public.fichas_tecnicas
      add constraint fichas_tecnicas_custo_indireto_tipo_check
      check (custo_indireto_tipo in ('percentual', 'fixo'));
  end if;
end $$;

-- Peso e custo indireto nunca negativos (regra 31 da especificação).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fichas_tecnicas_pesos_positivos_check'
      and conrelid = 'public.fichas_tecnicas'::regclass
  ) then
    alter table public.fichas_tecnicas
      add constraint fichas_tecnicas_pesos_positivos_check
      check (
        coalesce(peso_bruto_g, 0) >= 0
        and coalesce(peso_final_g, 0) >= 0
        and custo_indireto_valor >= 0
      );
  end if;
end $$;

-- Código FT-0001: único por unidade, e só quando preenchido.
create unique index if not exists fichas_tecnicas_codigo_unico_idx
  on public.fichas_tecnicas (unidade_id, codigo)
  where codigo is not null and codigo <> '';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. ETAPAS DO MODO DE PREPARO
--    Substitui o texto livre `modo_preparo` por etapas ordenadas. O campo
--    antigo continua existindo e sendo lido: nada quebra para quem já tem
--    receita escrita lá.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_etapas (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  text,
  ficha_id    uuid not null references public.fichas_tecnicas(id) on delete cascade,
  ordem       integer not null default 0,
  titulo      text,
  instrucao   text,
  tempo_min   integer,
  temperatura text,
  equipamento text,
  foto_url    text,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. EQUIPAMENTOS E UTENSÍLIOS
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_equipamentos (
  id         uuid primary key default gen_random_uuid(),
  unidade_id text,
  ficha_id   uuid not null references public.fichas_tecnicas(id) on delete cascade,
  nome       text not null,
  ordem      integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists fichas_equipamentos_unico_idx
  on public.fichas_equipamentos (ficha_id, lower(nome));

-- ───────────────────────────────────────────────────────────────────────────
-- 4. ALERGÊNICOS
--    Lista fechada da RDC 727/2022 mais "outros"; o texto do "pode conter"
--    fica em fichas_tecnicas.alergenicos_pode_conter.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_alergenicos (
  id         uuid primary key default gen_random_uuid(),
  unidade_id text,
  ficha_id   uuid not null references public.fichas_tecnicas(id) on delete cascade,
  alergenico text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists fichas_alergenicos_unico_idx
  on public.fichas_alergenicos (ficha_id, lower(alergenico));

-- ───────────────────────────────────────────────────────────────────────────
-- 5. ARMAZENAMENTO E VALIDADE — uma linha por ficha
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_armazenamento (
  id                       uuid primary key default gen_random_uuid(),
  unidade_id               text,
  ficha_id                 uuid not null unique
                             references public.fichas_tecnicas(id) on delete cascade,
  forma                    text,
  recipiente               text,
  temperatura_min          numeric(6,2),
  temperatura_max          numeric(6,2),
  validade_refrigerado_dias integer,
  validade_congelado_dias   integer,
  validade_apos_aberto_dias integer,
  validade_apos_preparo_horas integer,
  local_armazenamento      text,
  observacoes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. MONTAGEM PADRÃO — passos ordenados da montagem do prato
--    Não confundir com o módulo "Guia de Montagem" (tabela public.montagem),
--    que é outra coisa e continua intacto.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_montagem_passos (
  id         uuid primary key default gen_random_uuid(),
  unidade_id text,
  ficha_id   uuid not null references public.fichas_tecnicas(id) on delete cascade,
  ordem      integer not null default 0,
  descricao  text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. VERSÕES DA FICHA
--    Cada versão guarda um retrato completo (jsonb) do estado da ficha.
--    Nada é apagado automaticamente.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.fichas_versoes (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      text,
  ficha_id        uuid not null references public.fichas_tecnicas(id) on delete cascade,
  versao          text not null,
  versao_anterior text,
  snapshot        jsonb not null default '{}'::jsonb,
  alteracao       text,
  usuario_id      uuid,
  usuario_nome    text,
  created_at      timestamptz not null default now()
);

create unique index if not exists fichas_versoes_unico_idx
  on public.fichas_versoes (ficha_id, versao);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. ÍNDICES
-- ───────────────────────────────────────────────────────────────────────────
create index if not exists idx_fichas_etapas_ficha      on public.fichas_etapas (ficha_id, ordem);
create index if not exists idx_fichas_equip_ficha       on public.fichas_equipamentos (ficha_id, ordem);
create index if not exists idx_fichas_alerg_ficha       on public.fichas_alergenicos (ficha_id);
create index if not exists idx_fichas_montagem_ficha    on public.fichas_montagem_passos (ficha_id, ordem);
create index if not exists idx_fichas_versoes_ficha     on public.fichas_versoes (ficha_id, created_at desc);
create index if not exists idx_fichas_tec_codigo        on public.fichas_tecnicas (unidade_id, codigo);
create index if not exists idx_fichas_tec_status        on public.fichas_tecnicas (unidade_id, status);

-- ───────────────────────────────────────────────────────────────────────────
-- 9. RLS — mesma política aberta que o restante do app usa
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'fichas_etapas', 'fichas_equipamentos', 'fichas_alergenicos',
    'fichas_armazenamento', 'fichas_montagem_passos', 'fichas_versoes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_all'
    ) then
      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        t || '_all', t
      );
    end if;
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 10. CÓDIGO FT PARA AS FICHAS QUE JÁ EXISTEM
--     Numera por unidade, na ordem de criação, sem sobrescrever código já
--     preenchido à mão.
-- ───────────────────────────────────────────────────────────────────────────
-- Ordena por data de criação quando a coluna existir; senão, por nome (que
-- sempre existe). A numeração precisa ser estável, não cronológica.
do $$
declare
  v_ordem text := 'nome_receita';
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fichas_tecnicas' and column_name = 'created_at'
  ) then
    v_ordem := 'created_at, nome_receita';
  end if;

  execute format($sql$
    with numeradas as (
      select
        id,
        'FT-' || lpad(
          row_number() over (partition by unidade_id order by %s)::text, 4, '0'
        ) as novo_codigo
      from public.fichas_tecnicas
      where codigo is null or codigo = ''
    )
    update public.fichas_tecnicas f
    set codigo = n.novo_codigo
    from numeradas n
    where f.id = n.id
      and not exists (
        select 1 from public.fichas_tecnicas outra
        where outra.unidade_id is not distinct from f.unidade_id
          and outra.codigo = n.novo_codigo
          and outra.id <> f.id
      )
  $sql$, v_ordem);
end $$;

-- (`versao`, `status` e os custos indiretos já foram normalizados no passo 1,
--  antes das constraints.)

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA — o que deve aparecer depois de rodar
-- ═══════════════════════════════════════════════════════════════════════════
select
  unidade_id,
  count(*)                                        as fichas,
  count(codigo)                                   as com_codigo,
  count(*) filter (where status = 'ativa')        as ativas,
  count(*) filter (where peso_bruto_g is not null) as com_peso_bruto
from public.fichas_tecnicas
group by unidade_id
order by unidade_id;
