/* ═══════════════════════════════════════════════════════════════════════════
   IC-01 · HEFISTO INTELLIGENCE CORE — AUDITORIA, AÇÕES, MEMÓRIA E PREFERÊNCIAS
   VERSÃO: ic-01.2  (a versão fica gravada no comentário de cada tabela)

   STATUS: PROPOSTA. Rodar só com aprovação do dono (SQL Editor do Supabase),
   DEPOIS de db/intelligence/IC_01_PREFLIGHT.sql sem nenhum "BLOQUEIA".
   Conferência depois de aplicar: db/intelligence/IC_01_VERIFICACAO.sql.

   POR QUE: o Copilot anterior guardava a auditoria em MEMÓRIA (perdida a cada
   deploy) e hefisto_auditoria tem policy "using (true)". O Intelligence Core
   precisa de:
     intelligence_eventos       auditoria IMUTÁVEL de todo pedido, consulta,
                                proposta, confirmação, execução, bloqueio e
                                mudança de configuração
     intelligence_acoes         ações propostas pela conversa (rascunho →
                                proposta → executada), com chave de
                                idempotência por usuário/unidade
     intelligence_feedback      respostas aos insights e às perguntas do Héfisto
                                (aprendizado por dado persistido — o modelo não
                                muda regra nenhuma)
     intelligence_preferencias  por unidade: alertas ligados, sensibilidade,
                                limiares e metas de faturamento (configuradas
                                por gente; nunca inventadas pelo sistema)

   FAZ (uma transação; aborta sem mudar nada se a base não for a esperada):
     - cria só tabelas NOVAS. Aborta se já existir objeto com o mesmo nome que
       não seja desta migração (não "pula" tabela alheia com IF NOT EXISTS);
     - grava só pelo servidor (service role, com o mínimo de privilégio); o app
       (authenticated) só LÊ, e só o que é dele: os próprios eventos/ações/
       respostas, ou a unidade inteira para quem tem relatorios.audit.view
       (mesma chave da tela de Auditoria);
     - intelligence_eventos não aceita UPDATE, DELETE nem TRUNCATE (privilégio
       E trigger), nem da service role.

   NÃO FAZ: nenhum DROP/DELETE/UPDATE/TRUNCATE em tabela existente; não toca em
   estoque, financeiro, RH, compras, vendas, hefisto_auditoria nem nas funções
   de acesso. Os únicos DROP são de trigger/policy/constraint DAS TABELAS
   intelligence_* (para a migração poder ser reexecutada).
   A perda registrada pela inteligência continua indo para o estoque pela
   função que já existe (estoque_movimentar, EST-MOV-1).

   UNIDADE: unidade_id referencia public.unidades(id) sem cascade, igual às
   tabelas do financeiro (F2.1). Excluir uma unidade com histórico continua
   bloqueado, como já é hoje.

   SEM ESTA MIGRAÇÃO: as consultas da Central funcionam (auditoria marcada como
   não persistida) e as AÇÕES ficam bloqueadas — auditoria é obrigatória.

   ROLLBACK: db/intelligence/IC_01_ROLLBACK.sql (apaga o histórico da inteligência).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

/* ── 0. PRÉ-CHECK (aborta sem mudar nada) ──────────────────────────────────── */
do $$
declare
  v_tipo text;
  v_alheios text;
