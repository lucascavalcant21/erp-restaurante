/* RH-4b · prorrogação já combinada, registrada depois do 1º período (HDEV-RH-001, Fase 3)
   O Héfisto antigo tratava a prorrogação como automática e não guardava nada.
   Para registrar uma prorrogação que já aconteceu, a solicitação precisa do
   contrato assinado (documento) e fica marcada registro_retroativo; quem
   aprova (dp.contratos.aprovar) decide. Sem documento: efetivação.
   Aplicada com autorização permanente do dono para a missão de RH. */
create or replace function public.rh_transicao_solicitar(p_colaborador uuid, p_tipo text, p_vigencia date, p_dados jsonb, p_motivo text, p_documento text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_v rh_vinculos%rowtype; v_erros text[] := '{}'; v_id uuid; v_fim1 date; v_fund text[] := '{}';
begin
  select * into v_v from rh_vinculos where colaborador_id = p_colaborador and fim is null;
  if v_v.id is null then raise exception 'Colaborador sem vínculo aberto.'; end if;
  if not hefisto_user_can('dp.contratos.solicitar', v_v.unidade_id) and not hefisto_user_can('dp.contratos.aprovar', v_v.unidade_id) then
    raise exception 'Sem permissão para solicitar alteração contratual.';
  end if;
  if p_vigencia is null then raise exception 'Informe a data de vigência.'; end if;
  if p_vigencia < v_v.inicio then raise exception 'A vigência não pode ser anterior ao início do vínculo (%).', v_v.inicio; end if;

  if p_tipo = 'prorrogacao' then
    if v_v.categoria <> 'clt_experiencia' then raise exception 'Só contrato de experiência pode ser prorrogado.'; end if;
    if v_v.prorrogacao_dias is not null then raise exception 'A experiência já foi prorrogada uma vez (CLT art. 451).'; end if;
    v_fim1 := v_v.inicio + v_v.experiencia_dias - 1;
    if current_date > v_fim1 then
      -- registro de prorrogação que já aconteceu: só com o contrato assinado (documento) e decisão de quem aprova
      if p_documento is null or length(btrim(p_documento)) < 3 then
        raise exception 'O 1º período terminou em %. Para registrar uma prorrogação já combinada, anexe o contrato assinado; se não houve prorrogação, registre a efetivação.', v_fim1;
      end if;
      p_dados := coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('registro_retroativo', true);
    end if;
    v_erros := rh_validar_experiencia(v_v.unidade_id, v_v.experiencia_dias, (p_dados->>'dias')::int);
    if (p_dados->>'dias') is null then v_erros := v_erros || 'Informe os dias da prorrogação.'; end if;
    p_vigencia := v_fim1 + 1;
    v_fund := array['CLT art. 445 parágrafo único e art. 451', 'CCT Foz 2026/2027, cl. 19 §3º, p. 4 (com convenção ativa)'];
  elsif p_tipo = 'efetivacao' then
    if v_v.categoria not in ('clt_experiencia','eventual','intermitente','outro') then raise exception 'Este vínculo já é por prazo indeterminado.'; end if;
    v_fund := array['CLT art. 443 e 451 (contrato por prazo indeterminado)'];
  elsif p_tipo = 'mudanca_categoria' then
    if (p_dados->>'categoria') is null or (p_dados->>'categoria') not in ('eventual','intermitente','clt_experiencia','clt_indeterminado','outro') then raise exception 'Informe a nova categoria.'; end if;
    if (p_dados->>'categoria') = v_v.categoria then raise exception 'A nova categoria é igual à atual.'; end if;
    if (p_dados->>'categoria') = 'clt_experiencia' then
      v_erros := rh_validar_experiencia(v_v.unidade_id, coalesce((p_dados->>'experiencia_dias')::int, 0), null);
      if (p_dados->>'experiencia_dias') is null then v_erros := v_erros || 'Informe os dias do 1º período de experiência.'; end if;
    end if;
    v_fund := array['Mudança de categoria registrada como novo vínculo; o anterior fica no histórico'];
  elsif p_tipo = 'alteracao_salarial' then
    if (p_dados->>'salario') is null or (p_dados->>'salario')::numeric <= 0 then raise exception 'Informe o novo salário.'; end if;
    if p_vigencia > current_date then raise exception 'Registre o reajuste na data em que ele passa a valer (vigência futura ainda não é aplicada).'; end if;
    v_fund := array['CCT Foz 2026/2027, cl. 30, p. 7 (vedada redução salarial na mudança de função)'];
  else
    raise exception 'Tipo de transição inválido.';
  end if;

  if array_length(v_erros, 1) > 0 then raise exception '%', array_to_string(v_erros, ' '); end if;

  insert into rh_vinculo_transicoes (colaborador_id, unidade_id, vinculo_id, tipo, vigencia, dados, motivo, documento_ref, fundamentos)
  values (p_colaborador, v_v.unidade_id, v_v.id, p_tipo, p_vigencia, coalesce(p_dados, '{}'::jsonb), p_motivo, p_documento, v_fund)
  returning id into v_id;
  return v_id;
end $$;
