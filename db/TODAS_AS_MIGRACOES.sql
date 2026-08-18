-- ═══════════════════════════════════════════════════════════════════════════
-- MEU ERP / HEFISTO — TODAS AS MIGRAÇÕES, NUMA COLADA SÓ
--
-- Cole inteiro no SQL Editor do Supabase e execute uma vez.
-- Todas são idempotentes: rodar de novo o que já passou não faz nada.
-- Se parar no meio com erro, me mande a mensagem e o nome do bloco.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 1: migracao_controle_acesso.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- CONTROLE DE ACESSO: USUÁRIOS, PERFIS, ESCOPOS E AUDITORIA
--
-- É o que as telas "Usuários e acessos" e "Perfis de acesso" usam. Sem estas
-- tabelas a rota /api/admin/access-control responde "Não foi possível concluir
-- a operação".
--
-- Seguro rodar mesmo que já existam: tudo é "if not exists" e nenhuma coluna
-- é apagada ou alterada.
--
-- ATENÇÃO — além disto, a rota exige a variável SUPABASE_SERVICE_ROLE_KEY
-- configurada no servidor (Vercel → Settings → Environment Variables).
-- Sem ela, a tela continua dando erro mesmo com as tabelas criadas.
--
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PERFIS: conjuntos reutilizáveis de permissões ───────────────────────────
create table if not exists public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  descricao text,
  tipo text not null default 'personalizado',
  -- Perfis versionados: editar cria uma versão nova e aposenta a anterior.
  version integer not null default 1,
  is_current boolean not null default true,
  supersedes_id uuid,
  sistema boolean not null default false,
  permissoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfis_acesso add column if not exists permissoes jsonb not null default '[]'::jsonb;
alter table public.perfis_acesso add column if not exists version integer not null default 1;
alter table public.perfis_acesso add column if not exists is_current boolean not null default true;
alter table public.perfis_acesso add column if not exists supersedes_id uuid;
alter table public.perfis_acesso add column if not exists sistema boolean not null default false;

-- A tabela pode ja existir com outro formato: garante o que a rota usa.
alter table public.perfis_acesso add column if not exists nome text;
alter table public.perfis_acesso add column if not exists codigo text;
alter table public.perfis_acesso add column if not exists descricao text;
alter table public.perfis_acesso add column if not exists tipo text default 'personalizado';
alter table public.perfis_acesso add column if not exists ativo boolean not null default true;
alter table public.perfis_acesso add column if not exists created_by uuid;
alter table public.perfis_acesso add column if not exists created_at timestamptz not null default now();
alter table public.perfis_acesso add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_perfis_acesso_atual on public.perfis_acesso (is_current, ativo, nome);

-- ── USUÁRIOS DO SISTEMA ─────────────────────────────────────────────────────
create table if not exists public.usuarios_erp (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nome text not null,
  login text unique,
  email text,
  perfil_id uuid references public.perfis_acesso(id) on delete set null,
  colaborador_id uuid,
  setor text,
  unidade_id text,
  status text not null default 'ativo',
  ativo boolean not null default true,
  -- Segurança do login
  exigir_troca_senha boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  ultimo_acesso timestamptz,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesma proteção da tabela de perfis: completa o que faltar.
alter table public.usuarios_erp add column if not exists auth_user_id uuid;
alter table public.usuarios_erp add column if not exists nome text;
alter table public.usuarios_erp add column if not exists login text;
alter table public.usuarios_erp add column if not exists email text;
alter table public.usuarios_erp add column if not exists perfil_id uuid;
alter table public.usuarios_erp add column if not exists setor text;
alter table public.usuarios_erp add column if not exists unidade_id text;
alter table public.usuarios_erp add column if not exists status text not null default 'ativo';
alter table public.usuarios_erp add column if not exists ativo boolean not null default true;
alter table public.usuarios_erp add column if not exists criado_por uuid;
alter table public.usuarios_erp add column if not exists created_at timestamptz not null default now();
alter table public.usuarios_erp add column if not exists updated_at timestamptz not null default now();
alter table public.usuarios_erp add column if not exists exigir_troca_senha boolean not null default true;
alter table public.usuarios_erp add column if not exists failed_attempts integer not null default 0;
alter table public.usuarios_erp add column if not exists locked_until timestamptz;
alter table public.usuarios_erp add column if not exists ultimo_acesso timestamptz;
alter table public.usuarios_erp add column if not exists colaborador_id uuid;

create index if not exists idx_usuarios_erp_perfil on public.usuarios_erp (perfil_id);
create index if not exists idx_usuarios_erp_status on public.usuarios_erp (status, ativo);

-- ── ESCOPO: até onde cada usuário enxerga ───────────────────────────────────
create table if not exists public.usuario_escopos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_erp(id) on delete cascade,
  empresa_id uuid,
  unidade_id text,
  setor_id text,
  -- "todos" | "unidade" | "setor" | "proprio"
  data_scope text not null default 'unidade',
  created_at timestamptz not null default now()
);

create index if not exists idx_usuario_escopos_usuario on public.usuario_escopos (usuario_id);

