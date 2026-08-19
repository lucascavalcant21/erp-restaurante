-- ═══════════════════════════════════════════════════════════════════════════
-- MEU ERP / HEFISTO — O MÍNIMO PARA DESTRAVAR O QUE VOCÊ ESTÁ TESTANDO
--
-- Este é o recorte curto: só o que as três telas que você mexeu hoje precisam.
-- O arquivo TODAS_AS_MIGRACOES.sql continua sendo o completo — rode ele depois,
-- com calma. Este aqui você cola agora no SQL Editor do Supabase e executa.
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1) TIRAR GARRAFA DO GUIA DE DRINKS ─────────────────────────────────────
-- Sem esta coluna o botão "Não é drink — tirar do guia" não tem onde gravar,
-- e a tela continua mostrando água e cerveja como se fossem drinks.
alter table public.montagem
  add column if not exists fora_do_guia boolean not null default false;

create index if not exists idx_montagem_fora_do_guia
  on public.montagem (unidade_id, fora_do_guia);


-- ── 2) BATIDO × MEXIDO NA FICHA DO DRINK ───────────────────────────────────
-- Sem ela o método aparece na tela e não salva: salvarFicha remove a coluna
-- que o banco recusa e grava o resto.
alter table public.fichas_tecnicas
  add column if not exists metodo_bar text;


-- ── 3) AUDITORIA RECEBER A BAIXA DO INVENTÁRIO ─────────────────────────────
-- unidade_id, usuario_id e registro_id nasceram uuid, mas no ERP inteiro esses
-- ids são TEXTO ("matriz" é o valor quando não há unidade cadastrada). Um id
-- que não seja uuid derruba o insert com "invalid input syntax for type uuid"
-- — foi assim que a auditoria ficou vazia sem ninguém perceber.
create table if not exists public.hefisto_auditoria (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text,
  usuario_id         text,
  usuario_nome       text,
  comando            text,
  intencao           jsonb,
  acao               text,
  modulo             text,
  registro_id        text,
  valor_anterior     numeric(16,4),
  valor_novo         numeric(16,4),
  resultado          text,
  erro               text,
  exigiu_confirmacao boolean default false,
  dispositivo        text,
  created_at         timestamptz not null default now()
);

alter table public.hefisto_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'hefisto_auditoria'
       and policyname = 'hefisto_auditoria_all'
  ) then
    create policy hefisto_auditoria_all on public.hefisto_auditoria
      for all using (true) with check (true);
  end if;
end $$;

grant select, insert on public.hefisto_auditoria to anon, authenticated;


-- ── 4) unidade_id É TEXTO EM TODO O BANCO ──────────────────────────────────
-- Varre o schema e conserta qualquer tabela que ainda tenha unidade_id como
-- uuid. Só age onde precisa; o valor uuid vira a própria string, nada se perde.
-- Cada tabela consertada imprime um aviso — se aparecer algum, aquela tabela
-- estava recusando gravação em silêncio.
do $$
declare col record;
begin
  for col in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name = 'unidade_id'
       and data_type = 'uuid'
  loop
    execute format(
      'alter table public.%I alter column %I type text using %I::text',
      col.table_name, col.column_name, col.column_name
    );
    raise notice 'unidade_id convertido para text em %', col.table_name;
  end loop;
end $$;


-- ── 5) ZERAR ESTOQUE: GARANTIR QUE O UPDATE PASSA ──────────────────────────
-- O botão de zerar dizia "pronto" sem mudar nada porque um UPDATE barrado por
-- RLS não devolve erro, só não afeta linha. Isto garante a política de escrita
-- em estoque_itens. Se ela já existir com outro nome, nada acontece aqui.
alter table public.estoque_itens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'estoque_itens'
  ) then
    create policy estoque_itens_all on public.estoque_itens
      for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.estoque_itens to anon, authenticated;


-- Recarrega o cache de schema do PostgREST. Sem isto ele continua respondendo
-- "Could not find the column" logo depois da migração.
notify pgrst, 'reload schema';
