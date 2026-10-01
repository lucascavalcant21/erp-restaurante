/* ═══════════════════════════════════════════════════════════════════════════
   F2.1 — FUNDAÇÃO FINANCEIRA DO HÉFISTO (migration consolidada)

   STATUS: PROPOSTA. NÃO EXECUTAR sem aprovação do dono.
   Plano completo: PLANO-F2.1-FUNDACAO-FINANCEIRA.md

   Substitui, sem aplicá-las, as migrations financeiras antigas
   (migracao_financeiro_integrado, migracao_vendas_recebiveis_conciliacao,
   migracao_compras_recebimento, migracao_central_comando), consideradas
   incompatíveis na auditoria F2.0.

   Regras que este arquivo cumpre:
   - só ACRESCENTA: tabelas novas, colunas novas NULAS e SEM default em
     contas_pagar, índices, funções, triggers, views;
   - nenhum DROP, TRUNCATE, DELETE ou UPDATE de dados;
   - unidade_id continua TEXT (compatível com 'seldeestrela');
   - os 7 registros atuais de contas_pagar não são tocados: o que falta neles
     (competência, categoria nova, pagamento) é DERIVADO nas views;
   - CHECKs novos em contas_pagar entram como NOT VALID (não validam o
     histórico, só linhas novas/alteradas);
   - tudo numa transação: se a verificação prévia falhar, nada muda;
   - idempotente: pode rodar de novo (objetos marcados com 'hefisto:f2.1').

   Inserções desta migration: SOMENTE dados de referência novos (plano de
   categorias, centros de custo e o mapa das categorias antigas), com
   ON CONFLICT DO NOTHING. Nenhuma taxa, saldo ou valor financeiro é semeado.

   Como rodar (depois de aprovado): SQL Editor do Supabase, colar inteiro,
   executar. Conferência no fim do arquivo.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

/* ─────────────────────────────────────────────────────────────────────────
   0. VERIFICAÇÃO PRÉVIA (fail-closed)
   Cada item diz qual bloco do diagnóstico F2.0 (db/diagnosticos/
   F2_0_SCHEMA_REAL_LEITURA.sql) confirma a premissa antes de rodar.
   ───────────────────────────────────────────────────────────────────────── */
do $$
declare
  v_coluna text;
  v_extra text;
  v_tab text;
  v_conflito text;
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'F2.1 PREFLIGHT: Postgres 15+ é necessário (views com security_invoker).';
  end if;

  -- [S2] unidades.id é texto
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='unidades' and column_name='id' and data_type='text') then
    raise exception 'F2.1 PREFLIGHT [S2]: public.unidades(id text) não encontrada.';
  end if;

  -- [confirmado pelo dono] contas_pagar tem exatamente o schema conhecido
  -- (+ colunas desta própria migration, se ela já rodou antes)
  for v_coluna in select unnest(array['id:uuid','unidade_id:text','descricao:text','valor:numeric',
      'data_vencimento:date','data_pagamento:date','categoria:text','status:text',
      'created_at:timestamp with time zone','updated_at:timestamp with time zone','recorrente:boolean'])
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='contas_pagar'
                      and column_name=split_part(v_coluna,':',1) and data_type=split_part(v_coluna,':',2)) then
      raise exception 'F2.1 PREFLIGHT: contas_pagar.% não tem o tipo esperado (%).', split_part(v_coluna,':',1), split_part(v_coluna,':',2);
    end if;
  end loop;
  select string_agg(column_name, ', ') into v_extra
    from information_schema.columns
   where table_schema='public' and table_name='contas_pagar'
     and column_name not in ('id','unidade_id','descricao','valor','data_vencimento','data_pagamento',
       'categoria','status','created_at','updated_at','recorrente',
       -- colunas F2.1
       'fornecedor_id','categoria_codigo','centro_custo_codigo','competencia','documento_numero',
       'anexo_url','observacao','origem_tipo','origem_id','recorrencia_origem_id','grupo_parcelas_id',
       'parcela_numero','parcelas_total','chave_idempotencia','cancelado_em','motivo_cancelamento',
       'criado_por','atualizado_por');
  if v_extra is not null then
    raise exception 'F2.1 PREFLIGHT: contas_pagar tem colunas inesperadas (%). Schema divergiu: revisar antes.', v_extra;
  end if;

  -- [S5] nenhum CHECK antigo em contas_pagar.status (bloquearia 'parcial'/'cancelado')
  select string_agg(con.conname, ', ') into v_conflito
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname='public' and rel.relname='contas_pagar' and con.contype='c'
     and con.conname not like '%\_f21' escape '\';
  if v_conflito is not null then
    raise exception 'F2.1 PREFLIGHT [S5]: contas_pagar já tem CHECK (%). Revisar compatibilidade antes.', v_conflito;
  end if;

  -- [S1/S2] tabelas referenciadas por FK existem com id uuid
  foreach v_tab in array array['fornecedores','insumos','estoques','vendas'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=v_tab and column_name='id' and data_type='uuid') then
      raise exception 'F2.1 PREFLIGHT [S1/S2]: public.%(id uuid) não encontrada.', v_tab;
    end if;
  end loop;

  -- Linhas antigas fora das regras novas continuam como estão (CHECK NOT VALID),
  -- mas não poderão ser EDITADAS sem ajuste manual. Só avisa.
  if exists (select 1 from public.contas_pagar
              where status not in ('pendente','parcial','pago','cancelado') or valor is null or valor <= 0) then
    raise notice 'F2.1: há contas antigas com status fora de pendente/parcial/pago/cancelado ou valor <= 0. Ficam intactas; editar exigirá revisão.';
  end if;

  -- funções de autorização aplicadas em 30/09 (SEC-RH-1.4)
  if to_regprocedure('public.auth_unidade_id()') is null or to_regprocedure('public.pode_ver_todas()') is null then
    raise exception 'F2.1 PREFLIGHT: public.auth_unidade_id() / public.pode_ver_todas() não existem (SEC-RH-1.4).';
  end if;

  -- [S1] nomes novos: se já existirem, têm de ser desta migration
  foreach v_tab in array array['fin_categorias','fin_categorias_legado','fin_centros_custo',
      'fin_contas_financeiras','fin_pagamentos','fin_taxas_meio_pagamento','fin_contas_receber',
      'fin_recebimentos','compras','compras_itens','estoque_custos','estoque_contagens',
      'estoque_contagens_itens'] loop
    if to_regclass('public.'||v_tab) is not null
       and coalesce(obj_description(to_regclass('public.'||v_tab), 'pg_class'), '') not like 'hefisto:f2.1%' then
      raise exception 'F2.1 PREFLIGHT [S1]: public.% já existe e não foi criada pela F2.1. Revisar antes.', v_tab;
    end if;
  end loop;
end $$;


/* ─────────────────────────────────────────────────────────────────────────
   1. FUNÇÕES DE APOIO
   ───────────────────────────────────────────────────────────────────────── */

