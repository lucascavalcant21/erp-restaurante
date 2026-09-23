/* ETIQUETA RASTREÁVEL — saldo por recipiente, linhagem, eventos e operações
   atômicas. ADITIVO: nenhuma tabela é criada em duplicidade, nenhum estoque
   novo é inventado, nada é apagado.

   O QUE JÁ EXISTIA E CONTINUA MANDANDO
   - multi-estoque: estoques / estoque_itens / estoque_lotes (FEFO em SQL)
   - movimentos: estoque_movimentacoes_multi, via
     registrar_movimento_estoque_lote() — que já trava a linha do item
     (FOR UPDATE), recusa saldo insuficiente e recalcula o item pelos lotes
   - produção: producao_diaria, que JÁ lança a entrada no estoque de
     pré-preparo. Etiqueta de produção por isso NÃO gera entrada nova.
   - perda: continua saindo pelo mesmo caminho; o lançamento financeiro segue
     onde está hoje (app/lib/etiquetas.js) e NÃO foi duplicado aqui.
   - estoque_atual (camada legada do CMV/vendas/fichas): NÃO é tocado por
     nenhuma função deste arquivo.

   O QUE ESTE ARQUIVO ACRESCENTA
   1. saldo e condição física por etiqueta (o recipiente que existe de verdade)
   2. linhagem N→1 e 1→N em etiqueta_relacoes
   3. etiqueta_eventos: timeline, responsável e chave de idempotência
   4. ligação estruturada movimento ↔ etiqueta (fim do parsing de observação)
   5. RPCs transacionais: entrada, vincular produção, abrir, usar, perda,
      fracionar, novo ciclo, reimprimir
   6. get_etiqueta_publica(): o QR passa a ler só o que é público

   DATA DE CORTE
   etiquetas.rastreavel nasce FALSE. Só o que for criado/operado pelo fluxo
   novo vira rastreável. Etiqueta e saldo antigos continuam como estão, sem
   backfill inventado e sem constraint global — a reconciliação é fase própria.

   Idempotente. Nenhum DROP, nenhum DELETE, nenhum UPDATE de saldo existente.
*/

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 0 — PREFLIGHT
   ═══════════════════════════════════════════════════════════════════════════ */
do $$
declare
  faltando text;
begin
  foreach faltando in array array['etiquetas','estoques','estoque_itens','estoque_lotes','estoque_movimentacoes_multi','insumos'] loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=faltando) then
      raise exception 'PREFLIGHT: falta a tabela public.% — este arquivo é aditivo sobre o ERP existente.', faltando;
    end if;
  end loop;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='registrar_movimento_estoque_lote'
  ) then
    raise exception 'PREFLIGHT: registrar_movimento_estoque_lote() não existe. Rode db/migracao_estoque_lotes.sql antes.';
  end if;

  /* Colunas de etiquetas em que o novo fluxo se apoia. */
  foreach faltando in array array['id','codigo','produto','quantidade','unidade','status','unidade_id'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='etiquetas' and column_name=faltando
    ) then
      raise exception 'PREFLIGHT: public.etiquetas.% não existe.', faltando;
    end if;
  end loop;
end $$;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 — A ETIQUETA PASSA A TER SALDO, CONDIÇÃO E ORIGEM

   Por que `condicao_estoque` e não reaproveitar `status`: status é o ciclo de
   vida do registro (ativa/baixa/perda) e é lido por telas e pelo financeiro.
   A condição física — se aquilo está lacrado, aberto ou foi manipulado — é
   outra pergunta, e precisa sobreviver ao fim do saldo: uma etiqueta com
   status 'baixa' continua tendo sido de um recipiente ABERTO, e o histórico
   precisa dizer isso.
   ═══════════════════════════════════════════════════════════════════════════ */
alter table public.etiquetas add column if not exists insumo_id uuid;
alter table public.etiquetas add column if not exists estoque_id uuid;
alter table public.etiquetas add column if not exists saldo numeric(14,3);
alter table public.etiquetas add column if not exists saldo_unidade text;
alter table public.etiquetas add column if not exists condicao_estoque text;
alter table public.etiquetas add column if not exists producao_id uuid;
alter table public.etiquetas add column if not exists rastreavel boolean not null default false;
alter table public.etiquetas add column if not exists validade_original_em timestamptz;
alter table public.etiquetas add column if not exists aberta_em timestamptz;
alter table public.etiquetas add column if not exists regra_validade text;
alter table public.etiquetas add column if not exists encerrada_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'etiquetas_condicao_estoque_chk') then
    alter table public.etiquetas add constraint etiquetas_condicao_estoque_chk
      check (condicao_estoque is null or condicao_estoque in ('fechado','aberto','manipulado'));
  end if;
  /* Saldo negativo nunca, em hipótese alguma. */
  if not exists (select 1 from pg_constraint where conname = 'etiquetas_saldo_chk') then
    alter table public.etiquetas add constraint etiquetas_saldo_chk
      check (saldo is null or saldo >= 0);
  end if;