-- ── AUDITORIA: quem mexeu em acesso, quando e o que mudou ───────────────────
create table if not exists public.permissoes_auditoria (
  id uuid primary key default gen_random_uuid(),
  ator_auth_user_id uuid,
  alvo_tipo text,
  alvo_id uuid,
  evento text not null,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_permissoes_auditoria_alvo
  on public.permissoes_auditoria (alvo_tipo, alvo_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- A administração passa pela rota do servidor, que usa a service role e ignora
-- RLS. Aqui a política só libera leitura para quem já está autenticado.
do $$
declare t text;
begin
  foreach t in array array['perfis_acesso','usuarios_erp','usuario_escopos','permissoes_auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_leitura') then
      execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_leitura', t);
    end if;
  end loop;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 2: migracao_hefisto_auditoria.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORIA DO ASSISTENTE HEFISTO
-- Toda ação interpretada/executada pelo assistente gera um registro.
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.hefisto_auditoria (
  id              uuid primary key default gen_random_uuid(),
  -- Ids são TEXTO no ERP inteiro (a unidade pode ser "matriz", não só uuid).
  -- Declarar uuid aqui derrubava o insert e a auditoria ficava vazia.
  unidade_id      text,
  usuario_id      text,
  usuario_nome    text,
  comando         text,              -- texto original digitado/ditado
  intencao        jsonb,             -- intenção estruturada interpretada
  acao            text,              -- id da ação executada
  modulo          text,
  registro_id     text,              -- registro afetado (quando houver)
  valor_anterior  numeric(16,4),
  valor_novo      numeric(16,4),
  resultado       text,              -- sucesso | erro | cancelado | pendente
  erro            text,
  exigiu_confirmacao boolean default false,
  dispositivo     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_hefisto_aud_unidade on public.hefisto_auditoria (unidade_id, created_at desc);
create index if not exists idx_hefisto_aud_usuario on public.hefisto_auditoria (usuario_id, created_at desc);

alter table public.hefisto_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hefisto_auditoria' and policyname = 'hefisto_auditoria_all'
  ) then
    create policy hefisto_auditoria_all on public.hefisto_auditoria for all using (true) with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 3: migracao_auditoria_correcao.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DA AUDITORIA (hefisto_auditoria)
--
-- Por que existe: a baixa do inventário não aparecia em /dashboard/gestao/auditoria.
-- O insert era feito com .catch(() => {}), então qualquer recusa do banco sumia
-- sem deixar rastro — justamente na tabela que existe para deixar rastro.
--
-- A causa mais provável está na criação original (migracao_hefisto_auditoria.sql):
-- unidade_id, usuario_id e registro_id foram declarados como uuid, mas no ERP
-- inteiro esses ids trafegam como TEXTO ("matriz" é o fallback quando não há
-- unidade cadastrada). Um id que não seja uuid derruba o INSERT inteiro com
-- "invalid input syntax for type uuid" — e a leitura da tela quebra do mesmo
-- jeito, porque o filtro .eq("unidade_id", ...) manda texto.
--
-- Esta migração cobre de uma vez as quatro possibilidades: tabela inexistente,
-- coluna faltando, tipo errado e permissão/RLS.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Tabela, caso nunca tenha sido criada. Já nasce com os ids em texto.
create table if not exists public.hefisto_auditoria (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text,
  usuario_id         text,
  usuario_nome       text,
  comando            text,              -- texto original digitado/ditado
  intencao           jsonb,             -- intenção estruturada interpretada
  acao               text,              -- id da ação executada
  modulo             text,
  registro_id        text,              -- registro afetado (quando houver)
  valor_anterior     numeric(16,4),
  valor_novo         numeric(16,4),
  resultado          text,              -- sucesso | erro | cancelado | pendente
  erro               text,
  exigiu_confirmacao boolean default false,
  dispositivo        text,
  created_at         timestamptz not null default now()
);

-- 2) Colunas que podem faltar em bancos criados por versões anteriores.
alter table public.hefisto_auditoria add column if not exists unidade_id         text;
alter table public.hefisto_auditoria add column if not exists usuario_id         text;
alter table public.hefisto_auditoria add column if not exists usuario_nome       text;
alter table public.hefisto_auditoria add column if not exists comando            text;
alter table public.hefisto_auditoria add column if not exists intencao           jsonb;
alter table public.hefisto_auditoria add column if not exists acao               text;
alter table public.hefisto_auditoria add column if not exists modulo             text;
alter table public.hefisto_auditoria add column if not exists registro_id        text;
alter table public.hefisto_auditoria add column if not exists valor_anterior     numeric(16,4);
alter table public.hefisto_auditoria add column if not exists valor_novo         numeric(16,4);
alter table public.hefisto_auditoria add column if not exists resultado          text;
alter table public.hefisto_auditoria add column if not exists erro               text;
alter table public.hefisto_auditoria add column if not exists exigiu_confirmacao boolean default false;
alter table public.hefisto_auditoria add column if not exists dispositivo        text;
alter table public.hefisto_auditoria add column if not exists created_at         timestamptz not null default now();

-- 3) Ids do ERP são texto. Converte só o que ainda estiver como uuid — os
--    valores já gravados continuam válidos, uuid vira a própria string.
do $$
declare coluna record;
begin
  for coluna in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'hefisto_auditoria'
       and column_name in ('unidade_id', 'usuario_id', 'registro_id')
       and data_type    = 'uuid'
  loop
    execute format(
      'alter table public.hefisto_auditoria alter column %I type text using %I::text',
      coluna.column_name, coluna.column_name
    );
  end loop;
end $$;

create index if not exists idx_hefisto_aud_unidade on public.hefisto_auditoria (unidade_id, created_at desc);
create index if not exists idx_hefisto_aud_usuario on public.hefisto_auditoria (usuario_id, created_at desc);

-- 4) RLS liberada para quem está logado, igual ao resto do ERP.
alter table public.hefisto_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'hefisto_auditoria'
       and policyname = 'hefisto_auditoria_all'
  ) then
    create policy hefisto_auditoria_all on public.hefisto_auditoria
      for all using (true) with check (true);
  end if;
end $$;

-- 5) Sem GRANT a política não adianta: o erro sai como "permission denied".
grant select, insert on public.hefisto_auditoria to anon, authenticated;

-- 6) O PostgREST guarda o desenho das tabelas em cache; sem isto ele continua
--    respondendo "Could not find the table" logo depois da migração.
notify pgrst, 'reload schema';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 4: migracao_operacao_inteligente.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- OPERAÇÃO INTELIGENTE
-- Motor de processos operacionais: modelos versionados, agendamento recorrente,
-- execução guiada com evidências, não conformidades e ações corretivas.
--
-- Convenções deste banco (seguidas aqui):
--  · unidade_id é TEXTO (não uuid) — igual ao resto do ERP;
--  · RLS ligada com política permissiva, como nas demais tabelas do projeto;
--  · nada de foto em base64 no banco: a coluna guarda o caminho no storage.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── MODELO DO PROCESSO ──────────────────────────────────────────────────────
create table if not exists public.op_processos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  nome text not null,
  descricao text,
  categoria text,                       -- Cozinha, Bar, Salão, Limpeza...
  setor text,                           -- cozinha | bar | salao | limpeza
  criticidade text not null default 'normal' check (criticidade in ('baixa','normal','alta','critica')),
  versao integer not null default 1,    -- editar depois de ter execução cria v2
  ativo boolean not null default true,
  arquivado boolean not null default false,
  -- Regras de conclusão
  exige_todos_obrigatorios boolean not null default true,
  permite_concluir_com_nc boolean not null default true,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.op_secoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.op_processos(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer not null default 0
);

