-- Estoques de embalagens separados por Cozinha e Bar e vinculo com fichas.

alter table if exists public.operacao_embalagens
  add column if not exists departamento text not null default 'cozinha';

alter table if exists public.operacao_embalagens
  add column if not exists insumo_id uuid references public.insumos(id) on delete set null;

alter table if exists public.produtos
  add column if not exists embalagens jsonb not null default '[]'::jsonb;

create index if not exists operacao_embalagens_unidade_departamento_idx
  on public.operacao_embalagens (unidade_id, departamento, nome);

insert into public.estoques (
  unidade_id, nome, slug, tipo, descricao, status, cor,
  controla_validade, controla_minimo, ordem
)
select
  u.id,
  padrao.nome,
  padrao.slug,
  'embalagens',
  padrao.descricao,
  'ativo',
  padrao.cor,
  false,
  true,
  padrao.ordem
from public.unidades u
cross join (
  values
    ('Embalagens da Cozinha', 'embalagens-cozinha', 'Potes, caixas, sacolas e descartaveis da cozinha', '#db2777', 6),
    ('Embalagens do Bar', 'embalagens-bar', 'Copos, tampas, canudos e descartaveis do bar', '#9333ea', 7)
) as padrao(nome, slug, descricao, cor, ordem)
on conflict (unidade_id, slug) do nothing;

-- Cadastros antigos continuam pertencendo a Cozinha ate serem alterados.
update public.operacao_embalagens
set departamento = 'cozinha'
where departamento is null or departamento not in ('cozinha', 'bar');