-- Dia de hoje no fuso da operação (vencido/atrasado são derivados disto).
create or replace function public.fin_hoje()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Mesma regra das policies: vê a unidade quem vê a rede ou é da unidade.
-- Usada dentro das RPCs (que rodam como definer) para não furar o escopo.
create or replace function public.fin_pode_acessar_unidade(p_unidade_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce(p_unidade_id, '') <> ''
     and (public.pode_ver_todas() or p_unidade_id = public.auth_unidade_id());
$$;

-- Auditoria: quem criou / quem alterou por último. criado_por e created_at
-- não podem ser reescritos numa alteração.
create or replace function public.fin_auditoria_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
  else
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.atualizado_por := auth.uid();
  end if;
  return new;
end $$;

-- Custo médio ponderado móvel: FONTE ÚNICA da fórmula.
-- (saldo anterior × custo médio anterior + valor da entrada) / (saldo anterior + quantidade)
-- Ex.: 20 kg a R$ 45/kg + entrada de 10 kg por R$ 500 → (900 + 500) / 30 = 46,67/kg.
-- Saldo anterior ≤ 0 ou custo anterior desconhecido: o custo passa a ser o da entrada.
create or replace function public.estoque_custo_medio_novo(
  p_saldo_anterior numeric, p_custo_medio_anterior numeric,
  p_quantidade_entrada numeric, p_valor_entrada numeric)
returns numeric language plpgsql immutable as $$
begin
  if p_quantidade_entrada is null or p_quantidade_entrada <= 0 then
    raise exception 'Quantidade de entrada precisa ser maior que zero.';
  end if;
  if p_valor_entrada is null or p_valor_entrada < 0 then
    raise exception 'Valor da entrada inválido.';
  end if;
  if coalesce(p_saldo_anterior, 0) <= 0 or p_custo_medio_anterior is null then
    return round(p_valor_entrada / p_quantidade_entrada, 6);
  end if;
  return round((p_saldo_anterior * p_custo_medio_anterior + p_valor_entrada)
               / (p_saldo_anterior + p_quantidade_entrada), 6);
end $$;


/* ─────────────────────────────────────────────────────────────────────────
   2. REFERÊNCIA: PLANO DE CATEGORIAS E CENTROS DE CUSTO
   natureza = onde a categoria entra no DRE gerencial:
     deducao_receita  impostos sobre venda (sai da receita bruta)
     custo_variavel   taxas de cartão, comissões, entregas (antes da margem)
     pessoal          CMO
     despesa_fixa     ocupação, utilidades, administrativo, manutenção…
     financeiro       tarifas, juros e multas pagos
     mercadoria       compra para estoque: NÃO é despesa nem CMV; vira estoque
     perda_estoque    quebra/perda lançada como conta no passado (legado)
     investimento     equipamentos/obras (fora do resultado operacional)
     distribuicao     retirada de sócios (fora do resultado)
     outros
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.fin_categorias (
  codigo          text primary key check (codigo ~ '^[a-z0-9_]+$'),
  nome            text not null,
  grupo           text not null check (grupo in ('PESSOAL','OCUPACAO','UTILIDADES','ADMINISTRATIVO',
                    'COMERCIALIZACAO','IMPOSTOS','MANUTENCAO','MARKETING','LIMPEZA','FINANCEIRO',
                    'MERCADORIA','INVESTIMENTO','DISTRIBUICAO','LEGADO','OUTROS')),
  natureza        text not null check (natureza in ('deducao_receita','custo_variavel','pessoal',
                    'despesa_fixa','financeiro','mercadoria','perda_estoque','investimento',
                    'distribuicao','outros')),
  permite_conta_manual boolean not null default true,
  exige_revisao   boolean not null default false,
  ativa           boolean not null default true,
  ordem           integer not null default 100,
  created_at      timestamptz not null default now()
);
comment on table public.fin_categorias is 'hefisto:f2.1 — plano de categorias financeiras (global)';

insert into public.fin_categorias (codigo, nome, grupo, natureza, permite_conta_manual, exige_revisao, ordem) values
  ('pessoal_salarios',          'Salários',                                  'PESSOAL',         'pessoal',         true,  false, 10),
  ('pessoal_encargos',          'Encargos (INSS, FGTS)',                     'PESSOAL',         'pessoal',         true,  false, 11),
  ('pessoal_beneficios',        'Benefícios (VT, VA, plano)',                'PESSOAL',         'pessoal',         true,  false, 12),
  ('pessoal_extras',            'Extras e diárias',                          'PESSOAL',         'pessoal',         true,  false, 13),
  ('pessoal_taxa_servico',      'Taxa de serviço repassada à equipe',        'PESSOAL',         'pessoal',         true,  false, 14),
  ('ocupacao_aluguel',          'Aluguel',                                   'OCUPACAO',        'despesa_fixa',    true,  false, 20),
  ('ocupacao_condominio',       'Condomínio',                                'OCUPACAO',        'despesa_fixa',    true,  false, 21),
  ('utilidades_energia',        'Energia elétrica',                          'UTILIDADES',      'despesa_fixa',    true,  false, 30),
  ('utilidades_agua',           'Água',                                      'UTILIDADES',      'despesa_fixa',    true,  false, 31),
  ('utilidades_gas',            'Gás',                                       'UTILIDADES',      'despesa_fixa',    true,  false, 32),
  ('utilidades_internet',       'Internet e telefone',                       'UTILIDADES',      'despesa_fixa',    true,  false, 33),
  ('adm_contabilidade',         'Contabilidade',                             'ADMINISTRATIVO',  'despesa_fixa',    true,  false, 40),
  ('adm_sistemas',              'Sistemas e assinaturas',                    'ADMINISTRATIVO',  'despesa_fixa',    true,  false, 41),
  ('adm_material',              'Material administrativo',                   'ADMINISTRATIVO',  'despesa_fixa',    true,  false, 42),
  ('com_taxa_cartao',           'Taxas de cartão',                           'COMERCIALIZACAO', 'custo_variavel',  true,  false, 50),
  ('com_comissao_marketplace',  'Comissão de marketplace (iFood etc.)',      'COMERCIALIZACAO', 'custo_variavel',  true,  false, 51),
  ('com_comissoes',             'Outras comissões',                          'COMERCIALIZACAO', 'custo_variavel',  true,  false, 52),
  ('com_entregas',              'Entregas e fretes de venda',                'COMERCIALIZACAO', 'custo_variavel',  true,  false, 53),
  ('imp_sobre_vendas',          'Impostos sobre vendas (Simples/DAS etc.)',  'IMPOSTOS',        'deducao_receita', true,  false, 60),
  ('imp_taxas_licencas',        'Taxas, licenças e outros tributos',         'IMPOSTOS',        'despesa_fixa',    true,  false, 61),
  ('manutencao',                'Manutenção',                                'MANUTENCAO',      'despesa_fixa',    true,  false, 70),
  ('marketing',                 'Marketing',                                 'MARKETING',       'despesa_fixa',    true,  false, 80),
  ('limpeza',                   'Limpeza e higiene',                         'LIMPEZA',         'despesa_fixa',    true,  false, 90),
  ('fin_tarifas_bancarias',     'Tarifas bancárias',                         'FINANCEIRO',      'financeiro',      true,  false, 100),
  ('fin_juros_multas',          'Juros e multas pagos',                      'FINANCEIRO',      'financeiro',      true,  false, 101),
  ('mercadoria_insumos',        'Mercadoria / insumos para estoque',         'MERCADORIA',      'mercadoria',      false, false, 110),
  ('investimento_equipamentos', 'Investimentos (equipamentos, obras)',       'INVESTIMENTO',    'investimento',    true,  false, 120),
  ('retirada_socios',           'Retirada de sócios',                        'DISTRIBUICAO',    'distribuicao',    true,  false, 130),
  ('outros',                    'Outros',                                    'OUTROS',          'outros',          true,  false, 140),
  -- Categorias para LER o histórico (texto antigo de contas_pagar.categoria).
  -- Não aparecem para conta nova. "exige_revisao" = o texto antigo é amplo
  -- demais para ser classificado sem olhar a conta.
  ('legado_cmo',                'Pessoal (lançamento antigo, sem detalhe)',  'LEGADO',          'pessoal',         false, false, 200),
  ('legado_custo_fixo',         'Custo fixo (lançamento antigo)',            'LEGADO',          'despesa_fixa',    false, true,  201),
  ('legado_custo_variavel',     'Custo variável (lançamento antigo)',        'LEGADO',          'custo_variavel',  false, true,  202),
  ('legado_impostos',           'Impostos (lançamento antigo)',              'LEGADO',          'outros',          false, true,  203),
  ('legado_cmv',                'Lançado como "CMV" (provável compra)',      'LEGADO',          'mercadoria',      false, true,  204),
  ('legado_inventarios',        'Inventários/quebras (lançamento antigo)',   'LEGADO',          'perda_estoque',   false, true,  205)
on conflict (codigo) do nothing;

create table if not exists public.fin_categorias_legado (
  codigo_legado    text primary key,
  categoria_codigo text not null references public.fin_categorias(codigo)
);
comment on table public.fin_categorias_legado is 'hefisto:f2.1 — mapa texto antigo de contas_pagar.categoria → fin_categorias (leitura)';

insert into public.fin_categorias_legado (codigo_legado, categoria_codigo) values
  ('cmo',            'legado_cmo'),
  ('cmv',            'legado_cmv'),
  ('custo_fixo',     'legado_custo_fixo'),
  ('custo_variavel', 'legado_custo_variavel'),
  ('impostos',       'legado_impostos'),
  ('inventarios',    'legado_inventarios'),
  ('frete',          'com_entregas'),
  ('limpeza',        'limpeza'),
  ('manutencao',     'manutencao'),
  ('marketing',      'marketing'),
  ('investimento',   'investimento_equipamentos'),
  ('retirada_socio', 'retirada_socios')
on conflict (codigo_legado) do nothing;

create table if not exists public.fin_centros_custo (
  codigo     text primary key check (codigo ~ '^[a-z0-9_]+$'),
  nome       text not null,
  ativo      boolean not null default true,
  ordem      integer not null default 100
);
comment on table public.fin_centros_custo is 'hefisto:f2.1 — centros de custo (global)';

insert into public.fin_centros_custo (codigo, nome, ordem) values
  ('cozinha', 'Cozinha', 10), ('bar', 'Bar', 20), ('salao', 'Salão', 30),
  ('administrativo', 'Administrativo', 40), ('delivery', 'Delivery', 50),
  ('eventos', 'Eventos', 60), ('geral', 'Geral', 70)
on conflict (codigo) do nothing;


/* ─────────────────────────────────────────────────────────────────────────
   3. CONTAS FINANCEIRAS (onde o dinheiro está: caixa, banco, carteira…)
   Saldo NÃO é guardado: saldo_inicial (informado) + entradas − saídas.
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.fin_contas_financeiras (
  id               uuid primary key default gen_random_uuid(),
  unidade_id       text not null references public.unidades(id),
  nome             text not null check (btrim(nome) <> ''),
  tipo             text not null check (tipo in ('caixa','banco','carteira_digital','adquirente','outro')),
  saldo_inicial    numeric(14,2) not null,
  saldo_inicial_em date not null,
  ativa            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  criado_por       uuid,
  atualizado_por   uuid,
  unique (unidade_id, nome)
);
comment on table public.fin_contas_financeiras is 'hefisto:f2.1 — contas financeiras (caixa, banco, carteira digital, adquirente)';


/* ─────────────────────────────────────────────────────────────────────────
   4. CONTAS A PAGAR — evolução aditiva da tabela existente
   - colunas novas NULAS e SEM default (linhas antigas ficam exatamente como
     estão; nada "aparece pago" ou "zerado" por padrão);
   - `valor` continua sendo o VALOR ORIGINAL da obrigação e nunca é
     substituído pelo valor pago;
   - status persistido: pendente | parcial | pago | cancelado
     ("vencido" é derivado da data na view);
   - CHECKs NOT VALID: só valem para linha nova ou alterada.
   ───────────────────────────────────────────────────────────────────────── */
alter table public.contas_pagar add column if not exists fornecedor_id         uuid references public.fornecedores(id);
alter table public.contas_pagar add column if not exists categoria_codigo      text references public.fin_categorias(codigo);
alter table public.contas_pagar add column if not exists centro_custo_codigo   text references public.fin_centros_custo(codigo);
alter table public.contas_pagar add column if not exists competencia           date;
alter table public.contas_pagar add column if not exists documento_numero      text;
alter table public.contas_pagar add column if not exists anexo_url             text;
alter table public.contas_pagar add column if not exists observacao            text;
alter table public.contas_pagar add column if not exists origem_tipo           text;
alter table public.contas_pagar add column if not exists origem_id             uuid;
alter table public.contas_pagar add column if not exists recorrencia_origem_id uuid references public.contas_pagar(id);
alter table public.contas_pagar add column if not exists grupo_parcelas_id     uuid;
alter table public.contas_pagar add column if not exists parcela_numero        integer;
alter table public.contas_pagar add column if not exists parcelas_total        integer;
alter table public.contas_pagar add column if not exists chave_idempotencia    text;
alter table public.contas_pagar add column if not exists cancelado_em          timestamptz;
alter table public.contas_pagar add column if not exists motivo_cancelamento   text;
alter table public.contas_pagar add column if not exists criado_por            uuid;
alter table public.contas_pagar add column if not exists atualizado_por        uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_status_f21') then
    alter table public.contas_pagar add constraint contas_pagar_status_f21
      check (status in ('pendente','parcial','pago','cancelado')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_valor_f21') then
    alter table public.contas_pagar add constraint contas_pagar_valor_f21
      check (valor > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_competencia_f21') then
    alter table public.contas_pagar add constraint contas_pagar_competencia_f21
      check (competencia is null or extract(day from competencia) = 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_origem_f21') then
    alter table public.contas_pagar add constraint contas_pagar_origem_f21
      check (origem_tipo is null or origem_tipo in ('MANUAL','COMPRA','FOLHA','RECORRENTE','MANUTENCAO','RH','IMPORTACAO')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_parcela_f21') then
    alter table public.contas_pagar add constraint contas_pagar_parcela_f21
      check ((parcela_numero is null and parcelas_total is null)
          or (parcela_numero between 1 and parcelas_total and parcelas_total between 1 and 120)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contas_pagar_cancelamento_f21') then
    alter table public.contas_pagar add constraint contas_pagar_cancelamento_f21
      check (status <> 'cancelado' or (cancelado_em is not null and coalesce(btrim(motivo_cancelamento), '') <> '')) not valid;
  end if;
end $$;

-- Idempotência (índices únicos parciais: só valem quando a chave existe)
create unique index if not exists contas_pagar_idem_f21
  on public.contas_pagar (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create unique index if not exists contas_pagar_recorrencia_f21
  on public.contas_pagar (recorrencia_origem_id, competencia)
  where recorrencia_origem_id is not null and competencia is not null;
create unique index if not exists contas_pagar_origem_f21
  on public.contas_pagar (unidade_id, origem_tipo, origem_id, coalesce(parcela_numero, 1))
  where origem_id is not null;
create index if not exists contas_pagar_unid_venc_f21 on public.contas_pagar (unidade_id, data_vencimento);
create index if not exists contas_pagar_unid_comp_f21 on public.contas_pagar (unidade_id, competencia);

create or replace trigger contas_pagar_auditoria_f21 before insert or update on public.contas_pagar
  for each row execute function public.fin_auditoria_trg();


/* ─────────────────────────────────────────────────────────────────────────
   5. PAGAMENTOS (saídas de caixa) — conta → N pagamentos
   valor_principal = quanto da obrigação foi quitado
   valor_total     = o que saiu do caixa = principal + juros + multa − desconto
   Saldo da conta  = contas_pagar.valor − Σ principal (não estornados)
   Estorno não apaga: marca estornado_em/por/motivo.
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.fin_pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null references public.unidades(id),
  conta_pagar_id      uuid not null references public.contas_pagar(id),
  pago_em             date not null,
  valor_principal     numeric(14,2) not null check (valor_principal > 0),
  juros               numeric(14,2) not null default 0 check (juros >= 0),
  multa               numeric(14,2) not null default 0 check (multa >= 0),
  desconto            numeric(14,2) not null default 0 check (desconto >= 0),
  valor_total         numeric(14,2) generated always as (valor_principal + juros + multa - desconto) stored,
  forma_pagamento     text check (forma_pagamento in ('dinheiro','pix','debito','credito','boleto','transferencia','voucher','outro')),
  conta_financeira_id uuid references public.fin_contas_financeiras(id),
  observacao          text,
  comprovante_url     text,
  chave_idempotencia  text,
  estornado_em        timestamptz,
  estornado_por       uuid,
  motivo_estorno      text,
  created_at          timestamptz not null default now(),
  criado_por          uuid,
  check (valor_principal + juros + multa - desconto >= 0),
  check (estornado_em is null or coalesce(btrim(motivo_estorno), '') <> '')
);
comment on table public.fin_pagamentos is 'hefisto:f2.1 — pagamentos de contas a pagar (saída de caixa)';
create unique index if not exists fin_pagamentos_idem on public.fin_pagamentos (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create index if not exists fin_pagamentos_conta on public.fin_pagamentos (conta_pagar_id);
create index if not exists fin_pagamentos_unid_data on public.fin_pagamentos (unidade_id, pago_em);


/* ─────────────────────────────────────────────────────────────────────────
   6. MEIOS DE PAGAMENTO E TAXAS (cadastro do dono; NADA é semeado)
   Usado para PREVER a taxa e a data de um recebível. Sem cadastro, a taxa
   prevista fica nula ("não informada"), nunca um percentual inventado.
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.fin_taxas_meio_pagamento (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            text not null references public.unidades(id),
  meio                  text not null check (meio in ('debito','credito','pix','voucher','delivery_marketplace','boleto','outro')),
  adquirente            text,
  bandeira              text,
  modalidade            text not null default 'a_vista' check (modalidade in ('a_vista','parcelado_loja','parcelado_emissor','pre_pago','nao_se_aplica')),
  parcelas_min          integer not null default 1 check (parcelas_min >= 1),
  parcelas_max          integer not null default 1,
  taxa_percentual       numeric(7,4) not null check (taxa_percentual >= 0 and taxa_percentual < 100),
  taxa_fixa             numeric(14,2) not null default 0 check (taxa_fixa >= 0),
  dias_para_recebimento integer not null check (dias_para_recebimento >= 0),
  vigente_desde         date not null,
  vigente_ate           date,
  ativa                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  criado_por            uuid,
  atualizado_por        uuid,
  check (parcelas_max >= parcelas_min),
  check (vigente_ate is null or vigente_ate >= vigente_desde)
);
comment on table public.fin_taxas_meio_pagamento is 'hefisto:f2.1 — taxas e prazos por meio/adquirente/bandeira/modalidade (cadastro do dono)';
create index if not exists fin_taxas_busca on public.fin_taxas_meio_pagamento (unidade_id, meio, adquirente, bandeira, modalidade);


/* ─────────────────────────────────────────────────────────────────────────
   7. CONTAS A RECEBER — conta → N recebimentos
   valor_bruto = valor da venda/parcela (é a RECEITA; nunca o líquido)
   valor_taxa_previsto nulo = taxa não informada → líquido previsto nulo
   data_venda = competência da receita · data_prevista = caixa previsto
   status persistido: previsto | parcial | recebido | cancelado
   ("atrasado" é derivado na view)
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.fin_contas_receber (
  id                       uuid primary key default gen_random_uuid(),
  unidade_id               text not null references public.unidades(id),
  origem_tipo              text not null check (origem_tipo in ('VENDA','MANUAL','IMPORTACAO','MARKETPLACE','OUTRO')),
  origem_id                uuid,
  venda_id                 uuid references public.vendas(id),
  descricao                text not null check (btrim(descricao) <> ''),
  meio                     text not null check (meio in ('dinheiro','pix','debito','credito','voucher','delivery_marketplace','boleto','transferencia','outro')),
  adquirente               text,
  bandeira                 text,
  modalidade               text not null default 'a_vista' check (modalidade in ('a_vista','parcelado_loja','parcelado_emissor','pre_pago','nao_se_aplica')),
  nsu                      text,
  autorizacao              text,
  parcela_numero           integer not null default 1,
  parcelas_total           integer not null default 1,
  data_venda               date not null,
  data_prevista            date not null,
  valor_bruto              numeric(14,2) not null check (valor_bruto > 0),
  taxa_percentual_prevista numeric(7,4) check (taxa_percentual_prevista >= 0 and taxa_percentual_prevista < 100),
  taxa_fixa_prevista       numeric(14,2) check (taxa_fixa_prevista >= 0),
  valor_taxa_previsto      numeric(14,2) check (valor_taxa_previsto >= 0),
  valor_liquido_previsto   numeric(14,2) generated always as (valor_bruto - valor_taxa_previsto) stored,
  taxa_regra_id            uuid references public.fin_taxas_meio_pagamento(id),
  conta_financeira_prevista_id uuid references public.fin_contas_financeiras(id),
  status                   text not null default 'previsto' check (status in ('previsto','parcial','recebido','cancelado')),
  chave_idempotencia       text,
  cancelado_em             timestamptz,
  motivo_cancelamento      text,
  observacao               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  criado_por               uuid,
  atualizado_por           uuid,
  check (parcela_numero between 1 and parcelas_total and parcelas_total between 1 and 120),
  check (valor_taxa_previsto is null or valor_taxa_previsto <= valor_bruto),
  check (data_prevista >= data_venda),
  check (status <> 'cancelado' or (cancelado_em is not null and coalesce(btrim(motivo_cancelamento), '') <> ''))
);
comment on table public.fin_contas_receber is 'hefisto:f2.1 — contas a receber (bruto, taxa, líquido, datas)';
create unique index if not exists fin_contas_receber_idem on public.fin_contas_receber (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create unique index if not exists fin_contas_receber_origem on public.fin_contas_receber (unidade_id, origem_tipo, origem_id, parcela_numero) where origem_id is not null;
create index if not exists fin_contas_receber_prevista on public.fin_contas_receber (unidade_id, data_prevista);
create index if not exists fin_contas_receber_venda on public.fin_contas_receber (unidade_id, data_venda);

create table if not exists public.fin_recebimentos (
  id                     uuid primary key default gen_random_uuid(),
  unidade_id             text not null references public.unidades(id),
  conta_receber_id       uuid not null references public.fin_contas_receber(id),
  recebido_em            date not null,
  valor_bruto_baixado    numeric(14,2) not null check (valor_bruto_baixado > 0),
  valor_liquido_recebido numeric(14,2) not null check (valor_liquido_recebido >= 0),
  valor_taxa_efetiva     numeric(14,2) generated always as (valor_bruto_baixado - valor_liquido_recebido) stored,
  conta_financeira_id    uuid references public.fin_contas_financeiras(id),
  conciliacao_referencia text,
  observacao             text,
  chave_idempotencia     text,
  estornado_em           timestamptz,
  estornado_por          uuid,
  motivo_estorno         text,
  created_at             timestamptz not null default now(),
  criado_por             uuid,
  check (valor_liquido_recebido <= valor_bruto_baixado),
  check (estornado_em is null or coalesce(btrim(motivo_estorno), '') <> '')
);
comment on table public.fin_recebimentos is 'hefisto:f2.1 — recebimentos (entrada de caixa, valor líquido creditado)';
create unique index if not exists fin_recebimentos_idem on public.fin_recebimentos (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create index if not exists fin_recebimentos_conta on public.fin_recebimentos (conta_receber_id);
create index if not exists fin_recebimentos_unid_data on public.fin_recebimentos (unidade_id, recebido_em);


/* ─────────────────────────────────────────────────────────────────────────
   8. COMPRAS — documento de entrada de mercadoria (COMPRA ≠ CMV)
   compra → itens → (F2.3) entrada no razão de estoque
   compra → (opcional) conta a pagar com origem_tipo='COMPRA'
   valor da compra = Σ itens + frete − desconto (derivado, na view)
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.compras (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id),
  fornecedor_id      uuid references public.fornecedores(id),
  numero_documento   text,
  data_compra        date not null,
  status             text not null default 'rascunho' check (status in ('rascunho','confirmada','cancelada')),
  valor_frete        numeric(14,2) not null default 0 check (valor_frete >= 0),
  valor_desconto     numeric(14,2) not null default 0 check (valor_desconto >= 0),
  conta_pagar_id     uuid references public.contas_pagar(id),
  observacao         text,
  chave_idempotencia text,
  confirmada_em      timestamptz,
  confirmada_por     uuid,
  cancelado_em       timestamptz,
  motivo_cancelamento text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  criado_por         uuid,
  atualizado_por     uuid,
  check (status <> 'cancelada' or (cancelado_em is not null and coalesce(btrim(motivo_cancelamento), '') <> ''))
);
comment on table public.compras is 'hefisto:f2.1 — compras de mercadoria/insumo (documento de entrada; não é CMV)';
create unique index if not exists compras_idem on public.compras (unidade_id, chave_idempotencia) where chave_idempotencia is not null;
create unique index if not exists compras_documento on public.compras (unidade_id, fornecedor_id, numero_documento)
  where fornecedor_id is not null and numero_documento is not null and status <> 'cancelada';
create index if not exists compras_unid_data on public.compras (unidade_id, data_compra);

create table if not exists public.compras_itens (
  id                     uuid primary key default gen_random_uuid(),
  unidade_id             text not null references public.unidades(id),
  compra_id              uuid not null references public.compras(id),
  insumo_id              uuid not null references public.insumos(id),
  estoque_id             uuid references public.estoques(id),
  descricao_snapshot     text,
  quantidade_embalagens  numeric(14,3) not null check (quantidade_embalagens > 0),
  conteudo_por_embalagem numeric(14,3) not null check (conteudo_por_embalagem > 0),
  unidade_base           text not null check (unidade_base in ('g','ml','un')),
  quantidade_base        numeric(18,3) generated always as (quantidade_embalagens * conteudo_por_embalagem) stored,
  valor_total            numeric(14,2) not null check (valor_total >= 0),
  custo_unitario_base    numeric(18,6) generated always as (round(valor_total / (quantidade_embalagens * conteudo_por_embalagem), 6)) stored,
  lote                   text,
  validade               date,
  movimento_estoque_id   uuid,   -- ligação com o razão de estoque (F2.3)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  criado_por             uuid,
  atualizado_por         uuid
);
comment on table public.compras_itens is 'hefisto:f2.1 — itens da compra, em unidade base (g/ml/un)';
create index if not exists compras_itens_compra on public.compras_itens (compra_id);
create index if not exists compras_itens_insumo on public.compras_itens (unidade_id, insumo_id);


/* ─────────────────────────────────────────────────────────────────────────
   9. CUSTO MÉDIO VIGENTE POR INSUMO (escrito só pela confirmação de compra
      na F2.3, via estoque_custo_medio_novo). Nenhuma linha é criada agora.
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.estoque_custos (
  unidade_id        text not null references public.unidades(id),
  insumo_id         uuid not null references public.insumos(id),
  custo_medio_base  numeric(18,6) not null check (custo_medio_base >= 0),
  saldo_referencia  numeric(18,3),
  atualizado_em     timestamptz not null default now(),
  origem_tipo       text not null check (origem_tipo in ('COMPRA','CONTAGEM','AJUSTE')),
  origem_id         uuid,
  primary key (unidade_id, insumo_id)
);
comment on table public.estoque_custos is 'hefisto:f2.1 — custo médio ponderado vigente por insumo (unidade base)';


/* ─────────────────────────────────────────────────────────────────────────
   10. INVENTÁRIO (contagem física) — base do CMV real
   CMV REAL do período = estoque inicial + compras − estoque final
   Contagem FECHADA é imutável; fechar exige custo em todos os itens.
   (Não confundir com inventario_itens, que é patrimônio/utensílios.)
   ───────────────────────────────────────────────────────────────────────── */
create table if not exists public.estoque_contagens (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      text not null references public.unidades(id),
  tipo            text not null check (tipo in ('inicial','final','intermediaria','ajuste')),
  data_referencia date not null,
  estoque_id      uuid references public.estoques(id),   -- nulo = todos os estoques da unidade
  status          text not null default 'aberta' check (status in ('aberta','fechada','cancelada')),
  fechada_em      timestamptz,
  fechada_por     uuid,
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  criado_por      uuid,
  atualizado_por  uuid,
  check (status <> 'fechada' or fechada_em is not null)
);
comment on table public.estoque_contagens is 'hefisto:f2.1 — contagens de estoque (inicial, final, intermediária, ajuste)';
create unique index if not exists estoque_contagens_fechada_unica
  on public.estoque_contagens (unidade_id, coalesce(estoque_id, '00000000-0000-0000-0000-000000000000'::uuid), data_referencia, tipo)
  where status = 'fechada';

create table if not exists public.estoque_contagens_itens (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null references public.unidades(id),
  contagem_id        uuid not null references public.estoque_contagens(id),
  insumo_id          uuid not null references public.insumos(id),
  estoque_id         uuid references public.estoques(id),
  quantidade_contada numeric(18,3) not null check (quantidade_contada >= 0),
  unidade_base       text not null check (unidade_base in ('g','ml','un')),
  quantidade_sistema numeric(18,3),
  custo_unitario     numeric(18,6) check (custo_unitario >= 0),
  valor_total        numeric(14,2) generated always as (round(quantidade_contada * custo_unitario, 2)) stored,
  diferenca          numeric(18,3) generated always as (quantidade_contada - quantidade_sistema) stored,
  observacao         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  criado_por         uuid,
  atualizado_por     uuid
);
comment on table public.estoque_contagens_itens is 'hefisto:f2.1 — itens contados, com custo congelado no fechamento';
create unique index if not exists estoque_contagens_itens_unico
  on public.estoque_contagens_itens (contagem_id, insumo_id, coalesce(estoque_id, '00000000-0000-0000-0000-000000000000'::uuid));


/* ─────────────────────────────────────────────────────────────────────────
   11. TRIGGERS DE INTEGRIDADE
   ───────────────────────────────────────────────────────────────────────── */

-- Auditoria (criado_por / atualizado_por / updated_at)
do $$
declare t text;
begin
  foreach t in array array['fin_contas_financeiras','fin_taxas_meio_pagamento','fin_contas_receber',
                           'compras','compras_itens','estoque_contagens','estoque_contagens_itens'] loop
    execute format('create or replace trigger %I before insert or update on public.%I for each row execute function public.fin_auditoria_trg()',
                   t || '_auditoria_f21', t);
  end loop;
end $$;

-- Pagamentos/recebimentos: só o estorno pode mudar depois de gravado; e a
-- unidade é sempre a da conta.
create or replace function public.fin_movimento_imutavel_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Pagamento/recebimento não pode ser apagado: use o estorno.';
  end if;
  if old.estornado_em is not null then
    raise exception 'Este registro já foi estornado e não pode mudar.';
  end if;
  -- colunas geradas (valor_total / valor_taxa_efetiva) ficam fora: num trigger
  -- BEFORE elas ainda não foram calculadas em NEW.
  if (to_jsonb(new) - array['estornado_em','estornado_por','motivo_estorno','valor_total','valor_taxa_efetiva'])
     is distinct from (to_jsonb(old) - array['estornado_em','estornado_por','motivo_estorno','valor_total','valor_taxa_efetiva']) then
    raise exception 'Pagamento/recebimento é imutável; só o estorno é permitido.';
  end if;
  return new;
end $$;

create or replace trigger fin_pagamentos_imutavel_f21 before insert or update or delete on public.fin_pagamentos
  for each row execute function public.fin_movimento_imutavel_trg();
create or replace trigger fin_recebimentos_imutavel_f21 before insert or update or delete on public.fin_recebimentos
  for each row execute function public.fin_movimento_imutavel_trg();

-- Itens herdam a unidade do cabeçalho e não mudam depois de confirmado/fechado.
create or replace function public.fin_item_cabecalho_trg()
returns trigger language plpgsql set search_path = public as $$
declare
  v_unidade text;
  v_status  text;
  v_cab     uuid;
begin
  if tg_table_name = 'compras_itens' then
    v_cab := case when tg_op = 'DELETE' then old.compra_id else new.compra_id end;
    select unidade_id, status into v_unidade, v_status from public.compras where id = v_cab;
    if v_status in ('confirmada','cancelada') then
      raise exception 'Compra % não aceita alteração de itens.', v_status;
    end if;
  else
    v_cab := case when tg_op = 'DELETE' then old.contagem_id else new.contagem_id end;
    select unidade_id, status into v_unidade, v_status from public.estoque_contagens where id = v_cab;
    if v_status in ('fechada','cancelada') then
      raise exception 'Contagem % não aceita alteração de itens.', v_status;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.unidade_id is distinct from v_unidade then
    raise exception 'O item precisa ser da mesma unidade do documento.';
  end if;
  return new;
end $$;

create or replace trigger compras_itens_cabecalho_f21 before insert or update or delete on public.compras_itens
  for each row execute function public.fin_item_cabecalho_trg();
create or replace trigger estoque_contagens_itens_cabecalho_f21 before insert or update or delete on public.estoque_contagens_itens
  for each row execute function public.fin_item_cabecalho_trg();

-- Contagem: fechada/cancelada é imutável; fechar exige custo em todos os itens.
create or replace function public.estoque_contagem_status_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('fechada','cancelada') then
    raise exception 'Contagem % não pode ser alterada.', old.status;
  end if;
  if new.status = 'fechada' then
    if not exists (select 1 from public.estoque_contagens_itens where contagem_id = new.id) then
      raise exception 'Contagem sem itens não pode ser fechada.';
    end if;
    if exists (select 1 from public.estoque_contagens_itens where contagem_id = new.id and custo_unitario is null) then
      raise exception 'Há itens sem custo unitário: a contagem não pode ser fechada (o valor do estoque ficaria incompleto).';
    end if;
    new.fechada_em := coalesce(new.fechada_em, now());
    new.fechada_por := coalesce(new.fechada_por, auth.uid());
  end if;
  return new;
end $$;

create or replace trigger estoque_contagens_status_f21 before update on public.estoque_contagens
  for each row execute function public.estoque_contagem_status_trg();

-- Compra: confirmada/cancelada não volta atrás nem muda valores.
create or replace function public.compras_status_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'cancelada' then
    raise exception 'Compra cancelada não pode ser alterada.';
  end if;
  if old.status = 'confirmada' and new.status <> 'cancelada'
     and (to_jsonb(new) - array['updated_at','atualizado_por','conta_pagar_id','observacao'])
         is distinct from (to_jsonb(old) - array['updated_at','atualizado_por','conta_pagar_id','observacao']) then
    raise exception 'Compra confirmada não pode ser alterada (só cancelada, com motivo).';
  end if;
  if new.status = 'confirmada' and old.status <> 'confirmada' then
    if not exists (select 1 from public.compras_itens where compra_id = new.id) then
      raise exception 'Compra sem itens não pode ser confirmada.';
    end if;
    new.confirmada_em := coalesce(new.confirmada_em, now());
    new.confirmada_por := coalesce(new.confirmada_por, auth.uid());
  end if;
  return new;
end $$;

create or replace trigger compras_status_f21 before update on public.compras
  for each row execute function public.compras_status_trg();


/* ─────────────────────────────────────────────────────────────────────────
   12. RPCs (SECURITY DEFINER com checagem de unidade; a tabela de
       pagamentos/recebimentos não aceita escrita direta do app)
   Erros são exceções com mensagem em português (o app mostra a mensagem).
   ───────────────────────────────────────────────────────────────────────── */

-- Recalcula o status persistido de uma conta a pagar a partir dos pagamentos.
create or replace function public.fin_conta_pagar_recalcular(p_conta_pagar_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_conta public.contas_pagar%rowtype;
  v_pago  numeric;
  v_ult   date;
  v_status text;
begin
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id;
  if v_conta.status = 'cancelado' then return v_conta.status; end if;
  select coalesce(sum(valor_principal), 0), max(pago_em) into v_pago, v_ult
    from public.fin_pagamentos where conta_pagar_id = p_conta_pagar_id and estornado_em is null;
  v_status := case when v_pago >= v_conta.valor - 0.005 then 'pago'
                   when v_pago > 0 then 'parcial'
                   else 'pendente' end;
  update public.contas_pagar
     set status = v_status,
         data_pagamento = case when v_status = 'pago' then v_ult else null end
   where id = p_conta_pagar_id;
  return v_status;
end $$;

create or replace function public.fin_registrar_pagamento(
  p_conta_pagar_id      uuid,
  p_pago_em             date,
  p_valor_principal     numeric,
  p_juros               numeric default 0,
  p_multa               numeric default 0,
  p_desconto            numeric default 0,
  p_forma_pagamento     text default null,
  p_conta_financeira_id uuid default null,
  p_observacao          text default null,
  p_chave_idempotencia  text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta    public.contas_pagar%rowtype;
  v_existente public.fin_pagamentos%rowtype;
  v_qtd      integer;
  v_pago     numeric;
  v_saldo    numeric;
  v_id       uuid;
  v_status   text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;

  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_pagamentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('pagamento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;

  if v_conta.status = 'cancelado' then raise exception 'Conta cancelada não recebe pagamento.'; end if;
  select count(*), coalesce(sum(valor_principal), 0) into v_qtd, v_pago
    from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null;
  if v_qtd = 0 and lower(v_conta.status) in ('pago','paga') then
    raise exception 'Conta já consta como paga (registro anterior à F2.1).';
  end if;
  if p_pago_em is null then raise exception 'Informe a data real do pagamento.'; end if;
  if p_pago_em > public.fin_hoje() then raise exception 'A data do pagamento não pode ser futura.'; end if;
  if coalesce(p_valor_principal, 0) <= 0 then raise exception 'O valor pago precisa ser maior que zero.'; end if;
  if coalesce(p_juros,0) < 0 or coalesce(p_multa,0) < 0 or coalesce(p_desconto,0) < 0 then
    raise exception 'Juros, multa e desconto não podem ser negativos.';
  end if;
  v_saldo := v_conta.valor - v_pago;
  if p_valor_principal > v_saldo + 0.005 then
    raise exception 'Valor maior que o saldo da conta (saldo: %).', round(v_saldo, 2);
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_pagamentos (unidade_id, conta_pagar_id, pago_em, valor_principal, juros, multa, desconto,
                                     forma_pagamento, conta_financeira_id, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_pago_em, p_valor_principal, coalesce(p_juros,0), coalesce(p_multa,0),
          coalesce(p_desconto,0), p_forma_pagamento, p_conta_financeira_id, p_observacao,
          nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;

  v_status := public.fin_conta_pagar_recalcular(v_conta.id);
  return jsonb_build_object('pagamento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo', round(v_saldo - p_valor_principal, 2));
end $$;

create or replace function public.fin_estornar_pagamento(p_pagamento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pag public.fin_pagamentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_pag from public.fin_pagamentos where id = p_pagamento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_pag.unidade_id) then
    raise exception 'Pagamento não encontrado nesta unidade.';
  end if;
  if v_pag.estornado_em is not null then raise exception 'Pagamento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.contas_pagar where id = v_pag.conta_pagar_id for update;
  update public.fin_pagamentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_pagamento_id;
  v_status := public.fin_conta_pagar_recalcular(v_pag.conta_pagar_id);
  return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', v_status);
end $$;

create or replace function public.fin_cancelar_conta_pagar(p_conta_pagar_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_conta public.contas_pagar%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta já cancelada.'; end if;
  if lower(v_conta.status) in ('pago','paga','parcial')
     or exists (select 1 from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null) then
    raise exception 'Conta com pagamento não pode ser cancelada: estorne os pagamentos antes.';
  end if;
  update public.contas_pagar
     set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = btrim(p_motivo)
   where id = v_conta.id;
  return jsonb_build_object('conta_pagar_id', v_conta.id, 'status', 'cancelado');
end $$;

-- Recebimentos
create or replace function public.fin_conta_receber_recalcular(p_conta_receber_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_conta public.fin_contas_receber%rowtype;
  v_baixado numeric;
  v_status text;
begin
  select * into v_conta from public.fin_contas_receber where id = p_conta_receber_id;
  if v_conta.status = 'cancelado' then return v_conta.status; end if;
  select coalesce(sum(valor_bruto_baixado), 0) into v_baixado
    from public.fin_recebimentos where conta_receber_id = p_conta_receber_id and estornado_em is null;
  v_status := case when v_baixado >= v_conta.valor_bruto - 0.005 then 'recebido'
                   when v_baixado > 0 then 'parcial' else 'previsto' end;
  update public.fin_contas_receber set status = v_status where id = p_conta_receber_id;
  return v_status;
end $$;

create or replace function public.fin_registrar_recebimento(
  p_conta_receber_id       uuid,
  p_recebido_em            date,
  p_valor_liquido_recebido numeric,
  p_valor_bruto_baixado    numeric default null,   -- nulo = baixa o saldo bruto inteiro
  p_conta_financeira_id    uuid default null,
  p_conciliacao_referencia text default null,
  p_observacao             text default null,
  p_chave_idempotencia     text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta public.fin_contas_receber%rowtype;
  v_existente public.fin_recebimentos%rowtype;
  v_baixado numeric;
  v_saldo numeric;
  v_bruto numeric;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.fin_contas_receber where id = p_conta_receber_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a receber não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_recebimentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('recebimento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta a receber cancelada.'; end if;
  if p_recebido_em is null then raise exception 'Informe a data real do recebimento.'; end if;
  if p_recebido_em > public.fin_hoje() then raise exception 'A data do recebimento não pode ser futura.'; end if;
  select coalesce(sum(valor_bruto_baixado), 0) into v_baixado
    from public.fin_recebimentos where conta_receber_id = v_conta.id and estornado_em is null;
  v_saldo := v_conta.valor_bruto - v_baixado;
  if v_saldo <= 0.005 then raise exception 'Conta a receber já está totalmente recebida.'; end if;
  v_bruto := coalesce(p_valor_bruto_baixado, v_saldo);
  if v_bruto <= 0 or v_bruto > v_saldo + 0.005 then
    raise exception 'Valor bruto baixado inválido (saldo bruto: %).', round(v_saldo, 2);
  end if;
  if p_valor_liquido_recebido is null or p_valor_liquido_recebido < 0 or p_valor_liquido_recebido > v_bruto then
    raise exception 'Valor líquido recebido inválido (precisa estar entre 0 e o bruto baixado).';
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_recebimentos (unidade_id, conta_receber_id, recebido_em, valor_bruto_baixado,
       valor_liquido_recebido, conta_financeira_id, conciliacao_referencia, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_recebido_em, v_bruto, p_valor_liquido_recebido, p_conta_financeira_id,
          p_conciliacao_referencia, p_observacao, nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;
  v_status := public.fin_conta_receber_recalcular(v_conta.id);
  return jsonb_build_object('recebimento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo_bruto', round(v_saldo - v_bruto, 2));
end $$;

create or replace function public.fin_estornar_recebimento(p_recebimento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec public.fin_recebimentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_rec from public.fin_recebimentos where id = p_recebimento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_rec.unidade_id) then
    raise exception 'Recebimento não encontrado nesta unidade.';
  end if;
  if v_rec.estornado_em is not null then raise exception 'Recebimento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.fin_contas_receber where id = v_rec.conta_receber_id for update;
  update public.fin_recebimentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_recebimento_id;
  v_status := public.fin_conta_receber_recalcular(v_rec.conta_receber_id);
  return jsonb_build_object('recebimento_id', p_recebimento_id, 'status', v_status);
end $$;


/* ─────────────────────────────────────────────────────────────────────────
   13. VIEWS DE LEITURA (security_invoker: respeitam o RLS de quem consulta)
   ───────────────────────────────────────────────────────────────────────── */

-- Contas a pagar com saldo e situação derivados. Para os registros anteriores
-- à F2.1 (sem linhas em fin_pagamentos):
--   status 'pago'/'paga' → considerado pago INTEGRALMENTE na data_pagamento
--     (pagamento_legado = true);
--   competência nula → inferida pelo mês do vencimento (competencia_inferida);
--   categoria nova nula → mapeada do texto antigo via fin_categorias_legado.
create or replace view public.vw_fin_contas_pagar with (security_invoker = true) as
with pg as (
  select conta_pagar_id,
         count(*) filter (where estornado_em is null)                      as qtd_pagamentos,
         coalesce(sum(valor_principal) filter (where estornado_em is null), 0) as principal_pago,
         coalesce(sum(valor_total)     filter (where estornado_em is null), 0) as saida_total,
         max(pago_em)                  filter (where estornado_em is null) as ultimo_pagamento
    from public.fin_pagamentos group by conta_pagar_id
), base as (
  select c.*,
         (pg.conta_pagar_id is null and lower(c.status) in ('pago','paga')) as pagamento_legado,
         case when pg.conta_pagar_id is not null then pg.principal_pago
              when lower(c.status) in ('pago','paga') then c.valor
              else 0 end as valor_pago_calc,
         case when pg.conta_pagar_id is not null then pg.saida_total
              when lower(c.status) in ('pago','paga') then c.valor
              else 0 end as saida_total_calc,
         coalesce(pg.ultimo_pagamento,
                  case when lower(c.status) in ('pago','paga') then c.data_pagamento end) as data_ultimo_pagamento
    from public.contas_pagar c
    left join pg on pg.conta_pagar_id = c.id
)
select b.id, b.unidade_id, b.descricao, b.fornecedor_id,
       b.valor                                               as valor_original,
       b.valor_pago_calc                                     as valor_pago,
       greatest(b.valor - b.valor_pago_calc, 0)              as saldo,
       b.saida_total_calc                                    as saida_caixa_total,
       b.data_vencimento,
       coalesce(b.competencia, date_trunc('month', b.data_vencimento)::date) as competencia_efetiva,
       (b.competencia is null)                               as competencia_inferida,
       coalesce(b.categoria_codigo, l.categoria_codigo)      as categoria_codigo,
       (b.categoria_codigo is null)                          as categoria_inferida,
       b.categoria                                           as categoria_texto_antigo,
       cat.natureza, cat.grupo, cat.exige_revisao,
       b.centro_custo_codigo, b.documento_numero, b.observacao,
       b.origem_tipo, b.origem_id, b.recorrente, b.recorrencia_origem_id,
       b.parcela_numero, b.parcelas_total, b.grupo_parcelas_id,
       b.status                                              as status_persistido,
       case when lower(b.status) in ('cancelado','cancelada')        then 'cancelado'
            when b.valor - b.valor_pago_calc <= 0.005                then 'pago'
            when b.valor_pago_calc > 0                               then 'parcial'
            when b.data_vencimento < public.fin_hoje()               then 'vencido'
            when lower(b.status) in ('pendente')                     then 'pendente'
            else 'desconhecido' end                          as situacao,
       (lower(b.status) not in ('cancelado','cancelada') and b.valor - b.valor_pago_calc > 0.005
          and b.data_vencimento < public.fin_hoje())         as vencida,
       b.data_ultimo_pagamento,
       b.pagamento_legado,
       b.created_at, b.updated_at, b.criado_por, b.atualizado_por
  from base b
  left join public.fin_categorias_legado l on l.codigo_legado = b.categoria
  left join public.fin_categorias cat on cat.codigo = coalesce(b.categoria_codigo, l.categoria_codigo);

create or replace view public.vw_fin_contas_receber with (security_invoker = true) as
with rc as (
  select conta_receber_id,
         coalesce(sum(valor_bruto_baixado)    filter (where estornado_em is null), 0) as bruto_baixado,
         coalesce(sum(valor_liquido_recebido) filter (where estornado_em is null), 0) as liquido_recebido,
         max(recebido_em) filter (where estornado_em is null) as ultimo_recebimento
    from public.fin_recebimentos group by conta_receber_id
)
select r.id, r.unidade_id, r.origem_tipo, r.origem_id, r.venda_id, r.descricao,
       r.meio, r.adquirente, r.bandeira, r.modalidade, r.parcela_numero, r.parcelas_total,
       r.data_venda, r.data_prevista,
       r.valor_bruto, r.valor_taxa_previsto, r.valor_liquido_previsto,
       (r.valor_taxa_previsto is null)                     as taxa_nao_informada,
       coalesce(rc.bruto_baixado, 0)                       as bruto_baixado,
       coalesce(rc.liquido_recebido, 0)                    as liquido_recebido,
       greatest(r.valor_bruto - coalesce(rc.bruto_baixado, 0), 0) as saldo_bruto,
       case when r.status = 'cancelado'                                        then 'cancelado'
            when r.valor_bruto - coalesce(rc.bruto_baixado, 0) <= 0.005        then 'recebido'
            when coalesce(rc.bruto_baixado, 0) > 0                             then 'parcial'
            when r.data_prevista < public.fin_hoje()                           then 'atrasado'
            else 'previsto' end                            as situacao,
       rc.ultimo_recebimento,
       r.status as status_persistido, r.created_at, r.criado_por
  from public.fin_contas_receber r
  left join rc on rc.conta_receber_id = r.id;

-- Fluxo de caixa: REALIZADO (data do dinheiro) e PREVISTO (vencimento /
-- previsão). Não é DRE: competência fica nas views acima.
-- Limitação conhecida: o extrato antigo (lancamentos) e as vendas do PDV
-- ainda não geram recebimentos; o realizado de entradas é PARCIAL até a F2.2.
create or replace view public.vw_fin_fluxo_caixa with (security_invoker = true) as
  select p.unidade_id, p.pago_em as data, 'realizado'::text as natureza, 'saida'::text as direcao,
         p.valor_total as valor, 'pagamento'::text as origem, p.id as referencia_id, p.conta_financeira_id,
         c.categoria_codigo
    from public.fin_pagamentos p
    join public.vw_fin_contas_pagar c on c.id = p.conta_pagar_id
   where p.estornado_em is null
  union all
  select c.unidade_id, c.data_ultimo_pagamento, 'realizado', 'saida', c.valor_original,
         'pagamento_legado', c.id, null, c.categoria_codigo
    from public.vw_fin_contas_pagar c
   where c.pagamento_legado and c.data_ultimo_pagamento is not null
  union all
  select r.unidade_id, r.recebido_em, 'realizado', 'entrada', r.valor_liquido_recebido,
         'recebimento', r.id, r.conta_financeira_id, null
    from public.fin_recebimentos r
   where r.estornado_em is null
  union all
  select c.unidade_id, c.data_vencimento, 'previsto', 'saida', c.saldo,
         'conta_pagar', c.id, null, c.categoria_codigo
    from public.vw_fin_contas_pagar c
   where c.situacao in ('pendente','parcial','vencido') and c.saldo > 0
  union all
  select r.unidade_id, r.data_prevista, 'previsto', 'entrada',
         -- líquido previsto proporcional ao saldo bruto; nulo se a taxa não foi informada
         case when r.valor_liquido_previsto is null then null
              else round(r.saldo_bruto * r.valor_liquido_previsto / r.valor_bruto, 2) end,
         'conta_receber', r.id, null, null
    from public.vw_fin_contas_receber r
   where r.situacao in ('previsto','parcial','atrasado') and r.saldo_bruto > 0;

-- Saldo das contas financeiras: saldo inicial informado + entradas − saídas
-- realizadas DEPOIS da data do saldo inicial, ligadas à conta.
create or replace view public.vw_fin_saldo_contas_financeiras with (security_invoker = true) as
select f.id, f.unidade_id, f.nome, f.tipo, f.saldo_inicial, f.saldo_inicial_em,
       f.saldo_inicial
         + coalesce((select sum(r.valor_liquido_recebido) from public.fin_recebimentos r
                      where r.conta_financeira_id = f.id and r.estornado_em is null
                        and r.recebido_em > f.saldo_inicial_em), 0)
         - coalesce((select sum(p.valor_total) from public.fin_pagamentos p
                      where p.conta_financeira_id = f.id and p.estornado_em is null
                        and p.pago_em > f.saldo_inicial_em), 0) as saldo_calculado
  from public.fin_contas_financeiras f;

-- Compras com valor derivado dos itens.
create or replace view public.vw_compras with (security_invoker = true) as
select c.*, coalesce(i.valor_itens, 0) as valor_itens, coalesce(i.qtd_itens, 0) as qtd_itens,
       coalesce(i.valor_itens, 0) + c.valor_frete - c.valor_desconto as valor_total
  from public.compras c
  left join (select compra_id, sum(valor_total) as valor_itens, count(*) as qtd_itens
               from public.compras_itens group by compra_id) i on i.compra_id = c.id;


/* ─────────────────────────────────────────────────────────────────────────
   14. SEGURANÇA DAS TABELAS NOVAS
   - anon: nenhum acesso;
   - authenticated: só a própria unidade (ou a rede, para quem vê a rede),
     mesma regra de auth_unidade_id()/pode_ver_todas() aplicada em 30/09;
   - sem DELETE para ninguém do app (cancelamento/estorno é por status);
   - pagamentos/recebimentos/custos: só leitura direta; escrita pelas RPCs.
   As policies de contas_pagar (tabela existente) NÃO são alteradas aqui:
   isso é da trilha de segurança (SEC-RH-2).
   ───────────────────────────────────────────────────────────────────────── */
do $$
declare
  t text;
  escrita text[] := array['fin_contas_financeiras','fin_taxas_meio_pagamento','fin_contas_receber',
                          'compras','compras_itens','estoque_contagens','estoque_contagens_itens'];
  leitura text[] := array['fin_pagamentos','fin_recebimentos','estoque_custos'];
begin
  foreach t in array escrita || leitura loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_unidade_f21') then
      execute format('create policy %I on public.%I for all to authenticated
                        using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
                        with check (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())',
                     t || '_unidade_f21', t);
    end if;
  end loop;
  foreach t in array escrita loop
    execute format('revoke delete, truncate on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
  foreach t in array leitura loop
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;

  foreach t in array array['fin_categorias','fin_categorias_legado','fin_centros_custo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_leitura_f21') then
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_leitura_f21', t);
    end if;
  end loop;

  foreach t in array array['vw_fin_contas_pagar','vw_fin_contas_receber','vw_fin_fluxo_caixa',
                           'vw_fin_saldo_contas_financeiras','vw_compras'] loop
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on function public.fin_registrar_pagamento(uuid,date,numeric,numeric,numeric,numeric,text,uuid,text,text) from public, anon;
revoke all on function public.fin_estornar_pagamento(uuid,text)            from public, anon;
revoke all on function public.fin_cancelar_conta_pagar(uuid,text)          from public, anon;
revoke all on function public.fin_registrar_recebimento(uuid,date,numeric,numeric,uuid,text,text,text) from public, anon;
revoke all on function public.fin_estornar_recebimento(uuid,text)          from public, anon;
revoke all on function public.fin_conta_pagar_recalcular(uuid)             from public, anon, authenticated;
revoke all on function public.fin_conta_receber_recalcular(uuid)           from public, anon, authenticated;
revoke all on function public.fin_pode_acessar_unidade(text)               from public, anon;
grant execute on function public.fin_registrar_pagamento(uuid,date,numeric,numeric,numeric,numeric,text,uuid,text,text) to authenticated;
grant execute on function public.fin_estornar_pagamento(uuid,text)         to authenticated;
grant execute on function public.fin_cancelar_conta_pagar(uuid,text)       to authenticated;
grant execute on function public.fin_registrar_recebimento(uuid,date,numeric,numeric,uuid,text,text,text) to authenticated;
grant execute on function public.fin_estornar_recebimento(uuid,text)       to authenticated;
grant execute on function public.fin_pode_acessar_unidade(text)            to authenticated;
grant execute on function public.estoque_custo_medio_novo(numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.fin_hoje()                                to authenticated;

commit;


/* ═══════════════════════════════════════════════════════════════════════════
   CONFERÊNCIA (só leitura — rodar depois)

   -- 1. Os 7 registros históricos continuam iguais (compare com o S10):
   select categoria, status, count(*), sum(valor)
     from public.contas_pagar group by 1, 2 order by 1, 2;

   -- 2. Como a camada nova lê esses registros:
   select categoria_texto_antigo, categoria_codigo, natureza, exige_revisao,
          situacao, pagamento_legado, competencia_efetiva, competencia_inferida,
          valor_original, valor_pago, saldo
     from public.vw_fin_contas_pagar order by data_vencimento;

   -- 3. Objetos criados:
   select c.relname, obj_description(c.oid, 'pg_class')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and obj_description(c.oid, 'pg_class') like 'hefisto:f2.1%';
   ═══════════════════════════════════════════════════════════════════════════ */
