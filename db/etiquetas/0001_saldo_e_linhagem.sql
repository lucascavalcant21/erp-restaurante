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

/* ── IDEMPOTÊNCIA ANTES DE QUALQUER EFEITO COLATERAL ───────────────────────
   A versão anterior perguntava a etiqueta_eventos se a chave já tinha sido
   usada. Funcionava para o retry sequencial, mas o evento só nasce DEPOIS do
   movimento: duas requisições simultâneas passavam as duas pela pergunta,
   movimentavam as duas, e só a segunda quebrava no índice único.

   Agora a chave é RESERVADA numa tabela própria, como primeiro ato da
   operação. INSERT ... ON CONFLICT DO NOTHING bloqueia enquanto a primeira
   requisição não termina; quando ela termina, a segunda vê a reserva e devolve
   o resultado anterior sem tocar em estoque. Se a primeira falhar, a reserva
   volta atrás junto com ela e o retry pode seguir. */
create table if not exists public.etiqueta_operacoes (
  chave text primary key,
  operacao text not null,
  etiqueta_id uuid,
  resultado_etiqueta_id uuid,
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists etiqueta_operacoes_etiqueta_idx on public.etiqueta_operacoes (etiqueta_id);

/* Devolve a linha ANTERIOR quando a chave já foi usada; devolve nulo quando
   acabou de reservar (ou quando não há chave — chamada sem idempotência). */
create or replace function public.etiqueta__reservar(
  p_chave text, p_operacao text, p_etiqueta_id uuid
) returns public.etiqueta_operacoes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.etiqueta_operacoes;
begin
  if p_chave is null or p_chave = '' then return null; end if;

  insert into public.etiqueta_operacoes (chave, operacao, etiqueta_id)
  values (p_chave, p_operacao, p_etiqueta_id)
  on conflict (chave) do nothing;

  if found then return null; end if;

  select * into v from public.etiqueta_operacoes where chave = p_chave;
  if v.operacao is distinct from p_operacao then
    raise exception 'Chave de idempotência % já foi usada pela operação "%"', p_chave, v.operacao;
  end if;
  return v;
end $$;

create or replace function public.etiqueta__concluir(p_chave text, p_resultado uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.etiqueta_operacoes
     set resultado_etiqueta_id = p_resultado, concluida_em = now()
   where p_chave is not null and chave = p_chave
$$;

/* ── UNIDADES ──────────────────────────────────────────────────────────────
   Espelha app/lib/ingredientes-utils.mjs: massa tem base kg, volume tem base
   L, e contagem não converte. kg <-> L, g <-> ml e un <-> kg NÃO convertem:
   não existe fator cadastrado para isso e inventar um corromperia o estoque.
   Converter errado é pior do que recusar. */
create or replace function public.etiqueta__familia_unidade(p_unidade text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_unidade, '')))
    when 'g' then 'massa' when 'kg' then 'massa'
    when 'ml' then 'volume' when 'l' then 'volume' when 'lt' then 'volume'
    else 'contagem' end
$$;

create or replace function public.etiqueta__converter(
  p_valor numeric, p_de text, p_para text
) returns numeric
language plpgsql
immutable
as $$
declare
  v_de text := lower(btrim(coalesce(p_de, '')));
  v_para text := lower(btrim(coalesce(p_para, '')));
  v_fam_de text := public.etiqueta__familia_unidade(v_de);
  v_fam_para text := public.etiqueta__familia_unidade(v_para);
begin
  if v_de = v_para or v_de = '' or v_para = '' then return p_valor; end if;

  if v_fam_de <> v_fam_para or v_fam_de = 'contagem' then
    raise exception 'Não há conversão de "%" para "%": unidades de famílias diferentes precisam de fator cadastrado', p_de, p_para;
  end if;

  if v_fam_de = 'massa' then
    return case when v_de = 'g' then p_valor / 1000 else p_valor end
         * case when v_para = 'g' then 1000 else 1 end;
  end if;
  /* volume */
  return case when v_de = 'ml' then p_valor / 1000 else p_valor end
       * case when v_para = 'ml' then 1000 else 1 end;