end $$;

create index if not exists etiquetas_rastreavel_idx
  on public.etiquetas (unidade_id, rastreavel, condicao_estoque) where rastreavel;
create index if not exists etiquetas_insumo_idx
  on public.etiquetas (unidade_id, insumo_id) where rastreavel;

/* Ligação estruturada movimento ↔ etiqueta: a rastreabilidade deixa de
   depender de ler texto na observação. */
alter table public.estoque_movimentacoes_multi add column if not exists etiqueta_id uuid;
create index if not exists movimentacoes_multi_etiqueta_idx
  on public.estoque_movimentacoes_multi (etiqueta_id) where etiqueta_id is not null;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 — LINHAGEM (1→1, 1→N e N→1)
   Uma tabela de relações em vez de etiqueta_pai_id: transformação pode ter
   várias origens (tomate + cebola + creme → molho) e fracionamento tem várias
   destinos. Uma coluna só não daria conta.
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.etiqueta_relacoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  etiqueta_origem_id uuid not null references public.etiquetas(id) on delete cascade,
  etiqueta_destino_id uuid not null references public.etiquetas(id) on delete cascade,
  tipo_relacao text not null check (tipo_relacao in ('abertura','fracionamento','novo_ciclo','transformacao','producao')),
  quantidade_utilizada numeric(14,3),
  unidade_medida text,
  created_at timestamptz not null default now()
);
create index if not exists etiqueta_relacoes_origem_idx on public.etiqueta_relacoes (etiqueta_origem_id);
create index if not exists etiqueta_relacoes_destino_idx on public.etiqueta_relacoes (etiqueta_destino_id);

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 — EVENTOS (timeline, responsabilidade e idempotência)
   O que é consultado com frequência é coluna; metadata é só para o que varia
   de verdade entre um tipo de evento e outro.
   ═══════════════════════════════════════════════════════════════════════════ */
create table if not exists public.etiqueta_eventos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  tipo text not null check (tipo in (
    'criada','impressa','reimpressa','recebida','vinculada_producao',
    'aberta','uso','perda','fracionada','produzida','novo_ciclo','transformada','encerrada'
  )),
  quantidade numeric(14,3),
  unidade_medida text,
  usuario_id uuid,
  responsavel text,
  movimento_id uuid,
  etiqueta_relacionada_id uuid references public.etiquetas(id) on delete set null,
  observacao text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create index if not exists etiqueta_eventos_etiqueta_idx on public.etiqueta_eventos (etiqueta_id, created_at desc);
create index if not exists etiqueta_eventos_unidade_idx on public.etiqueta_eventos (unidade_id, tipo, created_at desc);
/* Retry de rede não pode virar movimento dobrado. */
create unique index if not exists etiqueta_eventos_idempotencia
  on public.etiqueta_eventos (idempotency_key) where idempotency_key is not null;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 — AUXILIARES INTERNOS
   ═══════════════════════════════════════════════════════════════════════════ */

/* Carrega a etiqueta COM TRAVA. É esta trava que impede dois tablets usarem o
   mesmo recipiente ao mesmo tempo: o segundo espera e enxerga o saldo já
   atualizado. */
create or replace function public.etiqueta__travar(p_etiqueta_id uuid)
returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
begin
  select * into v from public.etiquetas where id = p_etiqueta_id for update;
  if not found then
    /* Também é o que protege o tenant: RLS esconde a etiqueta de outra
       empresa, e aqui ela simplesmente não existe. */
    raise exception 'Etiqueta não encontrada nesta unidade';
  end if;
  return v;
end $$;

/* Já processamos esta requisição? Devolve o evento anterior, se houver. */
create or replace function public.etiqueta__evento_repetido(p_chave text)
returns public.etiqueta_eventos
language sql
security invoker
stable
set search_path = public
as $$
  select * from public.etiqueta_eventos
   where p_chave is not null and idempotency_key = p_chave
   limit 1
