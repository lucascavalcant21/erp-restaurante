/* ═══════════════════════════════════════════════════════════════════════════
   EST-MOV-3 · O SALDO DO ESTOQUE SÓ MUDA PELAS FUNÇÕES DO BANCO

   STATUS: PROPOSTA. Rodar só com aprovação do dono, e NESTA ORDEM:
     1. EST-MOV-1 e EST-MOV-2 aplicadas;
     2. o app novo (Fase 3) publicado — ele já não grava saldo direto;
     3. então esta.
   Rodar antes do app novo trava as telas antigas (elas gravavam direto).

   Depois da EST-MOV-1/2, um usuário logado ainda conseguia, chamando a API:
   mudar quantidade_atual em estoque_itens, mexer nos lotes, inserir linha no
   histórico no formato antigo e usar as funções antigas (que sobrescrevem o
   saldo sem motivo nem permissão, e o "zerar" das bebidas).

   FAZ (uma transação; aborta sem mudar nada se faltar a EST-MOV-1/2):
     1. estoque_transferir: transferência entre locais pelo banco (permissão,
        trava, FEFO com a validade indo junto, motivo, quem, sem duplicar).
     2. estoque_itens: quem vem pelo app não muda saldo (quantidade, fechado,
        aberto), não cria item com saldo e não apaga item que tem saldo.
        Mínimo, máximo, local, custo e validade continuam editáveis.
     3. estoque_lotes: só leitura para o app.
     4. histórico: o app não insere mais direto (só as funções).
     5. funções antigas de saldo e de bebidas: sem EXECUTE para o app.
   NÃO FAZ: não altera nenhum saldo, lote ou movimento existente; não mexe em
   estoque_atual (tabela antiga e global, usada pela Mesa) nem nas rotas de
   servidor (service role).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regprocedure('public.estoque_movimentar(text,uuid,uuid,text,text,numeric,date,numeric,text,jsonb,text,text,text,text,text,text)') is null
     or to_regprocedure('public.estoque_contagem_corrigir_item(uuid,numeric,text,text)') is null
     or to_regprocedure('public._estoque_unidade_saldo(uuid)') is null then
    raise exception 'EST-MOV-3: rode antes a EST-MOV-1 (versão atual) e a EST-MOV-2. Nada foi alterado.';
  end if;
end $$;


/* ── 1. TRANSFERÊNCIA PELO BANCO ───────────────────────────────────────────── */
-- p_quantidade na unidade do saldo. Os lotes vão com a validade (FEFO da origem).
create or replace function public.estoque_transferir(
  p_unidade_id text, p_estoque_origem_id uuid, p_estoque_destino_id uuid, p_insumo_id uuid, p_quantidade numeric,
  p_observacao text default null, p_responsavel_nome text default null, p_chave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_q numeric;
  v_tipo_o text;
  v_tipo_d text;
  v_orig public.estoque_itens%rowtype;
  v_dest public.estoque_itens%rowtype;
  v_soma numeric;
  v_antes jsonb;
  v_lotes jsonb;
  v_novo_o numeric;
  v_novo_d numeric;
  v_transf uuid := gen_random_uuid();
  v_us text;
  v_custo numeric;
  v_vu numeric;
  v_um text;
  v_dup record;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;
  if not (public.hefisto_user_can('estoque.transfers.transfer', p_unidade_id)
          or public.hefisto_user_can('estoque.transfers.create', p_unidade_id)
          or public.hefisto_user_can('estoque.movements.create', p_unidade_id)
          or public.hefisto_user_can('estoque.overview.adjust_stock', p_unidade_id)
          or public.hefisto_user_can('estoque.operation.adjust_stock', p_unidade_id)
          or public.hefisto_user_can('estoque.operation.create', p_unidade_id)) then
    raise exception 'Sem permissão para transferir entre estoques nesta unidade.';
  end if;
  if p_estoque_origem_id is null or p_estoque_destino_id is null or p_estoque_origem_id = p_estoque_destino_id then
    raise exception 'Escolha um estoque de origem e outro de destino.';
  end if;
  v_q := round(p_quantidade, 3);
  if v_q is null or v_q <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;

  if p_chave is not null then
    select id, saldo_posterior into v_dup from public.estoque_movimentacoes_multi
     where unidade_id = p_unidade_id and chave_idempotencia = p_chave;
    if v_dup.id is not null then
      return jsonb_build_object('ok', true, 'idempotente', true, 'movimento_id', v_dup.id, 'saldo_origem', v_dup.saldo_posterior);
    end if;
  end if;

  select tipo into v_tipo_o from public.estoques where id = p_estoque_origem_id and unidade_id = p_unidade_id and coalesce(status, 'ativo') = 'ativo';
  select tipo into v_tipo_d from public.estoques where id = p_estoque_destino_id and unidade_id = p_unidade_id and coalesce(status, 'ativo') = 'ativo';
  if v_tipo_o is null or v_tipo_d is null then raise exception 'Estoque não encontrado nesta unidade.'; end if;
  -- mesma regra da transferência antiga: tipos iguais, ou alimentos ↔ bebidas
  if v_tipo_o <> v_tipo_d and not (v_tipo_o in ('alimentos', 'bebidas') and v_tipo_d in ('alimentos', 'bebidas')) then
    raise exception 'Os tipos destes estoques não permitem transferência entre si.';
  end if;

  select * into v_orig from public.estoque_itens where estoque_id = p_estoque_origem_id and insumo_id = p_insumo_id for update;
  if v_orig.id is null then raise exception 'Este produto não está no estoque de origem.'; end if;
  if v_orig.permite_transferencia is false then raise exception 'Este produto não permite transferência.'; end if;
  v_us := public._estoque_unidade_saldo(p_insumo_id);
  if coalesce(v_orig.quantidade_atual, 0) + 0.0005 < v_q then
    raise exception 'Saldo insuficiente na origem: há % % e a transferência é de % %.',
      public.estoque_fmt_qtd(coalesce(v_orig.quantidade_atual, 0)), coalesce(v_us, ''), public.estoque_fmt_qtd(v_q), coalesce(v_us, '');
  end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id, estoque_minimo, estoque_maximo, custo_unitario, permite_transferencia)
  values (p_unidade_id, p_estoque_destino_id, p_insumo_id, v_orig.estoque_minimo, v_orig.estoque_maximo, v_orig.custo_unitario, v_orig.permite_transferencia)
  on conflict (estoque_id, insumo_id) do nothing;
  select * into v_dest from public.estoque_itens where estoque_id = p_estoque_destino_id and insumo_id = p_insumo_id for update;

  -- os lotes da origem lastreiam o saldo antes de mover (escrita antiga pode ter mexido só no saldo)
  select coalesce(sum(quantidade), 0) into v_soma from public.estoque_lotes where estoque_id = p_estoque_origem_id and insumo_id = p_insumo_id;
  if abs(v_soma - coalesce(v_orig.quantidade_atual, 0)) > 0.0005 then
    perform public.sincronizar_lotes_apos_contagem(p_unidade_id, p_estoque_origem_id, p_insumo_id, coalesce(v_orig.quantidade_atual, 0));
  end if;

  v_antes := public._estoque_lotes_mapa(p_estoque_origem_id, p_insumo_id);
  perform public.transferir_lotes_estoque(p_unidade_id, p_estoque_origem_id, p_estoque_destino_id, p_insumo_id, v_q);
  v_novo_o := public.sincronizar_item_por_lotes(p_estoque_origem_id, p_insumo_id);
  v_novo_d := public.sincronizar_item_por_lotes(p_estoque_destino_id, p_insumo_id);
  v_lotes := public._estoque_lotes_diff(v_antes, public._estoque_lotes_mapa(p_estoque_origem_id, p_insumo_id));
  update public.estoque_itens set ultima_movimentacao_em = now() where id in (v_orig.id, v_dest.id);

  select unidade_medida into v_um from public.insumos where id = p_insumo_id;
  select custo_medio_base into v_custo from public.estoque_custos where unidade_id = p_unidade_id and insumo_id = p_insumo_id;
  if v_custo is not null then v_vu := round(v_custo * public.estoque_fator_base(v_um) / public._estoque_fator_saldo(p_insumo_id), 6); end if;

  insert into public.estoque_movimentacoes_multi (
    transferencia_id, unidade_id, estoque_id, estoque_destino_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
    usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
    motivo, origem, responsavel_nome, registrado_por, unidade_medida, lotes, custo_origem, chave_idempotencia)
  values
  (v_transf, p_unidade_id, p_estoque_origem_id, p_estoque_destino_id, p_insumo_id, 'transferencia_saida', v_q,
   coalesce(v_orig.quantidade_atual, 0), v_novo_o, v_user.id, v_user.nome, nullif(btrim(coalesce(p_observacao, '')), ''), now(),
   v_vu, case when v_vu is not null then round(v_q * v_vu, 2) end,
   'transferencia_enviada', 'transferencia', nullif(btrim(coalesce(p_responsavel_nome, '')), ''), auth.uid(), v_us, v_lotes,
   case when v_vu is not null then 'custo_medio' end, p_chave),
  (v_transf, p_unidade_id, p_estoque_destino_id, p_estoque_origem_id, p_insumo_id, 'transferencia_entrada', v_q,
   coalesce(v_dest.quantidade_atual, 0), v_novo_d, v_user.id, v_user.nome, nullif(btrim(coalesce(p_observacao, '')), ''), now(),
   v_vu, case when v_vu is not null then round(v_q * v_vu, 2) end,
   'transferencia_recebida', 'transferencia', nullif(btrim(coalesce(p_responsavel_nome, '')), ''), auth.uid(), v_us, v_lotes,
   case when v_vu is not null then 'custo_medio' end, case when p_chave is not null then p_chave || '#destino' end);

  return jsonb_build_object('ok', true, 'idempotente', false, 'transferencia_id', v_transf,
                            'saldo_origem', v_novo_o, 'saldo_destino', v_novo_d, 'unidade_medida', v_us);