end $$;

/* Unidade em que o estoque daquele insumo é contado. É a unidade cadastrada no
   insumo, sem normalização: nada no caminho do estoque converte, então é ela
   que manda. */
create or replace function public.etiqueta__unidade_do_insumo(p_insumo_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(nullif(btrim(unidade_medida), ''), 'un')
    from public.insumos where id = p_insumo_id
$$;

/* ── Movimento de estoque que DEVOLVE o id do movimento ────────────────────
   A versão anterior desta função descobria o movimento relendo "o mais recente
   do par estoque+insumo". Com a trava isso funcionava, mas era acoplamento
   implícito: qualquer mudança de ordenação, qualquer gatilho que inserisse
   outro movimento, e o evento passaria a apontar para a linha errada em
   silêncio. Agora o id vem de RETURNING, direto de quem inseriu.

   registrar_movimento_estoque_lote_v2 é a implementação; as duas funções que
   já existiam (…_lote e …_multi) passam a ser fachadas dela, com a MESMA
   assinatura e o MESMO tipo de retorno. Nenhum chamador atual muda. */
create or replace function public.registrar_movimento_estoque_lote_v2(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_validade date default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now(),
  p_etiqueta_id uuid default null
)
returns table(novo_saldo numeric, movimento_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.estoque_itens%rowtype;
  v_novo numeric;
  v_mov uuid;
begin
  if p_tipo not in ('entrada', 'saida') or p_quantidade <= 0 then
    raise exception 'Movimentação inválida';
  end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
  values (p_unidade_id, p_estoque_id, p_insumo_id)
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_item
    from public.estoque_itens
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id
   for update;

  if p_tipo = 'saida' and v_item.quantidade_atual < p_quantidade then
    raise exception 'Saldo insuficiente neste estoque';
  end if;

  if p_tipo = 'entrada' then
    perform public.entrada_lote_estoque(p_estoque_id, p_insumo_id, p_unidade_id, p_validade, p_quantidade);
  else
    perform public.saida_lote_estoque(p_estoque_id, p_insumo_id, p_quantidade);
  end if;

  v_novo := public.sincronizar_item_por_lotes(p_estoque_id, p_insumo_id);

  update public.estoque_itens
     set ultima_movimentacao_em = p_data_movimento
   where id = v_item.id;

  insert into public.estoque_movimentacoes_multi (
    unidade_id, estoque_id, insumo_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, usuario_id, usuario_nome,
    observacao, data_movimento, etiqueta_id
  ) values (
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
    v_item.quantidade_atual, v_novo, p_usuario_id, p_usuario_nome,
    p_observacao, p_data_movimento, p_etiqueta_id
  )
  returning id into v_mov;

  return query select v_novo, v_mov;
end $$;

/* As duas de sempre, agora delegando. Assinatura e retorno idênticos: quem já
   chamava continua chamando igual e recebendo a mesma coisa. Delegar em vez de
   duplicar o corpo é de propósito — duas cópias da lógica de estoque divergem
   na primeira correção que alguém esquecer de repetir. */
create or replace function public.registrar_movimento_estoque_lote(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_validade date default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now()
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query select v.novo_saldo from public.registrar_movimento_estoque_lote_v2(
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade, p_validade,
    p_usuario_id, p_usuario_nome, p_observacao, p_data_movimento, null
  ) v;
end $$;

create or replace function public.registrar_movimento_estoque_multi(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now()
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query select v.novo_saldo from public.registrar_movimento_estoque_lote_v2(
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade, null,
    p_usuario_id, p_usuario_nome, p_observacao, p_data_movimento, null
  ) v;
end $$;

grant execute on function public.registrar_movimento_estoque_lote_v2(text, uuid, uuid, text, numeric, date, uuid, text, text, timestamptz, uuid) to authenticated;

/* Movimenta e devolve o id do movimento, agora sem adivinhação. */
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
  select m.movimento_id into v_mov
    from public.registrar_movimento_estoque_lote_v2(
      p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
      p_validade, p_usuario_id, p_usuario_nome, p_observacao, now(), p_etiqueta_id
    ) m;
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
  v_previa public.etiqueta_operacoes;
  v_estoque uuid;
  v_mov uuid;
  v_qtd numeric;
  v_unidade_estoque text;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'registrar_entrada', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  if v.rastreavel and v.saldo is not null then
    raise exception 'Esta etiqueta já deu entrada no estoque';
  end if;
  if v.insumo_id is null then
    raise exception 'Etiqueta sem produto vinculado (insumo_id)';
  end if;

  /* A etiqueta é impressa na unidade que a cozinha usa (500 g); o estoque
     conta na unidade cadastrada no insumo (kg). Até aqui nada convertia: 500 g
     entravam como 500 kg. A conversão é feita agora, e recusada quando as
     famílias não batem — kg <-> L e un <-> kg não têm fator para inventar. */
  v_unidade_estoque := public.etiqueta__unidade_do_insumo(v.insumo_id);
  v_qtd := public.etiqueta__converter(
    coalesce(v.saldo, v.quantidade, 0) * greatest(1, coalesce(v.copias, 1)),
    coalesce(v.saldo_unidade, v.unidade), v_unidade_estoque);
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
         saldo_unidade = v_unidade_estoque,
         estoque_id = v_estoque,
         condicao_estoque = coalesce(condicao_estoque, case when tipo_etiqueta = 'fechado' then 'fechado' else 'aberto' end),
         validade_original_em = coalesce(validade_original_em, validade_em),
         rastreavel = true,
         status = case when status = 'salva' then 'ativa' else status end
   where id = v.id
  returning * into v;

  /* A linha do tempo começa no nascimento da etiqueta, não na primeira vez
     que alguém mexe nela. */
  if not exists (select 1 from public.etiqueta_eventos where etiqueta_id = v.id and tipo = 'criada') then
    perform public.etiqueta__evento(v, 'criada', v_qtd, p_usuario_id,
      coalesce(p_responsavel, v.responsavel), null, null,
      'Etiqueta criada no recebimento', '{}'::jsonb, null);
  end if;
  perform public.etiqueta__evento(v, 'recebida', v_qtd, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov, null, 'Entrada por etiqueta', '{}'::jsonb, p_idempotency_key);
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
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
  v_previa public.etiqueta_operacoes;
  v_produzido numeric;
  v_ja_atribuido numeric;
  v_qtd numeric;
  v_estoque uuid;
  v_disponivel numeric;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'vincular_producao', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  v_qtd := coalesce(v.saldo, v.quantidade, 0);
  if v_qtd <= 0 then
    raise exception 'Etiqueta sem quantidade para vincular à produção';
  end if;

  /* A coluna é quantidade_produzida (db/migracao_producao_salao.sql). A
     versão anterior lia "quantidade", que não existe: em Postgres de verdade
     isso estouraria na primeira chamada. */
  select quantidade_produzida into v_produzido
    from public.producao_diaria where id = p_producao_id;
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

  /* Produzir 10 kg não garante que os 10 kg ainda estejam lá: entre a produção
     e a etiquetagem alguém pode ter consumido. Etiqueta representa coisa
     física, então o teto real é o que existe no estoque e ainda não está
     representado por outra etiqueta. */
  v_disponivel := public.etiqueta_saldo_nao_rastreado(v_estoque, v.insumo_id);
  if v_qtd > v_disponivel + 0.0001 then
    raise exception 'Só há % não etiquetado neste estoque (produção de %, já consumida em parte?) — não dá para etiquetar %',
      v_disponivel, v_produzido, v_qtd;
  end if;

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

  if not exists (select 1 from public.etiqueta_eventos where etiqueta_id = v.id and tipo = 'criada') then
    perform public.etiqueta__evento(v, 'criada', v_qtd, p_usuario_id,
      coalesce(p_responsavel, v.responsavel), null, null,
      'Etiqueta criada na produção', '{}'::jsonb, null);
  end if;
  perform public.etiqueta__evento(v, 'produzida', v_qtd, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, null,
    'Etiqueta de produção já lançada no estoque (sem nova entrada)',
    jsonb_build_object('producao_id', p_producao_id), p_idempotency_key);
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
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
  v_previa public.etiqueta_operacoes;
  v_saldo numeric;
  v_resto numeric;
  v_estoque_aberto uuid;
  v_mov_saida uuid;
  v_mov_entrada uuid;
  v_rel uuid;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'abrir', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
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
    perform public.etiqueta__concluir(p_idempotency_key, v.id);
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

  perform public.etiqueta__concluir(p_idempotency_key, v_filha.id);
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
  v_previa public.etiqueta_operacoes;
  v_mov uuid;
  v_novo numeric;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'usar', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
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
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
  return v;
end $$;

/* E) PERDA: mesma mecânica do uso, com tipo próprio. O prejuízo NÃO é
      lançado em contas_pagar aqui — vai para etiqueta_financeiro_pendente na
      mesma transação, e quem lança é o financeiro, lendo a fila. Ver 8.3. */
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
  v_previa public.etiqueta_operacoes;
  v_mov uuid;
  v_novo numeric;
  v_evento uuid;
  v_valor numeric;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'perda', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
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

  v_evento := public.etiqueta__evento(v, 'perda', p_quantidade, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), v_mov, null, p_motivo,
    jsonb_build_object('motivo', p_motivo), p_idempotency_key);

  /* O prejuízo entra na fila do financeiro AQUI, na transação que tirou do
     estoque. Antes o app fazia o INSERT em contas_pagar numa segunda chamada
     de rede: se ela falhasse, a comida sumia do estoque e o DRE não ficava
     sabendo. Agora ou as duas coisas existem, ou nenhuma existe. */
  v_valor := round(coalesce(p_quantidade, 0) * coalesce(v.custo_unit, 0), 2);
  if v_valor > 0 then
    insert into public.etiqueta_financeiro_pendente (
      unidade_id, etiqueta_id, evento_id, tipo, descricao, valor, competencia
    ) values (
      v.unidade_id, v.id, v_evento, 'perda',
      'Perda de validade: ' || coalesce(v.produto, 'produto') ||
        ' (' || trim(to_char(p_quantidade, 'FM999999990.999')) || ' ' ||
        coalesce(v.saldo_unidade, v.unidade, '') || ')' ||
        coalesce(' — ' || p_motivo, ''),
      v_valor, current_date
    )
    on conflict (evento_id) do nothing;
  end if;
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
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
  v_previa public.etiqueta_operacoes;
  v_soma numeric := 0;
  v_parte numeric;
  v_rel uuid;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'fracionar', p_etiqueta_id);
  if v_previa.chave is not null then
    return query
      select e.* from public.etiquetas e
       join public.etiqueta_relacoes r on r.etiqueta_destino_id = e.id
      where r.etiqueta_origem_id = v_previa.etiqueta_id and r.tipo_relacao = 'fracionamento';
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
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
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
  v_previa public.etiqueta_operacoes;
  v_rel uuid;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'novo_ciclo', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
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
  perform public.etiqueta__concluir(p_idempotency_key, v_filha.id);
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
  v_previa public.etiqueta_operacoes;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'reimprimir', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  perform public.etiqueta__evento(v, 'reimpressa', null, p_usuario_id,
    coalesce(p_responsavel, v.responsavel), null, null,
    coalesce(p_motivo, 'Segunda via'), '{}'::jsonb, p_idempotency_key);
  perform public.etiqueta__concluir(p_idempotency_key, v.id);
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
   BLOCO 8 — MEDIÇÃO, IMPRESSÃO, FINANCEIRO E INTEGRIDADE  (fase B.1)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 8.1 Quanto do estoque está representado por etiqueta ──────────────────
   Etiquetar é um processo que começa hoje: o estoque antigo continua lá, sem
   etiqueta, e isso não é erro. Estas duas peças medem a diferença em vez de
   escondê-la, e é delas que a futura tela vai ler.

   A conta só é legítima porque etiquetas.saldo_unidade é sempre a unidade
   cadastrada no insumo (ver etiqueta_registrar_entrada): somar saldos de
   unidades diferentes daria um número sem significado. */
create or replace function public.etiqueta_saldo_rastreado(
  p_estoque_id uuid, p_insumo_id uuid
) returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(saldo), 0)
    from public.etiquetas
   where estoque_id = p_estoque_id
     and insumo_id  = p_insumo_id
     and rastreavel
     and coalesce(saldo, 0) > 0
     and encerrada_em is null
$$;

create or replace function public.etiqueta_saldo_nao_rastreado(
  p_estoque_id uuid, p_insumo_id uuid
) returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(0, coalesce(
    (select quantidade_atual from public.estoque_itens
      where estoque_id = p_estoque_id and insumo_id = p_insumo_id), 0)
    - public.etiqueta_saldo_rastreado(p_estoque_id, p_insumo_id))
$$;

create or replace view public.vw_estoque_rastreabilidade as
  select it.unidade_id,
         it.estoque_id,
         es.nome  as estoque_nome,
         es.slug  as estoque_slug,
         it.insumo_id,
         ins.nome as insumo_nome,
         coalesce(nullif(btrim(ins.unidade_medida), ''), 'un') as unidade_medida,
         it.quantidade_atual as saldo_total,
         public.etiqueta_saldo_rastreado(it.estoque_id, it.insumo_id)     as saldo_rastreado,
         public.etiqueta_saldo_nao_rastreado(it.estoque_id, it.insumo_id) as saldo_nao_rastreado
    from public.estoque_itens it
    join public.estoques es on es.id = it.estoque_id
    join public.insumos  ins on ins.id = it.insumo_id;

/* ── 8.2 Criada, impressa, reimpressa: três coisas diferentes ──────────────
   A impressora é um aparelho externo, e o banco não pode ficar com uma
   transação aberta esperando WebUSB responder. Então a operação de domínio
   (a etiqueta existe, o estoque está certo) termina primeiro, e a impressão
   física é registrada DEPOIS, por esta função. Se a impressora falhar, o
   evento 'impressa' simplesmente não existe, e a etiqueta aparece em
   vw_etiquetas_pendentes_impressao até alguém imprimir.

   Nenhuma delas movimenta estoque. Imprimir papel não cria nem consome
   comida. */
create or replace function public.etiqueta_marcar_impressa(
  p_etiqueta_id uuid,
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
  v_previa public.etiqueta_operacoes;
  v_ja boolean;
begin
  v_previa := public.etiqueta__reservar(p_idempotency_key, 'marcar_impressa', p_etiqueta_id);
  if v_previa.chave is not null then
    select * into v from public.etiquetas where id = coalesce(v_previa.resultado_etiqueta_id, v_previa.etiqueta_id);
    return v;
  end if;

  v := public.etiqueta__travar(p_etiqueta_id);
  select exists (select 1 from public.etiqueta_eventos
                  where etiqueta_id = v.id and tipo = 'impressa') into v_ja;

  perform public.etiqueta__evento(v, case when v_ja then 'reimpressa' else 'impressa' end,
    null, p_usuario_id, coalesce(p_responsavel, v.responsavel), null, null,
    coalesce(p_observacao, case when v_ja then 'Segunda via' else 'Impressão confirmada' end),
    '{}'::jsonb, p_idempotency_key);

  perform public.etiqueta__concluir(p_idempotency_key, v.id);
  return v;
end $$;

/* Etiqueta que nasceu mas nunca saiu na impressora. O estoque já está certo —
   o que falta é o papel no pote. */
create or replace view public.vw_etiquetas_pendentes_impressao as
  select e.id, e.unidade_id, e.codigo, e.produto, e.saldo, e.saldo_unidade,
         e.estoque_id, e.condicao_estoque, e.created_at
    from public.etiquetas e
   where e.rastreavel
     and e.encerrada_em is null
     and not exists (select 1 from public.etiqueta_eventos ev
                      where ev.etiqueta_id = e.id and ev.tipo = 'impressa');

/* ── 8.3 Perda: estoque e financeiro não podem divergir ────────────────────
   Como era: a RPC tirava do estoque e o app, numa segunda chamada de rede,
   inseria em contas_pagar. Rede caindo entre as duas = perda no estoque sem
   prejuízo no DRE. E como o INSERT não tinha chave nenhuma, um retry criava
   duas contas para a mesma perda.

   Como fica: a mesma transação que tira do estoque grava a intenção de
   lançamento aqui. Ou as duas coisas existem, ou nenhuma. O financeiro
   consome esta fila depois, e o índice único por evento garante que consumir
   duas vezes não gera dois lançamentos.

   Escolhemos a fila em vez de inserir contas_pagar direto na RPC porque o
   lançamento financeiro tem regras próprias (categoria, competência, RLS de
   financeiro) que não pertencem a uma função de estoque. */
create table if not exists public.etiqueta_financeiro_pendente (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  evento_id uuid not null references public.etiqueta_eventos(id) on delete cascade,
  tipo text not null default 'perda' check (tipo in ('perda')),
  descricao text not null,
  valor numeric(14,2) not null check (valor >= 0),
  competencia date not null,
  status text not null default 'pendente' check (status in ('pendente','lancado','dispensado')),
  conta_pagar_id uuid,
  tentativas integer not null default 0,
  ultimo_erro text,
  processado_em timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists etiqueta_financeiro_por_evento
  on public.etiqueta_financeiro_pendente (evento_id);
create index if not exists etiqueta_financeiro_pendentes_idx
  on public.etiqueta_financeiro_pendente (unidade_id, status, created_at);

/* Fecha um item da fila. Idempotente: marcar duas vezes não muda nada e não
   perde o id da conta já criada. */
create or replace function public.etiqueta_financeiro_marcar_lancado(
  p_id uuid, p_conta_pagar_id uuid
) returns public.etiqueta_financeiro_pendente
language plpgsql
security invoker
set search_path = public
as $$
declare v public.etiqueta_financeiro_pendente;
begin
  update public.etiqueta_financeiro_pendente
     set status = 'lancado',
         conta_pagar_id = coalesce(conta_pagar_id, p_conta_pagar_id),
         processado_em = coalesce(processado_em, now()),
         ultimo_erro = null
   where id = p_id
  returning * into v;
  if v.id is null then raise exception 'Pendência financeira não encontrada'; end if;
  return v;
end $$;

create or replace function public.etiqueta_financeiro_marcar_erro(
  p_id uuid, p_erro text
) returns void
language sql
security invoker
set search_path = public
as $$
  update public.etiqueta_financeiro_pendente
     set tentativas = tentativas + 1, ultimo_erro = p_erro
   where id = p_id and status = 'pendente'
$$;

alter table public.etiqueta_financeiro_pendente enable row level security;
revoke all on public.etiqueta_financeiro_pendente from anon;
grant select, insert, update on public.etiqueta_financeiro_pendente to authenticated;
grant all on public.etiqueta_financeiro_pendente to service_role;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='etiqueta_financeiro_pendente' and policyname='etiqueta_financeiro_da_etiqueta') then
    create policy etiqueta_financeiro_da_etiqueta on public.etiqueta_financeiro_pendente
      for all to authenticated
      using (exists (select 1 from public.etiquetas e where e.id = etiqueta_financeiro_pendente.etiqueta_id))
      with check (exists (select 1 from public.etiquetas e where e.id = etiqueta_financeiro_pendente.etiqueta_id));
  end if;
end $$;

/* ── 8.4 Chaves estrangeiras ───────────────────────────────────────────────
   As colunas são novas e nulas em todo o histórico, então a FK entra sem
   tocar em linha antiga. Ainda assim cada uma é condicionada: a tabela alvo
   precisa existir, os tipos precisam bater e não pode haver órfão. Onde
   qualquer dessas coisas falhar, a migração AVISA e segue — a coluna fica sem
   FK e isso vai no relatório, em vez de a migração inteira parar.

   ON DELETE SET NULL de propósito: apagar um insumo não pode apagar o
   histórico de etiquetas que existiram. */
do $$
declare
  r record;
  v_tipo text;
  v_orfaos bigint;
begin
  for r in
    select * from (values
      ('etiquetas', 'insumo_id',   'insumos',          'etiquetas_insumo_fk'),
      ('etiquetas', 'estoque_id',  'estoques',         'etiquetas_estoque_fk'),
      ('etiquetas', 'producao_id', 'producao_diaria',  'etiquetas_producao_fk'),
      ('estoque_movimentacoes_multi', 'etiqueta_id', 'etiquetas', 'movimentacoes_multi_etiqueta_fk')
    ) as t(tabela, coluna, alvo, nome)
  loop
    if exists (select 1 from pg_constraint where conname = r.nome) then
      continue;
    end if;
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = r.alvo) then
      raise notice 'FK %: tabela % não existe, coluna fica sem integridade referencial', r.nome, r.alvo;
      continue;
    end if;
    select data_type into v_tipo from information_schema.columns
     where table_schema='public' and table_name = r.alvo and column_name = 'id';
    if v_tipo is distinct from 'uuid' then
      raise notice 'FK %: %.id é % e a coluna é uuid — sem FK', r.nome, r.alvo, coalesce(v_tipo,'inexistente');
      continue;
    end if;
    execute format(
      'select count(*) from public.%I f where f.%I is not null and not exists (select 1 from public.%I a where a.id = f.%I)',
      r.tabela, r.coluna, r.alvo, r.coluna) into v_orfaos;
    if v_orfaos > 0 then
      raise notice 'FK %: % linha(s) órfã(s) em %.% — sem FK até limpar', r.nome, v_orfaos, r.tabela, r.coluna;
      continue;
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete set null',
      r.tabela, r.nome, r.coluna, r.alvo);
    raise notice 'FK % criada', r.nome;
  end loop;