create table if not exists public.op_itens (
  id uuid primary key default gen_random_uuid(),
  secao_id uuid not null references public.op_secoes(id) on delete cascade,
  processo_id uuid not null references public.op_processos(id) on delete cascade,
  titulo text not null,
  instrucao text,
  tipo text not null default 'FEITO_NAO_FEITO',
  ordem integer not null default 0,
  obrigatorio boolean not null default true,
  permite_na boolean not null default false,
  peso numeric(6,2) not null default 1,
  critico boolean not null default false,
  exige_foto boolean not null default false,
  exige_comentario boolean not null default false,
  exige_gps boolean not null default false,
  valor_min numeric(14,3),
  valor_max numeric(14,3),
  unidade_medida text,
  opcoes jsonb not null default '[]'::jsonb,     -- para seleção única/múltipla
  resposta_esperada text,                        -- o que conta como conforme
  -- Condicional: mostra este item só quando outro item tiver certa resposta
  depende_item_id uuid,
  depende_valor text,
  -- Ação automática ao reprovar: nenhuma | nao_conformidade | manutencao
  acao_reprovar text not null default 'nao_conformidade',
  criterios_ia text                              -- o que a foto precisa mostrar
);

-- ── AGENDAMENTO ─────────────────────────────────────────────────────────────
create table if not exists public.op_agendas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.op_processos(id) on delete cascade,
  unidade_id text not null,
  frequencia text not null default 'diaria'
    check (frequencia in ('diaria','dias_semana','semanal','quinzenal','mensal','datas')),
  dias_semana integer[] not null default '{}',   -- 0=domingo .. 6=sábado
  dia_mes integer,
  datas date[] not null default '{}',
  hora_inicio time not null,
  minutos_tolerancia integer not null default 15,
  minutos_prazo integer not null default 120,    -- vira atrasado depois disso
  turno text,
  responsavel_id uuid,                           -- colaborador
  funcao_responsavel text,                       -- ou por cargo/função
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── EXECUÇÕES ───────────────────────────────────────────────────────────────
create table if not exists public.op_execucoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  processo_id uuid not null references public.op_processos(id) on delete cascade,
  agenda_id uuid references public.op_agendas(id) on delete set null,
  processo_versao integer not null default 1,    -- histórico não muda se o modelo mudar
  data_referencia date not null,
  previsto_para timestamptz not null,
  prazo_ate timestamptz,
  status text not null default 'AGENDADA'
    check (status in ('AGENDADA','DISPONIVEL','EM_ANDAMENTO','CONCLUIDA','CONCLUIDA_COM_ATRASO','ATRASADA','CANCELADA')),
  responsavel_id uuid,
  responsavel_nome text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  total_itens integer not null default 0,
  itens_respondidos integer not null default 0,
  itens_conformes integer not null default 0,
  itens_nao_conformes integer not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  -- Idempotência: uma execução por agenda/dia/horário
  unique (agenda_id, data_referencia, previsto_para)
);

create table if not exists public.op_respostas (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.op_execucoes(id) on delete cascade,
  item_id uuid not null,
  valor text,
  valor_numero numeric(14,3),
  conforme boolean,
  nao_aplica boolean not null default false,
  comentario text,
  respondido_por text,
  respondido_em timestamptz not null default now(),
  unique (execucao_id, item_id)
);

-- Evidências: o arquivo vive no storage; aqui fica a prova e o contexto.
create table if not exists public.op_evidencias (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.op_execucoes(id) on delete cascade,
  item_id uuid not null,
  unidade_id text not null,
  arquivo_caminho text,                 -- caminho no storage (nunca base64)
  arquivo_url text,
  tipo text not null default 'foto',
  usuario text,
  criado_em_servidor timestamptz not null default now(),
  latitude numeric(10,6),
  longitude numeric(10,6),
  precisao_gps numeric(10,2),
  dispositivo text,
  hash_arquivo text,
  ia_status text check (ia_status in ('aprovada','reprovada','revisar')),
  ia_confianca numeric(5,2),
  ia_motivo text,
  revisado_por text,
  revisado_em timestamptz,
  status text not null default 'valida'
);

-- ── NÃO CONFORMIDADES E AÇÕES ───────────────────────────────────────────────
create table if not exists public.op_nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  origem text not null default 'execucao',   -- execucao | manual | atraso
  processo_id uuid,
  execucao_id uuid references public.op_execucoes(id) on delete set null,
  item_id uuid,
  setor text,
  titulo text not null,
  descricao text,
  criticidade text not null default 'normal' check (criticidade in ('baixa','normal','alta','critica')),
  status text not null default 'ABERTA'
    check (status in ('ABERTA','EM_ANALISE','ACAO_DEFINIDA','EM_CORRECAO','AGUARDANDO_VALIDACAO','RESOLVIDA','CANCELADA')),
  responsavel_id uuid,
  responsavel_nome text,
  prazo date,
  aberta_por text,
  resolvida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.op_acoes_corretivas (
  id uuid primary key default gen_random_uuid(),
  nao_conformidade_id uuid not null references public.op_nao_conformidades(id) on delete cascade,
  descricao text not null,
  responsavel_id uuid,
  responsavel_nome text,
  prazo date,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  comentario text,
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

-- ── ALERTAS E AUDITORIA ─────────────────────────────────────────────────────
create table if not exists public.op_alertas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  tipo text not null default 'atencao' check (tipo in ('informativo','atencao','critico')),
  titulo text not null,
  descricao text,
  execucao_id uuid,
  nao_conformidade_id uuid,
  destinatario text,
  -- Deduplicação: a mesma regra não avisa duas vezes pelo mesmo motivo
  chave_dedupe text,
  lido boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chave_dedupe)
);

create table if not exists public.op_auditoria (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  entidade text not null,
  entidade_id uuid,
  acao text not null,
  usuario text,
  dados_antes jsonb,
  dados_depois jsonb,
  motivo text,
  created_at timestamptz not null default now()
);

-- ── ÍNDICES (volume alto de execuções) ──────────────────────────────────────
create index if not exists idx_op_processos_unidade on public.op_processos (unidade_id, ativo, arquivado);
create index if not exists idx_op_secoes_processo on public.op_secoes (processo_id, ordem);
create index if not exists idx_op_itens_secao on public.op_itens (secao_id, ordem);
create index if not exists idx_op_agendas_processo on public.op_agendas (processo_id, ativo);
create index if not exists idx_op_agendas_unidade on public.op_agendas (unidade_id, ativo);
create index if not exists idx_op_exec_unidade_data on public.op_execucoes (unidade_id, data_referencia desc);
create index if not exists idx_op_exec_status on public.op_execucoes (unidade_id, status, previsto_para);
create index if not exists idx_op_exec_responsavel on public.op_execucoes (responsavel_id, data_referencia desc);
create index if not exists idx_op_respostas_exec on public.op_respostas (execucao_id);
create index if not exists idx_op_evid_exec on public.op_evidencias (execucao_id);
create index if not exists idx_op_nc_unidade on public.op_nao_conformidades (unidade_id, status, created_at desc);
create index if not exists idx_op_acoes_nc on public.op_acoes_corretivas (nao_conformidade_id, status);
create index if not exists idx_op_alertas_unidade on public.op_alertas (unidade_id, lido, created_at desc);
create index if not exists idx_op_auditoria_entidade on public.op_auditoria (entidade, entidade_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'op_processos','op_secoes','op_itens','op_agendas','op_execucoes','op_respostas',
    'op_evidencias','op_nao_conformidades','op_acoes_corretivas','op_alertas','op_auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_all') then
      execute format('create policy %I on public.%I for all using (true) with check (true)', t||'_all', t);
    end if;
  end loop;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 5: migracao_memorandos_operacao.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Memorando diário consolidado: produção da Cozinha, produção do Bar e compras.
