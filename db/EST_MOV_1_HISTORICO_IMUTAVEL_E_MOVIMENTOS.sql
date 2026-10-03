/* ═══════════════════════════════════════════════════════════════════════════
   EST-MOV-1 · HISTÓRICO DO ESTOQUE IMUTÁVEL + ENTRADA / RETIRADA / ESTORNO /
               AJUSTE DE INVENTÁRIO PELO BANCO, COM PIN ADMINISTRATIVO

   STATUS: PROPOSTA. Rodar só com aprovação do dono.

   AUDITORIA DE PRODUÇÃO (02/10/2026, EST_MOV_AUDITORIA_ESTOQUE_MOVIMENTOS.sql):
     estoque_movimentacoes_multi: 2 policies ALL authenticated USING true; o
       authenticated tem DELETE/UPDATE/TRUNCATE → qualquer usuário logado apaga
       ou reescreve o histórico pela API. 345 movimentos (jul–set), 0 contagem.
     bebida_* (zerar, contagem, entrada, baixa): SECURITY DEFINER e EXECUTE
       para o anon → sem login, só com a chave pública, dá para zerar/alterar o
       estoque do bar. As funções de lote/FEFO também estão abertas ao anon
       (são INVOKER, o anon não tem tabela, mas não há motivo para expor).
     saldo × lotes: 0 divergentes em 53 itens com saldo. pgcrypto em extensions.

   FAZ (uma transação; aborta sem mudar nada se faltar tabela/função):
     1. histórico ganha colunas (motivo, justificativa, origem, estorno de,
        autorizado por, quem gravou, unidade, quantidade informada e detalhe
        embalagens+fração, validade, lotes afetados, inventário, custo,
        chave contra lançamento duplicado). Nenhuma linha antiga é alterada.
     2. histórico IMUTÁVEL: trigger bloqueia UPDATE, DELETE e TRUNCATE para
        todos (inclusive service role); do authenticated saem UPDATE/DELETE/
        TRUNCATE; do anon, tudo. Leitura e inserção simples só da própria
        unidade (como a SEC-EST-1). Inserção direta não pode se dizer estorno,
        ajuste nem autorizada: esses campos só as funções abaixo preenchem.
     3. estoque_seguranca: PIN com hash bcrypt (pgcrypto), PIN inicial 1234,
        5 erros = 15 min bloqueado, contagem cega. Nenhum papel do app lê a
        tabela; só as funções. estoque_autorizacoes registra cada tentativa.
     4. funções (SECURITY DEFINER, usuário e permissão conferidos no banco):
        estoque_movimentar         entrada/retirada com motivo, FEFO do banco,
                                   trava de concorrência, sem saldo negativo,
                                   sem lançamento duplicado (chave);
        estoque_estornar           só administrador autorizado + PIN; cria o
                                   movimento contrário e mantém o original;
        estoque_ajustar_inventario só administrador + PIN; aplica a diferença
                                   de um inventário FECHADO (contado − saldo
                                   do sistema na hora da contagem);
        estoque_seguranca_status / estoque_seguranca_salvar (PIN, contagem cega).
     5. tira EXECUTE do anon/public das funções de estoque e bebidas
        (o authenticated continua com elas: as telas atuais seguem funcionando).

   NÃO FAZ: não altera nem apaga nenhum movimento, saldo ou lote existente; não
   mexe nas telas antigas nem nas funções antigas (só o EXECUTE do anon); não
   mexe em estoque_atual, vendas, Mesa/KDS. A troca das telas antigas para as
   funções novas e a retirada do "zerar" são a Fase 3.

   PERMISSÕES (catálogo do app):
     lançar entrada/retirada: estoque.movements.create (nova) ou as que já
       mexem em estoque: overview/operation.adjust_stock, operation.create;
       entrada também entries.create; retirada também outputs.create e
       losses.record_loss.
     estornar / ajustar / ajuste autorizado: estoque.security.approve (nova) + PIN.
     trocar PIN / contagem cega:            estoque.security.settings (nova) + PIN.
     Super admin e perfis com "estoque.*" já têm as novas.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.estoque_movimentacoes_multi') is null or to_regclass('public.estoque_itens') is null
     or to_regclass('public.estoque_lotes') is null or to_regclass('public.estoques') is null
     or to_regclass('public.insumos') is null or to_regclass('public.unidades') is null
     or to_regclass('public.estoque_contagens') is null or to_regclass('public.estoque_contagens_itens') is null
     or to_regclass('public.estoque_custos') is null or to_regclass('public.usuarios_erp') is null then
    raise exception 'EST-MOV-1: tabela ausente. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_user_can(text,text)') is null
     or to_regprocedure('public.hefisto_user_in_unit(uuid,text)') is null
     or to_regprocedure('public.entrada_lote_estoque(uuid,uuid,text,date,numeric)') is null
     or to_regprocedure('public.saida_lote_estoque(uuid,uuid,numeric)') is null
     or to_regprocedure('public.sincronizar_item_por_lotes(uuid,uuid)') is null
     or to_regprocedure('public.sincronizar_lotes_apos_contagem(text,uuid,uuid,numeric)') is null
     or to_regprocedure('public.auth_unidade_id()') is null or to_regprocedure('public.pode_ver_todas()') is null then
    raise exception 'EST-MOV-1: função ausente. Nada foi alterado.';
  end if;
  if to_regprocedure('extensions.crypt(text,text)') is null or to_regprocedure('extensions.gen_salt(text,integer)') is null then
    raise exception 'EST-MOV-1: pgcrypto (schema extensions) ausente. Nada foi alterado.';
  end if;
end $$;


/* ── 1. COLUNAS NOVAS NO HISTÓRICO (todas opcionais; linhas antigas ficam como estão) ── */
alter table public.estoque_movimentacoes_multi
  add column if not exists motivo               text,
  add column if not exists justificativa        text,
  add column if not exists origem               text,
  add column if not exists estorno_de_id        uuid references public.estoque_movimentacoes_multi(id) on delete restrict,
  add column if not exists autorizado_por       uuid,
  add column if not exists autorizado_por_nome  text,
  add column if not exists responsavel_nome     text,
  add column if not exists registrado_por       uuid,
  add column if not exists unidade_medida       text,
  add column if not exists quantidade_informada numeric,
  add column if not exists unidade_informada    text,
  add column if not exists detalhe_quantidade   jsonb,
  add column if not exists validade             date,
  add column if not exists lotes                jsonb,
  add column if not exists inventario_id        uuid references public.estoque_contagens(id) on delete restrict,
  add column if not exists inventario_item_id   uuid references public.estoque_contagens_itens(id) on delete restrict,
  add column if not exists custo_origem         text,
  add column if not exists chave_idempotencia   text;

comment on column public.estoque_movimentacoes_multi.motivo is 'est-mov-1: por que entrou/saiu (compra, perda, estorno, ajuste_inventario…); nulo = lançamento anterior à EST-MOV-1';
comment on column public.estoque_movimentacoes_multi.registrado_por is 'est-mov-1: auth.uid() de quem gravou, preenchido pelo banco (o app não escolhe)';
comment on column public.estoque_movimentacoes_multi.lotes is 'est-mov-1: validades afetadas [{validade, quantidade}] — o estorno devolve aos mesmos lotes';