end $$;

grant execute on function public.etiqueta_saldo_rastreado(uuid, uuid) to authenticated;
grant execute on function public.etiqueta_saldo_nao_rastreado(uuid, uuid) to authenticated;
grant execute on function public.etiqueta_marcar_impressa(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.etiqueta_financeiro_marcar_lancado(uuid, uuid) to authenticated;
grant execute on function public.etiqueta_financeiro_marcar_erro(uuid, text) to authenticated;
grant select on public.vw_estoque_rastreabilidade to authenticated;
grant select on public.vw_etiquetas_pendentes_impressao to authenticated;
grant select, insert, update on public.etiqueta_operacoes to authenticated;
grant all on public.etiqueta_operacoes to service_role;
revoke all on public.etiqueta_operacoes from anon;

/* As views leem estoque e etiquetas; sem isto elas rodariam com os direitos do
   dono e furariam o RLS de quem consulta. security_invoker é PG15+; onde não
   existir, a view fica restrita ao service_role e o app usa as funções. */
do $$
begin
  execute 'alter view public.vw_estoque_rastreabilidade set (security_invoker = on)';
  execute 'alter view public.vw_etiquetas_pendentes_impressao set (security_invoker = on)';
exception when others then
  raise notice 'security_invoker indisponível nesta versão do Postgres: revogando as views de authenticated';
  execute 'revoke all on public.vw_estoque_rastreabilidade from authenticated';
  execute 'revoke all on public.vw_etiquetas_pendentes_impressao from authenticated';
end $$;

alter table public.etiqueta_operacoes enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='etiqueta_operacoes' and policyname='etiqueta_operacoes_da_etiqueta') then
    create policy etiqueta_operacoes_da_etiqueta on public.etiqueta_operacoes
      for all to authenticated
      using (etiqueta_id is null or exists (select 1 from public.etiquetas e where e.id = etiqueta_operacoes.etiqueta_id))
      with check (etiqueta_id is null or exists (select 1 from public.etiquetas e where e.id = etiqueta_operacoes.etiqueta_id));
  end if;
end $$;

notify pgrst, 'reload schema';

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 9 — CONFERÊNCIA (rode depois, separadamente)
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