-- Execute no SQL Editor do Supabase. É seguro executar novamente.

create table if not exists public.memorandos_operacao (
  id uuid primary key default gen_random_uuid(),
  -- TEXTO, não uuid: neste banco a unidade nem sempre é um uuid (config_sistema
  -- guarda unidade_id como texto). Com uuid, o salvar quebraria por tipo.
  unidade_id text not null,
  data_referencia date not null,
  cozinha jsonb not null default '{}'::jsonb,
  bar jsonb not null default '{}'::jsonb,
  compras_manuais jsonb not null default '[]'::jsonb,
  observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmado')),
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, data_referencia)
);

create index if not exists idx_memorandos_operacao_unidade_data
  on public.memorandos_operacao (unidade_id, data_referencia desc);

alter table public.memorandos_operacao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'memorandos_operacao'
      and policyname = 'memorandos_operacao_all'
  ) then
    create policy memorandos_operacao_all
      on public.memorandos_operacao for all
      using (true) with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 6: migracao_colaborador_filiacao.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- FILIAÇÃO E FILHOS NO CADASTRO DO COLABORADOR
--
-- O contrato precisa qualificar a pessoa: nome do pai e da mãe, onde nasceu,
-- onde mora hoje e, quando houver, os filhos com nome e CPF.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists nome_pai text;
alter table public.colaboradores add column if not exists nome_mae text;

-- Cidades: podem já existir em bancos mais novos; o "if not exists" resolve.
alter table public.colaboradores add column if not exists cidade_nascimento text;
alter table public.colaboradores add column if not exists cidade_uf text;

-- Filhos: lista de { "nome": "...", "cpf": "..." }. Fica em jsonb porque o
-- número varia e não se consulta filho isoladamente.
alter table public.colaboradores add column if not exists filhos jsonb not null default '[]'::jsonb;

-- Os contadores antigos continuam valendo para quem já preencheu.
alter table public.colaboradores add column if not exists tem_filhos boolean default false;
alter table public.colaboradores add column if not exists qtd_filhos integer;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 7: migracao_colaborador_estado_civil.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Estado civil no cadastro de funcionários e extras.
-- Os demais campos pessoais (gênero, escolaridade, filhos, nascimento) já existem.
alter table public.colaboradores add column if not exists estado_civil text;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 8: migracao_ponto_facial.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PONTO POR RECONHECIMENTO FACIAL
--
-- O rosto NÃO é guardado como imagem: o aparelho calcula um vetor de 128
-- números (descritor) e é só isso que fica no banco. Não dá para reconstruir a
-- face a partir dele.
--
-- LGPD: biometria é dado pessoal SENSÍVEL (art. 5º, II). O consentimento
-- específico de cada funcionário fica registrado em face_consentimento_em.
-- A foto da batida (face_foto_auditoria) é guardada por escolha da gestão para
-- conferência — trate-a como dado sensível e apague o que não for mais preciso.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cadastro facial do funcionário
alter table public.colaboradores add column if not exists face_descritores      jsonb;        -- lista de vetores (uma por captura)
alter table public.colaboradores add column if not exists face_cadastrado_em    timestamptz;
alter table public.colaboradores add column if not exists face_consentimento_em timestamptz;  -- aceite do termo LGPD
alter table public.colaboradores add column if not exists face_consentimento_por text;        -- quem colheu o aceite

-- Auditoria da batida por rosto
alter table public.registro_ponto add column if not exists face_foto_entrada   text;  -- base64 pequeno
alter table public.registro_ponto add column if not exists face_foto_saida     text;
alter table public.registro_ponto add column if not exists face_confianca      numeric(6,4); -- distância do match (menor = melhor)
alter table public.registro_ponto add column if not exists origem_batida       text;  -- facial | pin | manual


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 9: migracao_recibos_prestacao.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- RECIBOS DE TRABALHO EXTRA
-- Histórico dos acertos com freelancers/diaristas. Cada recibo guarda os dados
-- COMO ESTAVAM na emissão (coluna "dados"): mudar o cadastro da pessoa depois
-- não altera recibos já emitidos.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rh_recibos_prestacao (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  colaborador_id uuid not null,
  numero text,

  data_trabalho date not null,
  datas_contratadas jsonb not null default '[]'::jsonb,
  dias_contratados integer not null default 1,

  valor_diaria numeric(12,2) not null default 0,
  valor_total  numeric(12,2) not null default 0,

  pagamento_realizado boolean not null default false,
  data_pagamento date,
  forma_pagamento text,

  hora_entrada text,
  hora_saida_intervalo text,
  hora_retorno_intervalo text,
  hora_saida text,

  evento text,
  funcao text,
  janta_ofertada boolean not null default true,
  itens jsonb not null default '[]'::jsonb,

  -- Retrato dos dados no momento da emissão (nome, CPF, endereço, PIX...)
  dados jsonb not null default '{}'::jsonb,
  foto_recibo_assinado text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recibos_colaborador
  on public.rh_recibos_prestacao (colaborador_id, data_trabalho desc);
create index if not exists idx_recibos_unidade
  on public.rh_recibos_prestacao (unidade_id, data_trabalho desc);

alter table public.rh_recibos_prestacao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rh_recibos_prestacao'
      and policyname = 'rh_recibos_prestacao_all'
  ) then
    create policy rh_recibos_prestacao_all
      on public.rh_recibos_prestacao for all
      using (true) with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 10: migracao_extra_dados_recibo.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- DADOS DO RECIBO NO CADASTRO DO EXTRA
