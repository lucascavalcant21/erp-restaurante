-- ─────────────────────────────────────────────────────────────────────────────
-- PORTAL PÚBLICO DE CADASTRO DE EXTRAS
--
-- O extra abre um link, se cadastra sozinho e cai num BANCO DE EXTRAS separado
-- (não entra direto na folha): o RH revisa e aprova quem vira colaborador.
-- Quem marca interesse em CLT é levado ao portal de vagas com os dados já
-- preenchidos — sem redigitar.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.extras_cadastros (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,

  nome text not null,
  telefone text not null,
  data_nascimento date,
  estado_civil text,
  genero text,
  escolaridade text,
  tem_filhos boolean default false,
  qtd_filhos integer,

  endereco text,
  bairro text,
  cidade text,

  -- Até duas funções; a principal é a que manda na busca por categoria.
  funcao_principal text not null,
  funcao_secundaria text,

  dias_disponiveis text[] not null default '{}',   -- seg, ter, qua...
  periodo_disponivel text,                          -- almoço, jantar, ambos
  experiencia text,
  valor_diaria_pretendido numeric(12,2),
  chave_pix text,

  -- "extra" (só diárias) ou "clt" (quer ser contratado)
  interesse text not null default 'extra' check (interesse in ('extra', 'clt', 'ambos')),
  respostas jsonb not null default '{}'::jsonb,
  observacoes text,

  status text not null default 'novo' check (status in ('novo', 'aprovado', 'arquivado')),
  colaborador_id uuid,          -- preenchido quando o RH aprova e cria o cadastro
  created_at timestamptz not null default now()
);

create index if not exists idx_extras_cadastros_unidade
  on public.extras_cadastros (unidade_id, created_at desc);
create index if not exists idx_extras_cadastros_funcao
  on public.extras_cadastros (unidade_id, funcao_principal);

alter table public.extras_cadastros enable row level security;

-- Envio público (sem conta) e leitura/gestão pelo app.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='extras_cadastros' and policyname='extras_cadastros_insert_publico') then
    create policy extras_cadastros_insert_publico on public.extras_cadastros for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='extras_cadastros' and policyname='extras_cadastros_all') then
    create policy extras_cadastros_all on public.extras_cadastros for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Puxa SÓ os campos necessários para preencher a candidatura à vaga.
-- Nada além disso fica visível para quem não tem conta.
create or replace function public.extra_cadastro_publico(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', nome,
    'telefone', telefone,
    'data_nascimento', data_nascimento,
    'estado_civil', estado_civil,
    'genero', genero,
    'escolaridade', escolaridade,
    'tem_filhos', tem_filhos,
    'endereco', endereco,
    'bairro', bairro,
    'cidade', cidade,
    'funcao_principal', funcao_principal,
    'experiencia', experiencia
  )
  from public.extras_cadastros
  where id = p_id
  limit 1;
$$;

revoke all on function public.extra_cadastro_publico(uuid) from public;
grant execute on function public.extra_cadastro_publico(uuid) to anon, authenticated;

-- Dados públicos do restaurante para aparecer nos dois portais (endereço etc.).
create or replace function public.unidade_publica(p_unidade_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', coalesce(nome_fantasia, nome),
    'endereco', endereco,
    'numero', numero,
    'bairro', bairro,
    'cidade', cidade,
    'uf', uf,
    'cep', cep
  )
  from public.unidades
  where id::text = p_unidade_id
  limit 1;
$$;

revoke all on function public.unidade_publica(text) from public;
grant execute on function public.unidade_publica(text) to anon, authenticated;
