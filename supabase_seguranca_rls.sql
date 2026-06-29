-- ============================================================================
-- SEGURANÇA: trancar tabelas FINANCEIRAS para exigir login (authenticated)
-- ----------------------------------------------------------------------------
-- Problema: contas_pagar e lancamentos estavam acessíveis (read/write/delete)
-- pela chave PÚBLICA (anon), que vai embutida no JS do navegador. Isso expõe
-- a folha de pagamento (ex.: salários em contas_pagar) e permite adulteração.
--
-- Confirmado: NENHUMA página pública (cardápio/delivery/rastreio) toca essas
-- duas tabelas — só libs usadas pelo staff logado. Logo é seguro trancar.
--
-- NÃO inclui `pedidos`/`pedidos_itens`: o cardápio público (cliente sem login)
-- precisa inserir pedidos. Esses exigem política específica (anon só INSERT) —
-- tratar separadamente.
--
-- Rode no Supabase → SQL Editor → Run. Seguro reexecutar.
-- ============================================================================

-- 1) Bloqueia a chave anônima no nível de privilégio e garante o usuário logado
do $$
declare t text;
begin
  foreach t in array array['contas_pagar','lancamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to authenticated', t);
  end loop;
end $$;

-- 2) Remove a política permissiva para anônimo criada na migração anterior
drop policy if exists "lancamentos_all" on public.lancamentos;

-- 3) Cria políticas que permitem apenas usuário autenticado
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='contas_pagar' and policyname='contas_pagar_auth') then
    create policy "contas_pagar_auth" on public.contas_pagar
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='lancamentos' and policyname='lancamentos_auth') then
    create policy "lancamentos_auth" on public.lancamentos
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ============================================================================
-- VERIFICAÇÃO
-- 1) Com a chave anônima (sem login): SELECT nessas tabelas deve dar
--    "permission denied" (eu testo isso após você rodar).
-- 2) No app logado (Financeiro → Contas a Pagar / Fluxo de Caixa): deve
--    continuar funcionando normalmente.
-- ============================================================================
