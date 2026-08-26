-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUÇÃO DO DIA DO SALÃO
--
-- Por que existe: o plano do dia (memorandos_operacao) tinha coluna só para
-- cozinha e bar. O salão também pré-prepara — mise en place de bebidas,
-- guarnições de balcão, sobremesas montadas — e não tinha onde ser planejado.
--
-- A produção em si já era gravada em producao_diaria, mas sem o setor: para
-- saber de onde veio era preciso ir até a ficha. Com o volume de um dia cheio
-- isso torna a tela do funcionário lenta à toa.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.memorandos_operacao add column if not exists salao jsonb not null default '{}'::jsonb;

-- producao_diaria nunca foi versionada: existe no banco, mas não em script
-- nenhum do repositório. Fica aqui para que um banco novo não quebre no
-- primeiro registro de produção.
create table if not exists public.producao_diaria (
  id                   uuid primary key default gen_random_uuid(),
  unidade_id           text not null,
  ficha_id             uuid,
  colaborador_id       uuid,
  quantidade_produzida numeric(14,3) not null default 0,
  created_at           timestamptz not null default now()
);

-- Setor e local ficam no próprio registro da produção: é o que a tela do
-- funcionário lê para dizer o que ele fez hoje e onde guardou.
alter table public.producao_diaria add column if not exists departamento text;
alter table public.producao_diaria add column if not exists local_armazenamento text;
alter table public.producao_diaria add column if not exists created_at timestamptz not null default now();

-- "O que produzi hoje" é sempre uma consulta por unidade + dia + pessoa.
create index if not exists idx_producao_diaria_dia
  on public.producao_diaria (unidade_id, created_at desc);
create index if not exists idx_producao_diaria_pessoa
  on public.producao_diaria (unidade_id, colaborador_id, created_at desc);

notify pgrst, 'reload schema';