-- Tudo que o Recibo de Trabalho Extra precisa passa a viver no cadastro da
-- pessoa. Ao gerar o recibo, os campos já vêm preenchidos — sem redigitar.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists topicos_funcao      text;    -- o que a pessoa faz no dia (vai impresso no recibo)
alter table public.colaboradores add column if not exists itens_emprestados   text;    -- itens entregues, separados por vírgula
alter table public.colaboradores add column if not exists forma_pagamento     text;    -- Pix, Dinheiro, Transferência...
alter table public.colaboradores add column if not exists vale_transporte_val numeric(12,2); -- valor padrão de VT por diária
alter table public.colaboradores add column if not exists setor_entrega       text;    -- setor onde se apresenta
alter table public.colaboradores add column if not exists janta_ofertada      boolean default true;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 11: migracao_movimento_valor.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PREÇO TRAVADO NO DIA DA MOVIMENTAÇÃO
--
-- Sem isto, "Compras do mês" e o consumo de estoque são calculados pelo custo
-- ATUAL do ingrediente: mudou o preço hoje, as compras antigas mudam junto.
-- Guardando o valor no próprio movimento, cada entrada fica valendo o que
-- valia no dia — e o histórico para de se mexer sozinho.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.estoque_movimentacoes_multi
  add column if not exists valor_unitario numeric(14,4);

alter table public.estoque_movimentacoes_multi
  add column if not exists valor_total numeric(14,2);

-- Preenche o histórico já existente com o custo atual do ingrediente. É o
-- melhor palpite possível para o que já passou; daqui para frente o valor é
-- gravado no momento da movimentação.
update public.estoque_movimentacoes_multi m
   set valor_unitario = coalesce(i.custo_compra, i.custo_unitario, 0),
       valor_total    = round((coalesce(i.custo_compra, i.custo_unitario, 0) * coalesce(m.quantidade, 0))::numeric, 2)
  from public.insumos i
 where i.id = m.insumo_id
   and m.valor_unitario is null;

create index if not exists idx_mov_multi_data_tipo
  on public.estoque_movimentacoes_multi (unidade_id, tipo, data_movimento desc);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 12: migracao_insumo_fornecedor_precos.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PREÇO POR FORNECEDOR NO INGREDIENTE
-- Um ingrediente é único, mas pode ter vários fornecedores, cada um com seu
-- próprio preço (e embalagem). O fornecedor "atual" (insumos.fornecedor_atual_id)
-- define o custo usado nas fichas/estoque. O histórico por fornecedor já é
-- suportado por insumos_precos_historico (coluna fornecedor_id).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Colunas de preço na tabela de vínculo insumo↔fornecedor.
alter table public.insumos_fornecedores add column if not exists unidade_id         text;
alter table public.insumos_fornecedores add column if not exists preco              numeric(14,4);
alter table public.insumos_fornecedores add column if not exists tamanho_embalagem  numeric(14,4);
alter table public.insumos_fornecedores add column if not exists unidade_embalagem  text;
alter table public.insumos_fornecedores add column if not exists preco_normalizado  numeric(16,6);
alter table public.insumos_fornecedores add column if not exists atualizado_em      timestamptz default now();

-- Um fornecedor só pode aparecer uma vez por ingrediente (evita duplicidade).
create unique index if not exists uidx_insumo_fornecedor
  on public.insumos_fornecedores (insumo_id, fornecedor_id);

-- (Opcional / recomendado) Evita DOIS ingredientes com o mesmo nome no mesmo
-- setor da mesma unidade. Usa nome normalizado (minúsculo, sem espaços nas pontas).
-- Comentado por segurança: só habilite depois de conferir que não há duplicados
-- hoje — senão a criação do índice falha. A trava principal já é feita no app.
-- create unique index if not exists uidx_insumo_nome_setor
--   on public.insumos (unidade_id, departamento, lower(btrim(nome)))
--   where coalesce(ativo, true) = true;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 13: migracao_insumo_perda_empanado.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PERDA E EMPANAMENTO NO INGREDIENTE
-- Perda (limpeza/aparo): informa-se peso bruto e perda em g; o app calcula o %.
-- Empanamento: o produto GANHA peso e tem um custo adicional (empanado).
-- Esses fatores passam a valer por ingrediente (o FC sai da ficha técnica).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.insumos add column if not exists peso_bruto_padrao numeric(14,3);  -- referência p/ a perda (g)
alter table public.insumos add column if not exists perda_g           numeric(14,3);  -- perda em g sobre o peso bruto
alter table public.insumos add column if not exists perda_pct         numeric(8,3);   -- perda calculada (%)
alter table public.insumos add column if not exists empanado          boolean default false;
alter table public.insumos add column if not exists ganho_pct         numeric(8,3);   -- ganho de peso do empanado (%)
alter table public.insumos add column if not exists custo_empanado_kg numeric(14,4);  -- custo do empanamento por kg final (R$)


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 14: migracao_ficha_custo_historico.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- HISTÓRICO DE CUSTOS POR FICHA TÉCNICA
-- Registra um "retrato" do custo da ficha a cada alteração (edição da receita ou
-- registro manual quando o preço dos insumos muda). Nada é apagado: cada linha é
-- um ponto no tempo, permitindo ver a variação de custo da receita.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e execute. É idempotente
-- (pode rodar de novo sem erro).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.fichas_custo_historico (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text,   -- TEXTO: ids de unidade no ERP nao sao uuid
  ficha_id           uuid not null references public.fichas_tecnicas(id) on delete cascade,
  custo_total        numeric(14,4) not null default 0,
  custo_porcao       numeric(14,4),
  custo_anterior     numeric(14,4),
  diferenca          numeric(14,4),
  diferenca_pct      numeric(10,4),
  ingrediente_gatilho text,
  origem             text default 'edicao_ficha',   -- edicao_ficha | manual | variacao_preco
  usuario_id         uuid,
  usuario_nome       text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_fch_custo_hist_ficha
  on public.fichas_custo_historico (ficha_id, created_at desc);
create index if not exists idx_fch_custo_hist_unidade
  on public.fichas_custo_historico (unidade_id, created_at desc);

-- RLS: mesma política aberta usada pelo app (chave anônima + app single-tenant).
alter table public.fichas_custo_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fichas_custo_historico'
      and policyname = 'fichas_custo_historico_all'
  ) then
    create policy fichas_custo_historico_all
      on public.fichas_custo_historico
      for all
      using (true)
      with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 15: migracao_ficha_metodo_bar.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- MÉTODO DE PREPARO DO DRINK (fichas_tecnicas.metodo_bar)
--
-- Por que existe: batido e mexido não são estilo, mudam o resultado no copo.
-- O shaker aera, gela e dilui mais; o mixing glass mantém o drink límpido e com
-- corpo. Sem o campo, essa diferença só vivia na cabeça de quem já sabia.
--
-- Valores usados pelo app: batido | mexido | montado | liquidificador | dose.
-- Sem constraint de propósito: se amanhã entrar outro método, é só o app mudar,
-- e ficha antiga fica com nulo (nenhum método declarado).
--
-- Enquanto esta migração não roda, o app continua salvando a ficha sem o campo:
-- salvarFicha remove a coluna que o banco recusa e regrava.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.fichas_tecnicas add column if not exists metodo_bar text;