alter table public.estoque_movimentacoes_multi drop constraint if exists estoque_mov_motivo_check;
alter table public.estoque_movimentacoes_multi add constraint estoque_mov_motivo_check check (motivo is null or motivo in (
  'compra', 'recebimento', 'producao', 'devolucao', 'transferencia_recebida', 'transferencia_enviada',
  'consumo', 'perda', 'vencimento', 'quebra', 'ajuste_autorizado', 'ajuste_inventario', 'estorno'));
alter table public.estoque_movimentacoes_multi drop constraint if exists estoque_mov_origem_check;
alter table public.estoque_movimentacoes_multi add constraint estoque_mov_origem_check check (origem is null or origem in (
  'movimentacao', 'estorno', 'inventario', 'compra', 'producao', 'etiqueta', 'bebida', 'transferencia'));
alter table public.estoque_movimentacoes_multi drop constraint if exists estoque_mov_estorno_check;
alter table public.estoque_movimentacoes_multi add constraint estoque_mov_estorno_check
  check ((estorno_de_id is null) = (motivo is distinct from 'estorno'));
alter table public.estoque_movimentacoes_multi drop constraint if exists estoque_mov_autorizacao_check;
alter table public.estoque_movimentacoes_multi add constraint estoque_mov_autorizacao_check check (
  motivo is null or motivo not in ('ajuste_autorizado', 'ajuste_inventario', 'estorno')
  or (autorizado_por is not null and length(btrim(coalesce(justificativa, ''))) >= 3));
alter table public.estoque_movimentacoes_multi drop constraint if exists estoque_mov_inventario_check;
alter table public.estoque_movimentacoes_multi add constraint estoque_mov_inventario_check
  check (motivo is distinct from 'ajuste_inventario' or inventario_item_id is not null);

create unique index if not exists estoque_mov_chave_unica
  on public.estoque_movimentacoes_multi (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create unique index if not exists estoque_mov_estorno_unico
  on public.estoque_movimentacoes_multi (estorno_de_id) where estorno_de_id is not null;
create unique index if not exists estoque_mov_ajuste_inventario_unico
  on public.estoque_movimentacoes_multi (inventario_item_id) where motivo = 'ajuste_inventario';
create index if not exists estoque_mov_item_criado on public.estoque_movimentacoes_multi (estoque_id, insumo_id, created_at);
create index if not exists estoque_mov_insumo_data on public.estoque_movimentacoes_multi (insumo_id, data_movimento desc);


/* ── 2. HISTÓRICO IMUTÁVEL ─────────────────────────────────────────────────── */
create or replace function public.estoque_historico_imutavel_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'O histórico do estoque não pode ser alterado nem apagado. Para corrigir, faça um estorno.';
end $$;

drop trigger if exists estoque_mov_imutavel on public.estoque_movimentacoes_multi;
create trigger estoque_mov_imutavel before update or delete on public.estoque_movimentacoes_multi
  for each row execute function public.estoque_historico_imutavel_trg();
drop trigger if exists estoque_mov_sem_truncate on public.estoque_movimentacoes_multi;
create trigger estoque_mov_sem_truncate before truncate on public.estoque_movimentacoes_multi
  for each statement execute function public.estoque_historico_imutavel_trg();

create table if not exists public.sec_backup_policies_est_mov_1 (
  tabela     text not null,
  policy     text not null,
  cmd        text,
  roles      text[],
  permissive text,
  qual       text,
  with_check text,
  salvo_em   timestamptz not null default now(),
  primary key (tabela, policy)
);
alter table public.sec_backup_policies_est_mov_1 enable row level security;
revoke all on table public.sec_backup_policies_est_mov_1 from public, anon, authenticated;
insert into public.sec_backup_policies_est_mov_1 (tabela, policy, cmd, roles, permissive, qual, with_check)
select tablename, policyname, cmd, roles::text[], permissive, qual, with_check
  from pg_policies where schemaname = 'public' and tablename = 'estoque_movimentacoes_multi'
on conflict do nothing;

alter table public.estoque_movimentacoes_multi enable row level security;
drop policy if exists auth_all on public.estoque_movimentacoes_multi;
drop policy if exists estoque_mov_multi_auth_full on public.estoque_movimentacoes_multi;

drop policy if exists estoque_mov_ler_unidade on public.estoque_movimentacoes_multi;
create policy estoque_mov_ler_unidade on public.estoque_movimentacoes_multi for select to authenticated
  using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());

