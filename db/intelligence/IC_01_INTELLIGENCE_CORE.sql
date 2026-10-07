/* ═══════════════════════════════════════════════════════════════════════════
   IC-01 · HEFISTO INTELLIGENCE CORE — AUDITORIA, AÇÕES, MEMÓRIA E PREFERÊNCIAS

   STATUS: PROPOSTA. Rodar só com aprovação do dono (SQL Editor do Supabase).

   POR QUE: o Copilot anterior guardava a auditoria em MEMÓRIA (perdida a cada
   deploy) e hefisto_auditoria tem policy "using (true)". O Intelligence Core
   precisa de:
     intelligence_eventos       auditoria IMUTÁVEL de todo pedido, consulta,
                                proposta, confirmação, execução e bloqueio
     intelligence_acoes         ações propostas pela conversa (rascunho →
                                proposta → executada), com chave de
                                idempotência por usuário/unidade
     intelligence_feedback      respostas aos insights (aprendizado por dado
                                persistido — o modelo não muda regra nenhuma)
     intelligence_preferencias  limiares de detecção por unidade

   FAZ (uma transação; aborta sem mudar nada se faltar a base):
     - cria só tabelas NOVAS; nenhuma tabela, função ou policy existente muda;
     - grava só pelo servidor (service role); o app (authenticated) só LÊ, e só
       o que é dele: os próprios eventos/ações/respostas, ou a unidade inteira
       para quem tem relatorios.audit.view (mesma chave da tela de Auditoria);
     - intelligence_eventos não aceita UPDATE, DELETE nem TRUNCATE (trigger),
       nem da service role.

   NÃO FAZ: não toca em estoque, financeiro, RH, compras nem hefisto_auditoria.
   A perda registrada pela inteligência continua indo para o estoque pela
   função que já existe (estoque_movimentar, EST-MOV-1).

   SEM ESTA MIGRAÇÃO: as consultas da Central funcionam (auditoria marcada como
   não persistida) e as AÇÕES ficam bloqueadas — auditoria é obrigatória.

   ROLLBACK: db/intelligence/IC_01_ROLLBACK.sql (apaga o histórico da inteligência).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.unidades') is null or to_regclass('public.usuarios_erp') is null then
    raise exception 'IC-01: tabela base ausente (unidades/usuarios_erp). Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_user_can(text,text)') is null
     or to_regprocedure('public.hefisto_user_in_unit(uuid,text)') is null then
    raise exception 'IC-01: controle de acesso ausente (hefisto_user_can / hefisto_user_in_unit). Nada foi alterado.';
  end if;
end $$;

/* ── 1. AUDITORIA IMUTÁVEL ─────────────────────────────────────────────────── */
create table if not exists public.intelligence_eventos (
  id              uuid primary key default gen_random_uuid(),
  correlation_id  text not null,
  request_id      text,
  unidade_id      text not null references public.unidades(id),
  empresa_id      text,
  auth_user_id    uuid not null,
  usuario_erp_id  text,
  canal           text,
  etapa           text not null check (etapa in ('pedido','consulta','recomendacao','acao_proposta','acao_confirmada',
                                                  'acao_cancelada','acao_executada','acao_falhou','bloqueio','feedback','resumo_diario')),
  comando         text check (comando is null or char_length(comando) <= 600),
  intencao        jsonb,
  agentes         jsonb,
  consultas       jsonb,
  recomendacao    text,
  acao_id         uuid,
  acao_tipo       text,
  risco           text,
  entidade_tipo   text,
  entidade_id     text,
  antes           jsonb,
  depois          jsonb,
  resultado       jsonb,
  erro            text,
  latencia_ms     integer,
  provedor_ia     text,
  modelo_ia       text,
  tokens_entrada  integer,
  tokens_saida    integer,
  fallback        text,
  created_at      timestamptz not null default now()
);
comment on table public.intelligence_eventos is 'hefisto:ic-01 — auditoria imutável do Intelligence Core (pedido → consulta → proposta → confirmação → execução)';
create index if not exists intelligence_eventos_usuario on public.intelligence_eventos (unidade_id, auth_user_id, created_at desc);
create index if not exists intelligence_eventos_correlacao on public.intelligence_eventos (correlation_id);
create index if not exists intelligence_eventos_acao on public.intelligence_eventos (acao_id) where acao_id is not null;

create or replace function public.intelligence_eventos_imutavel_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A auditoria da inteligência é imutável: % não é permitido.', tg_op;
end $$;
drop trigger if exists intelligence_eventos_imutavel on public.intelligence_eventos;
create trigger intelligence_eventos_imutavel before update or delete on public.intelligence_eventos
  for each row execute function public.intelligence_eventos_imutavel_trg();
drop trigger if exists intelligence_eventos_sem_truncate on public.intelligence_eventos;
create trigger intelligence_eventos_sem_truncate before truncate on public.intelligence_eventos
  for each statement execute function public.intelligence_eventos_imutavel_trg();