notify pgrst, 'reload schema';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 16: migracao_montagem_fora_do_guia.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- TIRAR DO GUIA DE MONTAGEM (montagem.fora_do_guia)
--
-- Por que existe: água, cerveja e refrigerante apareciam como card de DRINK no
-- guia de montagem. Tentei separar por regra — pelo tipo da ficha técnica e
-- depois por ter passo a passo escrito — e nenhuma das duas pegou, porque no
-- banco esses itens são iguaizinhos a um drink de verdade.
--
-- Em vez de continuar adivinhando, a decisão passa a ser sua e fica gravada:
-- marcou "tirar do guia", sai da lista e a sincronia com o cardápio não recria.
-- Reversível — é só desmarcar em "Fora do guia".
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.montagem add column if not exists fora_do_guia boolean not null default false;

create index if not exists idx_montagem_fora_do_guia
  on public.montagem (unidade_id, fora_do_guia);

notify pgrst, 'reload schema';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 17: migracao_listas_etiquetas.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Listas reutilizáveis de etiquetas (voz ou cadastro manual).
-- Execute no SQL Editor do Supabase. O script pode ser executado novamente.

create table if not exists public.listas_etiquetas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,   -- TEXTO: ids de unidade no ERP nao sao uuid
  nome text not null,
  setor text not null check (setor in ('cozinha', 'bar')),
  responsavel_id uuid,
  responsavel_nome text,
  itens jsonb not null default '[]'::jsonb,
  total_etiquetas integer not null default 0 check (total_etiquetas >= 0),
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listas_etiquetas_unidade_setor
  on public.listas_etiquetas (unidade_id, setor, created_at desc);

alter table public.listas_etiquetas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listas_etiquetas'
      and policyname = 'listas_etiquetas_all'
  ) then
    create policy listas_etiquetas_all
      on public.listas_etiquetas for all
      using (true) with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 18: migracao_estoque_bebidas.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- MIGRAÇÃO: Estoque de bebidas/embalados — saldo FECHADO x ABERTO
-- ----------------------------------------------------------------------------
-- Segurança: NÃO altera a função existente registrar_movimento_estoque_multi.
-- As funções novas REAPROVEITAM essa função (testada) para mexer no
-- quantidade_atual e gravar o histórico, e só gerenciam o split fechado/aberto.
-- Assim o total (quantidade_atual) e o split ficam sempre consistentes.
--
-- Convenção de saldos, por item de estoque (estoque_itens):
--   quantidade_atual = total em CONTEÚDO (ml/g/L/kg) — como já é hoje.
--   saldo_fechado    = nº de unidades comerciais fechadas (garrafas/latas...).
--   saldo_aberto     = conteúdo solto na embalagem aberta (ml/g...).
--   Invariante: quantidade_atual = saldo_fechado * conteudo + saldo_aberto.
--
-- Conteúdo por embalagem: usa insumos.tamanho_embalagem (já existente).
-- Rode em ambiente de teste antes de produção. Revise nomes de coluna.
-- ============================================================================

-- 1) COLUNAS NOVAS (aditivas, não destrutivas) -------------------------------
alter table estoque_itens add column if not exists saldo_fechado numeric not null default 0;
alter table estoque_itens add column if not exists saldo_aberto  numeric not null default 0;

alter table insumos add column if not exists unidade_comercial text;      -- garrafa, lata, caixa, pacote, fardo, barril, unidade, outro
alter table insumos add column if not exists unidade_conteudo  text;      -- ml, l, g, kg, unidade
alter table insumos add column if not exists permite_fracionado boolean not null default true;

-- 2) BACKFILL DOS SALDOS EXISTENTES ------------------------------------------
-- Converte o quantidade_atual atual em fechadas + aberto, sem perder nada.
-- Itens com conteúdo por embalagem > 1 (bebidas/embalados). Não fracionáveis
-- (permite_fracionado = false) ficam com tudo em fechadas e aberto = 0.
update estoque_itens ei
set
  saldo_fechado = floor(coalesce(ei.quantidade_atual,0) / nullif(i.tamanho_embalagem,0)),
  saldo_aberto  = case when coalesce(i.permite_fracionado,true)
                       then coalesce(ei.quantidade_atual,0) - floor(coalesce(ei.quantidade_atual,0) / nullif(i.tamanho_embalagem,0)) * i.tamanho_embalagem
                       else 0 end
from insumos i
where ei.insumo_id = i.id
  and coalesce(i.tamanho_embalagem,1) > 1;

-- Para produtos SEM embalagem fracionável (conteudo <= 1): fechadas = total.
update estoque_itens ei
set saldo_fechado = coalesce(ei.quantidade_atual,0), saldo_aberto = 0
from insumos i
where ei.insumo_id = i.id
  and coalesce(i.tamanho_embalagem,1) <= 1;

-- 3) HELPER: conteúdo por embalagem do insumo --------------------------------
create or replace function bebida_conteudo(p_insumo_id uuid)
returns numeric language sql stable as $$
  select greatest(coalesce((select tamanho_embalagem from insumos where id = p_insumo_id), 1), 0.000001);
$$;

-- 4) ENTRADA POR UNIDADE COMERCIAL -------------------------------------------
-- Ex.: +3 garrafas → saldo_fechado += 3 e quantidade_atual += 3 * conteudo.
create or replace function bebida_entrada_unidades(
  p_unidade_id  text,
  p_estoque_id  uuid,
  p_insumo_id   uuid,
  p_unidades    numeric,
  p_usuario_id  uuid   default null,
  p_usuario_nome text  default null,
  p_observacao  text   default null,
  p_data        timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item_id uuid;
begin
  if p_unidades is null or p_unidades <= 0 then raise exception 'Informe uma quantidade de unidades maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select id into v_item_id from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if v_item_id is null then raise exception 'Item não vinculado a este estoque.'; end if;

  -- total + histórico via engine existente (entrada do equivalente em conteúdo)
  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'entrada', p_quantidade := p_unidades * v_conteudo,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Entrada de ' || p_unidades || ' unidade(s)'),
    p_data_movimento := coalesce(p_data, now()));

  update estoque_itens set saldo_fechado = saldo_fechado + p_unidades where id = v_item_id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item_id;
end; $$;

