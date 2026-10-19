/* ═══════════════════════════════════════════════════════════════════════════
   SEC-RH-2 · dados pessoais de RH: o próprio funcionário OU quem tem RH (S-22)
   (14/10/2026)

   POR QUE (lido no banco real, 14/10)
   - 7 tabelas com dado pessoal conferiam SÓ a unidade: qualquer colega da
     unidade lia atestados, advertências, CPF de candidatos (22) e das
     marcações de ponto, banco de horas e espelhos fechados.
   - extra_cadastro_publico(uuid) devolvia dado pessoal de um extra a
     qualquer usuário logado com o id (o portal já usa a rota do servidor).

   O QUE FAZ (só policies e grants; nenhum dado é alterado)
   - Cada tabela: a policy única vira quatro (ler, incluir, alterar, excluir).
     A regra de UNIDADE fica como está; passa a exigir também:
       ler    = chave do módulo (RH / ponto) OU o registro é do próprio
                funcionário (hefisto_meus_colaboradores: vínculo do login com
                colaborador/funcionário);
       gravar = chave de ação do módulo.
   - O relógio de ponto (tablet, ponto.kiosk.create) continua gravando as
     batidas e lendo o resumo do dia da unidade.
   - hefisto_tem_alguma(chaves[]): o mesmo verificador da SEC-FIN-3 (criado
     aqui também, com o mesmo texto, para não depender da ordem).
   - extra_cadastro_publico perde EXECUTE de authenticated.
   - Super admin continua vendo tudo.

   IMPACTO (14/10): perdem a leitura indevida 13 usuários (somente-consulta,
   cozinheiro). Gerente-geral (rh.*, ponto.*) e o administrador seguem iguais.
   O tablet do ponto usa a conta do administrador: sem mudança.

   ROLLBACK: db/security/SEC_RH_2_ROLLBACK.sql
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight ─────────────────────────────────────────────────────────────
do $pf$
declare r record; v_sec constant text := '(( SELECT hefisto_ve_todas_unidades() AS hefisto_ve_todas_unidades) OR (unidade_id IN ( SELECT unnest(hefisto_unidades_do_usuario()) AS unnest)))';
begin
  for r in select * from (values ('candidatos'), ('rh_atestados'), ('rh_advertencias_colab'), ('ponto_marcacao'), ('registro_ponto'), ('rh_banco_horas'), ('rh_espelho_fechado')) v(t) loop
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = r.t) <> 1
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.t and policyname = 'sec_unidade'
                        and cmd = 'ALL' and qual = v_sec and with_check = v_sec) then
      raise exception 'SEC-RH-2: as policies de % não estão como esperado. Nada foi alterado.', r.t;
    end if;
  end loop;
  if to_regprocedure('public.hefisto_meus_colaboradores()') is null then
    raise exception 'SEC-RH-2: hefisto_meus_colaboradores() não existe. Nada foi alterado.';
  end if;
end $pf$;

-- ── 1. Verificador de permissão (mesmo texto da SEC-FIN-3) ──────────────────
create or replace function public.hefisto_tem_alguma(p_chaves text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from unnest(coalesce(p_chaves, '{}'::text[])) k where public.hefisto_user_has_permission(auth.uid(), k))
$$;
revoke all on function public.hefisto_tem_alguma(text[]) from public, anon;
grant execute on function public.hefisto_tem_alguma(text[]) to authenticated;

-- ── 2. Policies ──────────────────────────────────────────────────────────────
-- candidatos: ler rh.recruiting.view; incluir rh.recruiting.create | rh.recruiting.edit; alterar/excluir rh.recruiting.edit | rh.recruiting.delete
drop policy sec_unidade on public.candidatos;
create policy candidatos_ler on public.candidatos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['rh.recruiting.view'])))));
create policy candidatos_incluir on public.candidatos for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.recruiting.create', 'rh.recruiting.edit']))));
create policy candidatos_alterar on public.candidatos for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.recruiting.edit', 'rh.recruiting.delete']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.recruiting.edit', 'rh.recruiting.delete']))));
create policy candidatos_excluir on public.candidatos for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.recruiting.edit', 'rh.recruiting.delete']))));

-- rh_atestados: ler rh.employees.view | rh.payroll.view | ponto.clock.view | o próprio funcionário; incluir rh.employees.create | rh.employees.edit | ponto.clock.edit; alterar/excluir rh.employees.edit | rh.employees.delete | ponto.clock.edit
drop policy sec_unidade on public.rh_atestados;
create policy rh_atestados_ler on public.rh_atestados for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['rh.employees.view', 'rh.payroll.view', 'ponto.clock.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy rh_atestados_incluir on public.rh_atestados for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit', 'ponto.clock.edit']))));
create policy rh_atestados_alterar on public.rh_atestados for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete', 'ponto.clock.edit']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete', 'ponto.clock.edit']))));
create policy rh_atestados_excluir on public.rh_atestados for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete', 'ponto.clock.edit']))));

-- rh_advertencias_colab: ler rh.employees.view | o próprio funcionário; incluir rh.employees.create | rh.employees.edit; alterar/excluir rh.employees.edit | rh.employees.delete
drop policy sec_unidade on public.rh_advertencias_colab;
create policy rh_advertencias_colab_ler on public.rh_advertencias_colab for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['rh.employees.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy rh_advertencias_colab_incluir on public.rh_advertencias_colab for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit']))));
create policy rh_advertencias_colab_alterar on public.rh_advertencias_colab for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete']))));
create policy rh_advertencias_colab_excluir on public.rh_advertencias_colab for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.edit', 'rh.employees.delete']))));

-- ponto_marcacao: ler ponto.clock.view | ponto.kiosk.create | rh.employees.view | rh.payroll.view | o próprio funcionário; incluir ponto.kiosk.create | ponto.clock.create | ponto.clock.edit; alterar/excluir ponto.clock.edit | ponto.clock.delete
drop policy sec_unidade on public.ponto_marcacao;
create policy ponto_marcacao_ler on public.ponto_marcacao for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['ponto.clock.view', 'ponto.kiosk.create', 'rh.employees.view', 'rh.payroll.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy ponto_marcacao_incluir on public.ponto_marcacao for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.kiosk.create', 'ponto.clock.create', 'ponto.clock.edit']))));
create policy ponto_marcacao_alterar on public.ponto_marcacao for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.clock.edit', 'ponto.clock.delete']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.clock.edit', 'ponto.clock.delete']))));
create policy ponto_marcacao_excluir on public.ponto_marcacao for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.clock.edit', 'ponto.clock.delete']))));

-- registro_ponto: ler ponto.clock.view | ponto.kiosk.view | ponto.kiosk.create | rh.employees.view | rh.payroll.view | o próprio funcionário; incluir ponto.kiosk.create | ponto.clock.create | ponto.clock.edit; alterar/excluir ponto.kiosk.create | ponto.clock.edit | ponto.clock.delete
drop policy sec_unidade on public.registro_ponto;
create policy registro_ponto_ler on public.registro_ponto for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['ponto.clock.view', 'ponto.kiosk.view', 'ponto.kiosk.create', 'rh.employees.view', 'rh.payroll.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy registro_ponto_incluir on public.registro_ponto for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.kiosk.create', 'ponto.clock.create', 'ponto.clock.edit']))));
create policy registro_ponto_alterar on public.registro_ponto for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.kiosk.create', 'ponto.clock.edit', 'ponto.clock.delete']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.kiosk.create', 'ponto.clock.edit', 'ponto.clock.delete']))));
create policy registro_ponto_excluir on public.registro_ponto for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['ponto.kiosk.create', 'ponto.clock.edit', 'ponto.clock.delete']))));

-- rh_banco_horas: ler rh.employees.view | rh.payroll.view | ponto.clock.view | o próprio funcionário; incluir rh.payroll.create | rh.payroll.edit | ponto.clock.edit; alterar/excluir rh.payroll.edit | rh.payroll.delete | ponto.clock.edit
drop policy sec_unidade on public.rh_banco_horas;
create policy rh_banco_horas_ler on public.rh_banco_horas for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['rh.employees.view', 'rh.payroll.view', 'ponto.clock.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy rh_banco_horas_incluir on public.rh_banco_horas for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.create', 'rh.payroll.edit', 'ponto.clock.edit']))));
create policy rh_banco_horas_alterar on public.rh_banco_horas for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.edit', 'rh.payroll.delete', 'ponto.clock.edit']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.edit', 'rh.payroll.delete', 'ponto.clock.edit']))));
create policy rh_banco_horas_excluir on public.rh_banco_horas for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.edit', 'rh.payroll.delete', 'ponto.clock.edit']))));

-- rh_espelho_fechado: ler rh.payroll.view | ponto.clock.view | rh.employees.view | o próprio funcionário; incluir rh.payroll.confirm | rh.payroll.edit | ponto.clock.edit; alterar/excluir rh.payroll.confirm | rh.payroll.edit | ponto.clock.edit
drop policy sec_unidade on public.rh_espelho_fechado;
create policy rh_espelho_fechado_ler on public.rh_espelho_fechado for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and ((select public.hefisto_tem_alguma(array['rh.payroll.view', 'ponto.clock.view', 'rh.employees.view'])) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())))));
create policy rh_espelho_fechado_incluir on public.rh_espelho_fechado for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.confirm', 'rh.payroll.edit', 'ponto.clock.edit']))));
create policy rh_espelho_fechado_alterar on public.rh_espelho_fechado for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.confirm', 'rh.payroll.edit', 'ponto.clock.edit']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.confirm', 'rh.payroll.edit', 'ponto.clock.edit']))));
create policy rh_espelho_fechado_excluir on public.rh_espelho_fechado for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.payroll.confirm', 'rh.payroll.edit', 'ponto.clock.edit']))));

-- ── 3. RPC antiga do portal de extras: só o servidor ────────────────────────
revoke execute on function public.extra_cadastro_publico(uuid) from authenticated;

commit;

-- Verificação (impressão digital)
select count(*) filter (where policyname like '%\_ler') as policies_ler,
       count(*) filter (where policyname = 'sec_unidade') as antigas_restantes,
       has_function_privilege('authenticated', 'public.extra_cadastro_publico(uuid)', 'execute') as extra_publico_auth
  from pg_policies where schemaname = 'public' and tablename in ('candidatos', 'rh_atestados', 'rh_advertencias_colab', 'ponto_marcacao', 'registro_ponto', 'rh_banco_horas', 'rh_espelho_fechado');
