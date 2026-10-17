/* SEC-RH-2 · ROLLBACK — volta as 7 policies "sec_unidade" exatamente como
   estavam em 14/10/2026 e o EXECUTE de extra_cadastro_publico para
   authenticated. Mantém hefisto_tem_alguma (a SEC-FIN-3 também a usa).
   Não rodar sem decisão do dono: reabre o S-22. */

begin;

drop policy if exists candidatos_ler on public.candidatos;
drop policy if exists candidatos_incluir on public.candidatos;
drop policy if exists candidatos_alterar on public.candidatos;
drop policy if exists candidatos_excluir on public.candidatos;
create policy sec_unidade on public.candidatos for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_atestados_ler on public.rh_atestados;
drop policy if exists rh_atestados_incluir on public.rh_atestados;
drop policy if exists rh_atestados_alterar on public.rh_atestados;
drop policy if exists rh_atestados_excluir on public.rh_atestados;
create policy sec_unidade on public.rh_atestados for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_advertencias_colab_ler on public.rh_advertencias_colab;
drop policy if exists rh_advertencias_colab_incluir on public.rh_advertencias_colab;
drop policy if exists rh_advertencias_colab_alterar on public.rh_advertencias_colab;
drop policy if exists rh_advertencias_colab_excluir on public.rh_advertencias_colab;
create policy sec_unidade on public.rh_advertencias_colab for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists ponto_marcacao_ler on public.ponto_marcacao;
drop policy if exists ponto_marcacao_incluir on public.ponto_marcacao;
drop policy if exists ponto_marcacao_alterar on public.ponto_marcacao;
drop policy if exists ponto_marcacao_excluir on public.ponto_marcacao;
create policy sec_unidade on public.ponto_marcacao for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists registro_ponto_ler on public.registro_ponto;
drop policy if exists registro_ponto_incluir on public.registro_ponto;
drop policy if exists registro_ponto_alterar on public.registro_ponto;
drop policy if exists registro_ponto_excluir on public.registro_ponto;
create policy sec_unidade on public.registro_ponto for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_banco_horas_ler on public.rh_banco_horas;
drop policy if exists rh_banco_horas_incluir on public.rh_banco_horas;
drop policy if exists rh_banco_horas_alterar on public.rh_banco_horas;
drop policy if exists rh_banco_horas_excluir on public.rh_banco_horas;
create policy sec_unidade on public.rh_banco_horas for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_espelho_fechado_ler on public.rh_espelho_fechado;
drop policy if exists rh_espelho_fechado_incluir on public.rh_espelho_fechado;
drop policy if exists rh_espelho_fechado_alterar on public.rh_espelho_fechado;
drop policy if exists rh_espelho_fechado_excluir on public.rh_espelho_fechado;
create policy sec_unidade on public.rh_espelho_fechado for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

grant execute on function public.extra_cadastro_publico(uuid) to authenticated;

commit;
