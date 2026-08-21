-- ─────────────────────────────────────────────────────────────────────────────
-- ESPELHO FECHADO (rh_espelho_fechado)
--
-- Por que existe: as batidas ficam guardadas por data e nunca mudam, mas o
-- CABEÇALHO do espelho era lido ao vivo do cadastro do colaborador. Bastava
-- mudar o horário ou a escala de alguém para que a folha de um mês JÁ ASSINADO
-- passasse a imprimir dados diferentes dos que foram assinados.
--
-- O caso grave é a folga: as linhas de FOLGA SEMANAL saem de dias_trabalho.
-- Mudou a escala em outubro, agosto passava a mostrar folga em outro dia — num
-- documento que a contabilidade arquiva e a fiscalização pode pedir.
--
-- Guarda um retrato do contrato no mês: lotação, cargo, admissão, horários,
-- janela de intervalo e dias de trabalho. As batidas continuam em
-- registro_ponto; aqui é só o contexto que valia naquele mês.
--
-- Um registro por colaborador e mês (mes_ref é sempre o dia 1).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rh_espelho_fechado (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     text,
  colaborador_id uuid not null,
  -- Primeiro dia do mês fechado. Date em vez de text para ordenar e filtrar
  -- sem depender do formato da string.
  mes_ref        date not null,
  -- Retrato do contrato naquele mês. Jsonb porque os campos do cadastro mudam
  -- com o tempo e uma coluna por campo obrigaria migração a cada mudança.
  contrato       jsonb not null default '{}'::jsonb,
  fechado_em     timestamptz not null default now(),
  fechado_por    text,
  created_at     timestamptz not null default now()
);

-- Um retrato por colaborador e mês. Sem isto, cada abertura da folha criaria
-- outro registro e o espelho passaria a escolher um retrato ao acaso.
create unique index if not exists idx_rh_espelho_fechado_unico
  on public.rh_espelho_fechado (colaborador_id, mes_ref);
create index if not exists idx_rh_espelho_fechado_unidade
  on public.rh_espelho_fechado (unidade_id, mes_ref);

alter table public.rh_espelho_fechado enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'rh_espelho_fechado'
       and policyname = 'rh_espelho_fechado_all'
  ) then
    create policy rh_espelho_fechado_all on public.rh_espelho_fechado
      for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