-- Inserção direta (funções antigas, que rodam como o usuário) continua, mas só
-- no formato antigo: estorno, ajuste e autorização só existem pelas funções.
drop policy if exists estoque_mov_inserir_simples on public.estoque_movimentacoes_multi;
create policy estoque_mov_inserir_simples on public.estoque_movimentacoes_multi for insert to authenticated
  with check ((public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
              and motivo is null and origem is null and estorno_de_id is null
              and autorizado_por is null and autorizado_por_nome is null and registrado_por is null
              and inventario_id is null and inventario_item_id is null and chave_idempotencia is null);

revoke all on public.estoque_movimentacoes_multi from anon;
revoke update, delete, truncate, references, trigger on public.estoque_movimentacoes_multi from authenticated;
grant select, insert on public.estoque_movimentacoes_multi to authenticated;


/* ── 3. SEGURANÇA: PIN (hash) E CONTAGEM CEGA, E O REGISTRO DAS AUTORIZAÇÕES ── */
create table if not exists public.estoque_seguranca (
  unidade_id        text primary key references public.unidades(id),
  pin_hash          text not null,
  pin_padrao        boolean not null default true,
  pin_alterado_em   timestamptz,
  pin_alterado_por  uuid,
  tentativas_falhas integer not null default 0,
  bloqueado_ate     timestamptz,
  contagem_cega     boolean not null default true,
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid
);
comment on table public.estoque_seguranca is 'est-mov-1: PIN administrativo do estoque (hash bcrypt) e contagem cega; só as funções leem';
alter table public.estoque_seguranca enable row level security;
revoke all on table public.estoque_seguranca from public, anon, authenticated;

insert into public.estoque_seguranca (unidade_id, pin_hash)
select u.id, extensions.crypt('1234', extensions.gen_salt('bf', 8)) from public.unidades u
on conflict (unidade_id) do nothing;

create table if not exists public.estoque_autorizacoes (
  id           uuid primary key default gen_random_uuid(),
  unidade_id   text not null,
  acao         text not null,
  alvo_id      uuid,
  usuario_id   uuid,
  usuario_nome text,
  auth_user_id uuid,
  resultado    text not null check (resultado in ('autorizado', 'pin_incorreto')),
  detalhe      text,
  created_at   timestamptz not null default now()
);
comment on table public.estoque_autorizacoes is 'est-mov-1: cada uso do PIN (certo ou errado) em estorno, ajuste e configuração';
create index if not exists estoque_autorizacoes_unidade_data on public.estoque_autorizacoes (unidade_id, created_at desc);
alter table public.estoque_autorizacoes enable row level security;
revoke all on table public.estoque_autorizacoes from public, anon, authenticated;
grant select on table public.estoque_autorizacoes to authenticated;
drop policy if exists estoque_autorizacoes_ler on public.estoque_autorizacoes;
create policy estoque_autorizacoes_ler on public.estoque_autorizacoes for select to authenticated
  using (public.hefisto_user_can('estoque.security.view', unidade_id));
drop trigger if exists estoque_autorizacoes_imutavel on public.estoque_autorizacoes;
create trigger estoque_autorizacoes_imutavel before update or delete on public.estoque_autorizacoes
  for each row execute function public.estoque_historico_imutavel_trg();


/* ── 4. FUNÇÕES INTERNAS (não expostas ao app) ─────────────────────────────── */

-- Quanto 1 unidade do cadastro vale na base (g/ml/un). Igual a unidadeContagem do app.
create or replace function public.estoque_fator_base(p_unidade_medida text)
returns numeric language sql immutable set search_path = public as $$
  select case lower(btrim(coalesce(p_unidade_medida, ''))) when 'kg' then 1000 when 'l' then 1000 else 1 end::numeric
$$;

-- Quantidade para mensagens: 3 casas no máximo, sem zeros à direita, vírgula decimal (6,5 · 6 · 0,35).
create or replace function public.estoque_fmt_qtd(p_qtd numeric)
returns text language sql immutable set search_path = public as $$
  select replace(trim_scale(round(p_qtd, 3))::text, '.', ',')
$$;

create or replace function public.estoque_unidade_base(p_unidade_medida text)
returns text language sql immutable set search_path = public as $$
  select case lower(btrim(coalesce(p_unidade_medida, ''))) when 'kg' then 'g' when 'g' then 'g'
                                                          when 'l' then 'ml' when 'ml' then 'ml' else 'un' end
$$;

-- Quem está logado, pelo próprio banco (o app não escolhe o usuário).
create or replace function public._estoque_usuario(out id uuid, out nome text)
language sql stable set search_path = public as $$
  select u.id, u.nome from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' limit 1
$$;

create or replace function public._estoque_pode(p_acao text, p_unidade_id text, p_tipo text default null)
returns boolean language sql stable set search_path = public as $$
  select coalesce(case p_acao
    when 'movimentar' then
         public.hefisto_user_can('estoque.movements.create', p_unidade_id)
      or public.hefisto_user_can('estoque.overview.adjust_stock', p_unidade_id)
      or public.hefisto_user_can('estoque.operation.adjust_stock', p_unidade_id)
      or public.hefisto_user_can('estoque.operation.create', p_unidade_id)
      or (p_tipo = 'entrada' and public.hefisto_user_can('estoque.entries.create', p_unidade_id))
      or (p_tipo = 'saida' and (public.hefisto_user_can('estoque.outputs.create', p_unidade_id)
                                or public.hefisto_user_can('estoque.losses.record_loss', p_unidade_id)))
    when 'autorizar' then public.hefisto_user_can('estoque.security.approve', p_unidade_id)
    when 'configurar' then public.hefisto_user_can('estoque.security.settings', p_unidade_id)
  end, false)
$$;

-- Confere o PIN. Devolve NULL se certo, ou a mensagem de erro. Não lança
-- exceção de propósito: a tentativa errada precisa ficar gravada.
create or replace function public._estoque_conferir_pin(p_unidade_id text, p_pin text)
returns text language plpgsql set search_path = public as $$
declare
  s public.estoque_seguranca%rowtype;
  v_falhas integer;
begin
  insert into public.estoque_seguranca (unidade_id, pin_hash)
  values (p_unidade_id, extensions.crypt('1234', extensions.gen_salt('bf', 8)))
  on conflict (unidade_id) do nothing;
  select * into s from public.estoque_seguranca where unidade_id = p_unidade_id for update;

  if s.bloqueado_ate is not null and s.bloqueado_ate > now() then
    return 'PIN bloqueado por excesso de tentativas. Tente de novo depois das '
           || to_char(s.bloqueado_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.';
  end if;
  v_falhas := case when s.bloqueado_ate is not null then 0 else s.tentativas_falhas end;

  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' or extensions.crypt(p_pin, s.pin_hash) <> s.pin_hash then
    v_falhas := v_falhas + 1;
    update public.estoque_seguranca
       set tentativas_falhas = v_falhas,
           bloqueado_ate = case when v_falhas >= 5 then now() + interval '15 minutes' end
     where unidade_id = p_unidade_id;
    if v_falhas >= 5 then return 'PIN incorreto. O PIN ficou bloqueado por 15 minutos.'; end if;
    return 'PIN incorreto. Restam ' || (5 - v_falhas) || ' tentativa(s).';
  end if;

  update public.estoque_seguranca set tentativas_falhas = 0, bloqueado_ate = null where unidade_id = p_unidade_id;
  return null;
end $$;

create or replace function public._estoque_registrar_autorizacao(
  p_unidade_id text, p_acao text, p_alvo_id uuid, p_usuario_id uuid, p_usuario_nome text, p_erro text, p_detalhe text)
returns void language sql set search_path = public as $$
  insert into public.estoque_autorizacoes (unidade_id, acao, alvo_id, usuario_id, usuario_nome, auth_user_id, resultado, detalhe)
  values (p_unidade_id, p_acao, p_alvo_id, p_usuario_id, p_usuario_nome, auth.uid(),
          case when p_erro is null then 'autorizado' else 'pin_incorreto' end, coalesce(p_erro, p_detalhe))
$$;

-- Lotes do item como {validade: quantidade}; 'sem_validade' para o lote sem prazo.
create or replace function public._estoque_lotes_mapa(p_estoque_id uuid, p_insumo_id uuid)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(coalesce(validade::text, 'sem_validade'), quantidade), '{}'::jsonb)
    from public.estoque_lotes where estoque_id = p_estoque_id and insumo_id = p_insumo_id and quantidade > 0
$$;

-- Quanto mudou em cada validade: [{validade, quantidade}].
create or replace function public._estoque_lotes_diff(p_antes jsonb, p_depois jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('validade', case when k = 'sem_validade' then null else k end,
                                               'quantidade', abs(d)) order by k), '[]'::jsonb)
    from (select k, coalesce((p_depois ->> k)::numeric, 0) - coalesce((p_antes ->> k)::numeric, 0) as d
            from (select jsonb_object_keys(p_antes) as k union select jsonb_object_keys(p_depois)) ks) x
   where abs(d) > 0.0005
$$;

-- Mesmo critério da tela de estoque (ehFracionavel): embalagem com conteúdo
-- consumido em partes, que tem saldo fechado x aberto.
create or replace function public._estoque_fracionavel(p_insumo_id uuid)
returns boolean language sql stable set search_path = public as $$
  select coalesce((
    select i.tamanho_embalagem > 1 and case
             when lower(coalesce(i.unidade_medida, '')) in ('un', 'unidade', 'garrafa', 'lata', 'barril', 'caixa', 'cx', 'pacote', 'fardo', 'maco', 'maço')
             then i.permite_fracionado is true
             else i.permite_fracionado is not false end
      from public.insumos i where i.id = p_insumo_id), false)
$$;

