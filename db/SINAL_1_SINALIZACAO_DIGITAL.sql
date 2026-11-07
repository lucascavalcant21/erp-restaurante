/* ═══════════════════════════════════════════════════════════════════════════
   SINAL-1 · SINALIZAÇÃO DIGITAL (TVs DE MARKETING)

   STATUS: ESCRITA, NÃO APLICADA. Aguarda a aprovação do dono (APR-016 em
   docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md). Testada no PGlite
   (app/lib/sinalizacao-banco.test.mjs).

   POR QUÊ: pedido do dono (07/11/2026): tirar o pendrive das TVs. As artes,
   os vídeos e o cardápio com preço do Héfisto passam a ir para as TVs pela
   internet, em quantas TVs ele quiser e a qualquer distância. Cada TV abre
   /tv, mostra um código e é pareada no painel (Cardápio → Sinalização
   digital). O que cada TV roda: a mesma playlist em todas, uma arte em cada,
   ou por programação (dia, horário, datas, prioridade).

   FAZ (uma transação; só aditiva — não altera nenhuma linha existente):
     1. sinal_telas         — cada TV da unidade: nome, local, orientação,
                              conteúdo fixo ("Trocar conteúdo"), hash do
                              token do aparelho, último contato e o que está
                              passando agora (monitoramento);
     2. sinal_midias        — o acervo: imagem/vídeo no bucket privado
                              `sinalizacao`, duração, orientação, versão;
     3. sinal_playlists     — sequência de mídias e páginas de cardápio;
     4. sinal_programacoes  — regras: playlist × telas × dias × horário ×
                              datas × prioridade;
     5. sinal_pareamentos   — códigos de 6 caracteres que a TV mostra até ser
                              pareada (expiram em 30 min);
     6. bucket privado `sinalizacao` (50 MB por arquivo, só JPG/PNG/WebP/MP4).
   SEGURANÇA: RLS ligado nas 5 tabelas, sem policy e sem grant para anon ou
   authenticated: só o servidor (service_role) lê e grava, depois de conferir
   sessão, vínculo com a unidade e permissão (clientes.signage.*). A TV não
   tem login: prova quem é com um token aleatório de 32 bytes, guardado no
   banco só como SHA-256. O bucket é privado: a TV recebe URL assinada e
   temporária, nunca um link público permanente.
   NÃO FAZ: não mexe em produtos, fichas, cardápio, unidades nem em nenhuma
   tabela existente; não cria policy aberta; não muda RLS de tabela existente.
   BACKUP: desnecessário (nenhuma linha existente é tocada).

   VERIFICAÇÃO: o select do fim devolve a impressão digital (colunas, índices,
   RLS das 5 tabelas e o bucket). Esperado: e1aa3b7cb7f2e3817dcab705b34c1787 (conferido no PGlite por
   app/lib/sinalizacao-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; telas, playlists e regras somem;
   os arquivos do bucket precisam ser apagados pelo painel do Storage antes):
     drop table if exists public.sinal_programacoes, public.sinal_playlists,
       public.sinal_midias, public.sinal_pareamentos, public.sinal_telas;
     delete from storage.buckets where id = 'sinalizacao';
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- Preflight: aborta sem mudar nada.
do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'SINAL-1: tabela unidades ausente. Nada foi alterado.';
  end if;
  if to_regclass('storage.buckets') is null then
    raise exception 'SINAL-1: storage.buckets ausente. Nada foi alterado.';
  end if;
  if to_regclass('public.sinal_telas') is not null or to_regclass('public.sinal_midias') is not null
     or to_regclass('public.sinal_playlists') is not null or to_regclass('public.sinal_programacoes') is not null
     or to_regclass('public.sinal_pareamentos') is not null then
    raise exception 'SINAL-1: tabelas sinal_* já existem (já aplicada?). Nada foi alterado.';
  end if;
  if exists (select 1 from storage.buckets where id = 'sinalizacao') then
    raise exception 'SINAL-1: bucket sinalizacao já existe. Nada foi alterado.';
  end if;
end $$;

-- 1. Telas ---------------------------------------------------------------------
create table public.sinal_telas (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 80),
  local              text check (local is null or char_length(local) <= 80),
  orientacao         text not null default 'horizontal' check (orientacao in ('horizontal', 'vertical')),
  conteudo           jsonb check (conteudo is null or jsonb_typeof(conteudo) = 'object'),
  token_hash         text check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  pareada_em         timestamptz,
  ultimo_contato     timestamptz,
  exibindo           jsonb check (exibindo is null or jsonb_typeof(exibindo) = 'object'),
  aparelho           text check (aparelho is null or char_length(aparelho) <= 200),
  ativa              boolean not null default true,
  criado_por         text check (criado_por is null or char_length(criado_por) <= 120),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index sinal_telas_token on public.sinal_telas (token_hash) where token_hash is not null;
create index sinal_telas_unidade on public.sinal_telas (unidade_id, nome);

-- 2. Mídias --------------------------------------------------------------------
create table public.sinal_midias (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 80),
  tipo               text not null check (tipo in ('imagem', 'video')),
  mime               text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4')),
  caminho            text not null check (char_length(caminho) between 1 and 300),
  tamanho_bytes      bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 52428800),
  duracao_seg        numeric(8, 2) check (duracao_seg is null or (duracao_seg > 0 and duracao_seg <= 3600)),
  largura            integer check (largura is null or largura between 1 and 20000),
  altura             integer check (altura is null or altura between 1 and 20000),
  orientacao         text not null default 'horizontal' check (orientacao in ('horizontal', 'vertical')),
  versao             integer not null default 1 check (versao >= 1),
  ativo              boolean not null default true,
  criado_por         text check (criado_por is null or char_length(criado_por) <= 120),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index sinal_midias_caminho on public.sinal_midias (caminho);
create index sinal_midias_unidade on public.sinal_midias (unidade_id, ativo, created_at desc);

-- 3. Playlists -----------------------------------------------------------------
create table public.sinal_playlists (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 80),
  orientacao         text not null default 'horizontal' check (orientacao in ('horizontal', 'vertical')),
  itens              jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) <= 60),
  ativa              boolean not null default true,
  criado_por         text check (criado_por is null or char_length(criado_por) <= 120),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index sinal_playlists_unidade on public.sinal_playlists (unidade_id, ativa, nome);

-- 4. Programação ---------------------------------------------------------------
create table public.sinal_programacoes (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 80),
  playlist_id        uuid not null references public.sinal_playlists(id) on delete cascade,
  tela_ids           uuid[] not null default '{}' check (cardinality(tela_ids) <= 500),
  dias_semana        smallint[] not null default '{}' check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  hora_inicio        time,
  hora_fim           time,
  data_inicio        date,
  data_fim           date,
  prioridade         integer not null default 100 check (prioridade between 1 and 999),
  ativa              boolean not null default true,
  criado_por         text check (criado_por is null or char_length(criado_por) <= 120),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((hora_inicio is null) = (hora_fim is null)),
  check (hora_inicio is null or hora_inicio <> hora_fim),
  check (data_inicio is null or data_fim is null or data_fim >= data_inicio)
);
create index sinal_programacoes_unidade on public.sinal_programacoes (unidade_id, ativa);

-- 5. Pareamentos ---------------------------------------------------------------
create table public.sinal_pareamentos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null check (codigo ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  segredo_hash       text not null check (segredo_hash ~ '^[0-9a-f]{64}$'),
  aparelho           text check (aparelho is null or char_length(aparelho) <= 200),
  expira_em          timestamptz not null,
  created_at         timestamptz not null default now()
);
create unique index sinal_pareamentos_codigo on public.sinal_pareamentos (codigo);
create unique index sinal_pareamentos_segredo on public.sinal_pareamentos (segredo_hash);
create index sinal_pareamentos_expira on public.sinal_pareamentos (expira_em);

-- 6. Quem lê e quem grava: só o servidor ---------------------------------------
alter table public.sinal_telas enable row level security;
alter table public.sinal_midias enable row level security;
alter table public.sinal_playlists enable row level security;
alter table public.sinal_programacoes enable row level security;
alter table public.sinal_pareamentos enable row level security;
revoke all on public.sinal_telas from public, anon, authenticated;
revoke all on public.sinal_midias from public, anon, authenticated;
revoke all on public.sinal_playlists from public, anon, authenticated;
revoke all on public.sinal_programacoes from public, anon, authenticated;
revoke all on public.sinal_pareamentos from public, anon, authenticated;
grant all on public.sinal_telas to service_role;
grant all on public.sinal_midias to service_role;
grant all on public.sinal_playlists to service_role;
grant all on public.sinal_programacoes to service_role;
grant all on public.sinal_pareamentos to service_role;

-- 7. Bucket privado das artes e vídeos -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sinalizacao', 'sinalizacao', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);

commit;

-- Verificação (só leitura): impressão digital das colunas, índices, RLS e bucket.
select md5(
  (select string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, '|' order by table_name, column_name)
     from information_schema.columns where table_schema = 'public' and table_name like 'sinal\_%')
  || '#' || (select string_agg(indexname, '|' order by indexname) from pg_indexes
              where schemaname = 'public' and tablename like 'sinal\_%')
  || '#' || (select string_agg(relname || ':' || relrowsecurity::text, '|' order by relname) from pg_class
              where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'sinal\_%')
  || '#' || (select coalesce(string_agg(policyname, '|'), 'sem_policy') from pg_policies
              where schemaname = 'public' and tablename like 'sinal\_%')
  || '#' || (select id || ':' || public::text || ':' || file_size_limit::text from storage.buckets where id = 'sinalizacao')
) as impressao_digital;