begin
  if to_regclass('public.unidades') is null or to_regclass('public.usuarios_erp') is null then
    raise exception 'IC-01: tabela base ausente (unidades/usuarios_erp). Nada foi alterado.';
  end if;
  select data_type into v_tipo from information_schema.columns
  where table_schema = 'public' and table_name = 'unidades' and column_name = 'id';
  if v_tipo is distinct from 'text' then
    raise exception 'IC-01: public.unidades.id é % (esperado text). Nada foi alterado.', coalesce(v_tipo, 'ausente');
  end if;
  if to_regprocedure('public.hefisto_user_can(text,text)') is null
     or to_regprocedure('public.hefisto_user_in_unit(uuid,text)') is null then
    raise exception 'IC-01: controle de acesso ausente (hefisto_user_can / hefisto_user_in_unit). Nada foi alterado.';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception 'IC-01: auth.uid() ausente. Nada foi alterado.';
  end if;
  if to_regprocedure('gen_random_uuid()') is null and to_regprocedure('public.gen_random_uuid()') is null then
    raise exception 'IC-01: gen_random_uuid() ausente. Nada foi alterado.';
  end if;
  -- colisão de nomes: só aceita objeto que ESTA migração criou antes
  select string_agg(c.relname, ', ') into v_alheios
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias')
    and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'hefisto:ic-01%';
  if v_alheios is not null then
    raise exception 'IC-01: já existe % no banco e não é desta migração. Nada foi alterado.', v_alheios;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'intelligence_eventos_imutavel_trg'
               and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'hefisto:ic-01%') then
    raise exception 'IC-01: já existe public.intelligence_eventos_imutavel_trg() e não é desta migração. Nada foi alterado.';
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
  etapa           text not null,
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
alter table public.intelligence_eventos drop constraint if exists intelligence_eventos_etapa_check;
alter table public.intelligence_eventos add constraint intelligence_eventos_etapa_check
  check (etapa in ('pedido','consulta','recomendacao','acao_proposta','acao_confirmada','acao_cancelada',
                   'acao_executada','acao_falhou','bloqueio','feedback','resumo_diario','configuracao'));
comment on table public.intelligence_eventos is 'hefisto:ic-01.2 — auditoria imutável do Intelligence Core (pedido → consulta → proposta → confirmação → execução)';
create index if not exists intelligence_eventos_usuario on public.intelligence_eventos (unidade_id, auth_user_id, created_at desc);
create index if not exists intelligence_eventos_correlacao on public.intelligence_eventos (correlation_id);
create index if not exists intelligence_eventos_acao on public.intelligence_eventos (acao_id) where acao_id is not null;

create or replace function public.intelligence_eventos_imutavel_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A auditoria da inteligência é imutável: % não é permitido.', tg_op;
end $$;
comment on function public.intelligence_eventos_imutavel_trg() is 'hefisto:ic-01.2 — bloqueia UPDATE/DELETE/TRUNCATE em intelligence_eventos';
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
comment on table public.intelligence_acoes is 'hefisto:ic-01.2 — ações pedidas pela conversa; só Confirmar executa (pelas funções do domínio)';
create index if not exists intelligence_acoes_usuario on public.intelligence_acoes (unidade_id, auth_user_id, created_at desc);

/* ── 3. MEMÓRIA: RESPOSTAS AOS INSIGHTS E ÀS PERGUNTAS DO HÉFISTO ──────────── */
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
-- feedback estruturado (perguntas abertas): de qual pergunta, sobre qual
-- entidade, e a evidência que estava na tela quando a pessoa respondeu
alter table public.intelligence_feedback add column if not exists pergunta_id text;
alter table public.intelligence_feedback add column if not exists entidade_tipo text;
alter table public.intelligence_feedback add column if not exists entidade_id text;
alter table public.intelligence_feedback add column if not exists contexto jsonb;
alter table public.intelligence_feedback drop constraint if exists intelligence_feedback_estruturado_check;
alter table public.intelligence_feedback add constraint intelligence_feedback_estruturado_check check (
  (pergunta_id is null or char_length(pergunta_id) <= 80)
  and (entidade_tipo is null or char_length(entidade_tipo) <= 30)
  and (entidade_id is null or char_length(entidade_id) <= 64)
  and (contexto is null or (jsonb_typeof(contexto) = 'object' and pg_column_size(contexto) <= 4000))
);
comment on table public.intelligence_feedback is 'hefisto:ic-01.2 — respostas aos insights e perguntas; reordenam hipóteses e escondem o que já foi respondido';
create index if not exists intelligence_feedback_unidade on public.intelligence_feedback (unidade_id, created_at desc);
create index if not exists intelligence_feedback_entidade on public.intelligence_feedback (unidade_id, entidade_tipo, entidade_id) where entidade_id is not null;

