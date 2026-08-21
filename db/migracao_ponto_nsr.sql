-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRO DE MARCAÇÕES COM NSR (ponto_marcacao)
--
-- Por que existe: hoje o ponto guarda UMA linha por dia e sobrescreve os quatro
-- horários nela. Apagar uma batida não deixa buraco, e alterar não deixa rastro
-- — exatamente o que a Portaria MTP 671/2021 proíbe (arts. 80 e 81).
--
-- Esta tabela é o livro-caixa do ponto: uma linha por marcação, numeração
-- sequencial que nunca volta atrás (NSR) e encadeamento por hash. Se alguém
-- apagar ou editar uma linha direto no banco, a corrente quebra e a conferência
-- acusa.
--
-- registro_ponto CONTINUA existindo e é o que as telas leem — ele passa a ser o
-- resumo do dia, derivado daqui. Trocar tudo de uma vez pararia o ponto da casa.
--
-- Correção de batida não apaga nada: entra uma marcação do tipo 'ajuste' com o
-- valor anterior, o autor e o motivo. O histórico fica completo.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- O NSR é do equipamento registrador, não do funcionário: uma sequência só,
-- global, que nunca é reiniciada.
create sequence if not exists public.ponto_nsr_seq as bigint start 1;

create table if not exists public.ponto_marcacao (
  id             uuid primary key default gen_random_uuid(),
  nsr            bigint not null default nextval('public.ponto_nsr_seq'),
  unidade_id     text not null,
  colaborador_id uuid not null,

  -- entrada | saida_intervalo | retorno_intervalo | saida_trabalho | ajuste
  tipo           text not null,

  -- Hora REAL da marcação. A tolerância da CLT não muda este valor: ela entra
  -- no cálculo, nunca no registro.
  marcado_em     timestamptz not null,
  data_referencia date not null,

  -- tablet | facial | manual | ajuste | importacao
  origem         text not null default 'tablet',

  -- Só em 'ajuste': o que havia antes, quem mudou e por quê. Sem os três, a
  -- correção não se sustenta numa fiscalização.
  valor_anterior timestamptz,
  tipo_alvo      text,
  registrado_por text,
  motivo         text,

  latitude       numeric,
  longitude      numeric,

  -- Encadeamento: hash desta linha calculado sobre a anterior. É o que
  -- transforma a tabela numa corrente, em vez de linhas soltas.
  hash_anterior  text,
  hash           text,

  criado_em      timestamptz not null default now()
);

create unique index if not exists idx_ponto_marcacao_nsr on public.ponto_marcacao (nsr);
create index if not exists idx_ponto_marcacao_colab on public.ponto_marcacao (colaborador_id, data_referencia);
create index if not exists idx_ponto_marcacao_unidade on public.ponto_marcacao (unidade_id, data_referencia);


-- ── Encadeamento por hash ───────────────────────────────────────────────────
-- O lock serializa as inserções: sem ele, duas batidas simultâneas leriam o
-- mesmo hash anterior e a corrente nasceria bifurcada.
create or replace function public.ponto_marcacao_encadear()
returns trigger
language plpgsql
as $$
declare
  v_anterior text;
begin
  perform pg_advisory_xact_lock(hashtext('ponto_marcacao'));

  select m.hash into v_anterior
    from public.ponto_marcacao m
   order by m.nsr desc
   limit 1;

  new.hash_anterior := v_anterior;
  new.hash := encode(
    sha256(convert_to(
      coalesce(v_anterior, '') || '|' ||
      new.nsr::text || '|' ||
      new.colaborador_id::text || '|' ||
      new.tipo || '|' ||
      to_char(new.marcado_em at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '|' ||
      new.data_referencia::text,
      'utf8')),
    'hex');
  return new;
end;
$$;

drop trigger if exists trg_ponto_marcacao_encadear on public.ponto_marcacao;
create trigger trg_ponto_marcacao_encadear
  before insert on public.ponto_marcacao
  for each row execute function public.ponto_marcacao_encadear();


-- ── Imutabilidade ───────────────────────────────────────────────────────────
-- A tabela só aceita INSERT. Corrigir uma marcação é inserir um 'ajuste', nunca
-- reescrever a original — é isso que dá valor de prova ao registro.
create or replace function public.ponto_marcacao_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Marcação de ponto não pode ser alterada nem apagada (NSR %). Registre um ajuste.',
    coalesce(old.nsr, -1);
end;
$$;

drop trigger if exists trg_ponto_marcacao_imutavel on public.ponto_marcacao;
create trigger trg_ponto_marcacao_imutavel
  before update or delete on public.ponto_marcacao
  for each row execute function public.ponto_marcacao_imutavel();


-- ── Conferência da corrente ─────────────────────────────────────────────────
-- Recalcula tudo e devolve as linhas onde o hash não fecha. Corrente íntegra
-- devolve zero linhas. Use antes de entregar qualquer coisa à fiscalização.
create or replace function public.ponto_marcacao_conferir()
returns table (nsr bigint, problema text)
language plpgsql
as $$
declare
  r record;
  v_anterior text := null;
  v_calc text;
begin
  for r in select * from public.ponto_marcacao order by nsr loop
    v_calc := encode(
      sha256(convert_to(
        coalesce(v_anterior, '') || '|' ||
        r.nsr::text || '|' ||
        r.colaborador_id::text || '|' ||
        r.tipo || '|' ||
        to_char(r.marcado_em at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '|' ||
        r.data_referencia::text,
        'utf8')),
      'hex');

    if r.hash is distinct from v_calc then
      nsr := r.nsr;
      problema := 'hash não confere — linha alterada ou anterior removida';
      return next;
    end if;

    v_anterior := r.hash;
  end loop;
end;
$$;


alter table public.ponto_marcacao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ponto_marcacao'
       and policyname = 'ponto_marcacao_ler'
  ) then
    create policy ponto_marcacao_ler on public.ponto_marcacao for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ponto_marcacao'
       and policyname = 'ponto_marcacao_inserir'
  ) then
    create policy ponto_marcacao_inserir on public.ponto_marcacao for insert with check (true);
  end if;
end $$;

-- Sem policy de update/delete: mesmo que alguém remova os gatilhos, a RLS
-- continua barrando pelo cliente.

notify pgrst, 'reload schema';
