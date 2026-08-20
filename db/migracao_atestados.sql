-- ─────────────────────────────────────────────────────────────────────────────
-- ATESTADO MÉDICO (rh_atestados)
--
-- Por que existe: até agora o sistema só sabia dizer "folga" ou "falta". Dia de
-- atestado caía como falta — e falta desconta, atestado não. Guardar os dois na
-- mesma gaveta erra o pagamento e ainda deixa o funcionário marcado como
-- faltoso no histórico dele.
--
-- Guarda um PERÍODO, não um dia solto: atestado de três dias é um documento só,
-- e lançar três registros separados faria perder essa ligação.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rh_atestados (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     text,
  colaborador_id uuid not null,
  data_inicio    date not null,
  data_fim       date not null,
  -- Parcial: a pessoa trabalhou parte do dia e saiu com atestado. Nesse caso o
  -- ponto do dia continua valendo e isto é só o registro do documento.
  parcial        boolean not null default false,
  cid            text,
  medico         text,
  observacao     text,
  arquivo_url    text,
  registrado_por text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_rh_atestados_colab
  on public.rh_atestados (colaborador_id, data_inicio);
create index if not exists idx_rh_atestados_unidade
  on public.rh_atestados (unidade_id, data_inicio);

alter table public.rh_atestados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'rh_atestados'
       and policyname = 'rh_atestados_all'
  ) then
    create policy rh_atestados_all on public.rh_atestados
      for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.rh_atestados to anon, authenticated;

notify pgrst, 'reload schema';
