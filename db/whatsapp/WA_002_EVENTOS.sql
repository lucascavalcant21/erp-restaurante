/* WA-002 · AUDITORIA DO CANAL WHATSAPP (HDEV-WA-COEX-001)
   ═══════════════════════════════════════════════════════════════════════════
   Aditiva: 1 tabela nova. Não toca em nenhuma tabela existente.

   whatsapp_eventos  trilha durável do canal (os logs da Vercel somem em 1 hora):
     entrada   mensagem recebida (comando reconhecido, não autorizado, duplicada…)
     saida     envio pela Graph API/YCloud com o message_id devolvido ou o erro
     status    recibo da Meta/YCloud: sent / delivered / read / failed + código
     eco       mensagem que o dono mandou pelo WhatsApp Business App (coexistência)
     historico lote de histórico sincronizado na coexistência
   Nunca guarda token, segredo nem texto de mensagem: só o comando reconhecido.

   Acesso: SÓ o servidor (service role). RLS ligado sem policy, sem privilégio
   para anon/authenticated. Idempotente por (provedor, direcao, wamid, status, resultado).

   COMO RODAR: só com aprovação (APR-004). Inteiro, de uma vez.
   Rollback: db/whatsapp/WA_002_ROLLBACK.sql (apaga só esta trilha: só com o dono).
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.whatsapp_eventos') is not null then
    raise exception 'WA-002 preflight: já aplicada (tabela existe). Nada foi alterado.';
  end if;
end $$;

create table public.whatsapp_eventos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  provedor text not null check (provedor in ('meta', 'ycloud')),
  direcao text not null check (direcao in ('entrada', 'saida', 'status', 'eco', 'historico')),
  wamid text check (wamid is null or length(wamid) <= 200),
  numero text check (numero is null or numero ~ '^[0-9]{10,15}$'),
  comando text check (comando is null or length(comando) <= 40),
  resultado text check (resultado is null or length(resultado) <= 40),
  status text check (status is null or length(status) <= 20),
  erro_codigo text check (erro_codigo is null or length(erro_codigo) <= 20),
  erro_titulo text check (erro_titulo is null or length(erro_titulo) <= 200),
  comando_id uuid
);
create unique index whatsapp_eventos_idem on public.whatsapp_eventos (provedor, direcao, wamid, coalesce(status, ''), coalesce(resultado, '')) where wamid is not null;
create index whatsapp_eventos_criado on public.whatsapp_eventos (criado_em desc);

alter table public.whatsapp_eventos enable row level security;
revoke all on table public.whatsapp_eventos from public, anon, authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.whatsapp_eventos'::regclass) then raise exception 'WA-002 verificação: RLS desligado'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_eventos') then raise exception 'WA-002 verificação: policy inesperada'; end if;
  if has_table_privilege('authenticated', 'public.whatsapp_eventos', 'select') or has_table_privilege('anon', 'public.whatsapp_eventos', 'select') then
    raise exception 'WA-002 verificação: navegador lê a trilha';
  end if;
end $$;

commit;
