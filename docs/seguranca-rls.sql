-- ════════════════════════════════════════════════════════════════════════════
-- SEGURANÇA: Row Level Security (RLS) + revogação do papel anônimo
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ RODE SÓ DEPOIS que o LOGIN REAL (Supabase Auth) estiver funcionando.
--
-- Fecha o banco: sem login (papel anônimo) ninguém lê/grava/apaga.
-- Apenas usuários AUTENTICADOS têm acesso.
--
-- IMPORTANTE: só ligar o RLS não bastou — o papel `anon` tinha GRANT direto
-- nas tabelas. A peça que fecha de verdade é o `revoke all ... from anon`.
-- (Verificado: insert anônimo passou a retornar 401 permission denied.)
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare t text; pol record;
begin
  foreach t in array array[
    'estoque','estoque_movimentacoes','ingredientes','cardapio','fichas_tecnicas',
    'ficha_itens','funcionarios','registros_ponto','holerites','eventos',
    'fornecedores','clientes','avaliacoes_nps','campanhas','lancamentos','documentos','unidades'
  ]
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      -- remove políticas antigas (inclusive permissivas que vazavam acesso)
      for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy if exists %I on public.%I;', pol.policyname, t);
      end loop;
      execute format('alter table public.%I enable row level security;', t);
      -- REVOGA acesso do papel anônimo (fecha mesmo se a política falhar)
      execute format('revoke all on public.%I from anon;', t);
      -- só usuários logados acessam
      execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
      execute format('create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true);', t);
    end if;
  end loop;
end $$;

-- Diagnóstico (opcional) — confira o status:
-- select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;
-- select tablename, policyname, roles, cmd from pg_policies where schemaname='public';