end $$;

revoke all on function public.estoque_transferir(text, uuid, uuid, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.estoque_transferir(text, uuid, uuid, uuid, numeric, text, text, text) to authenticated;


/* ── 2. estoque_itens: saldo só pelas funções ─────────────────────────────── */
create or replace function public.estoque_item_saldo_travado_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.quantidade_atual, 0) <> 0 or coalesce(new.saldo_fechado, 0) <> 0 or coalesce(new.saldo_aberto, 0) <> 0 then
        raise exception 'O saldo do estoque só muda por entrada, retirada, transferência ou ajuste autorizado.';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.quantidade_atual is distinct from old.quantidade_atual
         or new.saldo_fechado is distinct from old.saldo_fechado or new.saldo_aberto is distinct from old.saldo_aberto
         or new.estoque_id is distinct from old.estoque_id or new.insumo_id is distinct from old.insumo_id
         or new.unidade_id is distinct from old.unidade_id then
        raise exception 'O saldo do estoque só muda por entrada, retirada, transferência ou ajuste autorizado.';
      end if;
    elsif coalesce(old.quantidade_atual, 0) <> 0 then
      raise exception 'Produto com saldo não sai do estoque: lance a retirada (com motivo) antes.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists estoque_itens_saldo_travado on public.estoque_itens;
