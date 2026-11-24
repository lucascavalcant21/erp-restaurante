/* ═══════════════════════════════════════════════════════════════════════════
   CONC-1 · CARDÁPIOS DE DELIVERY DOS CONCORRENTES (lidos pelo Jhon)

   STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só). Antes: ESCRITA, NÃO APLICADA. É do SISTEMA DE TESTE (branch hefisto-teste,
   banco hefisto-staging): o banco do restaurante não recebe. Aplicar só com a
   aprovação do dono (APR-029).

   PEDIDO DO DONO (16 e 17/11/2026): "o Jhon também analisa cardápios de
   delivery e monta o que vem em cada um e o valor, para comparar com os
   nossos, incluindo os adicionais ofertados. E ficam salvos em um banco de
   dados."

   FAZ (uma transação; só aditiva):
     1. delivery_concorrentes: o concorrente (nome, plataforma, segmento, link).
     2. delivery_concorrentes_leituras: cada leitura do cardápio, com a data em
        que foi vista e de onde veio (foto/print, texto ou digitado). Uma leitura
        nova NÃO apaga a anterior: o histórico mostra quando o preço mudou.
     3. delivery_concorrentes_itens: o que o cardápio mostrava naquela data:
        pratos, combos, bebidas, sobremesas e ADICIONAIS (com o grupo, ex.:
        "Turbine sua marmita"), o que vem em cada um, peso quando o cardápio
        informa, preço e preço riscado.
     4. hefisto_salvar_leitura_concorrente(unidade, dados jsonb): grava tudo de
        uma vez (tudo ou nada), com chave contra envio duplicado. Exige
        marmitaria.competitors.create NA unidade.
     5. hefisto_apagar_leitura_concorrente(leitura): apaga UMA leitura errada
        (e os itens dela). Exige marmitaria.competitors.delete na unidade.
     6. Leitura das três tabelas: quem tem marmitaria.competitors.view na
        unidade. Escrita SÓ pelas funções (sem grant de insert/update/delete).
   NÃO FAZ: não mexe nas marmitas, nos preços nem no financeiro. Os valores do
   concorrente são o que estava no cardápio dele (REAL observado, com data);
   nada é calculado aqui.

   VERIFICAÇÃO: o select do fim devolve 5914f480e5d072dd0b31a8e0ce4f44d1
   (conferida no PGlite por app/lib/concorrentes-banco.test.mjs, 21 casos).

   ROLLBACK (não rodar sem decisão do dono; apaga os cardápios guardados):
     drop function if exists public.hefisto_apagar_leitura_concorrente(uuid);
     drop function if exists public.hefisto_salvar_leitura_concorrente(text, jsonb);
     drop table if exists public.delivery_concorrentes_itens;
     drop table if exists public.delivery_concorrentes_leituras;
     drop table if exists public.delivery_concorrentes;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regprocedure('public.hefisto_user_can(text, text)') is null then
    raise exception 'CONC-1: falta hefisto_user_can(text, text). Nada foi alterado.';
  end if;
  if to_regclass('public.delivery_concorrentes') is not null
     or to_regclass('public.delivery_concorrentes_leituras') is not null
     or to_regclass('public.delivery_concorrentes_itens') is not null then
    raise exception 'CONC-1: as tabelas já existem. Nada foi alterado.';
  end if;
end $$;

create table public.delivery_concorrentes (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  text not null,
  nome        text not null check (length(btrim(nome)) between 2 and 120),
  plataforma  text not null default 'ifood' check (plataforma in ('ifood', '99food', 'rappi', 'aiqfome', 'keeta', 'whatsapp', 'site', 'outro')),
  segmento    text check (segmento is null or length(segmento) <= 60),
  bairro      text check (bairro is null or length(bairro) <= 80),
  link        text check (link is null or (link ~ '^https://' and length(link) <= 500)),
  observacao  text check (observacao is null or length(observacao) <= 500),
  criado_por  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index delivery_concorrentes_nome_unico on public.delivery_concorrentes (unidade_id, lower(btrim(nome)), plataforma);

create table public.delivery_concorrentes_leituras (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      text not null,
  concorrente_id  uuid not null references public.delivery_concorrentes(id),
  observado_em    date not null,
  fonte           text not null check (fonte in ('foto', 'texto', 'manual')),
  taxa_entrega    numeric(10,2) check (taxa_entrega is null or taxa_entrega >= 0),
  pedido_minimo   numeric(10,2) check (pedido_minimo is null or pedido_minimo >= 0),
  tempo_entrega   text check (tempo_entrega is null or length(tempo_entrega) <= 40),
  avaliacao       numeric(3,1) check (avaliacao is null or avaliacao between 0 and 5),
  observacao      text check (observacao is null or length(observacao) <= 500),
  qtd_itens       int not null default 0,
  chave           text check (chave is null or length(chave) between 8 and 80),
  criado_por      uuid,
  created_at      timestamptz not null default now()
);
create unique index delivery_conc_leituras_chave on public.delivery_concorrentes_leituras (unidade_id, chave) where chave is not null;
create index delivery_conc_leituras_concorrente on public.delivery_concorrentes_leituras (concorrente_id, observado_em desc);

create table public.delivery_concorrentes_itens (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      text not null,
  leitura_id      uuid not null references public.delivery_concorrentes_leituras(id) on delete cascade,
  concorrente_id  uuid not null references public.delivery_concorrentes(id),
  ordem           int not null check (ordem between 1 and 300),
  tipo            text not null check (tipo in ('prato', 'combo', 'adicional', 'bebida', 'sobremesa', 'outro')),
  categoria       text check (categoria is null or length(categoria) <= 80),
  grupo           text check (grupo is null or length(grupo) <= 80),
  nome            text not null check (length(btrim(nome)) between 1 and 160),
  descricao       text check (descricao is null or length(descricao) <= 600),
  componentes     text[] not null default '{}' check (cardinality(componentes) <= 30),
  peso_g          numeric(10,1) check (peso_g is null or peso_g > 0),
  serve_pessoas   int check (serve_pessoas is null or serve_pessoas between 1 and 50),
  preco           numeric(10,2) not null check (preco >= 0 and preco < 100000),
  preco_original  numeric(10,2) check (preco_original is null or preco_original >= 0)
);
create index delivery_conc_itens_leitura on public.delivery_concorrentes_itens (leitura_id, ordem);

alter table public.delivery_concorrentes enable row level security;
alter table public.delivery_concorrentes_leituras enable row level security;
alter table public.delivery_concorrentes_itens enable row level security;

create policy conc_ler on public.delivery_concorrentes for select to authenticated
  using (public.hefisto_user_can('marmitaria.competitors.view', unidade_id));
create policy conc_leituras_ler on public.delivery_concorrentes_leituras for select to authenticated
  using (public.hefisto_user_can('marmitaria.competitors.view', unidade_id));
create policy conc_itens_ler on public.delivery_concorrentes_itens for select to authenticated
  using (public.hefisto_user_can('marmitaria.competitors.view', unidade_id));

revoke all on public.delivery_concorrentes, public.delivery_concorrentes_leituras, public.delivery_concorrentes_itens from anon, authenticated;
grant select on public.delivery_concorrentes, public.delivery_concorrentes_leituras, public.delivery_concorrentes_itens to authenticated;

create function public.hefisto_salvar_leitura_concorrente(p_unidade text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text := left(btrim(regexp_replace(coalesce(p_dados->>'concorrente', ''), '\s+', ' ', 'g')), 120);
  v_plat text := lower(coalesce(nullif(btrim(p_dados->>'plataforma'), ''), 'ifood'));
  v_fonte text := coalesce(nullif(p_dados->>'fonte', ''), 'manual');
  v_chave text := nullif(btrim(coalesce(p_dados->>'chave', '')), '');
  v_data date;
  v_link text := nullif(btrim(coalesce(p_dados->>'link', '')), '');
  v_conc uuid;
  v_leitura uuid;
  v_existente record;
  v_i jsonb;
  v_ordem int := 0;
  v_tipo text;
  v_preco numeric;
  v_orig numeric;
  v_peso numeric;
  v_serve int;
  v_comp text[];
  v_nome_item text;
  v_num text := '^[0-9]+(\.[0-9]+)?$';
begin
  if auth.uid() is null or not public.hefisto_user_can('marmitaria.competitors.create', p_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão para guardar cardápio de concorrente nesta unidade.');
  end if;
  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o nome do concorrente.');
  end if;
  if v_plat not in ('ifood', '99food', 'rappi', 'aiqfome', 'keeta', 'whatsapp', 'site', 'outro') then v_plat := 'outro'; end if;
  if v_fonte not in ('foto', 'texto', 'manual') then v_fonte := 'manual'; end if;
  if v_chave is not null and (length(v_chave) < 8 or length(v_chave) > 80) then v_chave := null; end if;
  if v_link is not null and (v_link !~ '^https://' or length(v_link) > 500) then v_link := null; end if;
  if (p_dados->>'observado_em') ~ '^\d{4}-\d{2}-\d{2}$' then v_data := (p_dados->>'observado_em')::date; end if;
  if v_data is null or v_data > current_date + 1 or v_data < current_date - 400 then v_data := current_date; end if;
  if jsonb_typeof(p_dados->'itens') is distinct from 'array' or jsonb_array_length(p_dados->'itens') = 0 then
    return jsonb_build_object('ok', false, 'erro', 'O cardápio precisa ter pelo menos um item com preço.');
  end if;
  if jsonb_array_length(p_dados->'itens') > 300 then
    return jsonb_build_object('ok', false, 'erro', 'Cardápio grande demais (máximo 300 itens por leitura).');
  end if;

  -- envio repetido (clique duplo, rede caiu): devolve o que já foi gravado
  if v_chave is not null then
    select id, concorrente_id, qtd_itens into v_existente from public.delivery_concorrentes_leituras
     where unidade_id = p_unidade and chave = v_chave;
    if v_existente.id is not null then
      return jsonb_build_object('ok', true, 'idempotente', true, 'leitura_id', v_existente.id,
                                'concorrente_id', v_existente.concorrente_id, 'itens', v_existente.qtd_itens);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('conc:' || p_unidade || ':' || lower(v_nome) || ':' || v_plat));
  select id into v_conc from public.delivery_concorrentes
   where unidade_id = p_unidade and lower(btrim(nome)) = lower(v_nome) and plataforma = v_plat;
  if v_conc is null then
    insert into public.delivery_concorrentes (unidade_id, nome, plataforma, segmento, bairro, link, criado_por)
    values (p_unidade, v_nome, v_plat, left(nullif(btrim(p_dados->>'segmento'), ''), 60), left(nullif(btrim(p_dados->>'bairro'), ''), 80), v_link, auth.uid())
    returning id into v_conc;
  else
    update public.delivery_concorrentes
       set segmento = coalesce(left(nullif(btrim(p_dados->>'segmento'), ''), 60), segmento),
           bairro = coalesce(left(nullif(btrim(p_dados->>'bairro'), ''), 80), bairro),
           link = coalesce(v_link, link), updated_at = now()
     where id = v_conc;
  end if;

  insert into public.delivery_concorrentes_leituras (unidade_id, concorrente_id, observado_em, fonte, taxa_entrega, pedido_minimo,
       tempo_entrega, avaliacao, observacao, chave, criado_por)
  values (p_unidade, v_conc, v_data, v_fonte,
       case when (p_dados->>'taxa_entrega') ~ v_num and (p_dados->>'taxa_entrega')::numeric < 1000 then (p_dados->>'taxa_entrega')::numeric end,
       case when (p_dados->>'pedido_minimo') ~ v_num and (p_dados->>'pedido_minimo')::numeric < 10000 then (p_dados->>'pedido_minimo')::numeric end,
       left(nullif(btrim(p_dados->>'tempo_entrega'), ''), 40),
       case when (p_dados->>'avaliacao') ~ v_num and (p_dados->>'avaliacao')::numeric <= 5 then (p_dados->>'avaliacao')::numeric end,
       left(nullif(btrim(p_dados->>'observacao'), ''), 500), v_chave, auth.uid())
  returning id into v_leitura;

  for v_i in select * from jsonb_array_elements(p_dados->'itens') loop
    v_nome_item := left(btrim(coalesce(v_i->>'nome', '')), 160);
    -- item sem nome ou sem preço lido não entra: o Héfisto não inventa preço
    continue when v_nome_item = '' or coalesce(v_i->>'preco', '') !~ v_num;
    v_preco := (v_i->>'preco')::numeric;
    continue when v_preco >= 100000;
    v_ordem := v_ordem + 1;
    v_tipo := coalesce(v_i->>'tipo', 'prato');
    if v_tipo not in ('prato', 'combo', 'adicional', 'bebida', 'sobremesa', 'outro') then v_tipo := 'outro'; end if;
    v_orig := case when (v_i->>'preco_original') ~ v_num and (v_i->>'preco_original')::numeric > v_preco then (v_i->>'preco_original')::numeric end;
    v_peso := case when (v_i->>'peso_g') ~ v_num and (v_i->>'peso_g')::numeric between 1 and 20000 then (v_i->>'peso_g')::numeric end;
    v_serve := case when (v_i->>'serve_pessoas') ~ '^[0-9]{1,2}$' and (v_i->>'serve_pessoas')::int between 1 and 50 then (v_i->>'serve_pessoas')::int end;
    v_comp := '{}';
    if jsonb_typeof(v_i->'componentes') = 'array' then
      select coalesce(array_agg(left(btrim(c), 80) order by n), '{}') into v_comp
        from jsonb_array_elements_text(v_i->'componentes') with ordinality as x(c, n)
       where btrim(c) <> '' and n <= 30;
    end if;
    insert into public.delivery_concorrentes_itens (unidade_id, leitura_id, concorrente_id, ordem, tipo, categoria, grupo, nome,
         descricao, componentes, peso_g, serve_pessoas, preco, preco_original)
    values (p_unidade, v_leitura, v_conc, v_ordem, v_tipo, left(nullif(btrim(v_i->>'categoria'), ''), 80),
         left(nullif(btrim(v_i->>'grupo'), ''), 80), v_nome_item, left(nullif(btrim(v_i->>'descricao'), ''), 600),
         v_comp, v_peso, v_serve, round(v_preco, 2), round(v_orig, 2));
    exit when v_ordem >= 300;
  end loop;

  if v_ordem = 0 then
    raise exception 'Nenhum item com nome e preço: nada foi guardado.' using errcode = '22023';
  end if;
  update public.delivery_concorrentes_leituras set qtd_itens = v_ordem where id = v_leitura;
  return jsonb_build_object('ok', true, 'idempotente', false, 'leitura_id', v_leitura, 'concorrente_id', v_conc, 'itens', v_ordem);
end $$;

create function public.hefisto_apagar_leitura_concorrente(p_leitura uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.delivery_concorrentes_leituras where id = p_leitura;
  if v_unidade is null or auth.uid() is null or not public.hefisto_user_can('marmitaria.competitors.delete', v_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Leitura não encontrada.');
  end if;
  delete from public.delivery_concorrentes_leituras where id = p_leitura;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.hefisto_salvar_leitura_concorrente(text, jsonb) from public, anon;
revoke all on function public.hefisto_apagar_leitura_concorrente(uuid) from public, anon;
grant execute on function public.hefisto_salvar_leitura_concorrente(text, jsonb) to authenticated;
grant execute on function public.hefisto_apagar_leitura_concorrente(uuid) to authenticated;

select md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' order by table_name, ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name in ('delivery_concorrentes', 'delivery_concorrentes_leituras', 'delivery_concorrentes_itens');

commit;
