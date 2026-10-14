/* ═══════════════════════════════════════════════════════════════════════════
   IFOOD-1 · onde o dono cadastra o iFood (14/10/2026)

   POR QUE
   O código do iFood (adaptador, webhook, cofre) existia, mas nenhuma tabela de
   integração existia no banco: o webhook gravava em integration_events, que
   não existe; a tela /dashboard/canais/ifood só marcava "Conectado" na unidade
   sem testar nada. A migração canônica antiga (migracao_integracoes_canonica.sql)
   não pode ser aplicada: cria índices em colunas de `vendas` que não existem.

   O QUE FAZ (aditivo; nada é apagado)
   - integration_connections: a conexão por unidade (merchant, client id, estado,
     último teste). Sem segredo.
   - integration_secrets: o Client Secret CIFRADO no servidor (AES-256-GCM,
     chave INTEGRATION_MASTER_KEY do ambiente; o banco nunca vê a chave).
   - integration_events: caixa de entrada do webhook (idempotente).
   Mesmas colunas da migração canônica, para o código existente funcionar.

   SEGURANÇA
   RLS ligado e NENHUMA policy: só o servidor (service_role) lê e grava. O
   navegador fala com /api/ifood/conexao, que confere sessão, unidade e
   permissão. anon e authenticated sem privilégio nenhum.

   ROLLBACK (não rodar sem decisão do dono; apaga a conexão salva):
     drop table if exists public.integration_events;
     drop table if exists public.integration_secrets;
     drop table if exists public.integration_connections;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'IFOOD-1: tabela unidades ausente. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.integration_connections (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            text not null references public.unidades(id) on delete cascade,
  provider              text not null check (provider in ('IFOOD', 'SAIPOS', 'WHATSAPP', 'INSTAGRAM')),
  auth_flow             text default 'CENTRALIZED' check (auth_flow in ('DISTRIBUTED', 'CENTRALIZED')),
  external_account_id   text,
  external_merchant_id  text,
  status                text not null default 'NOT_CONFIGURED' check (status in ('NOT_CONFIGURED', 'AUTHORIZATION_REQUIRED', 'PENDING_CREDENTIALS', 'CONFIGURED_UNVERIFIED', 'CONNECTED', 'DEGRADED', 'ERROR', 'AUTH_EXPIRED', 'DISABLED')),
  config_json           jsonb default '{}'::jsonb,
  last_sync_at          timestamptz,
  last_error            text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint integration_connections_unidade_provider_key unique (unidade_id, provider)
);

create table if not exists public.integration_secrets (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            text not null references public.unidades(id) on delete cascade,
  provider              text not null,
  credentials_payload   jsonb not null default '{}'::jsonb,
  security_state        text default 'DO_NOT_STORE_PRODUCTION_SECRETS',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint integration_secrets_unidade_provider_key unique (unidade_id, provider)
);

create table if not exists public.integration_events (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            text references public.unidades(id) on delete set null,
  provider              text not null,
  provider_event_id     text not null,
  event_type            text not null,
  payload               jsonb not null default '{}'::jsonb,
  status                text not null default 'RECEBIDO' check (status in ('RECEBIDO', 'PROCESSADO', 'ERRO_PROCESSAMENTO', 'FALHA', 'IGNORADO', 'IGNORADO_DUPLICIDADE_SAIPOS', 'IGNORADO_FONTE_OPERACIONAL_SAIPOS', 'QUARANTINED_INVALID_EVENT')),
  attempts              integer default 0,
  last_error            text,
  received_at           timestamptz default now(),
  processed_at          timestamptz,
  constraint integration_events_provider_event_key unique (provider, provider_event_id)
);
create index if not exists idx_integration_events_status on public.integration_events (unidade_id, provider, status);

alter table public.integration_connections enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.integration_events enable row level security;

revoke all on public.integration_connections from public, anon, authenticated;
revoke all on public.integration_secrets from public, anon, authenticated;
revoke all on public.integration_events from public, anon, authenticated;
grant all on public.integration_connections to service_role;
grant all on public.integration_secrets to service_role;
grant all on public.integration_events to service_role;

commit;

-- Verificação: RLS ligado, nenhuma policy, ninguém além do servidor
select c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_le,
       has_table_privilege('anon', c.oid, 'select') as anon_le
  from pg_class c where c.relname in ('integration_connections', 'integration_secrets', 'integration_events');