$$;

/* Movimenta o estoque pela função que já existe e devolve o id do movimento,
   para o evento apontar para ele. Estamos dentro da transação e segurando a
   trava do item, então o movimento mais recente daquele par é o nosso. */
create or replace function public.etiqueta__mover(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid,
  p_tipo text, p_quantidade numeric, p_validade date,
  p_usuario_id uuid, p_usuario_nome text, p_observacao text, p_etiqueta_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mov uuid;
begin
  perform public.registrar_movimento_estoque_lote(
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
    p_validade, p_usuario_id, p_usuario_nome, p_observacao, now()
  );

  select id into v_mov
    from public.estoque_movimentacoes_multi
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id
   order by data_movimento desc, created_at desc nulls last
   limit 1;

  if v_mov is not null then
    update public.estoque_movimentacoes_multi
       set etiqueta_id = p_etiqueta_id
     where id = v_mov and etiqueta_id is null;
  end if;

  return v_mov;
end $$;

create or replace function public.etiqueta__evento(
  p_etiqueta public.etiquetas, p_tipo text, p_quantidade numeric,
  p_usuario_id uuid, p_responsavel text, p_movimento_id uuid,
  p_relacionada uuid, p_observacao text, p_metadata jsonb, p_chave text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.etiqueta_eventos (
    unidade_id, etiqueta_id, tipo, quantidade, unidade_medida, usuario_id,
    responsavel, movimento_id, etiqueta_relacionada_id, observacao, metadata, idempotency_key
  ) values (
    p_etiqueta.unidade_id, p_etiqueta.id, p_tipo, p_quantidade,
    coalesce(p_etiqueta.saldo_unidade, p_etiqueta.unidade), p_usuario_id,
    p_responsavel, p_movimento_id, p_relacionada, p_observacao,
    coalesce(p_metadata, '{}'::jsonb), p_chave
  ) returning id into v_id;
  return v_id;
end $$;

/* Onde mora o saldo desta etiqueta: lacrado fica no estoque do setor, aberto/
   manipulado fica no de pré-preparos — a mesma regra que o app já usa. */
create or replace function public.etiqueta__estoque_da_condicao(
  p_unidade_id text, p_departamento text, p_condicao text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dept text := case when lower(coalesce(p_departamento,'cozinha')) like '%bar%' then 'bar' else 'cozinha' end;
  v_slug text := case when coalesce(p_condicao,'aberto') = 'fechado' then v_dept else 'pre-preparos-' || v_dept end;
  v_id uuid;
begin
  select id into v_id from public.estoques
   where unidade_id = p_unidade_id and slug = v_slug
   limit 1;
  if v_id is null then
    raise exception 'Estoque "%" não existe nesta unidade', v_slug;
  end if;
  return v_id;
end $$;

/* Cria a etiqueta filha copiando o que identifica o produto. Não movimenta
   nada: quem movimenta é quem chamou. */
create or replace function public.etiqueta__nova_filha(
  p_mae public.etiquetas, p_saldo numeric, p_condicao text, p_estoque_id uuid,
  p_validade timestamptz, p_regra text, p_responsavel text
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
begin
  insert into public.etiquetas (
    unidade_id, codigo, produto, conservacao, quantidade, unidade, validade_dias,
    manipulacao_em, validade_em, lote, responsavel, custo_unit, status, copias,
    tipo_etiqueta, insumo_id, estoque_id, saldo, saldo_unidade, condicao_estoque,
    producao_id, rastreavel, validade_original_em, aberta_em, regra_validade
  ) values (
    p_mae.unidade_id,
    upper(substr(md5(gen_random_uuid()::text), 1, 8)),
    p_mae.produto, p_mae.conservacao, p_saldo, coalesce(p_mae.saldo_unidade, p_mae.unidade),
    p_mae.validade_dias, now(), p_validade, p_mae.lote,
    coalesce(p_responsavel, p_mae.responsavel), p_mae.custo_unit, 'ativa', 1,
    case when p_condicao = 'fechado' then 'fechado' else 'aberto' end,
    p_mae.insumo_id, p_estoque_id, p_saldo, coalesce(p_mae.saldo_unidade, p_mae.unidade),
    p_condicao, p_mae.producao_id, true,
    coalesce(p_mae.validade_original_em, p_mae.validade_em),
    case when p_condicao = 'fechado' then null else now() end,
    p_regra
  ) returning * into v;
  return v;
end $$;

create or replace function public.etiqueta__encerrar(p_etiqueta public.etiquetas, p_status text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.etiquetas
     set saldo = 0,
         status = coalesce(p_status, status),
         encerrada_em = now()
   where id = p_etiqueta.id
$$;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 5 — OPERAÇÕES

   Todas: uma transação só (a função inteira roda numa), trava a etiqueta,
   validam saldo, escrevem evento e devolvem a etiqueta resultante.
   Todas aceitam p_idempotency_key: requisição repetida por timeout devolve o
   mesmo resultado em vez de movimentar de novo.
   ═══════════════════════════════════════════════════════════════════════════ */

/* A) RECEBIMENTO: a etiqueta declara que aquilo chegou e entra no estoque.
      É a única operação que cria entrada a partir de etiqueta. */
create or replace function public.etiqueta_registrar_entrada(
  p_etiqueta_id uuid,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_estoque uuid;
  v_mov uuid;
  v_qtd numeric;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = v_repetido.etiqueta_id;
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if v.rastreavel and v.saldo is not null then
    raise exception 'Esta etiqueta já deu entrada no estoque';
  end if;
  if v.insumo_id is null then
    raise exception 'Etiqueta sem produto vinculado (insumo_id)';
  end if;

  v_qtd := coalesce(v.saldo, v.quantidade, 0) * greatest(1, coalesce(v.copias, 1));
  if v_qtd <= 0 then
    raise exception 'Etiqueta sem quantidade para dar entrada';
  end if;

  v_estoque := coalesce(v.estoque_id, public.etiqueta__estoque_da_condicao(
    v.unidade_id, v.departamento, coalesce(v.condicao_estoque, v.tipo_etiqueta, 'fechado')));

  v_mov := public.etiqueta__mover(
    v.unidade_id, v_estoque, v.insumo_id, 'entrada', v_qtd,
    nullif(left(v.validade_em::text, 10), '')::date,
    p_usuario_id, coalesce(p_responsavel, v.responsavel), 'Recebimento etiquetado', v.id
  );

  update public.etiquetas
     set saldo = v_qtd,
         saldo_unidade = coalesce(saldo_unidade, unidade),
         estoque_id = v_estoque,
         condicao_estoque = coalesce(condicao_estoque, case when tipo_etiqueta = 'fechado' then 'fechado' else 'aberto' end),
         validade_original_em = coalesce(validade_original_em, validade_em),
         rastreavel = true,
         status = case when status = 'salva' then 'ativa' else status end
   where id = v.id
  returning * into v;

  perform public.etiqueta__evento(v, 'recebida', v_qtd, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov, null, 'Entrada por etiqueta', '{}'::jsonb, p_idempotency_key);
  return v;
end $$;

/* B) PRODUÇÃO: a produção JÁ lançou o estoque. A etiqueta só recebe a parte
      dela do que foi produzido. Nenhum movimento é criado aqui — é isto que
      impede 6 kg virarem 18 kg. */
create or replace function public.etiqueta_vincular_producao(
  p_etiqueta_id uuid,
  p_producao_id uuid,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_produzido numeric;
  v_ja_atribuido numeric;
  v_qtd numeric;
  v_estoque uuid;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = v_repetido.etiqueta_id;
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  v_qtd := coalesce(v.saldo, v.quantidade, 0);
  if v_qtd <= 0 then
    raise exception 'Etiqueta sem quantidade para vincular à produção';
  end if;

  select quantidade into v_produzido from public.producao_diaria where id = p_producao_id;
  if v_produzido is null then
    raise exception 'Produção não encontrada';
  end if;

  /* Trava lógica: a soma das etiquetas não pode passar do que foi produzido. */
  select coalesce(sum(coalesce(saldo, quantidade, 0)), 0) into v_ja_atribuido
    from public.etiquetas
   where producao_id = p_producao_id and id <> v.id and rastreavel;

  if v_ja_atribuido + v_qtd > v_produzido + 0.0001 then
    raise exception 'As etiquetas somam % e a produção foi de % — não dá para etiquetar mais do que foi produzido',
      v_ja_atribuido + v_qtd, v_produzido;
  end if;

  v_estoque := coalesce(v.estoque_id,
    public.etiqueta__estoque_da_condicao(v.unidade_id, v.departamento, 'manipulado'));

  update public.etiquetas
     set producao_id = p_producao_id,
         saldo = v_qtd,
         saldo_unidade = coalesce(saldo_unidade, unidade),
         estoque_id = v_estoque,
         condicao_estoque = 'manipulado',
         validade_original_em = coalesce(validade_original_em, validade_em),
         rastreavel = true,
         status = case when status = 'salva' then 'ativa' else status end
   where id = v.id
  returning * into v;

  perform public.etiqueta__evento(v, 'produzida', v_qtd, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, null,
    'Etiqueta de produção já lançada no estoque (sem nova entrada)',
    jsonb_build_object('producao_id', p_producao_id), p_idempotency_key);
  return v;
end $$;

/* C) ABRIR: sai do estoque fechado, o que foi usado vira consumo e o resto
      entra no estoque de manipulados como etiqueta nova. */
create or replace function public.etiqueta_abrir(
  p_etiqueta_id uuid,
  p_quantidade_usada numeric default 0,
  p_validade_em timestamptz default null,
  p_regra_validade text default null,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_filha public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_saldo numeric;
  v_resto numeric;
  v_estoque_aberto uuid;
  v_mov_saida uuid;
  v_mov_entrada uuid;
  v_rel uuid;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = coalesce(v_repetido.etiqueta_relacionada_id, v_repetido.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if coalesce(v.condicao_estoque, 'fechado') <> 'fechado' then
    raise exception 'Esta etiqueta não está fechada';
  end if;
  if not v.rastreavel or v.saldo is null then
    raise exception 'Etiqueta ainda não rastreável: registre a entrada antes de abrir';
  end if;

  v_saldo := v.saldo;
  if p_quantidade_usada < 0 or p_quantidade_usada > v_saldo + 0.0001 then
    raise exception 'Uso de % é maior que o saldo de %', p_quantidade_usada, v_saldo;
  end if;
  v_resto := round(v_saldo - coalesce(p_quantidade_usada, 0), 3);

  /* 1. o lacrado sai inteiro do estoque do setor */
  v_mov_saida := public.etiqueta__mover(
    v.unidade_id, v.estoque_id, v.insumo_id, 'saida', v_saldo, null,
    p_usuario_id, coalesce(p_responsavel, v.responsavel), 'Abertura de produto lacrado', v.id
  );
  perform public.etiqueta__encerrar(v, 'baixa');
  perform public.etiqueta__evento(v, 'aberta', v_saldo, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov_saida, null, 'Produto aberto', '{}'::jsonb, p_idempotency_key);

  if coalesce(p_quantidade_usada, 0) > 0 then
    perform public.etiqueta__evento(v, 'uso', p_quantidade_usada, p_usuario_id,
      coalesce(p_responsavel, v.responsavel), v_mov_saida, null,
      'Consumido na abertura', '{}'::jsonb, null);
  end if;

  if v_resto <= 0 then
    /* Usou tudo: não nasce etiqueta aberta. */
    return v;
  end if;

  /* 2. o resto entra nos manipulados, com etiqueta nova */
  v_estoque_aberto := public.etiqueta__estoque_da_condicao(v.unidade_id, v.departamento, 'aberto');
  v_filha := public.etiqueta__nova_filha(
    v, v_resto, 'aberto', v_estoque_aberto,
    coalesce(p_validade_em, v.validade_em), coalesce(p_regra_validade, 'validade após abertura'),
    coalesce(p_responsavel, v.responsavel)
  );

  v_mov_entrada := public.etiqueta__mover(
    v.unidade_id, v_estoque_aberto, v.insumo_id, 'entrada', v_resto,
    nullif(left(coalesce(p_validade_em, v.validade_em)::text, 10), '')::date,
    p_usuario_id, coalesce(p_responsavel, v.responsavel), 'Saldo aberto após abertura', v_filha.id
  );

  insert into public.etiqueta_relacoes (unidade_id, etiqueta_origem_id, etiqueta_destino_id, tipo_relacao, quantidade_utilizada, unidade_medida)
  values (v.unidade_id, v.id, v_filha.id, 'abertura', v_resto, coalesce(v.saldo_unidade, v.unidade))
  returning id into v_rel;

  perform public.etiqueta__evento(v_filha, 'criada', v_resto, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov_entrada, v.id,
    'Nasceu da abertura da etiqueta ' || v.codigo, jsonb_build_object('relacao_id', v_rel), null);

  return v_filha;
end $$;

/* D) USAR: consumo normal de um recipiente aberto. */
create or replace function public.etiqueta_usar(
  p_etiqueta_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_observacao text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_mov uuid;
  v_novo numeric;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = v_repetido.etiqueta_id;
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if not v.rastreavel or v.saldo is null then
    raise exception 'Etiqueta sem saldo rastreável';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe quanto foi usado';
  end if;
  if p_quantidade > v.saldo + 0.0001 then
    raise exception 'Uso de % é maior que o saldo de %', p_quantidade, v.saldo;
  end if;

  v_mov := public.etiqueta__mover(
    v.unidade_id, v.estoque_id, v.insumo_id, 'saida', p_quantidade, null,
    p_usuario_id, coalesce(p_responsavel, v.responsavel),
    coalesce(p_observacao, 'Consumo'), v.id
  );

  v_novo := round(v.saldo - p_quantidade, 3);
  update public.etiquetas
     set saldo = v_novo,
         status = case when v_novo <= 0 then 'baixa' else status end,
         encerrada_em = case when v_novo <= 0 then now() else encerrada_em end
   where id = v.id
  returning * into v;

  perform public.etiqueta__evento(v, 'uso', p_quantidade, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov, null, p_observacao, '{}'::jsonb, p_idempotency_key);
  if v_novo <= 0 then
    perform public.etiqueta__evento(v, 'encerrada', 0, p_usuario_id,
      coalesce(p_responsavel, v.responsavel), null, null, 'Saldo zerado', '{}'::jsonb, null);
  end if;
  return v;
end $$;

/* E) PERDA: mesma mecânica do uso, com tipo próprio. O lançamento financeiro
      continua onde sempre esteve (app/lib/etiquetas.js) — não é duplicado
      aqui, de propósito. */
create or replace function public.etiqueta_perda(
  p_etiqueta_id uuid,
  p_quantidade numeric,
  p_motivo text default null,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_mov uuid;
  v_novo numeric;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = v_repetido.etiqueta_id;
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if not v.rastreavel or v.saldo is null then
    raise exception 'Etiqueta sem saldo rastreável';
  end if;
  if p_quantidade is null or p_quantidade <= 0 or p_quantidade > v.saldo + 0.0001 then
    raise exception 'Quantidade de perda inválida para o saldo de %', v.saldo;
  end if;

  v_mov := public.etiqueta__mover(
    v.unidade_id, v.estoque_id, v.insumo_id, 'saida', p_quantidade, null,
    p_usuario_id, coalesce(p_responsavel, v.responsavel),
    'Perda' || coalesce(' — ' || p_motivo, ''), v.id
  );

  v_novo := round(v.saldo - p_quantidade, 3);
  update public.etiquetas
     set saldo = v_novo,
         status = case when v_novo <= 0 then 'perda' else status end,
         encerrada_em = case when v_novo <= 0 then now() else encerrada_em end
   where id = v.id
  returning * into v;

  perform public.etiqueta__evento(v, 'perda', p_quantidade, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov, null, p_motivo,
    jsonb_build_object('motivo', p_motivo), p_idempotency_key);
  return v;
end $$;

/* F) FRACIONAR: o conteúdo muda de recipiente e continua no mesmo estoque.
      Movimento líquido ZERO — não se inventa saída+entrada para não poluir o
      relatório de consumo com algo que ninguém consumiu. */
create or replace function public.etiqueta_fracionar(
  p_etiqueta_id uuid,
  p_partes numeric[],
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns setof public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_filha public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_soma numeric := 0;
  v_parte numeric;
  v_rel uuid;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    return query
      select e.* from public.etiquetas e
       join public.etiqueta_relacoes r on r.etiqueta_destino_id = e.id
      where r.etiqueta_origem_id = v_repetido.etiqueta_id and r.tipo_relacao = 'fracionamento';
    return;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if not v.rastreavel or v.saldo is null then
    raise exception 'Etiqueta sem saldo rastreável';
  end if;

  foreach v_parte in array p_partes loop
    if v_parte is null or v_parte <= 0 then
      raise exception 'Parte inválida no fracionamento';
    end if;
    v_soma := v_soma + v_parte;
  end loop;

  if v_soma > v.saldo + 0.0001 then
    raise exception 'As partes somam % e o saldo é %', v_soma, v.saldo;
  end if;

  foreach v_parte in array p_partes loop
    v_filha := public.etiqueta__nova_filha(
      v, v_parte, coalesce(v.condicao_estoque, 'aberto'), v.estoque_id,
      v.validade_em, coalesce(v.regra_validade, 'herdada do fracionamento'),
      coalesce(p_responsavel, v.responsavel)
    );
    insert into public.etiqueta_relacoes (unidade_id, etiqueta_origem_id, etiqueta_destino_id, tipo_relacao, quantidade_utilizada, unidade_medida)
    values (v.unidade_id, v.id, v_filha.id, 'fracionamento', v_parte, coalesce(v.saldo_unidade, v.unidade))
    returning id into v_rel;

    perform public.etiqueta__evento(v_filha, 'criada', v_parte, p_usuario_id,
      coalesce(p_responsavel, v.responsavel), null, v.id,
      'Fracionada de ' || v.codigo, jsonb_build_object('relacao_id', v_rel), null);
    return next v_filha;
  end loop;

  update public.etiquetas
     set saldo = round(v.saldo - v_soma, 3),
         status = case when round(v.saldo - v_soma, 3) <= 0 then 'baixa' else status end,
         encerrada_em = case when round(v.saldo - v_soma, 3) <= 0 then now() else encerrada_em end
   where id = v.id
  returning * into v;

  perform public.etiqueta__evento(v, 'fracionada', v_soma, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, null,
    'Dividida em ' || array_length(p_partes, 1) || ' recipientes', '{}'::jsonb, p_idempotency_key);
end $$;

/* G) NOVO CICLO: identidade nova para o mesmo conteúdo físico, com origem
      registrada. Movimento líquido ZERO; a validade nova é explícita e fica
      no evento junto com o motivo e o responsável. */
create or replace function public.etiqueta_novo_ciclo(
  p_etiqueta_id uuid,
  p_validade_em timestamptz,
  p_motivo text,
  p_regra_validade text default null,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_filha public.etiquetas;
  v_repetido public.etiqueta_eventos;
  v_rel uuid;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = coalesce(v_repetido.etiqueta_relacionada_id, v_repetido.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if not v.rastreavel or coalesce(v.saldo, 0) <= 0 then
    raise exception 'Etiqueta sem saldo para iniciar novo ciclo';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'Novo ciclo exige motivo registrado';
  end if;
  if p_validade_em is null then
    raise exception 'Novo ciclo exige a nova validade';
  end if;

  v_filha := public.etiqueta__nova_filha(
    v, v.saldo, coalesce(v.condicao_estoque, 'manipulado'), v.estoque_id,
    p_validade_em, coalesce(p_regra_validade, 'novo ciclo autorizado'),
    coalesce(p_responsavel, v.responsavel)
  );

  insert into public.etiqueta_relacoes (unidade_id, etiqueta_origem_id, etiqueta_destino_id, tipo_relacao, quantidade_utilizada, unidade_medida)
  values (v.unidade_id, v.id, v_filha.id, 'novo_ciclo', v.saldo, coalesce(v.saldo_unidade, v.unidade))
  returning id into v_rel;

  perform public.etiqueta__evento(v, 'novo_ciclo', v.saldo, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, v_filha.id, p_motivo,
    jsonb_build_object('motivo', p_motivo, 'validade_anterior', v.validade_em, 'validade_nova', p_validade_em, 'relacao_id', v_rel),
    p_idempotency_key);

  perform public.etiqueta__encerrar(v, 'baixa');
  return v_filha;
end $$;

/* H) REIMPRIMIR: só papel. Nenhum movimento, nenhum saldo, nenhuma etiqueta
      nova, nenhuma validade alterada. */
create or replace function public.etiqueta_reimprimir(
  p_etiqueta_id uuid,
  p_usuario_id uuid default null,
  p_responsavel text default null,
  p_motivo text default null,
  p_idempotency_key text default null
) returns public.etiquetas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiquetas;
  v_repetido public.etiqueta_eventos;
begin
  v_repetido := public.etiqueta__evento_repetido(p_idempotency_key);
  if v_repetido.id is not null then
    select * into v from public.etiquetas where id = v_repetido.etiqueta_id;
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  perform public.etiqueta__evento(v, 'reimpressa', null, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, null,
    coalesce(p_motivo, 'Segunda via'), '{}'::jsonb, p_idempotency_key);
  return v;
end $$;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 6 — RASTREIO PÚBLICO (QR)
   A tabela etiquetas tem leitura anônima hoje para o QR funcionar sem login.
   Com saldo, custo e linhagem na mesma linha, isso deixaria dado interno
   exposto. Esta função devolve SÓ o que pode ser público.
   A remoção da policy anônima está no 0002, para ser rodada depois que a
   página /rastreio já estiver usando esta função.
   ═══════════════════════════════════════════════════════════════════════════ */
create or replace function public.get_etiqueta_publica(p_codigo text)
returns table (
  codigo text,
  produto text,
  conservacao text,
  quantidade numeric,
  unidade text,
  lote text,
  manipulacao_em timestamptz,
  validade_em timestamptz,
  status text,
  unidade_nome text
)
language sql
security definer
stable
set search_path = public
as $$
  /* Só o que já está impresso no papel que a pessoa tem na mão. Fora daqui
     ficam saldo, custo, linhagem, produção, ids internos e o nome do
     responsável — este último é dado de pessoa, e quem escaneia um QR na rua
     não precisa dele. */
  select e.codigo, e.produto, e.conservacao, e.quantidade, e.unidade, e.lote,
         e.manipulacao_em, e.validade_em,
         case when e.status in ('baixa','perda') then 'encerrada' else 'ativa' end,
         u.nome
    from public.etiquetas e
    left join public.unidades u on u.id = e.unidade_id
   where e.codigo = p_codigo
   limit 1
$$;

revoke all on function public.get_etiqueta_publica(text) from public;
grant execute on function public.get_etiqueta_publica(text) to anon, authenticated, service_role;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 7 — RLS E PERMISSÕES DAS TABELAS NOVAS
   Mesma regra da casa: anon fora, authenticated lê o que é da unidade dele,
   escrita passa pelas funções (que rodam como o usuário e respeitam o RLS
   das tabelas de estoque).
   ═══════════════════════════════════════════════════════════════════════════ */
alter table public.etiqueta_eventos enable row level security;
alter table public.etiqueta_relacoes enable row level security;
revoke all on public.etiqueta_eventos from anon;
revoke all on public.etiqueta_relacoes from anon;
grant select, insert on public.etiqueta_eventos to authenticated;
grant select, insert on public.etiqueta_relacoes to authenticated;
grant all on public.etiqueta_eventos to service_role;
grant all on public.etiqueta_relacoes to service_role;

do $$
begin
  /* Só enxerga evento/relação de etiqueta que ele já pode enxergar. */
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='etiqueta_eventos' and policyname='etiqueta_eventos_da_etiqueta') then
    create policy etiqueta_eventos_da_etiqueta on public.etiqueta_eventos
      for select to authenticated
      using (exists (select 1 from public.etiquetas e where e.id = etiqueta_eventos.etiqueta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='etiqueta_eventos' and policyname='etiqueta_eventos_insere') then
    create policy etiqueta_eventos_insere on public.etiqueta_eventos
      for insert to authenticated
      with check (exists (select 1 from public.etiquetas e where e.id = etiqueta_eventos.etiqueta_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='etiqueta_relacoes' and policyname='etiqueta_relacoes_da_etiqueta') then
    create policy etiqueta_relacoes_da_etiqueta on public.etiqueta_relacoes
      for select to authenticated
      using (exists (select 1 from public.etiquetas e where e.id = etiqueta_relacoes.etiqueta_origem_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='etiqueta_relacoes' and policyname='etiqueta_relacoes_insere') then
    create policy etiqueta_relacoes_insere on public.etiqueta_relacoes
      for insert to authenticated
      with check (exists (select 1 from public.etiquetas e where e.id = etiqueta_relacoes.etiqueta_origem_id));
  end if;
end $$;

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 8 — CONFERÊNCIA (rode depois, separadamente)
   ═══════════════════════════════════════════════════════════════════════════

   Saldo rastreável x saldo do estoque, por produto. A diferença é o que ainda
   NÃO tem etiqueta — não é erro, é histórico a reconciliar.

select i.nome,
       coalesce(sum(e.saldo), 0) as saldo_em_etiquetas,
       it.quantidade_atual       as saldo_do_estoque,
       it.quantidade_atual - coalesce(sum(e.saldo), 0) as nao_rastreado
  from public.estoque_itens it
  join public.insumos i on i.id = it.insumo_id
  left join public.etiquetas e
    on e.insumo_id = it.insumo_id and e.estoque_id = it.estoque_id
   and e.rastreavel and coalesce(e.saldo, 0) > 0
 group by i.nome, it.quantidade_atual
 order by 4 desc;

   ═══════════════════════════════════════════════════════════════════════════ */