/* ── 4. PREFERÊNCIAS E METAS POR UNIDADE ───────────────────────────────────── */
create table if not exists public.intelligence_preferencias (
  unidade_id      text primary key references public.unidades(id),
  limiares        jsonb not null default '{}'::jsonb,
  atualizado_por  uuid,
  updated_at      timestamptz not null default now()
);
alter table public.intelligence_preferencias add column if not exists alertas jsonb not null
  default '{"estoque":true,"financeiro":true,"compras":true,"rh":true,"vendas":true}'::jsonb;
alter table public.intelligence_preferencias add column if not exists sensibilidade text not null default 'normal';
-- metas digitadas por gente. Nulas = sem meta (o sistema não inventa meta).
alter table public.intelligence_preferencias add column if not exists meta_faturamento_mensal numeric(14,2);
alter table public.intelligence_preferencias add column if not exists meta_faturamento_semanal numeric(14,2);
alter table public.intelligence_preferencias add column if not exists meta_faturamento_diaria numeric(14,2);
alter table public.intelligence_preferencias drop constraint if exists intelligence_preferencias_valores_check;
alter table public.intelligence_preferencias add constraint intelligence_preferencias_valores_check check (
  sensibilidade in ('baixa','normal','alta')
  and jsonb_typeof(alertas) = 'object'
  and jsonb_typeof(limiares) = 'object'
  and (meta_faturamento_mensal is null or meta_faturamento_mensal > 0)
  and (meta_faturamento_semanal is null or meta_faturamento_semanal > 0)
  and (meta_faturamento_diaria is null or meta_faturamento_diaria > 0)
);
comment on table public.intelligence_preferencias is 'hefisto:ic-01.2 — alertas, sensibilidade, limiares e metas de faturamento da unidade';

/* ── 5. SEGURANÇA ──────────────────────────────────────────────────────────── */
do $$
declare
  t text;
  r text;
begin
  foreach t in array array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
    -- o Supabase concede tudo por padrão a anon/authenticated/service_role em
    -- tabela nova do schema public: tira tudo e devolve só o necessário
    foreach r in array array['anon','authenticated','service_role'] loop
      begin execute format('revoke all on public.%I from %I', t, r); exception when undefined_object then null; end;
    end loop;
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

-- metas são informação gerencial: só quem pode abrir a Central da unidade
drop policy if exists intelligence_preferencias_ler on public.intelligence_preferencias;
create policy intelligence_preferencias_ler on public.intelligence_preferencias for select to authenticated
  using (public.hefisto_user_can('dashboard.intelligence.view', unidade_id));

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
  select string_agg(t, ', ') into v
  from unnest(array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias']) t
  where coalesce(obj_description(to_regclass('public.' || t), 'pg_class'), '') not like 'hefisto:ic-01.2%';
  if v is not null then raise exception 'IC-01 pós-check: versão não gravada em %', v; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    select string_agg(t, ', ') into v
    from unnest(array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias']) t
    where has_table_privilege('authenticated', 'public.' || t, 'INSERT') or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE') or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE');
    if v is not null then raise exception 'IC-01 pós-check: usuário do app escreve em %', v; end if;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    select string_agg(t, ', ') into v
    from unnest(array['intelligence_eventos','intelligence_acoes','intelligence_feedback','intelligence_preferencias']) t
    where has_table_privilege('anon', 'public.' || t, 'SELECT');
    if v is not null then raise exception 'IC-01 pós-check: anônimo lê %', v; end if;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role')
     and (has_table_privilege('service_role', 'public.intelligence_eventos', 'UPDATE')
          or has_table_privilege('service_role', 'public.intelligence_eventos', 'DELETE')
          or has_table_privilege('service_role', 'public.intelligence_eventos', 'TRUNCATE')) then
    raise exception 'IC-01 pós-check: service role pode alterar a auditoria';
  end if;
end $$;

commit;