-- 5) BAIXA POR UNIDADE (garrafa inteira descartada/transferida/consumida) -----
create or replace function bebida_baixa_unidades(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_unidades numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null,
  p_observacao text default null, p_data timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item estoque_itens%rowtype;
begin
  if p_unidades is null or p_unidades <= 0 then raise exception 'Informe uma quantidade de unidades maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if p_unidades > coalesce(v_item.saldo_fechado,0) + 1e-9 then
    raise exception 'Só há % unidade(s) fechada(s) disponível(is).', v_item.saldo_fechado;
  end if;

  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'saida', p_quantidade := p_unidades * v_conteudo,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Baixa de ' || p_unidades || ' unidade(s) fechada(s)'),
    p_data_movimento := coalesce(p_data, now()));

  update estoque_itens set saldo_fechado = saldo_fechado - p_unidades where id = v_item.id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- 6) BAIXA POR CONTEÚDO (ml/g) — consome o aberto e abre garrafa se faltar ----
-- 1) consome o saldo aberto; 2) se faltar, abre quantas unidades forem
-- necessárias (fechado -1, aberto += conteudo por unidade); 3) consome; nunca
-- deixa saldo negativo. Retorna também quantas embalagens foram abertas.
create or replace function bebida_baixa_conteudo(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_qtd numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null,
  p_observacao text default null, p_data timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric, abertas int)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item estoque_itens%rowtype; v_precisa numeric; v_abrir int := 0;
begin
  if p_qtd is null or p_qtd <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if p_qtd > coalesce(v_item.quantidade_atual,0) + 1e-9 then
    raise exception 'Saldo insuficiente: disponível %.', v_item.quantidade_atual;
  end if;

  -- abre embalagens fechadas se o aberto não cobre o pedido
  v_precisa := p_qtd - coalesce(v_item.saldo_aberto,0);
  if v_precisa > 1e-9 then
    v_abrir := ceil(v_precisa / v_conteudo);
    if v_abrir > coalesce(v_item.saldo_fechado,0) then
      raise exception 'Saldo insuficiente para abrir embalagem.';
    end if;
    update estoque_itens set saldo_fechado = saldo_fechado - v_abrir,
                             saldo_aberto  = saldo_aberto + v_abrir * v_conteudo
    where id = v_item.id;
  end if;

  -- consome do aberto e baixa o total (quantidade_atual) + histórico via engine
  update estoque_itens set saldo_aberto = saldo_aberto - p_qtd where id = v_item.id;
  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'saida', p_quantidade := p_qtd,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Baixa fracionada' || case when v_abrir > 0 then ' (' || v_abrir || ' embalagem aberta automaticamente)' else '' end),
    p_data_movimento := coalesce(p_data, now()));

  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual, v_abrir from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- 7) CONTAGEM COM DOIS CAMPOS (fechadas + aberto) ----------------------------
create or replace function bebida_contagem(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid,
  p_fechadas numeric, p_aberto numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null, p_observacao text default null
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item_id uuid; v_total numeric;
begin
  if p_fechadas < 0 or p_aberto < 0 then raise exception 'Contagem não pode ser negativa.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select id into v_item_id from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if v_item_id is null then raise exception 'Item não vinculado a este estoque.'; end if;
  v_total := p_fechadas * v_conteudo + p_aberto;

  -- ajusta o total + registra a divergência via engine de contagem existente
  perform registrar_contagem_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_saldo_contado := v_total, p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Contagem: ' || p_fechadas || ' fechadas + ' || p_aberto || ' aberto'));

  update estoque_itens set saldo_fechado = p_fechadas, saldo_aberto = p_aberto where id = v_item_id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item_id;
end; $$;

-- 8) ZERAR PRODUTO (com motivo obrigatório) ----------------------------------
create or replace function bebida_zerar(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_motivo text,
  p_usuario_id uuid default null, p_usuario_nome text default null
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_item estoque_itens%rowtype;
begin
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo para zerar o produto.'; end if;
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if coalesce(v_item.quantidade_atual,0) > 0 then
    perform registrar_movimento_estoque_multi(
      p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
      p_tipo := 'saida', p_quantidade := v_item.quantidade_atual,
      p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
      p_observacao := 'Zerar produto — ' || p_motivo, p_data_movimento := now());
  end if;
  update estoque_itens set saldo_fechado = 0, saldo_aberto = 0 where id = v_item.id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- FIM. Após rodar, a tela passa a usar estas funções para itens fracionáveis.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 19: migracao_estoques_embalagens_fichas.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Estoques de embalagens separados por Cozinha e Bar e vinculo com fichas.

alter table if exists public.operacao_embalagens
  add column if not exists departamento text not null default 'cozinha';

alter table if exists public.operacao_embalagens
  add column if not exists insumo_id uuid references public.insumos(id) on delete set null;

alter table if exists public.produtos
  add column if not exists embalagens jsonb not null default '[]'::jsonb;

create index if not exists operacao_embalagens_unidade_departamento_idx
  on public.operacao_embalagens (unidade_id, departamento, nome);

insert into public.estoques (
  unidade_id, nome, slug, tipo, descricao, status, cor,
  controla_validade, controla_minimo, ordem
)
select
  u.id,
  padrao.nome,
  padrao.slug,
  'embalagens',
  padrao.descricao,
  'ativo',
  padrao.cor,
  false,
  true,
  padrao.ordem
from public.unidades u
cross join (
  values
    ('Embalagens da Cozinha', 'embalagens-cozinha', 'Potes, caixas, sacolas e descartaveis da cozinha', '#db2777', 6),
    ('Embalagens do Bar', 'embalagens-bar', 'Copos, tampas, canudos e descartaveis do bar', '#9333ea', 7)
) as padrao(nome, slug, descricao, cor, ordem)
on conflict (unidade_id, slug) do nothing;

-- Cadastros antigos continuam pertencendo a Cozinha ate serem alterados.
update public.operacao_embalagens
set departamento = 'cozinha'
where departamento is null or departamento not in ('cozinha', 'bar');


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 20: migracao_portal_extras.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PORTAL PÚBLICO DE CADASTRO DE EXTRAS
--
-- O extra abre um link, se cadastra sozinho e cai num BANCO DE EXTRAS separado
-- (não entra direto na folha): o RH revisa e aprova quem vira colaborador.
-- Quem marca interesse em CLT é levado ao portal de vagas com os dados já
-- preenchidos — sem redigitar.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.extras_cadastros (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,

  nome text not null,
  telefone text not null,
  data_nascimento date,
  nacionalidade text,
  estado_civil text,
  genero text,
  escolaridade text,
  tem_filhos boolean default false,
  qtd_filhos integer,

  endereco text,                 -- rua/avenida
  numero text,                   -- número, separado da rua
  bairro text,
  cidade text,

  -- Até duas funções; a principal é a que manda na busca por categoria.
  funcao_principal text not null,
  funcao_secundaria text,

  dias_disponiveis text[] not null default '{}',   -- seg, ter, qua...
  periodo_disponivel text,                          -- almoço, jantar, ambos
  experiencia text,
  valor_diaria_pretendido numeric(12,2),
  chave_pix text,

  -- "extra" (só diárias) ou "clt" (quer ser contratado)
  interesse text not null default 'extra' check (interesse in ('extra', 'clt', 'ambos')),
  respostas jsonb not null default '{}'::jsonb,
  observacoes text,

  status text not null default 'novo' check (status in ('novo', 'aprovado', 'arquivado')),
  colaborador_id uuid,          -- preenchido quando o RH aprova e cria o cadastro
  created_at timestamptz not null default now()
);

-- Quem já rodou este arquivo antes: acrescenta só o que faltava.
alter table public.extras_cadastros add column if not exists nacionalidade text;
alter table public.extras_cadastros add column if not exists numero text;
alter table public.extras_cadastros add column if not exists hora_inicio time;
alter table public.extras_cadastros add column if not exists hora_fim time;

create index if not exists idx_extras_cadastros_unidade
  on public.extras_cadastros (unidade_id, created_at desc);
create index if not exists idx_extras_cadastros_funcao
  on public.extras_cadastros (unidade_id, funcao_principal);

alter table public.extras_cadastros enable row level security;

-- Envio público (sem conta) e leitura/gestão pelo app.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='extras_cadastros' and policyname='extras_cadastros_insert_publico') then
    create policy extras_cadastros_insert_publico on public.extras_cadastros for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='extras_cadastros' and policyname='extras_cadastros_all') then
    create policy extras_cadastros_all on public.extras_cadastros for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Puxa SÓ os campos necessários para preencher a candidatura à vaga.