-- Em que unidade o estoque guarda o saldo. Igual a inventario-saldo.mjs do app:
-- garrafa marcada como fracionada e cadastrada numa unidade que se CONTA
-- (garrafa, lata, un...) guarda o saldo em conteúdo (ml); o resto, na unidade
-- do cadastro. fator = quanto 1 unidade do cadastro vale no saldo.
create or replace function public._estoque_fator_saldo(p_insumo_id uuid)
returns numeric language sql stable set search_path = public as $$
  select coalesce((
    select case when public._estoque_fracionavel(i.id)
                 and lower(coalesce(i.unidade_medida, '')) in ('un', 'unidade', 'garrafa', 'lata', 'barril', 'caixa', 'cx', 'pacote', 'fardo', 'maco', 'maço')
                then greatest(i.tamanho_embalagem, 0.000001) else 1 end
      from public.insumos i where i.id = p_insumo_id), 1)::numeric
$$;

create or replace function public._estoque_unidade_saldo(p_insumo_id uuid)
returns text language sql stable set search_path = public as $$
  select case when public._estoque_fator_saldo(i.id) <> 1 then coalesce(nullif(btrim(i.unidade_conteudo), ''), 'ml')
              else i.unidade_medida end
    from public.insumos i where i.id = p_insumo_id
$$;

-- Núcleo: trava o item, aplica nos lotes com o FEFO que já existe no banco,
-- recalcula o saldo e devolve antes/depois e os lotes afetados. Não grava o
-- histórico (quem chama grava, com todos os campos).
create or replace function public._estoque_aplicar(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_quantidade numeric,
  p_validade date, p_lotes_preferidos jsonb, p_embalagens numeric,
  out o_saldo_anterior numeric, out o_saldo_posterior numeric, out o_lotes jsonb)
language plpgsql set search_path = public as $$
declare
  v_item public.estoque_itens%rowtype;
  v_unidade_medida text;
  v_soma numeric;
  v_antes jsonb;
  v_resta numeric;
  v_l record;
  v_disp numeric;
  v_tirou numeric;
  v_conteudo numeric;
  v_emb numeric;
  v_abrir numeric;
begin
  if p_tipo = 'entrada' then
    insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
    values (p_unidade_id, p_estoque_id, p_insumo_id)
    on conflict (estoque_id, insumo_id) do nothing;
  end if;
  select * into v_item from public.estoque_itens
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if v_item.id is null then raise exception 'Este produto não está neste estoque.'; end if;
  v_unidade_medida := public._estoque_unidade_saldo(p_insumo_id);

  o_saldo_anterior := coalesce(v_item.quantidade_atual, 0);
  if o_saldo_anterior < 0 then
    raise exception 'O saldo deste produto está negativo (%). Peça um ajuste ao administrador.', o_saldo_anterior;
  end if;

  -- Escritas antigas podem ter mexido só no saldo: os lotes passam a lastrear o
  -- saldo atual antes do movimento (o saldo não muda).
  select coalesce(sum(quantidade), 0) into v_soma from public.estoque_lotes
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id;
  if abs(v_soma - o_saldo_anterior) > 0.0005 then
    perform public.sincronizar_lotes_apos_contagem(p_unidade_id, p_estoque_id, p_insumo_id, o_saldo_anterior);
  end if;

  if p_tipo = 'saida' and o_saldo_anterior + 0.0005 < p_quantidade then
    raise exception 'Saldo insuficiente: há % % neste estoque e a retirada é de % %.',
      public.estoque_fmt_qtd(o_saldo_anterior), coalesce(v_unidade_medida, ''),
      public.estoque_fmt_qtd(p_quantidade), coalesce(v_unidade_medida, '');
  end if;

  v_antes := public._estoque_lotes_mapa(p_estoque_id, p_insumo_id);
  v_resta := p_quantidade;

  if p_tipo = 'entrada' then
    -- estorno de retirada: devolve às validades de onde saiu
    for v_l in select (e ->> 'validade')::date as validade, (e ->> 'quantidade')::numeric as qtd
                 from jsonb_array_elements(coalesce(p_lotes_preferidos, '[]'::jsonb)) e loop
      exit when v_resta <= 0;
      v_tirou := least(v_l.qtd, v_resta);
      perform public.entrada_lote_estoque(p_estoque_id, p_insumo_id, p_unidade_id, v_l.validade, v_tirou);
      v_resta := v_resta - v_tirou;
    end loop;
    if v_resta > 0 then
      perform public.entrada_lote_estoque(p_estoque_id, p_insumo_id, p_unidade_id, p_validade, v_resta);
    end if;
  else
    -- estorno de entrada: tira das validades que entraram; o resto, FEFO
    for v_l in select (e ->> 'validade')::date as validade, (e ->> 'quantidade')::numeric as qtd
                 from jsonb_array_elements(coalesce(p_lotes_preferidos, '[]'::jsonb)) e loop
      exit when v_resta <= 0;
      select l.quantidade into v_disp from public.estoque_lotes l
       where l.estoque_id = p_estoque_id and l.insumo_id = p_insumo_id
         and coalesce(l.validade, 'infinity'::date) = coalesce(v_l.validade, 'infinity'::date)
       for update;
      v_tirou := least(coalesce(v_disp, 0), v_l.qtd, v_resta);
      if v_tirou > 0 then
        update public.estoque_lotes l set quantidade = l.quantidade - v_tirou, updated_at = now()
         where l.estoque_id = p_estoque_id and l.insumo_id = p_insumo_id
           and coalesce(l.validade, 'infinity'::date) = coalesce(v_l.validade, 'infinity'::date);
        v_resta := v_resta - v_tirou;
      end if;
    end loop;
    if v_resta > 0 then
      perform public.saida_lote_estoque(p_estoque_id, p_insumo_id, v_resta);
    end if;
  end if;

  o_saldo_posterior := public.sincronizar_item_por_lotes(p_estoque_id, p_insumo_id);
  update public.estoque_itens set ultima_movimentacao_em = now() where id = v_item.id;
  o_lotes := public._estoque_lotes_diff(v_antes, public._estoque_lotes_mapa(p_estoque_id, p_insumo_id));

  -- Bebidas e embalados (fechado x aberto): mesmas regras das funções bebida_*.
  if public._estoque_fracionavel(p_insumo_id) then
    v_conteudo := greatest(coalesce((select tamanho_embalagem from public.insumos where id = p_insumo_id), 1), 0.000001);
    select * into v_item from public.estoque_itens where id = v_item.id;
    if p_tipo = 'entrada' then
      v_emb := greatest(floor(coalesce(p_embalagens, 0)), 0);
      if v_emb * v_conteudo > p_quantidade + 0.0005 then v_emb := floor(p_quantidade / v_conteudo); end if;
      update public.estoque_itens
         set saldo_fechado = coalesce(saldo_fechado, 0) + v_emb,
             saldo_aberto  = coalesce(saldo_aberto, 0) + (p_quantidade - v_emb * v_conteudo)
       where id = v_item.id;
    else
      v_abrir := 0;
      if p_quantidade - coalesce(v_item.saldo_aberto, 0) > 0.0005 then
        v_abrir := least(ceil((p_quantidade - coalesce(v_item.saldo_aberto, 0)) / v_conteudo), coalesce(v_item.saldo_fechado, 0));
      end if;
      update public.estoque_itens
         set saldo_fechado = coalesce(saldo_fechado, 0) - v_abrir,
             saldo_aberto  = greatest(coalesce(saldo_aberto, 0) + v_abrir * v_conteudo - p_quantidade, 0)
       where id = v_item.id;
    end if;
  end if;
