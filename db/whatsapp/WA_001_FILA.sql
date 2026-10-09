/* WA-001 · FILA DE COMANDOS DO WHATSAPP PARA O AGENTE (HDEV-WA-001)
   ═══════════════════════════════════════════════════════════════════════════
   Aditiva: 2 tabelas novas e 1 função. Não toca em nenhuma tabela existente.

   whatsapp_comandos  comandos de desenvolvimento vindos do número autorizado
                      (status, continue, pare, aprovar…); a ponte no PC do dono
                      pega, executa e devolve a resposta.
   whatsapp_ponte     última vez que a ponte apareceu (para dizer "PC offline").
   whatsapp_pegar_comandos(n)  pega até n pendentes de forma atômica
                      (for update skip locked); reentrega o que ficou preso
                      em execução por mais de 10 minutos.

   Acesso: SÓ o servidor (service role). RLS ligado sem policy, sem privilégio
   para anon/authenticated, função executável só pela service_role.

   COMO RODAR: só com aprovação (APR-003). Inteiro, de uma vez.
   Rollback: db/whatsapp/WA_001_ROLLBACK.sql (apaga a fila: só com o dono).
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.whatsapp_comandos') is not null or to_regclass('public.whatsapp_ponte') is not null then
    raise exception 'WA-001 preflight: já aplicada (tabela existe). Nada foi alterado.';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then raise exception 'WA-001 preflight: falta gen_random_uuid(). Nada foi alterado.'; end if;
end $$;

create table public.whatsapp_comandos (
  id uuid primary key default gen_random_uuid(),
  mensagem_id text not null unique check (length(mensagem_id) between 1 and 200),
  numero text not null check (numero ~ '^[0-9]{10,15}$'),
  comando text not null check (comando in ('status', 'desenvolvimento', 'continuar', 'parar', 'missoes', 'bloqueadores', 'aprovacoes', 'aprovar', 'rejeitar')),
  args jsonb not null default '{}'::jsonb,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'EM_EXECUCAO', 'CONCLUIDO', 'FALHOU')),
  resposta text check (resposta is null or length(resposta) <= 8000),
  criado_em timestamptz not null default now(),
  pego_em timestamptz,
  concluido_em timestamptz
);
create index whatsapp_comandos_pendentes on public.whatsapp_comandos (criado_em) where status in ('PENDENTE', 'EM_EXECUCAO');

create table public.whatsapp_ponte (
  id smallint primary key default 1 check (id = 1),
  visto_em timestamptz not null default now()
);

alter table public.whatsapp_comandos enable row level security;
alter table public.whatsapp_ponte enable row level security;
revoke all on table public.whatsapp_comandos from public, anon, authenticated;
revoke all on table public.whatsapp_ponte from public, anon, authenticated;

create function public.whatsapp_pegar_comandos(p_limite int default 5) returns setof public.whatsapp_comandos
language sql volatile security definer set search_path = public as $$
  update public.whatsapp_comandos c set status = 'EM_EXECUCAO', pego_em = now()
   where c.id in (
     select x.id from public.whatsapp_comandos x
      where x.status = 'PENDENTE' or (x.status = 'EM_EXECUCAO' and x.pego_em < now() - interval '10 minutes')
      order by x.criado_em
      limit least(greatest(coalesce(p_limite, 5), 1), 20)
      for update skip locked)
  returning c.*
$$;
revoke all on function public.whatsapp_pegar_comandos(int) from public, anon, authenticated;
grant execute on function public.whatsapp_pegar_comandos(int) to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.whatsapp_comandos'::regclass) then raise exception 'WA-001 verificação: RLS desligado'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('whatsapp_comandos', 'whatsapp_ponte')) then raise exception 'WA-001 verificação: policy inesperada'; end if;
  if has_table_privilege('authenticated', 'public.whatsapp_comandos', 'select') or has_table_privilege('anon', 'public.whatsapp_comandos', 'select') then
    raise exception 'WA-001 verificação: navegador lê a fila';
  end if;
  if has_function_privilege('authenticated', 'public.whatsapp_pegar_comandos(int)', 'execute') then raise exception 'WA-001 verificação: navegador executa a função'; end if;
end $$;

commit;
