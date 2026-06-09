-- ════════════════════════════════════════════════════════════════════════════
-- SEGURANÇA: Row Level Security (RLS)
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ RODE ISTO SÓ DEPOIS de confirmar que o LOGIN REAL (Supabase Auth) funciona,
--    senão o site perde acesso aos dados (a chave pública passa a ser bloqueada).
--
-- O que faz: liga o RLS em todas as tabelas e permite acesso apenas a usuários
-- AUTENTICADOS. Sem login, ninguém lê nem grava (fecha o banco aberto de hoje).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'estoque','estoque_movimentacoes','ingredientes','cardapio','fichas_tecnicas',
    'ficha_itens','funcionarios','registros_ponto','holerites','eventos',
    'fornecedores','clientes','avaliacoes_nps','campanhas','lancamentos','documentos','unidades'
  ]
  loop
    -- só aplica se a tabela existir
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists "auth_full_access" on public.%I;', t);
      execute format(
        'create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true);', t
      );
    end if;
  end loop;
end $$;

-- Pronto: agora só quem está logado (via Supabase Auth) acessa os dados.
-- Próximo nível (futuro): restringir por unidade_id usando o metadado do usuário.
