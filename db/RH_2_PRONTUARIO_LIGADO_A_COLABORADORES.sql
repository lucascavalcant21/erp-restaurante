/* ═══════════════════════════════════════════════════════════════════════════
   RH-2 · PRONTUÁRIO LIGADO A `colaboradores` + ACESSO SÓ PARA QUEM TEM RH
   (HDEV-RH-001, Fase 2)

   STATUS: PROPOSTA. Rodar só com aprovação do dono.

   Visto no banco real (13/10/2026):
   - 8 tabelas do prontuário apontam (FK) para a tabela LEGADA `funcionarios`
     (2 linhas), não para `colaboradores` (23, a usada pelo app): holerites,
     rh_historico, rh_atas, rh_bonificacoes, avisos, cursos, advertencias,
     producoes. Resultado: é impossível gravar holerite, histórico, ata,
     bônus etc. de um colaborador real. As 8 estão VAZIAS (0 linhas).
   - 7 delas usam a política `sec_unidade`: qualquer usuário da unidade lê e
     altera bônus, advertências, atas e o histórico (que vai guardar salário).

   FAZ (uma transação; nenhuma linha existente é alterada):
     0. preflight: aborta se alguma das 8 tabelas tiver linha (nada a migrar)
     1. troca a FK func_id → funcionarios por func_id → colaboradores
        ON DELETE RESTRICT (o histórico nunca some junto com o cadastro)
     2. políticas por permissão (hefisto_user_can), no lugar de sec_unidade:
          rh_historico   ler: rh.employees.view_history · incluir: rh.employees.edit
                         SEM alterar/apagar (histórico imutável)
          rh_bonificacoes ler/incluir/alterar/apagar: rh.payroll.view/create/edit/delete
          advertencias, rh_atas, cursos, producoes, avisos
                         ler: rh.employees.view · gravar: rh.employees.edit
          avisos e cursos: o próprio colaborador também lê os seus
                         (hefisto_meus_colaboradores) e os gerais da unidade
        holerites já usa hefisto_user_can (rh.payroll.*): mantida.
   NÃO FAZ: não mexe em `funcionarios`, `pedidos.garcom_id`, `registros_ponto`
   (legado do PDV/ponto antigo, com dados).

   ROLLBACK (não rodar sem decisão do dono): recriar as FKs para
   funcionarios(id) ON DELETE CASCADE e a política sec_unidade (texto em
   db/security/SEC_RLS_2_FASE2.sql). Só possível enquanto as tabelas não
   tiverem linhas de colaboradores.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare t text; tem boolean;
begin
  foreach t in array array['holerites','rh_historico','rh_atas','rh_bonificacoes','avisos','cursos','advertencias','producoes'] loop
    execute format('select exists (select 1 from public.%I)', t) into tem;
    if tem then raise exception 'RH-2: % tem linhas. Nada foi alterado.', t; end if;
  end loop;
end $$;

-- 1. FKs para colaboradores
do $$
declare t text; c text;
begin
  foreach t in array array['holerites','rh_historico','rh_atas','rh_bonificacoes','avisos','cursos','advertencias','producoes'] loop
    for c in select conname from pg_constraint where conrelid = format('public.%I', t)::regclass and contype = 'f'
              and confrelid = 'public.funcionarios'::regclass loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
    execute format('alter table public.%I add constraint %I foreign key (func_id) references public.colaboradores(id) on delete restrict', t, t || '_func_id_colaborador_fkey');
  end loop;
end $$;

-- 2. políticas por permissão
drop policy if exists sec_unidade on public.rh_historico;
create policy rh_historico_ler on public.rh_historico for select to authenticated
  using (public.hefisto_user_can('rh.employees.view_history', unidade_id));
create policy rh_historico_incluir on public.rh_historico for insert to authenticated
  with check (public.hefisto_user_can('rh.employees.edit', unidade_id));
-- sem política de UPDATE/DELETE: histórico não se altera nem se apaga

drop policy if exists sec_unidade on public.rh_bonificacoes;
create policy rh_bonificacoes_ler on public.rh_bonificacoes for select to authenticated using (public.hefisto_user_can('rh.payroll.view', unidade_id));
create policy rh_bonificacoes_incluir on public.rh_bonificacoes for insert to authenticated with check (public.hefisto_user_can('rh.payroll.create', unidade_id));
create policy rh_bonificacoes_alterar on public.rh_bonificacoes for update to authenticated using (public.hefisto_user_can('rh.payroll.edit', unidade_id)) with check (public.hefisto_user_can('rh.payroll.edit', unidade_id));
create policy rh_bonificacoes_apagar on public.rh_bonificacoes for delete to authenticated using (public.hefisto_user_can('rh.payroll.delete', unidade_id));

do $$
declare t text;
begin
  foreach t in array array['advertencias','rh_atas','producoes'] loop
    execute format('drop policy if exists sec_unidade on public.%I', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.hefisto_user_can(''rh.employees.view'', unidade_id))', t || '_ler', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.hefisto_user_can(''rh.employees.edit'', unidade_id)) with check (public.hefisto_user_can(''rh.employees.edit'', unidade_id))', t || '_gravar', t);
  end loop;
  foreach t in array array['avisos','cursos'] loop
    execute format('drop policy if exists sec_unidade on public.%I', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.hefisto_user_can(''rh.employees.view'', unidade_id) or func_id in (select unnest(public.hefisto_meus_colaboradores())) or (func_id is null and unidade_id in (select unnest(public.hefisto_unidades_do_usuario()))))', t || '_ler', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.hefisto_user_can(''rh.employees.edit'', unidade_id)) with check (public.hefisto_user_can(''rh.employees.edit'', unidade_id))', t || '_gravar', t);
  end loop;
end $$;

commit;

select conrelid::regclass tabela, confrelid::regclass aponta_para
  from pg_constraint where contype = 'f' and conname like '%_func_id_colaborador_fkey' order by 1;
