/* ═══════════════════════════════════════════════════════════════════════════
   SEC-EST-1 · estoque_itens e estoque_lotes SÓ DA PRÓPRIA UNIDADE

   STATUS: PROPOSTA. Rodar só com aprovação do dono, DEPOIS da prévia
   (SEC_EST_1_PREVIA_ESTOQUE_ITENS_LOTES.sql).

   AUDITORIA DE PRODUÇÃO (01/10/2026):
     estoque_itens / auth_all                 ALL  authenticated  USING true  CHECK true
     estoque_itens / estoque_itens_auth_full  ALL  authenticated  USING true  CHECK true
     estoque_lotes / estoque_lotes_all        ALL  public         USING true  CHECK true
   Ou seja: qualquer usuário logado vê e altera itens e lotes de QUALQUER
   unidade. Hoje só existe uma unidade, então nada vaza de fato — mas a
   próxima unidade nasceria aberta.

   FAZ (uma transação; aborta sem mudar nada se faltar função/tabela):
     1. backup do texto das policies atuais em sec_backup_policies_sec_est_1;
     2. remove as 3 policies abertas;
     3. cria estoque_itens_unidade e estoque_lotes_unidade: pode_ver_todas()
        ou a própria unidade (USING = WITH CHECK), só para authenticated;
     4. tira do anon o que sobrou (REFERENCES/TRIGGER/TRUNCATE) e do
        authenticated TRUNCATE/REFERENCES/TRIGGER (o app não usa; TRUNCATE
        ignora RLS). SELECT/INSERT/UPDATE/DELETE do authenticated ficam.
   NÃO FAZ: não altera dados, não mexe nas outras tabelas de estoque (estoques,
   estoque_movimentacoes_multi, estoque_atual, insumos, produtos, fichas —
   ver relatório), nem nas funções. service_role (rotas de servidor) e funções
   SECURITY DEFINER não são afetadas.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.estoque_itens') is null or to_regclass('public.estoque_lotes') is null then
    raise exception 'SEC-EST-1: tabela ausente. Nada foi alterado.';
  end if;
  if to_regprocedure('public.auth_unidade_id()') is null or to_regprocedure('public.pode_ver_todas()') is null then
    raise exception 'SEC-EST-1: funções auth_unidade_id()/pode_ver_todas() ausentes. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.sec_backup_policies_sec_est_1 (
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
alter table public.sec_backup_policies_sec_est_1 enable row level security;
revoke all on table public.sec_backup_policies_sec_est_1 from public, anon, authenticated;
insert into public.sec_backup_policies_sec_est_1 (tabela, policy, cmd, roles, permissive, qual, with_check)
select tablename, policyname, cmd, roles::text[], permissive, qual, with_check
  from pg_policies where schemaname = 'public' and tablename in ('estoque_itens', 'estoque_lotes')
on conflict do nothing;

alter table public.estoque_itens enable row level security;
alter table public.estoque_lotes enable row level security;

drop policy if exists auth_all on public.estoque_itens;
drop policy if exists estoque_itens_auth_full on public.estoque_itens;
drop policy if exists estoque_lotes_all on public.estoque_lotes;

drop policy if exists estoque_itens_unidade on public.estoque_itens;
create policy estoque_itens_unidade on public.estoque_itens for all to authenticated
  using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
  with check (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());
drop policy if exists estoque_lotes_unidade on public.estoque_lotes;
create policy estoque_lotes_unidade on public.estoque_lotes for all to authenticated
  using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
  with check (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());

revoke all on public.estoque_itens, public.estoque_lotes from anon;
revoke truncate, references, trigger on public.estoque_itens, public.estoque_lotes from authenticated;

-- conferência final: nenhuma policy aberta sobrou nessas tabelas
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('estoque_itens', 'estoque_lotes')
              and policyname not in ('estoque_itens_unidade', 'estoque_lotes_unidade')) then
    raise exception 'SEC-EST-1: há outra policy nessas tabelas além das por unidade. Nada foi alterado (revise antes).';
  end if;
end $$;

commit;


/* ── CONFERÊNCIA (só leitura): rode a prévia de novo. Esperado no bloco 04:
   só estoque_itens_unidade e estoque_lotes_unidade, com USING = CHECK.
   ────────────────────────────────────────────────────────────────────────── */


/* ── ROLLBACK (só se algo der errado; volta ao estado auditado em 01/10) ─────
begin;
drop policy if exists estoque_itens_unidade on public.estoque_itens;
drop policy if exists estoque_lotes_unidade on public.estoque_lotes;
create policy auth_all on public.estoque_itens as permissive for all to authenticated using (true) with check (true);
create policy estoque_itens_auth_full on public.estoque_itens as permissive for all to authenticated using (true) with check (true);
create policy estoque_lotes_all on public.estoque_lotes as permissive for all to public using (true) with check (true);
grant references, trigger, truncate on public.estoque_itens, public.estoque_lotes to anon;
grant truncate, references, trigger on public.estoque_itens, public.estoque_lotes to authenticated;
commit;
   ────────────────────────────────────────────────────────────────────────── */