-- Nada além disso fica visível para quem não tem conta.
create or replace function public.extra_cadastro_publico(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', nome,
    'telefone', telefone,
    'data_nascimento', data_nascimento,
    'estado_civil', estado_civil,
    'genero', genero,
    'escolaridade', escolaridade,
    'tem_filhos', tem_filhos,
    'endereco', endereco,
    'bairro', bairro,
    'cidade', cidade,
    'funcao_principal', funcao_principal,
    'experiencia', experiencia
  )
  from public.extras_cadastros
  where id = p_id
  limit 1;
$$;

revoke all on function public.extra_cadastro_publico(uuid) from public;
grant execute on function public.extra_cadastro_publico(uuid) to anon, authenticated;

-- Dados públicos do restaurante para aparecer nos dois portais (endereço etc.).
create or replace function public.unidade_publica(p_unidade_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', coalesce(nome_fantasia, nome),
    'endereco', endereco,
    'numero', numero,
    'bairro', bairro,
    'cidade', cidade,
    'uf', uf,
    'cep', cep
  )
  from public.unidades
  where id::text = p_unidade_id
  limit 1;
$$;

revoke all on function public.unidade_publica(text) from public;
grant execute on function public.unidade_publica(text) to anon, authenticated;

-- Configuração editável do portal (títulos, funções oferecidas e perguntas).
-- Fica em config_sistema.params -> 'portal_extras'. A função devolve SÓ esse
-- bloco: o resto das configurações da empresa continua invisível para quem não
-- tem conta. Mesmo padrão já usado no portal de vagas.
-- Atenção: config_sistema.unidade_id é TEXTO neste banco — o parâmetro segue o
-- mesmo tipo e a comparação é feita como texto (funciona com texto ou uuid).
drop function if exists public.portal_extras_publico(uuid);

create or replace function public.portal_extras_publico(p_unidade_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(params -> 'portal_extras', '{}'::jsonb)
  from public.config_sistema
  where unidade_id::text = p_unidade_id
  limit 1;
$$;

revoke all on function public.portal_extras_publico(text) from public;
grant execute on function public.portal_extras_publico(text) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO 21: migracao_portal_vagas_publico.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- PORTAL PÚBLICO DE VAGAS (sem login)
-- O candidato abre /vagas/<unidade>, preenche e envia. Duas permissões são
-- necessárias para quem NÃO tem conta:
--   1. ler as vagas publicadas  → via função, que devolve SÓ o bloco de vagas
--      (nunca o restante das configurações da empresa);
--   2. gravar a própria candidatura em "candidatos".
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente e seguro:
-- não liga RLS onde ela está desligada (isso poderia derrubar o acesso atual).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Leitura pública apenas das vagas -----------------------------------------
-- config_sistema.unidade_id é TEXTO neste banco: o parâmetro segue o mesmo tipo
-- e a comparação é feita como texto, funcionando com id em texto ou uuid.
drop function if exists public.portal_vagas_publico(uuid);

create or replace function public.portal_vagas_publico(p_unidade_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(params -> 'portal_vagas', '{}'::jsonb)
  from public.config_sistema
  where unidade_id::text = p_unidade_id
  limit 1;
$$;

revoke all on function public.portal_vagas_publico(text) from public;
grant execute on function public.portal_vagas_publico(text) to anon, authenticated;

-- 2) Envio da candidatura sem login -------------------------------------------
-- Só cria a política se a tabela já usa RLS. Se a RLS estiver desligada, o
-- envio já funciona e nada precisa ser feito.
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'candidatos' and rowsecurity
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidatos'
      and policyname = 'candidatos_insert_publico'
  ) then
    create policy candidatos_insert_publico
      on public.candidatos
      for insert
      to anon
      with check (true);
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOCO FINAL: unidade_id é TEXTO em todo o banco
--
-- No ERP o id da unidade viaja como texto ("matriz" é o valor de partida
-- quando não há unidade cadastrada). Tabela que declarou uuid rejeita o
-- insert com "invalid input syntax for type uuid" — foi assim que a auditoria
-- ficou vazia por meses sem ninguém perceber. Isto varre o banco e converte o
-- que ainda estiver errado. Só age onde precisa; uuid vira a própria string.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare col record;
begin
  for col in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name = 'unidade_id'
       and data_type = 'uuid'
  loop
    execute format(
      'alter table public.%I alter column %I type text using %I::text',
      col.table_name, col.column_name, col.column_name
    );
    raise notice 'unidade_id convertido para text em %', col.table_name;
  end loop;
end $$;

-- Recarrega o cache de schema do PostgREST no fim de tudo.
notify pgrst, 'reload schema';
