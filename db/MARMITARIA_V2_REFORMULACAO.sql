/* ═══════════════════════════════════════════════════════════════════════════
   MARMITARIA-V2 · reformulação do módulo Marmitaria & Delivery (14/10/2026)

   POR QUE
   - "duplicate key value violates unique constraint fichas_tecnicas_codigo_unico_idx":
     o código MARM-00N era gerado no navegador como "quantidade de marmitas + 1".
     A lista de marmitas falhava calada (pedia colunas que não existem), voltava
     vazia e toda marmita nova nascia MARM-001. Além disso a gravação era feita
     em vários passos soltos: ingredientes iam para colunas inexistentes de
     fichas_ingredientes (erro ignorado), custo e preço eram descartados.
   - Faltava uma fonte de vendas por canal para o DRE próprio da marmitaria.

   O QUE FAZ (aditivo; nada é apagado ou reescrito)
   1. marmitaria_salvar_ficha(jsonb): grava marmita OU pré-preparo numa transação
      só. Código gerado no banco sob trava (pg_advisory_xact_lock) e protegido
      pelo índice único existente; o id vem do cliente, então reenvio e clique
      duplo viram atualização, nunca duplicata. Valida unidade do usuário,
      ingredientes da mesma unidade, pré-preparo como subficha, ciclo entre
      fichas e nome repetido. Mensagens em português.
   2. marmitaria_registrar_producao(jsonb): lote de produção + baixas de estoque
      (via estoque_movimentar, chave idempotente por item) numa transação.
   3. marmitaria_vendas: vendas por dia, canal e marmita (lançamento manual ou
      importação), com taxas, descontos e repasse. RLS por unidade.
   4. marmitaria_configuracoes: + canais (taxas por canal/modalidade), encargos
      (CMO), rateio (despesas compartilhadas), tributos e centros diretos.

   SEGURANÇA
   - Funções SECURITY INVOKER: valem as policies de quem chama (sec_unidade).
   - EXECUTE só para authenticated.
   - Tabela nova com RLS e policy sec_unidade (padrão SEC-RLS-1).

   ROLLBACK (não rodar sem decisão do dono; não apaga dados das tabelas antigas):
     drop function if exists public.marmitaria_registrar_producao(jsonb);
     drop function if exists public.marmitaria_salvar_ficha(jsonb);
     drop table if exists public.marmitaria_vendas;            -- APAGA vendas lançadas
     alter table public.marmitaria_configuracoes
       drop column if exists canais, drop column if exists encargos,
       drop column if exists rateio, drop column if exists tributos_pct,
       drop column if exists centros_diretos;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight: aborta sem mudar nada se a base esperada não existir ─────────
do $$
declare t text;
begin
  foreach t in array array['unidades','fichas_tecnicas','fichas_ingredientes','insumos','estoques',
    'marmitaria_configuracoes','marmitaria_precificacao_canais','marmitaria_fichas_embalagens','marmitaria_producao_lotes'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'MARMITARIA-V2: tabela % não existe. Nada foi alterado.', t;
    end if;
  end loop;
  if to_regprocedure('public.hefisto_unidades_do_usuario()') is null
     or to_regprocedure('public.hefisto_ve_todas_unidades()') is null then
    raise exception 'MARMITARIA-V2: funções de escopo (SEC-RLS-1) ausentes. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'fichas_tecnicas_codigo_unico_idx') then
    raise exception 'MARMITARIA-V2: índice fichas_tecnicas_codigo_unico_idx ausente. Nada foi alterado.';
  end if;
end $$;

-- ── 1. Configurações: canais, encargos, rateio ────────────────────────────────
alter table public.marmitaria_configuracoes
  add column if not exists canais jsonb not null default '[]'::jsonb,
  add column if not exists encargos jsonb not null default '{}'::jsonb,
  add column if not exists rateio jsonb not null default '{}'::jsonb,
  add column if not exists tributos_pct numeric,
  add column if not exists centros_diretos text[] not null default array['marmitaria']::text[];

comment on column public.marmitaria_configuracoes.canais is
  'Taxas por canal: [{id,nome,ativo,modalidade,comissao_pct,comissao_base,taxa_pagamento_pct,pagamento_na_comissao,taxa_fixa_pedido,entrega_subsidiada_pedido,promocao_pct,itens_por_pedido}]';
comment on column public.marmitaria_configuracoes.tributos_pct is
  'Alíquota sobre a receita de vendas da marmitaria (ex.: Simples). Nulo = não configurado.';

-- ── 2. Vendas da marmitaria (fonte da receita do DRE próprio) ─────────────────
create table if not exists public.marmitaria_vendas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  data date not null,
  canal text not null,
  ficha_id uuid references public.fichas_tecnicas(id) on delete set null,
  quantidade numeric not null default 0,
  valor_bruto numeric not null default 0,
  descontos numeric not null default 0,
  cancelamentos numeric not null default 0,
  tributos numeric,
  comissao numeric not null default 0,
  taxa_pagamento numeric not null default 0,
  entrega_subsidiada numeric not null default 0,
  promocoes numeric not null default 0,
  outras_taxas numeric not null default 0,
  repasse_liquido numeric,
  taxas_estimadas boolean not null default false,
  fonte text not null default 'manual',
  referencia_externa text,
  observacao text,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marmitaria_vendas_canal_ck check (canal ~ '^[a-z0-9_]{2,30}$'),
  constraint marmitaria_vendas_fonte_ck check (fonte in ('manual', 'ifood', 'importacao')),
  constraint marmitaria_vendas_valores_ck check (
    quantidade >= 0 and valor_bruto >= 0 and descontos >= 0 and cancelamentos >= 0
    and coalesce(tributos, 0) >= 0 and comissao >= 0 and taxa_pagamento >= 0
    and entrega_subsidiada >= 0 and promocoes >= 0 and outras_taxas >= 0)
);

create index if not exists marmitaria_vendas_unidade_data_idx on public.marmitaria_vendas (unidade_id, data);
-- pedido importado (iFood etc.) entra uma vez só
create unique index if not exists marmitaria_vendas_externa_uq
  on public.marmitaria_vendas (unidade_id, fonte, referencia_externa) where referencia_externa is not null;

alter table public.marmitaria_vendas enable row level security;
drop policy if exists sec_unidade on public.marmitaria_vendas;
create policy sec_unidade on public.marmitaria_vendas for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
revoke all on public.marmitaria_vendas from anon;
grant select, insert, update, delete on public.marmitaria_vendas to authenticated;

create or replace function public.marmitaria_vendas_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists marmitaria_vendas_touch on public.marmitaria_vendas;
create trigger marmitaria_vendas_touch before update on public.marmitaria_vendas
  for each row execute function public.marmitaria_vendas_touch();

-- ── 3. Gravação atômica de marmita / pré-preparo ──────────────────────────────
create or replace function public.marmitaria_salvar_ficha(p_dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_unidade text;
  v_tipo text;
  v_nome text;
  v_dep text;
  v_rotulo text;
  v_ex record;
  v_existe boolean := false;
  v_codigo text;
  v_prefixo text;
  v_n integer;
  v_item jsonb;
  v_qtd numeric;
  v_ins uuid;
  v_sub uuid;
  v_sub_nome text;
  v_canal text;
  v_canais text[] := '{}';
  v_tentativa integer := 0;
  v_restricao text;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados da ficha ausentes.' using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(p_dados ->> 'id'), '')::uuid;
  exception when others then
    raise exception 'Identificador da ficha inválido. Recarregue a tela.' using errcode = '22023';
  end;
  if v_id is null then raise exception 'Identificador da ficha ausente. Recarregue a tela.' using errcode = '22023'; end if;

  v_unidade := nullif(btrim(coalesce(p_dados ->> 'unidade_id', '')), '');
  if v_unidade is null or v_unidade in ('todas', 'matriz') then
    raise exception 'Selecione a unidade antes de salvar.' using errcode = '22023';
  end if;
  if not ((select public.hefisto_ve_todas_unidades()) or v_unidade = any (public.hefisto_unidades_do_usuario())) then
    raise exception 'Você não tem acesso a esta unidade.' using errcode = '42501';
  end if;

  v_tipo := coalesce(nullif(p_dados ->> 'tipo', ''), 'marmita');
  if v_tipo not in ('marmita', 'pre_preparo') then
    raise exception 'Tipo de ficha inválido.' using errcode = '22023';
  end if;
  v_rotulo := case v_tipo when 'marmita' then 'marmita' else 'pré-preparo' end;
  v_dep := case v_tipo when 'marmita' then 'marmitaria'
                       else coalesce(nullif(lower(btrim(p_dados ->> 'departamento')), ''), 'cozinha') end;
  if v_tipo = 'pre_preparo' and v_dep not in ('cozinha', 'bar') then
    raise exception 'Pré-preparo precisa ser da cozinha ou do bar.' using errcode = '22023';
  end if;

  v_nome := btrim(regexp_replace(coalesce(p_dados ->> 'nome', ''), '\s+', ' ', 'g'));
  if length(v_nome) < 2 then raise exception 'Informe o nome da %.', v_rotulo using errcode = '22023'; end if;
  if length(v_nome) > 120 then raise exception 'Nome muito longo (máximo 120 caracteres).' using errcode = '22023'; end if;

  select id, unidade_id, departamento, eh_base, codigo into v_ex
    from public.fichas_tecnicas where id = v_id for update;
  v_existe := found;
  if v_existe then
    if v_ex.unidade_id is distinct from v_unidade then
      raise exception 'Esta ficha pertence a outra unidade.' using errcode = '42501';
    end if;
    if v_tipo = 'marmita' and coalesce(v_ex.departamento, '') <> 'marmitaria' then
      raise exception 'Esta ficha não é uma marmita.' using errcode = '22023';
    end if;
    if v_tipo = 'pre_preparo' and v_ex.eh_base is not true then
      raise exception 'Esta ficha não é um pré-preparo.' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.fichas_tecnicas f
     where f.unidade_id = v_unidade and f.id <> v_id and coalesce(f.ativo, true)
       and lower(btrim(f.nome_receita)) = lower(v_nome)
       and ((v_tipo = 'marmita' and f.departamento = 'marmitaria') or (v_tipo = 'pre_preparo' and f.eh_base))
  ) then
    raise exception 'Já existe um(a) % chamado(a) "%". Abra o cadastro existente para editar.', v_rotulo, v_nome
      using errcode = '23505';
  end if;

  -- itens: ingrediente (insumo_id) ou pré-preparo (subficha_id)
  for v_item in select value from jsonb_array_elements(coalesce(p_dados -> 'itens', '[]'::jsonb)) loop
    begin
      v_qtd := (v_item ->> 'quantidade')::numeric;
      v_ins := nullif(v_item ->> 'insumo_id', '')::uuid;
      v_sub := nullif(v_item ->> 'subficha_id', '')::uuid;
    exception when others then
      raise exception 'Item da ficha com valor inválido.' using errcode = '22023';
    end;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Informe uma quantidade maior que zero em todos os itens.' using errcode = '22023';
    end if;
    if (v_ins is null) = (v_sub is null) then
      raise exception 'Cada item precisa ser um ingrediente ou um pré-preparo.' using errcode = '22023';
    end if;
    if v_ins is not null and not exists (
      select 1 from public.insumos i where i.id = v_ins and (i.unidade_id is null or i.unidade_id = v_unidade)
    ) then
      raise exception 'Ingrediente não encontrado nesta unidade.' using errcode = '22023';
    end if;
    if v_sub is not null then
      if v_sub = v_id then raise exception 'Uma ficha não pode usar a si mesma.' using errcode = '22023'; end if;
      select nome_receita into v_sub_nome from public.fichas_tecnicas f
       where f.id = v_sub and f.unidade_id = v_unidade and f.eh_base is true;
      if not found then raise exception 'Pré-preparo não encontrado nesta unidade.' using errcode = '22023'; end if;
      if v_tipo = 'pre_preparo' and exists (
        with recursive usados(id) as (
          select v_sub
          union
          select fi.subficha_id from public.fichas_ingredientes fi join usados u on fi.ficha_id = u.id
           where fi.subficha_id is not null
        ) select 1 from usados where id = v_id
      ) then
        raise exception 'Referência circular: "%" já usa este pré-preparo.', v_sub_nome using errcode = '22023';
      end if;
    end if;
  end loop;

  if v_tipo = 'marmita' then
    for v_item in select value from jsonb_array_elements(coalesce(p_dados -> 'embalagens', '[]'::jsonb)) loop
      begin
        v_qtd := (v_item ->> 'quantidade')::numeric;
        v_ins := nullif(v_item ->> 'insumo_id', '')::uuid;
      exception when others then
        raise exception 'Embalagem com valor inválido.' using errcode = '22023';
      end;
      if v_ins is null or v_qtd is null or v_qtd <= 0 then
        raise exception 'Cada embalagem precisa de produto e quantidade maior que zero.' using errcode = '22023';
      end if;
      if not exists (select 1 from public.insumos i where i.id = v_ins and (i.unidade_id is null or i.unidade_id = v_unidade)) then
        raise exception 'Embalagem não encontrada nesta unidade.' using errcode = '22023';
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(coalesce(p_dados -> 'precos', '[]'::jsonb)) loop
      v_canal := lower(btrim(coalesce(v_item ->> 'canal', '')));
      if v_canal !~ '^[a-z0-9_]{2,30}$' then raise exception 'Canal de venda inválido.' using errcode = '22023'; end if;
      if v_canal = any (v_canais) then raise exception 'Canal "%" repetido nos preços.', v_canal using errcode = '22023'; end if;
      begin
        v_qtd := (v_item ->> 'preco_venda')::numeric;
      exception when others then
        raise exception 'Preço inválido no canal "%".', v_canal using errcode = '22023';
      end;
      if v_qtd is null or v_qtd < 0 then raise exception 'Preço inválido no canal "%".', v_canal using errcode = '22023'; end if;
      v_canais := v_canais || v_canal;
    end loop;
  end if;

  -- código: preserva o existente; gera o próximo sob trava da unidade
  v_codigo := nullif(btrim(coalesce(v_ex.codigo, '')), '');
  v_prefixo := case v_tipo when 'marmita' then 'MARM' else 'FT' end;
  if v_codigo is null then
    perform pg_advisory_xact_lock(hashtextextended('hefisto:fichas_codigo:' || v_unidade, 0));
    select coalesce(max(substring(f.codigo from '^' || v_prefixo || '-(\d+)$')::integer), 0) + 1 into v_n
      from public.fichas_tecnicas f
     where f.unidade_id = v_unidade and f.codigo ~ ('^' || v_prefixo || '-\d+$');
    v_codigo := v_prefixo || '-' || lpad(v_n::text, 4, '0');
  end if;

  loop
    begin
      if v_existe then
        update public.fichas_tecnicas set
          nome_receita = v_nome,
          codigo = v_codigo,
          categoria = nullif(btrim(coalesce(p_dados ->> 'categoria', '')), ''),
          descricao = nullif(btrim(coalesce(p_dados ->> 'descricao', '')), ''),
          descricao_comercial = case when v_tipo = 'marmita' then nullif(btrim(coalesce(p_dados ->> 'descricao', '')), '') else descricao_comercial end,
          imagem = nullif(btrim(coalesce(p_dados ->> 'foto', '')), ''),
          tamanho_marmita = case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'tamanho', ''), tamanho_marmita) else tamanho_marmita end,
          peso_final_g = nullif(p_dados ->> 'peso_final_g', '')::numeric,
          peso_porcao_g = case when v_tipo = 'marmita' then nullif(p_dados ->> 'peso_final_g', '')::numeric else peso_porcao_g end,
          preco_venda = case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'preco_venda', '')::numeric, 0) else preco_venda end,
          ativo = coalesce((p_dados ->> 'ativo')::boolean, true),
          rendimento_porcoes = case when v_tipo = 'marmita' then 1 else coalesce(nullif(p_dados ->> 'rendimento', '')::numeric, rendimento_porcoes) end,
          rendimento_unidade = case when v_tipo = 'marmita' then 'porcao' else coalesce(nullif(p_dados ->> 'rendimento_unidade', ''), rendimento_unidade) end,
          validade_dias = nullif(p_dados ->> 'validade_dias', '')::integer,
          custo_embalagens_total = case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'custo_embalagens_total', '')::numeric, 0) else custo_embalagens_total end,
          atualizado_em = now()
        where id = v_id;
      else
        insert into public.fichas_tecnicas (
          id, unidade_id, departamento, nome_receita, codigo, eh_base, categoria, descricao, descricao_comercial,
          imagem, tamanho_marmita, peso_final_g, peso_porcao_g, preco_venda, ativo, status, versao,
          rendimento_porcoes, rendimento_unidade, validade_dias, custo_embalagens_total, atualizado_em)
        values (
          v_id, v_unidade, v_dep, v_nome, v_codigo, v_tipo = 'pre_preparo',
          nullif(btrim(coalesce(p_dados ->> 'categoria', '')), ''),
          nullif(btrim(coalesce(p_dados ->> 'descricao', '')), ''),
          case when v_tipo = 'marmita' then nullif(btrim(coalesce(p_dados ->> 'descricao', '')), '') end,
          nullif(btrim(coalesce(p_dados ->> 'foto', '')), ''),
          case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'tamanho', ''), 'M') end,
          nullif(p_dados ->> 'peso_final_g', '')::numeric,
          case when v_tipo = 'marmita' then nullif(p_dados ->> 'peso_final_g', '')::numeric end,
          case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'preco_venda', '')::numeric, 0) else 0 end,
          coalesce((p_dados ->> 'ativo')::boolean, true), 'ativa', '1.0',
          case when v_tipo = 'marmita' then 1 else coalesce(nullif(p_dados ->> 'rendimento', '')::numeric, 1) end,
          case when v_tipo = 'marmita' then 'porcao' else coalesce(nullif(p_dados ->> 'rendimento_unidade', ''), 'kg') end,
          nullif(p_dados ->> 'validade_dias', '')::integer,
          case when v_tipo = 'marmita' then coalesce(nullif(p_dados ->> 'custo_embalagens_total', '')::numeric, 0) else 0 end,
          now());
      end if;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_restricao = constraint_name;
      -- outra tela gerou o mesmo código no mesmo instante: tenta o próximo
      if v_restricao = 'fichas_tecnicas_codigo_unico_idx' and v_tentativa < 5 and v_ex.codigo is null then
        v_tentativa := v_tentativa + 1;
        v_n := coalesce(v_n, 0) + 1;
        v_codigo := v_prefixo || '-' || lpad(v_n::text, 4, '0');
      elsif v_restricao = 'fichas_tecnicas_pkey' and v_tentativa < 5 then
        -- o mesmo envio chegou duas vezes ao mesmo tempo (clique duplo, rede
        -- lenta): o primeiro criou; este segue como atualização da mesma ficha
        v_tentativa := v_tentativa + 1;
        select id, unidade_id, departamento, eh_base, codigo into v_ex
          from public.fichas_tecnicas where id = v_id for update;
        if not found or v_ex.unidade_id is distinct from v_unidade
           or (v_tipo = 'marmita' and coalesce(v_ex.departamento, '') <> 'marmitaria')
           or (v_tipo = 'pre_preparo' and v_ex.eh_base is not true) then
          raise exception 'Conflito de identificador: recarregue a tela e tente de novo.' using errcode = '23505';
        end if;
        v_existe := true;
        v_codigo := coalesce(nullif(btrim(coalesce(v_ex.codigo, '')), ''), v_codigo);
      else
        raise exception 'Já existe uma ficha com o código %. Escolha outro código.', v_codigo using errcode = '23505';
      end if;
    end;
  end loop;

  delete from public.fichas_ingredientes where ficha_id = v_id;
  insert into public.fichas_ingredientes (ficha_id, insumo_id, subficha_id, quantidade, fator_correcao)
  select v_id,
         nullif(e.value ->> 'insumo_id', '')::uuid,
         nullif(e.value ->> 'subficha_id', '')::uuid,
         (e.value ->> 'quantidade')::numeric,
         greatest(coalesce(nullif(e.value ->> 'fator_correcao', '')::numeric, 0), 0)
    from jsonb_array_elements(coalesce(p_dados -> 'itens', '[]'::jsonb)) with ordinality e(value, ord)
   order by e.ord;

  if v_tipo = 'marmita' then
    delete from public.marmitaria_fichas_embalagens where ficha_id = v_id;
    insert into public.marmitaria_fichas_embalagens (unidade_id, ficha_id, embalagem_insumo_id, tipo_embalagem, quantidade, custo_unitario)
    select v_unidade, v_id, (e.value ->> 'insumo_id')::uuid,
           coalesce(nullif(btrim(e.value ->> 'tipo'), ''), 'outra'),
           (e.value ->> 'quantidade')::numeric,
           greatest(coalesce(nullif(e.value ->> 'custo_unitario', '')::numeric, 0), 0)
      from jsonb_array_elements(coalesce(p_dados -> 'embalagens', '[]'::jsonb)) e;

    delete from public.marmitaria_precificacao_canais
     where ficha_id = v_id and not (canal = any (v_canais));
    insert into public.marmitaria_precificacao_canais (unidade_id, ficha_id, canal, preco_venda, atualizado_em)
    select v_unidade, v_id, lower(btrim(e.value ->> 'canal')), (e.value ->> 'preco_venda')::numeric, now()
      from jsonb_array_elements(coalesce(p_dados -> 'precos', '[]'::jsonb)) e
    on conflict (unidade_id, ficha_id, canal) do update
      set preco_venda = excluded.preco_venda, atualizado_em = now();
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'codigo', v_codigo, 'criado', not v_existe);
end $$;

revoke all on function public.marmitaria_salvar_ficha(jsonb) from public, anon;
grant execute on function public.marmitaria_salvar_ficha(jsonb) to authenticated;

-- ── 4. Produção: lote + baixas numa transação ─────────────────────────────────
-- As baixas chegam calculadas pela tela (explosão da ficha, testada em
-- app/lib/marmitaria/nucleo.mjs). Pré-preparo baixa o PRÓPRIO pré-preparo do
-- estoque (os ingredientes dele já saíram quando ele foi produzido).
create or replace function public.marmitaria_registrar_producao(p_dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lote uuid;
  v_unidade text;
  v_ficha uuid;
  v_qtd numeric;
  v_b jsonb;
  v_res jsonb;
  v_baixas integer := 0;
begin
  begin
    v_lote := nullif(p_dados ->> 'lote_id', '')::uuid;
    v_ficha := nullif(p_dados ->> 'ficha_id', '')::uuid;
    v_qtd := (p_dados ->> 'quantidade')::numeric;
  exception when others then
    raise exception 'Dados da produção inválidos.' using errcode = '22023';
  end;
  v_unidade := nullif(btrim(coalesce(p_dados ->> 'unidade_id', '')), '');
  if v_lote is null or v_ficha is null or v_unidade is null then
    raise exception 'Produção sem marmita, lote ou unidade.' using errcode = '22023';
  end if;
  if v_qtd is null or v_qtd <= 0 then raise exception 'Informe quantas marmitas foram produzidas.' using errcode = '22023'; end if;
  if not ((select public.hefisto_ve_todas_unidades()) or v_unidade = any (public.hefisto_unidades_do_usuario())) then
    raise exception 'Você não tem acesso a esta unidade.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fichas_tecnicas where id = v_ficha and unidade_id = v_unidade and departamento = 'marmitaria') then
    raise exception 'Marmita não encontrada nesta unidade.' using errcode = '22023';
  end if;

  -- reenvio do mesmo lote: devolve o que já foi feito, sem baixar de novo
  if exists (select 1 from public.marmitaria_producao_lotes where id = v_lote) then
    return jsonb_build_object('ok', true, 'idempotente', true, 'lote_id', v_lote);
  end if;

  for v_b in select value from jsonb_array_elements(coalesce(p_dados -> 'baixas', '[]'::jsonb)) loop
    v_res := public.estoque_movimentar(
      p_unidade_id => v_unidade,
      p_estoque_id => (v_b ->> 'estoque_id')::uuid,
      p_insumo_id => (v_b ->> 'insumo_id')::uuid,
      p_tipo => 'saida',
      p_motivo => 'producao',
      p_quantidade => (v_b ->> 'quantidade')::numeric,
      p_observacao => 'Produção de marmitas · lote ' || left(v_lote::text, 8),
      p_responsavel_nome => nullif(p_dados ->> 'responsavel', ''),
      p_chave => 'marm-prod:' || v_lote::text || ':' || (v_b ->> 'estoque_id') || ':' || (v_b ->> 'insumo_id'),
      p_origem => 'producao');
    if coalesce((v_res ->> 'ok')::boolean, false) is not true then
      raise exception 'Baixa recusada: %', coalesce(v_res ->> 'erro', 'motivo não informado') using errcode = '22023';
    end if;
    v_baixas := v_baixas + 1;
  end loop;

  insert into public.marmitaria_producao_lotes (
    id, unidade_id, codigo, status, ficha_id, quantidade_planejada, quantidade_produzida, quantidade_perdas,
    motivo_perda, data_producao, custo_total, baixou_ingredientes, baixou_embalagens, rendimento_real_dados)
  values (
    v_lote, v_unidade, 'PROD-' || to_char(coalesce(nullif(p_dados ->> 'data', '')::date, current_date), 'YYYYMMDD') || '-' || left(v_lote::text, 4),
    'concluido', v_ficha, v_qtd, v_qtd, greatest(coalesce(nullif(p_dados ->> 'perdas', '')::numeric, 0), 0),
    nullif(p_dados ->> 'motivo_perda', ''), coalesce(nullif(p_dados ->> 'data', '')::date, current_date),
    greatest(coalesce(nullif(p_dados ->> 'custo_previsto', '')::numeric, 0), 0),
    v_baixas > 0, v_baixas > 0, coalesce(p_dados -> 'baixas', '[]'::jsonb));

  return jsonb_build_object('ok', true, 'idempotente', false, 'lote_id', v_lote, 'baixas', v_baixas);
end $$;

revoke all on function public.marmitaria_registrar_producao(jsonb) from public, anon;
grant execute on function public.marmitaria_registrar_producao(jsonb) to authenticated;

commit;

-- ── Verificação pós-aplicação (impressão digital) ──────────────────────────────
select 'marmitaria_vendas' as objeto, (to_regclass('public.marmitaria_vendas') is not null) as ok
union all select 'rls marmitaria_vendas', relrowsecurity from pg_class where oid = 'public.marmitaria_vendas'::regclass
union all select 'policy sec_unidade', exists (select 1 from pg_policies where tablename = 'marmitaria_vendas' and policyname = 'sec_unidade')
union all select 'fn salvar_ficha', to_regprocedure('public.marmitaria_salvar_ficha(jsonb)') is not null
union all select 'fn registrar_producao', to_regprocedure('public.marmitaria_registrar_producao(jsonb)') is not null
union all select 'col canais', exists (select 1 from information_schema.columns where table_name = 'marmitaria_configuracoes' and column_name = 'canais')
union all select 'anon sem execute', not has_function_privilege('anon', 'public.marmitaria_salvar_ficha(jsonb)', 'execute');
