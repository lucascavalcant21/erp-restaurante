-- ─────────────────────────────────────────────────────────────────────────────
-- FILIAÇÃO E FILHOS NO CADASTRO DO COLABORADOR
--
-- O contrato precisa qualificar a pessoa: nome do pai e da mãe, onde nasceu,
-- onde mora hoje e, quando houver, os filhos com nome e CPF.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists nome_pai text;
alter table public.colaboradores add column if not exists nome_mae text;

-- Cidades: podem já existir em bancos mais novos; o "if not exists" resolve.
alter table public.colaboradores add column if not exists cidade_nascimento text;
alter table public.colaboradores add column if not exists cidade_uf text;

-- Filhos: lista de { "nome": "...", "cpf": "..." }. Fica em jsonb porque o
-- número varia e não se consulta filho isoladamente.
alter table public.colaboradores add column if not exists filhos jsonb not null default '[]'::jsonb;

-- Os contadores antigos continuam valendo para quem já preencheu.
alter table public.colaboradores add column if not exists tem_filhos boolean default false;
alter table public.colaboradores add column if not exists qtd_filhos integer;
