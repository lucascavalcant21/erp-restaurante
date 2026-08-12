-- ─────────────────────────────────────────────────────────────────────────────
-- PORTAL PÚBLICO DE VAGAS (sem login)
-- O candidato abre /vagas/<unidade>, preenche e envia. Duas permissões são
-- necessárias para quem NÃO tem conta:
--   1. ler as vagas publicadas  → via função, que devolve SÓ o bloco de vagas
--      (nunca o restante das configurações da empresa);
--   2. gravar a própria candidatura em "candidatos".
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente e seguro:
-- não liga RLS onde ela está desligada (isso poderia derrubar o acesso atual).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Leitura pública apenas das vagas -----------------------------------------
create or replace function public.portal_vagas_publico(p_unidade_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(params -> 'portal_vagas', '{}'::jsonb)
  from public.config_sistema
  where unidade_id = p_unidade_id
  limit 1;
$$;

revoke all on function public.portal_vagas_publico(uuid) from public;
grant execute on function public.portal_vagas_publico(uuid) to anon, authenticated;

-- 2) Envio da candidatura sem login -------------------------------------------
-- Só cria a política se a tabela já usa RLS. Se a RLS estiver desligada, o
-- envio já funciona e nada precisa ser feito.
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'candidatos' and rowsecurity
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidatos'
      and policyname = 'candidatos_insert_publico'
  ) then
    create policy candidatos_insert_publico
      on public.candidatos
      for insert
      to anon
      with check (true);
  end if;
end $$;