end $$;


/* ── 5. FUNÇÕES PARA O APP ─────────────────────────────────────────────────── */

-- Entrada ou retirada. Funcionário com permissão de estoque; "ajuste_autorizado"
-- só administrador autorizado com PIN. p_quantidade na unidade do SALDO (a do
-- cadastro; garrafa fracionada: o conteúdo). Devolve {ok, movimento_id, saldo_*}.
create or replace function public.estoque_movimentar(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_tipo text, p_motivo text, p_quantidade numeric,
  p_validade date default null, p_quantidade_informada numeric default null, p_unidade_informada text default null,
  p_detalhe jsonb default null, p_observacao text default null, p_responsavel_nome text default null,
  p_chave text default null, p_pin text default null, p_justificativa text default null,
  p_origem text default 'movimentacao')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_ins record;
  v_q numeric;
  v_res record;
  v_mov record;
  v_erro text;
  v_custo numeric;
  v_vu numeric;
  v_id uuid;
  v_restricao text;
begin
  if auth.uid() is null then raise exception 'Faça login para movimentar o estoque.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;

  if p_tipo is null or p_tipo not in ('entrada', 'saida') then raise exception 'Escolha ENTRADA ou RETIRADA.'; end if;
  if p_motivo is null or not (
       (p_tipo = 'entrada' and p_motivo in ('compra', 'recebimento', 'producao', 'devolucao', 'transferencia_recebida', 'ajuste_autorizado'))
    or (p_tipo = 'saida' and p_motivo in ('consumo', 'perda', 'vencimento', 'quebra', 'transferencia_enviada', 'producao', 'ajuste_autorizado'))) then
    raise exception 'Escolha o motivo da %.', case p_tipo when 'entrada' then 'entrada' else 'retirada' end;
  end if;
  if coalesce(p_origem, 'movimentacao') not in ('movimentacao', 'compra', 'producao', 'etiqueta', 'bebida') then
    raise exception 'Origem inválida.';
  end if;
  v_q := round(p_quantidade, 3);
  if v_q is null or v_q <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  if v_q >= 1e9 then raise exception 'Quantidade grande demais: confira o número.'; end if;

  if p_motivo = 'ajuste_autorizado' then
    if not public._estoque_pode('autorizar', p_unidade_id) then
      raise exception 'Sem permissão: ajuste de estoque só com administrador autorizado.';
    end if;
    if length(btrim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo do ajuste.'; end if;
  elsif not public._estoque_pode('movimentar', p_unidade_id, p_tipo) then
    raise exception 'Sem permissão para lançar % de estoque nesta unidade.', case p_tipo when 'entrada' then 'entrada' else 'retirada' end;
  end if;

  if p_chave is not null then
    select id, saldo_anterior, saldo_posterior into v_mov from public.estoque_movimentacoes_multi
     where unidade_id = p_unidade_id and chave_idempotencia = p_chave;
    if v_mov.id is not null then
      return jsonb_build_object('ok', true, 'idempotente', true, 'movimento_id', v_mov.id,
                                'saldo_anterior', v_mov.saldo_anterior, 'saldo_posterior', v_mov.saldo_posterior);
    end if;
  end if;

  perform 1 from public.estoques where id = p_estoque_id and unidade_id = p_unidade_id and coalesce(status, 'ativo') = 'ativo';
  if not found then raise exception 'Estoque não encontrado nesta unidade.'; end if;
  select id, nome, unidade_medida, unidade_id into v_ins from public.insumos where id = p_insumo_id;
  if v_ins.id is null or (v_ins.unidade_id is not null and v_ins.unidade_id <> p_unidade_id) then
    raise exception 'Produto não encontrado nesta unidade.';
  end if;

  if p_motivo = 'ajuste_autorizado' then
    v_erro := public._estoque_conferir_pin(p_unidade_id, p_pin);
    perform public._estoque_registrar_autorizacao(p_unidade_id, 'ajuste_autorizado', p_insumo_id, v_user.id, v_user.nome, v_erro, p_justificativa);
    if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;
  end if;

  begin
    select * into v_res from public._estoque_aplicar(p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, v_q,
                                                     p_validade, null, (p_detalhe ->> 'embalagens')::numeric);
    select custo_medio_base into v_custo from public.estoque_custos where unidade_id = p_unidade_id and insumo_id = p_insumo_id;
    -- custo médio é por unidade base do cadastro (g/ml/un); o movimento é na unidade do saldo
    if v_custo is not null then
      v_vu := round(v_custo * public.estoque_fator_base(v_ins.unidade_medida) / public._estoque_fator_saldo(p_insumo_id), 6);
    end if;

    insert into public.estoque_movimentacoes_multi (
      unidade_id, estoque_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
      usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
      motivo, justificativa, origem, autorizado_por, autorizado_por_nome, responsavel_nome, registrado_por,
      unidade_medida, quantidade_informada, unidade_informada, detalhe_quantidade, validade, lotes,
      custo_origem, chave_idempotencia)
    values (
      p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, v_q, v_res.o_saldo_anterior, v_res.o_saldo_posterior,
      v_user.id, v_user.nome, nullif(btrim(coalesce(p_observacao, '')), ''), now(), v_vu,
      case when v_vu is not null then round(v_q * v_vu, 2) end,
      p_motivo, nullif(btrim(coalesce(p_justificativa, '')), ''), coalesce(p_origem, 'movimentacao'),
      case when p_motivo = 'ajuste_autorizado' then v_user.id end,
      case when p_motivo = 'ajuste_autorizado' then v_user.nome end,
      nullif(btrim(coalesce(p_responsavel_nome, '')), ''), auth.uid(),
      public._estoque_unidade_saldo(p_insumo_id), p_quantidade_informada, p_unidade_informada, p_detalhe,
      case when p_tipo = 'entrada' then p_validade end, v_res.o_lotes,
      case when v_vu is not null then 'custo_medio' end, p_chave)
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_restricao = constraint_name;
    if v_restricao <> 'estoque_mov_chave_unica' then raise; end if;
    -- o mesmo lançamento chegou duas vezes ao mesmo tempo: vale o primeiro
    select id, saldo_anterior, saldo_posterior into v_mov from public.estoque_movimentacoes_multi
     where unidade_id = p_unidade_id and chave_idempotencia = p_chave;
    return jsonb_build_object('ok', true, 'idempotente', true, 'movimento_id', v_mov.id,
                              'saldo_anterior', v_mov.saldo_anterior, 'saldo_posterior', v_mov.saldo_posterior);
  end;

  return jsonb_build_object('ok', true, 'idempotente', false, 'movimento_id', v_id,
                            'saldo_anterior', v_res.o_saldo_anterior, 'saldo_posterior', v_res.o_saldo_posterior,
                            'unidade_medida', public._estoque_unidade_saldo(p_insumo_id), 'valor_total', case when v_vu is not null then round(v_q * v_vu, 2) end);
end $$;

-- Estorno: o original fica; entra o movimento contrário, ligado a ele.
create or replace function public.estoque_estornar(
  p_movimento_id uuid, p_justificativa text, p_pin text, p_chave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_mov public.estoque_movimentacoes_multi%rowtype;
  v_dup record;
  v_tipo text;
  v_atual numeric;
  v_unidade_medida text;
  v_erro text;
  v_res record;
  v_id uuid;
  v_restricao text;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;

  select * into v_mov from public.estoque_movimentacoes_multi where id = p_movimento_id;
  if v_mov.id is null then raise exception 'Movimentação não encontrada.'; end if;
  if not public._estoque_pode('autorizar', v_mov.unidade_id) then
    raise exception 'Sem permissão: só administrador autorizado pode estornar.';
  end if;
  if v_mov.tipo not in ('entrada', 'saida') then
    raise exception 'Este tipo de movimentação (%) não é estornado aqui. Transferência: faça a transferência de volta. Contagem antiga: use o ajuste de inventário.', v_mov.tipo;
  end if;
  -- o mesmo pedido repetido (toque duplo, rede lenta) devolve o estorno já feito
  if p_chave is not null then
    select id, saldo_posterior into v_dup from public.estoque_movimentacoes_multi
     where unidade_id = v_mov.unidade_id and chave_idempotencia = p_chave and estorno_de_id = v_mov.id;
    if v_dup.id is not null then
      return jsonb_build_object('ok', true, 'idempotente', true, 'movimento_id', v_dup.id, 'estorno_de_id', v_mov.id,
                                'saldo_posterior', v_dup.saldo_posterior);
    end if;
  end if;
  if v_mov.estorno_de_id is not null then
    raise exception 'Isto já é um estorno. Para refazer, lance a movimentação correta.';
  end if;
  if exists (select 1 from public.estoque_movimentacoes_multi where estorno_de_id = v_mov.id) then
    raise exception 'Esta movimentação já foi estornada.';
  end if;
  if length(btrim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo do estorno.'; end if;

  v_tipo := case v_mov.tipo when 'entrada' then 'saida' else 'entrada' end;
  v_unidade_medida := coalesce(v_mov.unidade_medida, public._estoque_unidade_saldo(v_mov.insumo_id));
  if v_tipo = 'saida' then
    select quantidade_atual into v_atual from public.estoque_itens where estoque_id = v_mov.estoque_id and insumo_id = v_mov.insumo_id;
    if coalesce(v_atual, 0) + 0.0005 < v_mov.quantidade then
      raise exception 'Não dá para estornar a entrada inteira: o saldo atual é % % e a entrada foi de % % (parte já saiu). Use um ajuste autorizado.',
        public.estoque_fmt_qtd(coalesce(v_atual, 0)), coalesce(v_unidade_medida, ''),
        public.estoque_fmt_qtd(v_mov.quantidade), coalesce(v_unidade_medida, '');
    end if;
  end if;

  v_erro := public._estoque_conferir_pin(v_mov.unidade_id, p_pin);
  perform public._estoque_registrar_autorizacao(v_mov.unidade_id, 'estorno', v_mov.id, v_user.id, v_user.nome, v_erro, p_justificativa);
  if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;

  begin
    select * into v_res from public._estoque_aplicar(v_mov.unidade_id, v_mov.estoque_id, v_mov.insumo_id, v_tipo, v_mov.quantidade,
      v_mov.validade,
      coalesce(v_mov.lotes, case when v_mov.validade is not null
                                 then jsonb_build_array(jsonb_build_object('validade', v_mov.validade, 'quantidade', v_mov.quantidade)) end),
      0);

    insert into public.estoque_movimentacoes_multi (
      unidade_id, estoque_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
      usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
      motivo, justificativa, origem, estorno_de_id, autorizado_por, autorizado_por_nome, registrado_por,
      unidade_medida, lotes, custo_origem, chave_idempotencia)
    values (
      v_mov.unidade_id, v_mov.estoque_id, v_mov.insumo_id, v_tipo, v_mov.quantidade, v_res.o_saldo_anterior, v_res.o_saldo_posterior,
      v_user.id, v_user.nome,
      'Estorno de ' || case v_mov.tipo when 'entrada' then 'entrada' else 'retirada' end || ' de '
        || to_char(v_mov.data_movimento at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      now(), v_mov.valor_unitario, v_mov.valor_total,
      'estorno', btrim(p_justificativa), 'estorno', v_mov.id, v_user.id, v_user.nome, auth.uid(),
      coalesce(v_mov.unidade_medida, v_unidade_medida), v_res.o_lotes,
      case when v_mov.valor_unitario is not null then 'estorno' end, p_chave)
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_restricao = constraint_name;
    if v_restricao = 'estoque_mov_estorno_unico' then raise exception 'Esta movimentação já foi estornada.'; end if;
    if v_restricao <> 'estoque_mov_chave_unica' then raise; end if;
    select id, saldo_posterior, estorno_de_id into v_dup from public.estoque_movimentacoes_multi
     where unidade_id = v_mov.unidade_id and chave_idempotencia = p_chave;
    if v_dup.estorno_de_id is distinct from v_mov.id then raise exception 'Este lançamento já foi usado para outra movimentação.'; end if;
    return jsonb_build_object('ok', true, 'idempotente', true, 'movimento_id', v_dup.id, 'estorno_de_id', v_mov.id,
                              'saldo_posterior', v_dup.saldo_posterior);
  end;

  return jsonb_build_object('ok', true, 'idempotente', false, 'movimento_id', v_id, 'estorno_de_id', v_mov.id,
                            'saldo_anterior', v_res.o_saldo_anterior, 'saldo_posterior', v_res.o_saldo_posterior);
end $$;

-- Ajuste do saldo pelo inventário FECHADO. Para cada produto contado:
-- ajuste = contado − saldo do sistema NA HORA em que foi contado (o que
-- entrou/saiu depois da contagem continua valendo). Produto não contado não
-- é tocado (não vira zero).
create or replace function public.estoque_ajustar_inventario(
  p_contagem_id uuid, p_justificativa text, p_pin text, p_itens uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_c public.estoque_contagens%rowtype;
  v_erro text;
  v_it record;
  v_fator numeric;
  v_fs numeric;
  v_us text;
  v_atual numeric;
  v_na_contagem numeric;
  v_contado numeric;
  v_ajuste numeric;
  v_res record;
  v_saldo_antes numeric;
  v_saldo_depois numeric;
  v_vu numeric;
  v_status text;
  v_lista jsonb := '[]'::jsonb;
  v_ajustados integer := 0;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;

  select * into v_c from public.estoque_contagens where id = p_contagem_id;
  if v_c.id is null then raise exception 'Inventário não encontrado.'; end if;
  if not public._estoque_pode('autorizar', v_c.unidade_id) then
    raise exception 'Sem permissão: só administrador autorizado ajusta o estoque pelo inventário.';
  end if;
  if v_c.status <> 'fechada' then raise exception 'Feche o inventário antes de ajustar o estoque.'; end if;
  if length(btrim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo do ajuste.'; end if;

  v_erro := public._estoque_conferir_pin(v_c.unidade_id, p_pin);
  perform public._estoque_registrar_autorizacao(v_c.unidade_id, 'ajuste_inventario', v_c.id, v_user.id, v_user.nome, v_erro, p_justificativa);
  if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;

  for v_it in
    select ci.id, ci.insumo_id, ci.estoque_id, ci.quantidade_contada, ci.unidade_base, ci.quantidade_sistema,
           ci.custo_unitario, ci.created_at, i.nome, i.unidade_medida
      from public.estoque_contagens_itens ci join public.insumos i on i.id = ci.insumo_id
     where ci.contagem_id = v_c.id and (p_itens is null or ci.id = any(p_itens))
     order by i.nome, ci.id
  loop
    v_status := null; v_ajuste := null; v_na_contagem := null; v_contado := null; v_atual := null;
    v_saldo_antes := null; v_saldo_depois := null;
    v_fator := public.estoque_fator_base(v_it.unidade_medida);
    v_fs := public._estoque_fator_saldo(v_it.insumo_id);
    v_us := public._estoque_unidade_saldo(v_it.insumo_id);

    if v_it.estoque_id is null then
      v_status := 'sem_local';
    elsif exists (select 1 from public.estoque_movimentacoes_multi where inventario_item_id = v_it.id and motivo = 'ajuste_inventario') then
      v_status := 'ja_ajustado';
    elsif exists (select 1 from public.estoque_movimentacoes_multi
                   where estoque_id = v_it.estoque_id and insumo_id = v_it.insumo_id and tipo = 'contagem'
                     and observacao like '%[inventario:' || v_c.id::text || ']%') then
      -- já aplicado ao saldo pelo caminho anterior (fechar → registrar_contagem_estoque_multi)
      v_status := 'ja_ajustado';
    elsif v_it.unidade_base <> public.estoque_unidade_base(v_it.unidade_medida) then
      v_status := 'unidade_mudou';
    elsif exists (select 1 from public.estoque_contagens_itens o join public.estoque_contagens oc on oc.id = o.contagem_id
                   where o.insumo_id = v_it.insumo_id and o.estoque_id = v_it.estoque_id and o.id <> v_it.id
                     and oc.status <> 'cancelada' and o.created_at > v_it.created_at) then
      v_status := 'existe_contagem_mais_recente';
    else
      select quantidade_atual into v_atual from public.estoque_itens
       where estoque_id = v_it.estoque_id and insumo_id = v_it.insumo_id for update;
      v_atual := coalesce(v_atual, 0);
      -- saldo do sistema quando o produto foi contado: o "antes" do primeiro
      -- movimento depois da contagem; sem movimento depois, o saldo atual.
      select m.saldo_anterior into v_na_contagem from public.estoque_movimentacoes_multi m
       where m.estoque_id = v_it.estoque_id and m.insumo_id = v_it.insumo_id and m.created_at > v_it.created_at
       order by m.created_at, m.id limit 1;
      v_na_contagem := coalesce(v_na_contagem, v_atual);
      v_contado := round(v_it.quantidade_contada / v_fator * v_fs, 3);
      v_ajuste := round(v_contado - v_na_contagem, 3);

      if abs(v_ajuste) < 0.0005 then
        v_status := 'sem_diferenca';
      elsif v_ajuste < 0 and v_atual + 0.0005 < -v_ajuste then
        v_status := 'saldo_insuficiente';
      else
        select * into v_res from public._estoque_aplicar(v_c.unidade_id, v_it.estoque_id, v_it.insumo_id,
          case when v_ajuste > 0 then 'entrada' else 'saida' end, abs(v_ajuste), null, null, 0);
        v_saldo_antes := v_res.o_saldo_anterior;
        v_saldo_depois := v_res.o_saldo_posterior;
        v_vu := case when v_it.custo_unitario is not null then round(v_it.custo_unitario * v_fator / v_fs, 6) end;
        insert into public.estoque_movimentacoes_multi (
          unidade_id, estoque_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
          usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
          motivo, justificativa, origem, autorizado_por, autorizado_por_nome, registrado_por,
          unidade_medida, detalhe_quantidade, lotes, inventario_id, inventario_item_id, custo_origem)
        values (
          v_c.unidade_id, v_it.estoque_id, v_it.insumo_id, case when v_ajuste > 0 then 'entrada' else 'saida' end, abs(v_ajuste),
          v_res.o_saldo_anterior, v_res.o_saldo_posterior, v_user.id, v_user.nome,
          'Ajuste do inventário de ' || to_char(v_c.data_referencia, 'DD/MM/YYYY') || ': contado '
            || public.estoque_fmt_qtd(v_contado) || ', sistema na contagem ' || public.estoque_fmt_qtd(v_na_contagem),
          now(), v_vu, case when v_vu is not null then round(abs(v_ajuste) * v_vu, 2) end,
          'ajuste_inventario', btrim(p_justificativa), 'inventario', v_user.id, v_user.nome, auth.uid(),
          v_us,
          jsonb_build_object('contado', v_contado, 'sistema_na_contagem', v_na_contagem,
                             'sistema_registrado_na_contagem', case when v_it.quantidade_sistema is not null then round(v_it.quantidade_sistema / v_fator * v_fs, 3) end,
                             'ajuste', v_ajuste),
          v_res.o_lotes, v_c.id, v_it.id, case when v_vu is not null then 'inventario' end);
        v_status := 'ajustado';
        v_ajustados := v_ajustados + 1;
      end if;
    end if;

    v_lista := v_lista || jsonb_build_object('item_id', v_it.id, 'insumo_id', v_it.insumo_id, 'estoque_id', v_it.estoque_id,
      'nome', v_it.nome, 'unidade_medida', v_us, 'status', v_status, 'contado', v_contado,
      'sistema_na_contagem', v_na_contagem, 'ajuste', v_ajuste,
      'saldo_anterior', v_saldo_antes, 'saldo_posterior', v_saldo_depois);
  end loop;

  return jsonb_build_object('ok', true, 'ajustados', v_ajustados, 'itens', v_lista);
end $$;

-- O que a tela precisa saber (sem nada sensível para quem não administra).
create or replace function public.estoque_seguranca_status(p_unidade_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.estoque_seguranca%rowtype;
  v_admin boolean;
  v_config boolean;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_unidade_id is null or not public.hefisto_user_in_unit(auth.uid(), p_unidade_id) then
    raise exception 'Sem acesso a esta unidade.';
  end if;
  if exists (select 1 from public.unidades where id = p_unidade_id) then
    insert into public.estoque_seguranca (unidade_id, pin_hash)
    values (p_unidade_id, extensions.crypt('1234', extensions.gen_salt('bf', 8)))
    on conflict (unidade_id) do nothing;
  end if;
  select * into s from public.estoque_seguranca where unidade_id = p_unidade_id;
  v_admin := public._estoque_pode('autorizar', p_unidade_id);
  v_config := public._estoque_pode('configurar', p_unidade_id);
  return jsonb_build_object(
    'contagem_cega', coalesce(s.contagem_cega, true),
    'pode_entrada', public._estoque_pode('movimentar', p_unidade_id, 'entrada'),
    'pode_retirada', public._estoque_pode('movimentar', p_unidade_id, 'saida'),
    'pode_autorizar', v_admin,
    'pode_configurar', v_config,
    'pin_padrao', case when v_admin or v_config then coalesce(s.pin_padrao, true) end,
    'pin_bloqueado_ate', case when (v_admin or v_config) and s.bloqueado_ate > now() then s.bloqueado_ate end);
end $$;

-- Trocar o PIN e/ou a contagem cega. Exige a permissão de configurar + PIN atual.
create or replace function public.estoque_seguranca_salvar(
  p_unidade_id text, p_pin_atual text, p_pin_novo text default null, p_contagem_cega boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_erro text;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;
  if not public._estoque_pode('configurar', p_unidade_id) then
    raise exception 'Sem permissão para alterar a segurança do estoque.';
  end if;
  if p_pin_novo is not null and p_pin_novo !~ '^[0-9]{4,8}$' then
    raise exception 'O PIN novo deve ter de 4 a 8 números.';
  end if;
  if p_pin_novo is null and p_contagem_cega is null then raise exception 'Nada para salvar.'; end if;

  v_erro := public._estoque_conferir_pin(p_unidade_id, p_pin_atual);
  perform public._estoque_registrar_autorizacao(p_unidade_id,
    case when p_pin_novo is not null then 'troca_pin' else 'configuracao' end, null, v_user.id, v_user.nome, v_erro,
    case when p_contagem_cega is not null then 'contagem_cega=' || p_contagem_cega end);
  if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;

  update public.estoque_seguranca
     set pin_hash         = case when p_pin_novo is not null then extensions.crypt(p_pin_novo, extensions.gen_salt('bf', 8)) else pin_hash end,
         pin_padrao       = case when p_pin_novo is not null then p_pin_novo = '1234' else pin_padrao end,
         pin_alterado_em  = case when p_pin_novo is not null then now() else pin_alterado_em end,
         pin_alterado_por = case when p_pin_novo is not null then v_user.id else pin_alterado_por end,
         contagem_cega    = coalesce(p_contagem_cega, contagem_cega),
         atualizado_em    = now(),
         atualizado_por   = v_user.id
   where unidade_id = p_unidade_id;
  return jsonb_build_object('ok', true) || public.estoque_seguranca_status(p_unidade_id);
end $$;


/* ── 6. QUEM PODE CHAMAR O QUÊ ─────────────────────────────────────────────── */
revoke all on function public.estoque_movimentar(text, uuid, uuid, text, text, numeric, date, numeric, text, jsonb, text, text, text, text, text, text) from public, anon;
revoke all on function public.estoque_estornar(uuid, text, text, text) from public, anon;
revoke all on function public.estoque_ajustar_inventario(uuid, text, text, uuid[]) from public, anon;
revoke all on function public.estoque_seguranca_status(text) from public, anon;
revoke all on function public.estoque_seguranca_salvar(text, text, text, boolean) from public, anon;
grant execute on function public.estoque_movimentar(text, uuid, uuid, text, text, numeric, date, numeric, text, jsonb, text, text, text, text, text, text) to authenticated;
grant execute on function public.estoque_estornar(uuid, text, text, text) to authenticated;
grant execute on function public.estoque_ajustar_inventario(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.estoque_seguranca_status(text) to authenticated;
grant execute on function public.estoque_seguranca_salvar(text, text, text, boolean) to authenticated;

revoke all on function public._estoque_usuario() from public, anon, authenticated;
revoke all on function public._estoque_pode(text, text, text) from public, anon, authenticated;
revoke all on function public._estoque_conferir_pin(text, text) from public, anon, authenticated;
revoke all on function public._estoque_registrar_autorizacao(text, text, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._estoque_lotes_mapa(uuid, uuid) from public, anon, authenticated;
revoke all on function public._estoque_lotes_diff(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public._estoque_fracionavel(uuid) from public, anon, authenticated;
revoke all on function public._estoque_fator_saldo(uuid) from public, anon, authenticated;
revoke all on function public._estoque_unidade_saldo(uuid) from public, anon, authenticated;
revoke all on function public._estoque_aplicar(text, uuid, uuid, text, numeric, date, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.estoque_historico_imutavel_trg() from public, anon, authenticated;
revoke all on function public.estoque_fator_base(text) from public, anon;
revoke all on function public.estoque_unidade_base(text) from public, anon;
revoke all on function public.estoque_fmt_qtd(numeric) from public, anon;
grant execute on function public.estoque_fmt_qtd(numeric) to authenticated;
grant execute on function public.estoque_fator_base(text) to authenticated;
grant execute on function public.estoque_unidade_base(text) to authenticated;

-- Funções antigas de estoque e bebidas: fora do anon (sem login), mantidas para
-- o authenticated (telas atuais).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'sincronizar_item_por_lotes', 'entrada_lote_estoque', 'saida_lote_estoque', 'registrar_movimento_estoque_lote',
       'registrar_movimento_estoque_multi', 'registrar_contagem_estoque_multi', 'sincronizar_lotes_apos_contagem',
       'transferir_lotes_estoque', 'transferir_item_entre_estoques',
       'bebida_conteudo', 'bebida_entrada_unidades', 'bebida_baixa_unidades', 'bebida_baixa_conteudo', 'bebida_contagem', 'bebida_zerar')
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated', f.assinatura);
  end loop;
end $$;


/* ── 7. CONFERÊNCIA FINAL (aborta tudo se algo não ficou como esperado) ───── */
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estoque_movimentacoes_multi'
              and policyname not in ('estoque_mov_ler_unidade', 'estoque_mov_inserir_simples')) then
    raise exception 'EST-MOV-1: há outra policy no histórico além das novas. Nada foi alterado (revise antes).';
  end if;
  if has_table_privilege('authenticated', 'public.estoque_movimentacoes_multi', 'DELETE')
     or has_table_privilege('authenticated', 'public.estoque_movimentacoes_multi', 'UPDATE')
     or has_table_privilege('authenticated', 'public.estoque_seguranca', 'SELECT')
     or has_table_privilege('anon', 'public.estoque_movimentacoes_multi', 'SELECT') then
    raise exception 'EST-MOV-1: privilégio indevido sobrou. Nada foi alterado.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'bebida\_%' and has_function_privilege('anon', p.oid, 'execute')) then
    raise exception 'EST-MOV-1: função de bebida ainda aberta ao anon. Nada foi alterado.';
  end if;
end $$;

commit;


/* ── CONFERÊNCIA (só leitura), depois de rodar ────────────────────────────────
select 'policies' as o_que, string_agg(policyname, ', ') as resultado from pg_policies
 where schemaname = 'public' and tablename = 'estoque_movimentacoes_multi'
union all
select 'authenticated no histórico', string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'estoque_movimentacoes_multi' and grantee = 'authenticated'
union all
select 'triggers do histórico', string_agg(tgname, ', ') from pg_trigger
 where tgrelid = 'public.estoque_movimentacoes_multi'::regclass and not tgisinternal
union all
select 'movimentos (devem ser os mesmos 345)', count(*)::text from public.estoque_movimentacoes_multi
union all
select 'PIN guardado como hash', string_agg(unidade_id || '=' || (pin_hash like '$2%')::text, ', ') from public.estoque_seguranca
union all
select 'anon executa bebida_zerar', has_function_privilege('anon', 'public.bebida_zerar(text,uuid,uuid,text,uuid,text)', 'execute')::text;
   ────────────────────────────────────────────────────────────────────────── */
