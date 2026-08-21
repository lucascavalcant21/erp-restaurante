-- ─────────────────────────────────────────────────────────────────────────────
-- ENTREGA DO COMPROVANTE (ponto_comprovante_envio)
--
-- Por que existe: a Portaria MTP 671/2021 obriga a FORNECER o comprovante da
-- marcação ao trabalhador. Imprimir ou enviar não basta se, questionada, a casa
-- não conseguir mostrar que forneceu.
--
-- Guarda uma linha por entrega: qual marcação (NSR), por qual meio, para qual
-- endereço e se deu certo. Falha também é registrada — saber que o e-mail
-- voltou é o que permite reenviar antes de virar problema.
--
-- Não é o comprovante em si: o conteúdo é reconstruído a partir de
-- ponto_marcacao, que é imutável. Aqui fica só a prova da entrega.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ponto_comprovante_envio (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     text,
  colaborador_id uuid,
  nsr            bigint not null,

  -- email | impressao | tela
  meio           text not null default 'email',
  destino        text,

  sucesso        boolean not null default false,
  erro           text,

  enviado_em     timestamptz not null default now()
);

create index if not exists idx_comprovante_envio_nsr
  on public.ponto_comprovante_envio (nsr);
create index if not exists idx_comprovante_envio_colab
  on public.ponto_comprovante_envio (colaborador_id, enviado_em desc);

alter table public.ponto_comprovante_envio enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ponto_comprovante_envio'
       and policyname = 'ponto_comprovante_envio_all'
  ) then
    create policy ponto_comprovante_envio_all on public.ponto_comprovante_envio
      for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
