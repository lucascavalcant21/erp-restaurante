/* ═══════════════════════════════════════════════════════════════════════════
   UNID-MARM-1 · transferência de estoque ENTRE UNIDADES (14/10/2026)

   POR QUE
   A Marmitaria passa a ser uma unidade própria (negócio separado do
   restaurante, decisão do dono 14/10). O dono quer estoques separados, mas
   com transferência CONTROLADA entre unidades da mesma empresa (ex.: o
   restaurante cede arroz à marmitaria). A transferência existente
   (estoque_transferir) só move entre estoques da MESMA unidade.

   O QUE FAZ (aditivo; nenhum movimento ou custo existente é alterado)
   1. estoque_custos / estoque_custos_historico: o tipo de origem do custo
      ganha 'TRANSFERENCIA' (as restrições são recriadas com a lista antiga +
      o valor novo; toda linha existente continua válida).
   2. estoque_transferencias_unidades: o registro de cada transferência entre
      unidades (origem, destino, quantidade, valor ao custo médio da origem),
      visível para quem enxerga qualquer uma das duas unidades. Base do
      acerto entre os negócios e da correção do CMV (o inventário da origem
      cai sem ser consumo).
   3. estoque_transferir_unidades(dados): numa transação só
        - confere login, empresa igual, permissão de RETIRAR na origem e de
          DAR ENTRADA no destino (as mesmas regras de estoque_movimentar);
        - exige produtos com a mesma unidade de medida nos dois cadastros;
        - retira na origem e dá entrada no destino pelos lotes
          (_estoque_aplicar), grava os dois movimentos com o valor ao custo
          médio da origem e atualiza o custo médio do destino como numa
          compra (estoque_custo_registrar_entrada, origem TRANSFERENCIA);
        - chave idempotente: reenviar não transfere de novo.

   SEGURANÇA
   - Tabela nova com RLS; leitura para quem enxerga a origem OU o destino;
     ninguém grava direto (só pela função).
   - Função SECURITY DEFINER com checagem explícita de usuário, empresa e
     permissão nas duas unidades; EXECUTE só para authenticated.

   ROLLBACK (não rodar sem decisão do dono):
     drop function if exists public.estoque_transferir_unidades(jsonb);
     drop table if exists public.estoque_transferencias_unidades;   -- apaga o registro (os movimentos ficam)
     -- as restrições de origem_tipo podem voltar à lista antiga só se não houver linha 'TRANSFERENCIA'
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight ──────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public._estoque_aplicar(text,uuid,uuid,text,numeric,date,jsonb,numeric)',
    'public._estoque_pode(text,text,text)',
    'public._estoque_usuario()',
    'public._estoque_unidade_saldo(uuid)',
    'public._estoque_fator_saldo(uuid)',
    'public.estoque_fator_base(text)',
    'public.estoque_custo_registrar_entrada(text,uuid,text,numeric,numeric,date,text,uuid)',
    'public.hefisto_unidades_do_usuario()',
    'public.hefisto_ve_todas_unidades()'] loop
    if to_regprocedure(f) is null then
      raise exception 'UNID-MARM-1: função % ausente. Nada foi alterado.', f;
    end if;
  end loop;
  if to_regclass('public.estoque_custos') is null or to_regclass('public.estoque_custos_historico') is null
     or to_regclass('public.estoque_movimentacoes_multi') is null then
    raise exception 'UNID-MARM-1: tabelas de estoque/custo ausentes. Nada foi alterado.';
  end if;
end $$;

-- ── 1. Origem de custo 'TRANSFERENCIA' ───────────────────────────────────────
alter table public.estoque_custos drop constraint if exists estoque_custos_origem_tipo_check;
alter table public.estoque_custos add constraint estoque_custos_origem_tipo_check
  check (origem_tipo = any (array['COMPRA', 'CONTAGEM', 'AJUSTE', 'TRANSFERENCIA']));
alter table public.estoque_custos_historico drop constraint if exists estoque_custos_historico_origem_tipo_check;
alter table public.estoque_custos_historico add constraint estoque_custos_historico_origem_tipo_check
  check (origem_tipo = any (array['COMPRA', 'CONTAGEM', 'ESTORNO_COMPRA', 'AJUSTE', 'TRANSFERENCIA']));

-- ── 2. Registro das transferências entre unidades ────────────────────────────
create table if not exists public.estoque_transferencias_unidades (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  unidade_origem text not null references public.unidades(id),
  estoque_origem_id uuid not null references public.estoques(id),
  insumo_origem_id uuid not null references public.insumos(id),
  unidade_destino text not null references public.unidades(id),
  estoque_destino_id uuid not null references public.estoques(id),
  insumo_destino_id uuid not null references public.insumos(id),
  quantidade numeric not null check (quantidade > 0),
  unidade_medida text,
  quantidade_base numeric,
  unidade_base text,
  valor numeric,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  constraint estoque_transf_unidades_diferentes check (unidade_origem <> unidade_destino)
);
create index if not exists estoque_transf_unid_origem_idx on public.estoque_transferencias_unidades (unidade_origem, created_at);
create index if not exists estoque_transf_unid_destino_idx on public.estoque_transferencias_unidades (unidade_destino, created_at);

alter table public.estoque_transferencias_unidades enable row level security;
drop policy if exists sec_unidades_ler on public.estoque_transferencias_unidades;
create policy sec_unidades_ler on public.estoque_transferencias_unidades for select to authenticated
  using ((select public.hefisto_ve_todas_unidades())
         or unidade_origem in (select unnest(public.hefisto_unidades_do_usuario()))
         or unidade_destino in (select unnest(public.hefisto_unidades_do_usuario())));
revoke all on public.estoque_transferencias_unidades from public, anon, authenticated;
grant select on public.estoque_transferencias_unidades to authenticated;

-- ── 3. A transferência ───────────────────────────────────────────────────────
create or replace function public.estoque_transferir_unidades(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_ori text := nullif(p_dados ->> 'unidade_origem', '');
  v_dst text := nullif(p_dados ->> 'unidade_destino', '');
  v_est_o uuid := nullif(p_dados ->> 'estoque_origem_id', '')::uuid;
  v_est_d uuid := nullif(p_dados ->> 'estoque_destino_id', '')::uuid;
  v_ins_o uuid := nullif(p_dados ->> 'insumo_origem_id', '')::uuid;
  v_ins_d uuid := nullif(p_dados ->> 'insumo_destino_id', '')::uuid;
  v_chave text := nullif(btrim(coalesce(p_dados ->> 'chave', '')), '');
  v_obs text := nullif(btrim(coalesce(p_dados ->> 'observacao', '')), '');
  v_q numeric;
  v_emp_o uuid; v_emp_d uuid;
  v_nome_o text; v_nome_d text;
  v_io record; v_id record;
  v_fs_o numeric; v_fs_d numeric;
  v_res_o record; v_res_d record;
  v_custo numeric; v_vu numeric; v_valor numeric;
  v_q_base numeric; v_base text;
  v_existente public.estoque_transferencias_unidades;
  v_id_t uuid := gen_random_uuid();
  v_us text;
  v_texto text;
begin
  if auth.uid() is null then raise exception 'Faça login para transferir.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;
  if v_chave is null then raise exception 'Transferência sem chave (recarregue a tela).' using errcode = '22023'; end if;

  -- reenvio: devolve o que já foi feito
  select * into v_existente from public.estoque_transferencias_unidades where chave = v_chave;
  if v_existente.id is not null then
    return jsonb_build_object('ok', true, 'idempotente', true, 'transferencia_id', v_existente.id, 'valor', v_existente.valor);
  end if;

  if v_ori is null or v_dst is null or v_ori = v_dst then
    raise exception 'Escolha a unidade de origem e outra de destino.' using errcode = '22023';
  end if;
  select empresa_id, nome into v_emp_o, v_nome_o from public.unidades where id = v_ori;
  select empresa_id, nome into v_emp_d, v_nome_d from public.unidades where id = v_dst;
  if v_nome_o is null or v_nome_d is null then raise exception 'Unidade não encontrada.' using errcode = '22023'; end if;
  if v_emp_o is null or v_emp_d is null or v_emp_o <> v_emp_d then
    raise exception 'Transferência só entre unidades da mesma empresa.' using errcode = '42501';
  end if;
  if not public._estoque_pode('movimentar', v_ori, 'saida') then
    raise exception 'Sem permissão para retirar do estoque de %.', v_nome_o using errcode = '42501';
  end if;
  if not public._estoque_pode('movimentar', v_dst, 'entrada') then
    raise exception 'Sem permissão para dar entrada no estoque de %.', v_nome_d using errcode = '42501';
  end if;

  perform 1 from public.estoques where id = v_est_o and unidade_id = v_ori and coalesce(status, 'ativo') = 'ativo';
  if not found then raise exception 'Estoque de origem não encontrado em %.', v_nome_o using errcode = '22023'; end if;
  perform 1 from public.estoques where id = v_est_d and unidade_id = v_dst and coalesce(status, 'ativo') = 'ativo';
  if not found then raise exception 'Estoque de destino não encontrado em %.', v_nome_d using errcode = '22023'; end if;

  select id, nome, unidade_medida, unidade_id into v_io from public.insumos where id = v_ins_o;
  select id, nome, unidade_medida, unidade_id into v_id from public.insumos where id = v_ins_d;
  if v_io.id is null or (v_io.unidade_id is not null and v_io.unidade_id <> v_ori) then
    raise exception 'Produto de origem não encontrado em %.', v_nome_o using errcode = '22023';
  end if;
  if v_id.id is null or (v_id.unidade_id is not null and v_id.unidade_id <> v_dst) then
    raise exception 'Produto de destino não encontrado em %.', v_nome_d using errcode = '22023';
  end if;
  v_fs_o := public._estoque_fator_saldo(v_ins_o);
  v_fs_d := public._estoque_fator_saldo(v_ins_d);
  if lower(btrim(coalesce(v_io.unidade_medida, ''))) <> lower(btrim(coalesce(v_id.unidade_medida, ''))) or v_fs_o <> v_fs_d then
    raise exception 'Os cadastros têm unidades diferentes (% em %, % em %): ajuste o cadastro antes de transferir.',
      coalesce(v_io.unidade_medida, '?'), v_nome_o, coalesce(v_id.unidade_medida, '?'), v_nome_d using errcode = '22023';
  end if;

  v_q := round((p_dados ->> 'quantidade')::numeric, 3);
  if v_q is null or v_q <= 0 then raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023'; end if;
  v_us := public._estoque_unidade_saldo(v_ins_o);
  v_texto := 'Transferência entre unidades: ' || v_nome_o || ' → ' || v_nome_d || coalesce(' · ' || v_obs, '');

  -- origem: retira pelos lotes (FEFO); valor ao custo médio da origem
  select * into v_res_o from public._estoque_aplicar(v_ori, v_est_o, v_ins_o, 'saida', v_q, null, null, null);
  select custo_medio_base into v_custo from public.estoque_custos where unidade_id = v_ori and insumo_id = v_ins_o;
  if v_custo is not null then
    v_vu := round(v_custo * public.estoque_fator_base(v_io.unidade_medida) / v_fs_o, 6);
    v_valor := round(v_q * v_vu, 2);
  end if;

  -- destino: dá entrada
  select * into v_res_d from public._estoque_aplicar(v_dst, v_est_d, v_ins_d, 'entrada', v_q, null, null, null);

  insert into public.estoque_movimentacoes_multi (
    transferencia_id, unidade_id, estoque_id, estoque_destino_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
    usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
    motivo, origem, registrado_por, unidade_medida, lotes, custo_origem, chave_idempotencia)
  values
    (v_id_t, v_ori, v_est_o, v_est_d, v_ins_o, 'saida', v_q, v_res_o.o_saldo_anterior, v_res_o.o_saldo_posterior,
     v_user.id, v_user.nome, v_texto, now(), v_vu, v_valor,
     'transferencia_enviada', 'transferencia', auth.uid(), v_us, v_res_o.o_lotes, case when v_vu is not null then 'custo_medio' end, v_chave || '#origem'),
    (v_id_t, v_dst, v_est_d, v_est_o, v_ins_d, 'entrada', v_q, v_res_d.o_saldo_anterior, v_res_d.o_saldo_posterior,
     v_user.id, v_user.nome, v_texto, now(), v_vu, v_valor,
     'transferencia_recebida', 'transferencia', auth.uid(), v_us, v_res_d.o_lotes, case when v_vu is not null then 'custo_medio' end, v_chave || '#destino');

  -- custo médio do destino: como numa compra, pelo valor da origem
  v_q_base := round(v_q * public.estoque_fator_base(v_id.unidade_medida) / v_fs_d, 3);
  v_base := case when v_fs_d <> 1 then 'un'
                 when lower(btrim(coalesce(v_id.unidade_medida, ''))) in ('kg', 'g') then 'g'
                 when lower(btrim(coalesce(v_id.unidade_medida, ''))) in ('l', 'ml') then 'ml'
                 else 'un' end;
  if v_valor is not null and v_q_base > 0 then
    perform public.estoque_custo_registrar_entrada(v_dst, v_ins_d, v_base, v_q_base, v_valor, current_date, 'TRANSFERENCIA', v_id_t);
  end if;

  insert into public.estoque_transferencias_unidades (
    id, chave, unidade_origem, estoque_origem_id, insumo_origem_id, unidade_destino, estoque_destino_id, insumo_destino_id,
    quantidade, unidade_medida, quantidade_base, unidade_base, valor, observacao, criado_por, criado_por_nome)
  values (v_id_t, v_chave, v_ori, v_est_o, v_ins_o, v_dst, v_est_d, v_ins_d,
    v_q, v_us, v_q_base, v_base, v_valor, v_obs, auth.uid(), v_user.nome);

  return jsonb_build_object('ok', true, 'idempotente', false, 'transferencia_id', v_id_t, 'valor', v_valor,
    'saldo_origem', v_res_o.o_saldo_posterior, 'saldo_destino', v_res_d.o_saldo_posterior, 'unidade_medida', v_us,
    'sem_custo', v_valor is null);
end $$;

revoke all on function public.estoque_transferir_unidades(jsonb) from public, anon;
grant execute on function public.estoque_transferir_unidades(jsonb) to authenticated;

commit;

-- Verificação (impressão digital)
select (select count(*) from pg_policies where tablename = 'estoque_transferencias_unidades') as policies,
       has_table_privilege('anon', 'public.estoque_transferencias_unidades', 'select') as anon_le,
       has_table_privilege('authenticated', 'public.estoque_transferencias_unidades', 'insert') as authenticated_insere,
       has_function_privilege('anon', 'public.estoque_transferir_unidades(jsonb)', 'execute') as anon_executa,
       (select pg_get_constraintdef(oid) from pg_constraint where conname = 'estoque_custos_origem_tipo_check') as origem_custo;
