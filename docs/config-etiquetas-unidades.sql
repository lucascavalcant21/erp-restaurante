-- Dados automáticos da unidade + configurações persistentes das etiquetas.
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.

alter table public.unidades
  add column if not exists telefone_contato text,
  add column if not exists horario_funcionamento text,
  add column if not exists email_unidade text,
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists regime_tributario text,
  add column if not exists cep text,
  add column if not exists endereco text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text;

create table if not exists public.config_sistema (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.config_sistema
  add column if not exists params jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- O aplicativo mantém um registro de configurações por unidade.
-- Se esta criação acusar duplicidade, consolide primeiro os registros repetidos.
create unique index if not exists config_sistema_unidade_unique
  on public.config_sistema (unidade_id);

-- Merge atômico: evita que duas telas salvando ao mesmo tempo apaguem chaves
-- diferentes do JSON (por exemplo, parâmetros do RH e categorias de validade).
create or replace function public.merge_config_sistema_params(
  p_unidade_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  resultado jsonb;
begin
  insert into public.config_sistema (unidade_id, params, updated_at)
  values (p_unidade_id, coalesce(p_patch, '{}'::jsonb), now())
  on conflict (unidade_id) do update
    set params = coalesce(public.config_sistema.params, '{}'::jsonb) || excluded.params,
        updated_at = now()
  returning params into resultado;
  return resultado;
end;
$$;

comment on column public.config_sistema.params is
  'Parâmetros da unidade, incluindo validade_categorias das etiquetas.';