create trigger estoque_itens_saldo_travado before insert or update or delete on public.estoque_itens
  for each row execute function public.estoque_item_saldo_travado_trg();
revoke all on function public.estoque_item_saldo_travado_trg() from public, anon, authenticated;


/* ── 3 e 4. lotes e histórico: o app só lê ─────────────────────────────────── */
revoke insert, update, delete, truncate, references, trigger on public.estoque_lotes from authenticated;
grant select on public.estoque_lotes to authenticated;

drop policy if exists estoque_mov_inserir_simples on public.estoque_movimentacoes_multi;
revoke insert on public.estoque_movimentacoes_multi from authenticated;


/* ── 5. funções antigas de saldo e de bebidas: só pelas funções novas ──────── */
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
       'bebida_entrada_unidades', 'bebida_baixa_unidades', 'bebida_baixa_conteudo', 'bebida_contagem', 'bebida_zerar')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end $$;


/* ── CONFERÊNCIA FINAL (aborta tudo se algo não ficou como esperado) ──────── */
do $$
begin
  if has_table_privilege('authenticated', 'public.estoque_movimentacoes_multi', 'INSERT')
     or has_table_privilege('authenticated', 'public.estoque_lotes', 'UPDATE')
     or has_function_privilege('authenticated', 'public.bebida_zerar(text,uuid,uuid,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_contagem_estoque_multi(text,uuid,uuid,numeric,uuid,text,text)', 'execute') then
    raise exception 'EST-MOV-3: escrita direta ainda aberta. Nada foi alterado.';
  end if;
end $$;

commit;


/* ── CONFERÊNCIA (só leitura), depois de rodar ────────────────────────────────
select 'authenticated no histórico' as o_que, string_agg(privilege_type, ',' order by privilege_type) as resultado
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'estoque_movimentacoes_multi' and grantee = 'authenticated'
union all
select 'authenticated nos lotes', string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'estoque_lotes' and grantee = 'authenticated'
union all
select 'trigger do saldo', string_agg(tgname, ', ') from pg_trigger where tgrelid = 'public.estoque_itens'::regclass and tgname = 'estoque_itens_saldo_travado'
union all
select 'app executa bebida_zerar', has_function_privilege('authenticated', 'public.bebida_zerar(text,uuid,uuid,text,uuid,text)', 'execute')::text;
   ────────────────────────────────────────────────────────────────────────── */
