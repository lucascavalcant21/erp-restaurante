-- ─────────────────────────────────────────────────────────────────────────────
-- GUIAS OPERACIONAIS
--
-- Uma tabela para os guias que a equipe consulta: o Guia de Funções (a rotina
-- de cada posto, hora a hora) e o Guia de Uso (como usar e higienizar um
-- produto de limpeza ou um equipamento).
--
-- São a mesma coisa por dentro: um título, um setor e uma sequência de blocos.
-- Guardar em duas tabelas obrigaria a escrever duas vezes cada consulta, cada
-- política e cada tela, para ganhar nada.
--
-- Por que no banco e não no navegador: material de treino é consultado no
-- tablet da cozinha, no celular do garçom e no computador da gerência. Guardado
-- local, cada aparelho teria a sua versão — e a versão errada é pior que
-- nenhuma, porque ninguém desconfia dela.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e execute. É idempotente
-- (pode rodar de novo sem erro).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.guias_operacionais (
  id           uuid primary key default gen_random_uuid(),
  unidade_id   text not null,           -- TEXTO: ids de unidade no ERP nao sao uuid
  tipo         text not null,           -- funcao | produto | equipamento
  titulo       text not null,
  setor        text,
  cor          text,
  -- Os blocos do guia. jsonb porque o formato difere por tipo: a função tem
  -- horário e atividade; o equipamento tem seções com passos e avisos. Impor
  -- colunas fixas para os dois faria metade delas ficar sempre nula.
  conteudo     jsonb not null default '[]'::jsonb,
  observacoes  text,
  ordem        integer not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_guias_unidade_tipo
  on public.guias_operacionais (unidade_id, tipo, ordem);

-- updated_at automático: a tela mostra quando o guia mudou pela última vez, e
-- deixar isso a cargo de cada chamada do app é garantir que uma delas esqueça.
create or replace function public.guias_operacionais_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_guias_operacionais_touch on public.guias_operacionais;
create trigger trg_guias_operacionais_touch
  before update on public.guias_operacionais
  for each row execute function public.guias_operacionais_touch();

-- RLS: mesma política aberta usada pelo app (chave anônima + app single-tenant).
alter table public.guias_operacionais enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guias_operacionais'
      and policyname = 'guias_operacionais_all'
  ) then
    create policy guias_operacionais_all
      on public.guias_operacionais
      for all
      using (true)
      with check (true);
  end if;
end $$;
