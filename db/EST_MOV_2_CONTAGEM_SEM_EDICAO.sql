/* ═══════════════════════════════════════════════════════════════════════════
   EST-MOV-2 · PRODUTO CONTADO NÃO MUDA SEM O ADMINISTRADOR

   STATUS: PROPOSTA. Rodar só com aprovação do dono, DEPOIS da EST-MOV-1.

   Hoje (F2.4A) qualquer pessoa com acesso à contagem corrige ou apaga um
   produto já contado enquanto o inventário está aberto, inclusive chamando a
   API direto. A regra pedida: depois de confirmar, o funcionário não apaga,
   não zera, não edita, não substitui. Correção só pelo administrador, com PIN.

   FAZ (uma transação; aborta sem mudar nada se a EST-MOV-1 não estiver lá):
     1. trigger em estoque_contagens_itens: quem vem pelo app (authenticated/
        anon) não muda quantidade, produto, local nem o saldo guardado, e não
        apaga linha. Gravar o custo no fechamento continua (é outra coluna).
     2. estoque_contagem_corrigir_item(item, quantidade, motivo, PIN): só
        administrador autorizado, só com o inventário aberto; registra de
        quanto para quanto, quem e por quê (na linha e em estoque_autorizacoes).
   NÃO FAZ: não altera nenhuma contagem existente; inventário fechado continua
   imutável (correção dele é pelo ajuste do estoque, EST-MOV-1).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.estoque_contagens_itens') is null or to_regclass('public.estoque_autorizacoes') is null
     or to_regprocedure('public._estoque_conferir_pin(text,text)') is null
     or to_regprocedure('public._estoque_pode(text,text,text)') is null then
    raise exception 'EST-MOV-2: rode antes a EST-MOV-1. Nada foi alterado.';
  end if;
end $$;

create or replace function public.estoque_contagem_item_travado_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      raise exception 'Produto já contado não pode ser apagado. Correção só pelo administrador, com PIN.';
    end if;
    if new.quantidade_contada is distinct from old.quantidade_contada
       or new.insumo_id is distinct from old.insumo_id or new.estoque_id is distinct from old.estoque_id
       or new.unidade_base is distinct from old.unidade_base or new.quantidade_sistema is distinct from old.quantidade_sistema
       or new.contagem_id is distinct from old.contagem_id then
      raise exception 'Este produto já foi contado. Correção só pelo administrador, com PIN.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists estoque_contagens_itens_travado on public.estoque_contagens_itens;
create trigger estoque_contagens_itens_travado before update or delete on public.estoque_contagens_itens
  for each row execute function public.estoque_contagem_item_travado_trg();

-- p_quantidade na unidade do cadastro (kg, L, un…), como o funcionário conta.
create or replace function public.estoque_contagem_corrigir_item(
  p_item_id uuid, p_quantidade numeric, p_justificativa text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_it public.estoque_contagens_itens%rowtype;
  v_status text;
  v_um text;
  v_fator numeric;
  v_nova numeric;
  v_erro text;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;

  select * into v_it from public.estoque_contagens_itens where id = p_item_id;
  if v_it.id is null then raise exception 'Produto da contagem não encontrado.'; end if;
  if not public._estoque_pode('autorizar', v_it.unidade_id) then
    raise exception 'Sem permissão: só administrador autorizado corrige a contagem.';
  end if;
  select status into v_status from public.estoque_contagens where id = v_it.contagem_id;
  if v_status is distinct from 'aberta' then
    raise exception 'Inventário já fechado: a correção agora é pelo ajuste do estoque.';
  end if;
  if length(btrim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo da correção.'; end if;

  select unidade_medida into v_um from public.insumos where id = v_it.insumo_id;
  if public.estoque_unidade_base(v_um) <> v_it.unidade_base then
    raise exception 'A unidade do cadastro mudou depois da contagem. Corrija o cadastro antes.';
  end if;
  v_fator := public.estoque_fator_base(v_um);
  v_nova := round(p_quantidade * v_fator, 3);
  if v_nova is null or v_nova < 0 or v_nova >= 1e12 then raise exception 'Quantidade inválida.'; end if;

  v_erro := public._estoque_conferir_pin(v_it.unidade_id, p_pin);
  perform public._estoque_registrar_autorizacao(v_it.unidade_id, 'correcao_contagem', v_it.id, v_user.id, v_user.nome, v_erro,
    'de ' || public.estoque_fmt_qtd(v_it.quantidade_contada / v_fator) || ' para '
      || public.estoque_fmt_qtd(v_nova / v_fator) || ' ' || coalesce(v_um, '') || ': ' || btrim(p_justificativa));
  if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;

  update public.estoque_contagens_itens
     set quantidade_contada = v_nova,
         observacao = left(concat_ws(' · ', nullif(observacao, ''),
           'Corrigido por ' || v_user.nome || ': ' || public.estoque_fmt_qtd(v_it.quantidade_contada / v_fator)
           || ' → ' || public.estoque_fmt_qtd(v_nova / v_fator) || ' ' || coalesce(v_um, '') || ' (' || btrim(p_justificativa) || ')'), 1000)
   where id = v_it.id;

  return jsonb_build_object('ok', true, 'item_id', v_it.id,
                            'quantidade_anterior', round(v_it.quantidade_contada / v_fator, 3), 'quantidade', round(v_nova / v_fator, 3));
end $$;

revoke all on function public.estoque_contagem_corrigir_item(uuid, numeric, text, text) from public, anon;
grant execute on function public.estoque_contagem_corrigir_item(uuid, numeric, text, text) to authenticated;
revoke all on function public.estoque_contagem_item_travado_trg() from public, anon, authenticated;

commit;


/* ── CONFERÊNCIA (só leitura), depois de rodar ────────────────────────────────
select 'trigger da contagem' as o_que, string_agg(tgname, ', ') as resultado from pg_trigger
 where tgrelid = 'public.estoque_contagens_itens'::regclass and not tgisinternal and tgname = 'estoque_contagens_itens_travado'
union all
select 'anon executa a correção', has_function_privilege('anon', 'public.estoque_contagem_corrigir_item(uuid,numeric,text,text)', 'execute')::text;
   ────────────────────────────────────────────────────────────────────────── */
