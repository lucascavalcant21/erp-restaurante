-- =========================================================================
-- RESERVAS À LA CARTE - Módulo de Mesas e Atendimento
-- =========================================================================

create table if not exists reservas (
  id              uuid primary key default gen_random_uuid(),
  cliente_nome    text not null,
  telefone        text,
  email           text,
  data_reserva    date not null,
  horario         time not null,
  qtd_pessoas     int not null default 1,
  
  -- Detalhes adicionais
  ocasiao         text, -- Aniversário, Encontro, Casamento, etc.
  mesa            text,
  area_preferencia text, -- Ex: Salão, Varanda, Deck
  observacoes     text,
  alergias        text,
  restricoes      text,
  criancas        int default 0,
  necessidade_esp boolean default false,

  -- Controle do restaurante
  origem          text not null default 'manual', -- WhatsApp, Instagram, Site, Telefone, Manual
  status          text not null default 'nova',   -- nova, aguardando confirmação, confirmada, cliente chegou, sentado, finalizada, cancelada, no-show
  responsavel_id  uuid,                           -- Quem anotou/criou a reserva
  responsavel_nome text,
  
  -- Segurança e Links públicos
  token_alteracao text,                           -- Token para o cliente alterar a reserva
  
  -- Locatário
  unidade_id      text references unidades(id),
  
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_reservas_unidade on reservas(unidade_id);
create index if not exists idx_reservas_data on reservas(data_reserva);
create index if not exists idx_reservas_status on reservas(status);
create index if not exists idx_reservas_token on reservas(token_alteracao);

alter table reservas enable row level security;
revoke all on reservas from anon;
grant all on reservas to authenticated;

drop policy if exists "auth_all" on reservas;
create policy "auth_all" on reservas for all to authenticated using (true) with check (true);

-- Policy para permitir inserção anônima se vier do form público?
-- Em vez de RLS anon, faremos via API segura (Next.js server action).
