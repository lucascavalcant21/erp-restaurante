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
