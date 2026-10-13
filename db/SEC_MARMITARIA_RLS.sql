/* ═══════════════════════════════════════════════════════════════════════════
   SEC-MARMITARIA-RLS · fecha a policy aberta das tabelas da marmitaria

   As migrações MIGRACAO_MARMITARIA_DELIVERY e _INTELIGENCIA (publicadas
   direto na main em 13/10/2026) criaram p_auth_all (USING true) em 10
   tabelas: qualquer usuário logado, de qualquer empresa, lia e alterava tudo.
   A trava app/lib/seguranca-rls.test.mjs acusou. Conferido no banco em
   13/10/2026: as 10 tabelas estavam VAZIAS (nenhum dado exposto).

   FAZ (uma transação): troca p_auth_all por sec_unidade (padrão SEC-RLS-1:
   usuário vê só as próprias unidades; proprietário vê todas). Não altera dado.
   ROLLBACK (não rodar sem decisão do dono; reabre o acesso):
     recriar p_auth_all FOR ALL TO authenticated USING (true) WITH CHECK (true)
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare t text;
begin
  foreach t in array array['marmitaria_fichas_embalagens','marmitaria_precificacao_canais','marmitaria_simulacoes',
    'marmitaria_producao_lotes','marmitaria_transferencias','marmitaria_rh_alocacoes','marmitaria_configuracoes',
    'marmitaria_planos_operacionais','marmitaria_assinaturas','marmitaria_qualidade_ocorrencias'] loop
    if to_regclass('public.' || t) is null then raise exception 'SEC-MARMITARIA: % não existe. Nada foi alterado.', t; end if;
    execute format('drop policy if exists p_auth_all on public.%I', t);
    execute format('drop policy if exists sec_unidade on public.%I', t);
    execute format('create policy sec_unidade on public.%I for all to authenticated using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario()))) with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;

-- verificação: nenhuma policy "true" sobrando nas tabelas da marmitaria
select tablename, policyname, qual from pg_policies where schemaname = 'public' and tablename like 'marmitaria%' order by 1;