/* ── 2. AÇÕES DA CONVERSA ──────────────────────────────────────────────────── */
create table if not exists public.intelligence_acoes (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null references public.unidades(id),
  empresa_id          text,
  auth_user_id        uuid not null,
  correlation_id      text,
  chave_idempotencia  text not null check (char_length(chave_idempotencia) between 8 and 80),
  tipo                text not null,
  risco               text not null check (risco in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status              text not null check (status in ('rascunho','proposta','executando','executada','falhou','cancelada','expirada')),
  comando             text,
  params              jsonb,
  preview             jsonb,
  payload             jsonb,
  resultado           jsonb,
  antes               jsonb,
  depois              jsonb,
  erro                text,
  entidade_id         text,
  expira_em           timestamptz not null,
  confirmada_em       timestamptz,
  executada_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (auth_user_id, unidade_id, chave_idempotencia),
  check (risco <> 'CRITICAL' or status in ('rascunho','cancelada'))
);
comment on table public.intelligence_acoes is 'hefisto:ic-01 — ações pedidas pela conversa; só Confirmar executa (pelas funções do domínio)';
create index if not exists intelligence_acoes_usuario on public.intelligence_acoes (unidade_id, auth_user_id, created_at desc);

/* ── 3. MEMÓRIA: RESPOSTAS AOS INSIGHTS ────────────────────────────────────── */
create table if not exists public.intelligence_feedback (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    text not null references public.unidades(id),
  empresa_id    text,
  auth_user_id  uuid not null,
  insight_id    text not null check (char_length(insight_id) <= 80),
  insight_tipo  text not null check (char_length(insight_tipo) <= 40),
  resposta      text not null check (resposta in ('opcao','dispensar','util','nao_util')),
  opcao_id      text check (opcao_id is null or char_length(opcao_id) <= 40),
  comentario    text check (comentario is null or char_length(comentario) <= 300),
  created_at    timestamptz not null default now()
);
comment on table public.intelligence_feedback is 'hefisto:ic-01 — respostas aos insights; reordenam hipóteses e escondem o que já foi respondido';
create index if not exists intelligence_feedback_unidade on public.intelligence_feedback (unidade_id, created_at desc);

/* ── 4. PREFERÊNCIAS POR UNIDADE ───────────────────────────────────────────── */
create table if not exists public.intelligence_preferencias (
  unidade_id      text primary key references public.unidades(id),
  limiares        jsonb not null default '{}'::jsonb,
  atualizado_por  uuid,
  updated_at      timestamptz not null default now()
);
comment on table public.intelligence_preferencias is 'hefisto:ic-01 — limiares de detecção personalizados da unidade';

/* ── 5. SEGURANÇA ──────────────────────────────────────────────────────────── */
do $$
declare
  t text;
begin
  foreach t in array array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
    begin execute format('revoke all on public.%I from anon', t); exception when undefined_object then null; end;
    begin execute format('revoke all on public.%I from authenticated', t); exception when undefined_object then null; end;
    begin execute format('grant select on public.%I to authenticated', t); exception when undefined_object then null; end;
  end loop;
  begin
    grant select, insert on public.intelligence_eventos to service_role;
    grant select, insert, update on public.intelligence_acoes to service_role;
    grant select, insert on public.intelligence_feedback to service_role;
    grant select, insert, update on public.intelligence_preferencias to service_role;
  exception when undefined_object then null;
  end;
end $$;

drop policy if exists intelligence_eventos_ler on public.intelligence_eventos;
create policy intelligence_eventos_ler on public.intelligence_eventos for select to authenticated
  using (auth_user_id = auth.uid() or public.hefisto_user_can('relatorios.audit.view', unidade_id));

drop policy if exists intelligence_acoes_ler on public.intelligence_acoes;
create policy intelligence_acoes_ler on public.intelligence_acoes for select to authenticated
  using (auth_user_id = auth.uid() or public.hefisto_user_can('relatorios.audit.view', unidade_id));

drop policy if exists intelligence_feedback_ler on public.intelligence_feedback;
create policy intelligence_feedback_ler on public.intelligence_feedback for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists intelligence_preferencias_ler on public.intelligence_preferencias;
create policy intelligence_preferencias_ler on public.intelligence_preferencias for select to authenticated
  using (public.hefisto_user_in_unit(auth.uid(), unidade_id));

revoke all on function public.intelligence_eventos_imutavel_trg() from public;

/* ── 6. PÓS-CHECK ──────────────────────────────────────────────────────────── */
do $$
declare
  v text;
begin
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'intelligence_%' and c.relkind = 'r' and not c.relrowsecurity;
  if v is not null then raise exception 'IC-01 pós-check: RLS desligado em %', v; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    select string_agg(t, ', ') into v
    from unnest(array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias']) t
    where has_table_privilege('authenticated', 'public.' || t, 'INSERT') or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE');
    if v is not null then raise exception 'IC-01 pós-check: usuário do app escreve em %', v; end if;
  end if;
end $$;

commit;
