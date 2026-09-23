/*
  HEFISTO — FASE 1B — MIGRAÇÃO 02 DE 04: RLS POR PERMISSÃO E TABELAS-FILHO

  PRÉ-REQUISITOS
    1. Migração 01 da Fase 1B aplicada.
    2. db/testes/simular_1b_02.sql executado e a matriz revisada: nenhum usuário
       ativo pode perder leitura ou escrita de que precisa para trabalhar.

  O QUE FAZ
    Até a Etapa 3, as tabelas comuns (fora do mapa sensível) aceitavam QUALQUER
    comando de qualquer usuário válido da unidade: um garçom apagava ficha
    técnica ou insumo. E tabelas sem unidade_id (itens de pedido, de ficha, de
    evento, registros de RH por funcionário) ficavam como estavam.

    Agora TODA tabela do schema public segue uma regra explícita, por comando:
      unidade  permissão do catálogo + unidade da própria linha
      pai      permissão do catálogo + unidade da tabela-pai (item → pedido → unidade)
      global   permissão do catálogo em alguma unidade do escopo (catálogos da empresa)
      negado   nenhuma policy: ninguém logado lê nem escreve

    O mapa vem do USO REAL no código (qual tela lê e qual escreve cada tabela),
    do mapa sensível da Etapa 3 e de decisões curadas com motivo; fica gravado
    em hefisto_privado.mapa_rls_v2. Tabela que existir no banco sem regra fica
    NEGADA (negar por padrão) e aparece no relatório.

    Linhas com unidade_id NULO: leitura para quem tem a permissão em alguma
    unidade; escrita só para quem tem escopo total. Antes, qualquer logado lia
    e alterava.

  O QUE NÃO FAZ
    Não toca no controle de acesso (usuarios_erp e afins), em unidades nem em
    config_pins, que já têm regra própria. Não separa colunas: biometria sai das
    tabelas comuns nas migrações 03 e 04.

  ROLLBACK
    db/1b/rollback_02_rls_permissao_e_tabelas_filho.sql (restaura as policies e
    o RLS fotografados antes desta migração).
*/

begin;

create temp table if not exists hefisto_relatorio (
  ordem serial, etapa text, verificacao text, situacao text, detalhe text
) on commit preserve rows;
truncate hefisto_relatorio;

/* 1. PRÉ-CHECK */
do $$
begin
  if to_regclass('hefisto_privado.snapshot_seguranca') is null
     or not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-01' and tipo = 'marcador') then
    raise exception '1B-02 abortada: a migração 01 da Fase 1B não foi aplicada.';
  end if;
  if to_regprocedure('public.hefisto_unidades_com_permissao(text[])') is null
     or to_regprocedure('public.hefisto_escopo_unidades()') is null then
    raise exception '1B-02 abortada: funções de escopo ausentes.';
  end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('02 pré-check', 'migração 01 aplicada', 'OK', '');
end $$;

/* 2. MAPA */
create table if not exists hefisto_privado.mapa_rls_v2 (
  tabela text not null,
  comando text not null check (comando in ('select', 'insert', 'update', 'delete', '*')),
  permissoes text[] not null,
  escopo text not null check (escopo in ('unidade', 'pai', 'global', 'negado')),
  pai text,
  fk text,
  origem text not null,
  motivo text,
  primary key (tabela, comando)
);
create table if not exists hefisto_privado.tabelas_do_app (tabela text primary key);
create table if not exists hefisto_privado.rls_aplicado (
  tabela text primary key,
  escopo text not null,
  pai text,
  fk text,
  comandos text[] not null,
  origem text not null,
  aplicado_em timestamptz not null default now()
);
truncate hefisto_privado.mapa_rls_v2;
truncate hefisto_privado.tabelas_do_app;
truncate hefisto_privado.rls_aplicado;

/* <<MAPA_INICIO>> — gerado por scripts/seguranca/gerar-mapa-rls.mjs; não edite à mão */
insert into hefisto_privado.mapa_rls_v2 (tabela, comando, permissoes, escopo, pai, fk, origem, motivo) values
  ('acessos_modulo', '*', array[]::text[], 'negado', null, null, 'curado', 'acessos legados com senha em texto puro: só a migração do administrador geral, pela API'),
  ('advertencias', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('advertencias', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('advertencias', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('avaliacoes_nps', 'select', array['clientes.nps.view','clientes.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('avaliacoes_nps', 'insert', array['clientes.nps.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('avaliacoes_nps', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('avisos', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('avisos', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('avisos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('campanhas', 'select', array['clientes.campaigns.view','clientes.overview.view','dashboard.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('campanhas', 'insert', array['clientes.campaigns.create','clientes.campaigns.edit','clientes.overview.create','clientes.overview.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('campanhas', 'update', array['clientes.campaigns.create','clientes.campaigns.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('campanhas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('candidatos', 'select', array['rh.recruiting.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('candidatos', 'insert', array['rh.recruiting.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('candidatos', 'update', array['rh.recruiting.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('candidatos', 'delete', array['rh.recruiting.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('cardapio', 'select', array['cardapio.engineering.view','financeiro.cashflow.view','gestao.network.view','rh.overview.view','tarefas.notifications.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('cardapio', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('cervejas', 'select', array['cardapio.beers.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('cervejas', 'insert', array['cardapio.beers.create','cardapio.beers.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('cervejas', 'update', array['cardapio.beers.create','cardapio.beers.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('cervejas', 'delete', array['cardapio.beers.delete','cardapio.beers.edit','configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_execucoes', 'select', array['checklist.execution.view','checklist.templates.view','dashboard.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_execucoes', 'insert', array['checklist.execution.confirm','checklist.execution.create','checklist.execution.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_execucoes', 'delete', array['configuracoes.store.edit','configuracoes.stores.delete','configuracoes.stores.edit','configuracoes.units.delete','configuracoes.units.edit','gestao.units.delete','gestao.units.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_templates', 'select', array['checklist.execution.view','checklist.templates.view','configuracoes.store.view','configuracoes.stores.view','configuracoes.units.view','dashboard.overview.view','gestao.units.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_templates', 'insert', array['checklist.templates.create','checklist.templates.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_templates', 'update', array['checklist.templates.create','checklist.templates.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('checklists_templates', 'delete', array['configuracoes.store.edit','configuracoes.stores.delete','configuracoes.stores.edit','configuracoes.units.delete','configuracoes.units.edit','gestao.units.delete','gestao.units.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('clientes', 'select', array['clientes.crm.view','clientes.overview.view','vendas.delivery.view']::text[], 'unidade', null, null, 'curado-1b', ''),
  ('clientes', 'insert', array['clientes.crm.create','clientes.overview.create','vendas.delivery.create']::text[], 'unidade', null, null, 'curado-1b', ''),
  ('clientes', 'update', array['clientes.crm.edit','clientes.overview.edit','vendas.delivery.edit']::text[], 'unidade', null, null, 'curado-1b', ''),
  ('colaboradores', 'select', array['financeiro.dre.view','financeiro.pizza_lucro.view','ponto.clock.view','ponto.kiosk.create','ponto.kiosk.view','rh.employees.view','rh.extras.view','rh.overview.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('colaboradores', 'insert', array['rh.employees.create','rh.extras.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('colaboradores', 'update', array['rh.employees.edit','rh.extras.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('colaboradores', 'delete', array['rh.employees.delete','rh.extras.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('comandas', 'select', array['salao.tables.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('comandas', 'insert', array['vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('comandas', 'update', array['vendas.pdv.cancel','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('comandas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('config_sistema', 'select', array['bar.assembly.view','bar.recipes.view','configuracoes.store.view','configuracoes.units.view','cozinha.assembly.view','cozinha.recipes.view','dashboard.overview.view','estoque.inventory.view','estoque.labels.view','estoque.losses.view','estoque.outputs.view','estoque.overview.view','estoque.transfers.view','fichas.assembly.view','fichas.recipes.view','financeiro.pizza_lucro.view','ponto.clock.view','rh.extras.view','rh.overview.view','rh.recruiting.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('config_sistema', 'insert', array['bar.assembly.create','bar.assembly.edit','bar.recipes.create','bar.recipes.edit','configuracoes.store.edit','configuracoes.store.settings','configuracoes.units.create','configuracoes.units.edit','configuracoes.units.settings','cozinha.assembly.create','cozinha.assembly.edit','cozinha.recipes.create','cozinha.recipes.edit','dashboard.overview.view','estoque.inventory.close_inventory','estoque.inventory.create','estoque.inventory.edit','estoque.inventory.inventory','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.assembly.create','fichas.assembly.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','financeiro.pizza_lucro.view','ponto.clock.create','ponto.clock.edit','rh.extras.create','rh.extras.edit','rh.overview.view','rh.recruiting.create','rh.recruiting.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('config_sistema', 'update', array['bar.assembly.create','bar.assembly.edit','bar.recipes.create','bar.recipes.edit','configuracoes.store.edit','configuracoes.store.settings','configuracoes.units.create','configuracoes.units.edit','configuracoes.units.settings','cozinha.assembly.create','cozinha.assembly.edit','cozinha.recipes.create','cozinha.recipes.edit','dashboard.overview.view','estoque.inventory.close_inventory','estoque.inventory.create','estoque.inventory.edit','estoque.inventory.inventory','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.outputs.adjust_stock','estoque.outputs.cancel','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.transfers.cancel','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.assembly.create','fichas.assembly.edit','fichas.recipes.create','fichas.recipes.edit','financeiro.pizza_lucro.view','ponto.clock.create','ponto.clock.edit','rh.extras.create','rh.extras.edit','rh.overview.view','rh.recruiting.create','rh.recruiting.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('config_sistema', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('contas_pagar', 'select', array['compras.orders.view','dashboard.overview.view_values','financeiro.cashflow.view','financeiro.dre.view','financeiro.pizza_lucro.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('contas_pagar', 'insert', array['compras.invoices.create','compras.orders.create','estoque.entries.create','estoque.labels.edit','estoque.losses.record_loss','financeiro.cashflow.create','rh.admin_expenses.create','rh.payroll.create','salao.tables.edit','vendas.pdv.confirm']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('contas_pagar', 'update', array['financeiro.cashflow.approve','financeiro.cashflow.edit','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('contas_pagar', 'delete', array['financeiro.cashflow.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('controle_gas', 'select', array['cozinha.cleaning.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_gas', 'insert', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_gas', 'update', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_gas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','cozinha.cleaning.delete','cozinha.cleaning.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_limpeza', 'select', array['bar.sector.view','cardapio.menu.view','cozinha.cleaning.view','estoque.losses.view','estoque.operation.view','estoque.outputs.view','estoque.overview.view','estoque.transfers.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_limpeza', 'insert', array['bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.menu.import','cozinha.cleaning.create','cozinha.cleaning.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_limpeza', 'update', array['bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cozinha.cleaning.create','cozinha.cleaning.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.cancel','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.transfers.cancel','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_limpeza', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','cozinha.cleaning.delete','cozinha.cleaning.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_manutencoes', 'select', array['cozinha.cleaning.view','dashboard.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_manutencoes', 'insert', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_manutencoes', 'update', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_manutencoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','cozinha.cleaning.delete','cozinha.cleaning.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_oleo', 'select', array['cozinha.cleaning.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_oleo', 'insert', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_oleo', 'update', array['cozinha.cleaning.create','cozinha.cleaning.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('controle_oleo', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','cozinha.cleaning.delete','cozinha.cleaning.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('cupons', 'select', array['clientes.coupons.view','salao.sector.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('cupons', 'insert', array['clientes.coupons.create','clientes.coupons.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('cupons', 'update', array['clientes.coupons.create','clientes.coupons.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('cupons', 'delete', array['clientes.coupons.delete','clientes.coupons.edit','configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('cursos', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('cursos', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('cursos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('delivery_configs', 'select', array['vendas.delivery.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('delivery_configs', 'insert', array['vendas.delivery.confirm','vendas.delivery.create','vendas.delivery.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('delivery_configs', 'update', array['vendas.delivery.cancel','vendas.delivery.confirm','vendas.delivery.create','vendas.delivery.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('delivery_configs', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('documentos_rh', 'select', array['rh.employees.view','rh.overview.view']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('documentos_rh', 'insert', array['rh.employees.create','rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('documentos_rh', 'update', array['rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('documentos_rh', 'delete', array['rh.employees.delete','rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('empresa_documentos', 'select', array['gestao.documents.view']::text[], 'global', null, null, 'codigo', 'documentos da empresa (contrato social, alvarás): não pertencem a uma unidade'),
  ('empresa_documentos', 'insert', array['gestao.documents.create','gestao.documents.edit']::text[], 'global', null, null, 'codigo', 'documentos da empresa (contrato social, alvarás): não pertencem a uma unidade'),
  ('empresa_documentos', 'delete', array['gestao.documents.delete','gestao.documents.edit']::text[], 'global', null, null, 'codigo', 'documentos da empresa (contrato social, alvarás): não pertencem a uma unidade'),
  ('equipe_unidade', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('equipe_unidade', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('escalas_dia', 'select', array['dashboard.overview.view','ponto.clock.view','rh.employee_portal.view','rh.employees.view','rh.extras.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('escalas_dia', 'insert', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('escalas_dia', 'update', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('escalas_dia', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_atual', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_atual', 'insert', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_atual', 'update', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_atual', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_itens', 'select', array['*escopo*']::text[], 'pai', 'estoques', 'estoque_id', 'codigo', ''),
  ('estoque_itens', 'insert', array['bar.production.confirm','bar.production.create','bar.production.edit','bar.products.create','bar.products.edit','bar.recipes.create','bar.recipes.edit','bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.menu.import','cardapio.packaging.create','cardapio.packaging.edit','cozinha.expiry.create','cozinha.expiry.edit','cozinha.production.confirm','cozinha.production.create','cozinha.production.edit','cozinha.production_all.confirm','cozinha.production_all.create','cozinha.production_all.edit','cozinha.recipes.create','cozinha.recipes.edit','estoque.labels.create','estoque.labels.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.products.create','estoque.products.edit','estoque.products.import','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','gestao.ai.create','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'pai', 'estoques', 'estoque_id', 'codigo', ''),
  ('estoque_itens', 'update', array['*escopo*']::text[], 'pai', 'estoques', 'estoque_id', 'codigo', ''),
  ('estoque_itens', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'pai', 'estoques', 'estoque_id', 'codigo', ''),
  ('estoque_movimentacoes', 'select', array['cardapio.beers.view','relatorios.audit.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentacoes', 'insert', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentacoes', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentacoes_multi', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentacoes_multi', 'update', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentacoes_multi', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentos', 'insert', array['gestao.ai.create']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoque_movimentos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoques', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoques', 'insert', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoques', 'update', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('estoques', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('etiquetas', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('etiquetas', 'insert', array['estoque.labels.create','estoque.labels.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('etiquetas', 'update', array['cozinha.expiry.create','cozinha.expiry.edit','estoque.labels.create','estoque.labels.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('etiquetas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','estoque.labels.delete','estoque.labels.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('evento_compras', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_compras', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_compras', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_compras', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_custos_fixos', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_custos_fixos', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_custos_fixos', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_custos_fixos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_drinks', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_drinks', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_drinks', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_drinks', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_ingredientes', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_ingredientes', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_ingredientes', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_ingredientes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_pratos', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_pratos', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_pratos', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_pratos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_preparos', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_preparos', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_preparos', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_preparos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_reservas', 'select', array['eventos.events.view']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_reservas', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_reservas', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('evento_reservas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','gestao.units.delete']::text[], 'pai', 'eventos', 'evento_id', 'codigo', ''),
  ('eventos', 'select', array['eventos.events.view','eventos.operation.view','rh.overview.view','tarefas.notifications.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('eventos', 'insert', array['eventos.events.approve','eventos.events.create','eventos.events.edit','eventos.operation.confirm','eventos.operation.create','eventos.operation.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('eventos', 'update', array['eventos.events.approve','eventos.events.cancel','eventos.events.create','eventos.events.edit','eventos.operation.cancel','eventos.operation.confirm','eventos.operation.create','eventos.operation.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('eventos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.events.cancel','eventos.events.delete','eventos.events.edit','eventos.operation.cancel','eventos.operation.delete','eventos.operation.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('extras_cadastros', 'select', array['rh.extras.view','rh.recruiting.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('extras_cadastros', 'insert', array['rh.extras.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('extras_cadastros', 'update', array['rh.extras.edit','rh.recruiting.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('extras_cadastros', 'delete', array['rh.extras.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('ficha_itens', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_alergenicos', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_alergenicos', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_alergenicos', 'delete', array['bar.recipes.delete','bar.recipes.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.recipes.delete','cozinha.recipes.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_armazenamento', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_armazenamento', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_armazenamento', 'update', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_armazenamento', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_custo_historico', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_custo_historico', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_custo_historico', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_equipamentos', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_equipamentos', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_equipamentos', 'delete', array['bar.recipes.delete','bar.recipes.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.recipes.delete','cozinha.recipes.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_etapas', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_etapas', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_etapas', 'delete', array['bar.recipes.delete','bar.recipes.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.recipes.delete','cozinha.recipes.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_ingredientes', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_ingredientes', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_ingredientes', 'delete', array['bar.products.delete','bar.products.edit','bar.recipes.delete','bar.recipes.edit','configuracoes.store.edit','configuracoes.stores.delete','configuracoes.stores.edit','configuracoes.units.delete','configuracoes.units.edit','cozinha.recipes.delete','cozinha.recipes.edit','estoque.products.delete','estoque.products.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete','gestao.units.edit']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_lote_auditoria', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'unidade', null, null, 'codigo', ''),
  ('fichas_montagem_passos', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_montagem_passos', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_montagem_passos', 'delete', array['bar.recipes.delete','bar.recipes.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.recipes.delete','cozinha.recipes.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_tecnicas', 'select', array['bar.assembly.view','bar.production.view','bar.recipes.view','bar.sector.view','cardapio.menu.view','cardapio.products.view','configuracoes.store.view','configuracoes.stores.view','configuracoes.units.view','cozinha.assembly.view','cozinha.production.view','cozinha.production_all.view','cozinha.recipes.view','dashboard.overview.view','estoque.labels.view','estoque.losses.view','estoque.operation.view','estoque.outputs.view','estoque.overview.view','estoque.transfers.view','eventos.budget.view','eventos.events.view','fichas.assembly.view','fichas.recipes.view','financeiro.cashflow.view','financeiro.cmv.view','financeiro.dre.view','financeiro.pizza_lucro.view','gestao.units.view','relatorios.reports.view','rh.staff_menu.view','salao.sector.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('fichas_tecnicas', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'unidade', null, null, 'codigo', ''),
  ('fichas_tecnicas', 'update', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('fichas_tecnicas', 'delete', array['bar.recipes.delete','bar.recipes.edit','configuracoes.store.edit','configuracoes.stores.delete','configuracoes.stores.edit','configuracoes.units.delete','configuracoes.units.edit','cozinha.recipes.delete','cozinha.recipes.edit','fichas.recipes.delete','fichas.recipes.edit','gestao.units.delete','gestao.units.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('fichas_versoes', 'select', array['bar.recipes.view','cozinha.recipes.view','fichas.recipes.view']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_versoes', 'insert', array['bar.recipes.create','bar.recipes.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fichas_versoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'fichas_tecnicas', 'ficha_id', 'codigo', ''),
  ('fornecedores', 'select', array['bar.products.view','compras.orders.view','compras.suppliers.view','dashboard.overview.view','estoque.products.view','estoque.suppliers.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('fornecedores', 'insert', array['compras.suppliers.create','compras.suppliers.edit','estoque.suppliers.create','estoque.suppliers.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('fornecedores', 'update', array['compras.suppliers.create','compras.suppliers.edit','estoque.suppliers.create','estoque.suppliers.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('fornecedores', 'delete', array['compras.suppliers.delete','compras.suppliers.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.suppliers.delete','estoque.suppliers.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('func_documentos', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('func_documentos', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('func_documentos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('funcionarios', 'select', array['rh.overview.view','salao.sector.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('funcionarios', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('funcionarios', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('gastos_administrativos', 'select', array['financeiro.cashflow.view','rh.admin_expenses.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('gastos_administrativos', 'insert', array['rh.admin_expenses.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('gastos_administrativos', 'update', array['rh.admin_expenses.approve','rh.admin_expenses.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('gastos_administrativos', 'delete', array['rh.admin_expenses.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('guias_operacionais', 'select', array['cozinha.guides.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('guias_operacionais', 'insert', array['cozinha.guides.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('guias_operacionais', 'update', array['cozinha.guides.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('guias_operacionais', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','cozinha.guides.view','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('hefisto_auditoria', 'select', array['configuracoes.users.view_history','relatorios.audit.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('hefisto_auditoria', 'insert', array['*escopo*']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('holerites', 'select', array['rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('holerites', 'insert', array['rh.payroll.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('holerites', 'update', array['rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('holerites', 'delete', array['rh.payroll.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('insumos', 'select', array['*escopo*']::text[], 'unidade', null, null, 'codigo', ''),
  ('insumos', 'insert', array['bar.production.confirm','bar.production.create','bar.production.edit','bar.products.create','bar.products.edit','bar.recipes.create','bar.recipes.edit','bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.menu.import','cardapio.packaging.create','cardapio.packaging.edit','cozinha.production.confirm','cozinha.production.create','cozinha.production.edit','cozinha.production_all.confirm','cozinha.production_all.create','cozinha.production_all.edit','cozinha.recipes.create','cozinha.recipes.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.products.create','estoque.products.edit','estoque.products.import','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','gestao.ai.create','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('insumos', 'update', array['bar.products.create','bar.products.edit','bar.recipes.create','bar.recipes.edit','bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.packaging.create','cardapio.packaging.edit','cozinha.recipes.create','cozinha.recipes.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.cancel','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.products.create','estoque.products.edit','estoque.transfers.cancel','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.recipes.create','fichas.recipes.edit','gestao.ai.create','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('insumos', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('insumos_fornecedores', 'select', array['bar.products.view','bar.recipes.view','cozinha.recipes.view','dashboard.overview.view','estoque.losses.view','estoque.outputs.view','estoque.overview.view','estoque.products.view','estoque.transfers.view','eventos.budget.view','fichas.recipes.view']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_fornecedores', 'insert', array['bar.products.create','bar.products.edit','bar.recipes.create','bar.recipes.edit','bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.menu.import','cozinha.recipes.create','cozinha.recipes.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.products.create','estoque.products.edit','estoque.products.import','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','gestao.ai.create']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_fornecedores', 'update', array['bar.products.create','bar.products.edit','estoque.products.create','estoque.products.edit']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_fornecedores', 'delete', array['bar.products.delete','bar.products.edit','bar.recipes.delete','bar.recipes.edit','bar.sector.edit','cardapio.menu.delete','cardapio.menu.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.recipes.delete','cozinha.recipes.edit','estoque.losses.view','estoque.operation.view','estoque.outputs.cancel','estoque.overview.delete','estoque.overview.edit','estoque.products.delete','estoque.products.edit','estoque.transfers.cancel','fichas.recipes.delete','fichas.recipes.edit','gestao.ai.view','gestao.units.delete']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_precos_fornecedores', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_precos_historico', 'select', array['bar.products.view','estoque.products.view','financeiro.cmv.view']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_precos_historico', 'insert', array['bar.products.create','bar.products.edit','bar.recipes.create','bar.recipes.edit','bar.sector.confirm','bar.sector.create','bar.sector.edit','cardapio.menu.create','cardapio.menu.edit','cardapio.menu.import','cozinha.recipes.create','cozinha.recipes.edit','estoque.losses.approve','estoque.losses.create','estoque.losses.record_loss','estoque.operation.adjust_stock','estoque.operation.create','estoque.outputs.adjust_stock','estoque.outputs.confirm','estoque.outputs.create','estoque.overview.adjust_stock','estoque.overview.create','estoque.overview.edit','estoque.products.create','estoque.products.edit','estoque.products.import','estoque.transfers.confirm','estoque.transfers.create','estoque.transfers.transfer','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','gestao.ai.create']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('insumos_precos_historico', 'delete', array['bar.products.delete','bar.products.edit','configuracoes.stores.delete','configuracoes.units.delete','estoque.products.delete','estoque.products.edit','gestao.units.delete']::text[], 'pai', 'insumos', 'insumo_id', 'codigo', ''),
  ('inventario_itens', 'select', array['dashboard.overview.view','estoque.inventory.view','relatorios.reports.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_itens', 'insert', array['estoque.inventory.close_inventory','estoque.inventory.create','estoque.inventory.edit','estoque.inventory.inventory']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_itens', 'update', array['estoque.inventory.close_inventory','estoque.inventory.create','estoque.inventory.edit','estoque.inventory.inventory']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_itens', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','estoque.inventory.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_movimentos', 'select', array['estoque.inventory.view','relatorios.reports.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_movimentos', 'insert', array['estoque.inventory.close_inventory','estoque.inventory.create','estoque.inventory.edit','estoque.inventory.inventory']::text[], 'unidade', null, null, 'codigo', ''),
  ('inventario_movimentos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('lancamentos', 'select', array['dashboard.overview.view_values','financeiro.cashflow.view','financeiro.dre.view','financeiro.pizza_lucro.view','rh.overview.view_values']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('lancamentos', 'insert', array['financeiro.cashflow.create','salao.tables.edit','vendas.pdv.confirm']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('lancamentos', 'update', array['financeiro.cashflow.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('lancamentos', 'delete', array['financeiro.cashflow.delete','vendas.pdv.cancel']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('listas_etiquetas', 'select', array['estoque.labels.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('listas_etiquetas', 'insert', array['estoque.labels.create','estoque.labels.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('listas_etiquetas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','estoque.labels.delete','estoque.labels.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('manutencao_servicos', 'select', array['gestao.maintenance.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('manutencao_servicos', 'insert', array['gestao.maintenance.create','gestao.maintenance.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('manutencao_servicos', 'update', array['gestao.maintenance.create','gestao.maintenance.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('manutencao_servicos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.maintenance.delete','gestao.maintenance.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('memorandos_operacao', 'select', array['bar.production.view','cozinha.production.view','cozinha.production_all.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('memorandos_operacao', 'insert', array['bar.production.confirm','bar.production.create','bar.production.edit','cozinha.production.confirm','cozinha.production.create','cozinha.production.edit','cozinha.production_all.confirm','cozinha.production_all.create','cozinha.production_all.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('memorandos_operacao', 'update', array['bar.production.cancel','bar.production.confirm','bar.production.create','bar.production.edit','cozinha.production.cancel','cozinha.production.confirm','cozinha.production.create','cozinha.production.edit','cozinha.production_all.cancel','cozinha.production_all.confirm','cozinha.production_all.create','cozinha.production_all.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('memorandos_operacao', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('mesas', 'select', array['salao.sector.view','salao.tables.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('mesas', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','salao.tables.create','salao.tables.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('mesas', 'update', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','vendas.pdv.cancel','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('mesas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('montagem', 'select', array['bar.assembly.view','bar.recipes.view','cardapio.products.view','cozinha.assembly.view','cozinha.recipes.view','dashboard.overview.view','fichas.assembly.view','fichas.recipes.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('montagem', 'insert', array['bar.assembly.create','bar.assembly.edit','bar.recipes.create','bar.recipes.edit','cardapio.products.create','cardapio.products.edit','cozinha.assembly.create','cozinha.assembly.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.assembly.create','fichas.assembly.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'unidade', null, null, 'codigo', ''),
  ('montagem', 'update', array['bar.assembly.create','bar.assembly.edit','bar.recipes.create','bar.recipes.edit','cozinha.assembly.create','cozinha.assembly.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.assembly.create','fichas.assembly.edit','fichas.recipes.create','fichas.recipes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('montagem', 'delete', array['bar.assembly.delete','bar.assembly.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.assembly.delete','cozinha.assembly.edit','fichas.assembly.delete','fichas.assembly.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('motoboys', 'select', array['vendas.delivery.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('motoboys', 'insert', array['vendas.delivery.confirm','vendas.delivery.create','vendas.delivery.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('motoboys', 'update', array['vendas.delivery.cancel','vendas.delivery.confirm','vendas.delivery.create','vendas.delivery.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('motoboys', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','vendas.delivery.cancel','vendas.delivery.delete','vendas.delivery.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('notas_fiscais', 'select', array['compras.invoices.view','financeiro.fiscal.view','vendas.pdv.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('notas_fiscais', 'insert', array['compras.invoices.create','salao.tables.edit','vendas.pdv.confirm']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('notas_fiscais', 'update', array['compras.invoices.edit','financeiro.cashflow.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('notas_fiscais', 'delete', array['compras.invoices.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('observacoes_padrao', 'select', array['salao.notes.view','salao.sector.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('observacoes_padrao', 'insert', array['salao.notes.create','salao.notes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('observacoes_padrao', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','salao.notes.delete','salao.notes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_acoes_corretivas', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_nao_conformidades', 'nao_conformidade_id', 'codigo', ''),
  ('op_acoes_corretivas', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_nao_conformidades', 'nao_conformidade_id', 'codigo', ''),
  ('op_acoes_corretivas', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_nao_conformidades', 'nao_conformidade_id', 'codigo', ''),
  ('op_acoes_corretivas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'op_nao_conformidades', 'nao_conformidade_id', 'codigo', ''),
  ('op_agendas', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_agendas', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_agendas', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_agendas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.operational_center.delete','gestao.operational_center.edit','gestao.units.delete']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_alertas', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_alertas', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_alertas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_auditoria', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_evidencias', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_evidencias', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_evidencias', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_evidencias', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_execucoes', 'select', array['gestao.operational_center.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_execucoes', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_execucoes', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_execucoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_itens', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_itens', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_itens', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_itens', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.operational_center.delete','gestao.operational_center.edit','gestao.units.delete']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_nao_conformidades', 'select', array['gestao.operational_center.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_nao_conformidades', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_nao_conformidades', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_nao_conformidades', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_processos', 'select', array['gestao.operational_center.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_processos', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_processos', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_processos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('op_respostas', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_respostas', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_respostas', 'update', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_respostas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'op_execucoes', 'execucao_id', 'codigo', ''),
  ('op_secoes', 'select', array['gestao.operational_center.view']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_secoes', 'insert', array['gestao.operational_center.approve','gestao.operational_center.confirm','gestao.operational_center.create','gestao.operational_center.edit']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('op_secoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.operational_center.delete','gestao.operational_center.edit','gestao.units.delete']::text[], 'pai', 'op_processos', 'processo_id', 'codigo', ''),
  ('operacao_embalagens', 'select', array['bar.recipes.view','bar.sector.view','cardapio.menu.view','cardapio.packaging.view','cardapio.products.view','cozinha.recipes.view','estoque.losses.view','estoque.operation.view','estoque.outputs.view','estoque.overview.view','estoque.transfers.view','fichas.recipes.view','salao.sector.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens', 'insert', array['bar.recipes.create','bar.recipes.edit','cardapio.packaging.create','cardapio.packaging.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens', 'update', array['bar.recipes.create','bar.recipes.edit','cardapio.packaging.create','cardapio.packaging.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens', 'delete', array['cardapio.packaging.delete','cardapio.packaging.edit','configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens_consumo', 'select', array['cardapio.packaging.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens_consumo', 'insert', array['cardapio.packaging.create','cardapio.packaging.edit','salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('operacao_embalagens_consumo', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('orcamentos_eventos', 'select', array['eventos.budget.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('orcamentos_eventos', 'insert', array['eventos.budget.approve','eventos.budget.create','eventos.budget.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('orcamentos_eventos', 'update', array['eventos.budget.approve','eventos.budget.create','eventos.budget.edit','eventos.budget.reject']::text[], 'unidade', null, null, 'codigo', ''),
  ('orcamentos_eventos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','eventos.budget.delete','eventos.budget.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('pdv_caixas', 'select', array['salao.sector.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('pdv_caixas', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('pdv_caixas', 'update', array['salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('pdv_caixas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('pdv_movimentacoes', 'select', array['salao.sector.view']::text[], 'pai', 'pdv_caixas', 'caixa_id', 'codigo', ''),
  ('pdv_movimentacoes', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit']::text[], 'pai', 'pdv_caixas', 'caixa_id', 'codigo', ''),
  ('pdv_movimentacoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'pdv_caixas', 'caixa_id', 'codigo', ''),
  ('pedidos', 'select', array['cardapio.engineering.view','configuracoes.store.view','configuracoes.stores.view','configuracoes.units.view','financeiro.cashflow.view','financeiro.pizza_lucro.view','gestao.units.view','salao.sector.view','vendas.ifood.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('pedidos', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','vendas.ifood.edit','vendas.ifood.settings','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('pedidos', 'update', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','vendas.ifood.edit','vendas.ifood.settings']::text[], 'unidade', null, null, 'codigo', ''),
  ('pedidos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('pedidos_itens', 'select', array['cardapio.engineering.view','salao.sector.view','vendas.pdv.view']::text[], 'pai', 'pedidos', 'pedido_id', 'codigo', ''),
  ('pedidos_itens', 'insert', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','vendas.ifood.edit','vendas.ifood.settings','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'pai', 'pedidos', 'pedido_id', 'codigo', ''),
  ('pedidos_itens', 'update', array['salao.sector.confirm','salao.sector.create','salao.sector.edit','vendas.ifood.edit','vendas.ifood.settings','vendas.pdv.cancel','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'pai', 'pedidos', 'pedido_id', 'codigo', ''),
  ('pedidos_itens', 'delete', array['cardapio.products.delete','cardapio.products.edit','configuracoes.store.edit','configuracoes.stores.delete','configuracoes.stores.edit','configuracoes.units.delete','configuracoes.units.edit','gestao.units.delete','gestao.units.edit']::text[], 'pai', 'pedidos', 'pedido_id', 'codigo', ''),
  ('ponto_marcacao', 'select', array['ponto.clock.view','ponto.kiosk.create','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('ponto_marcacao', 'insert', array['ponto.clock.create','ponto.clock.edit','ponto.kiosk.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('producao_diaria', 'select', array['bar.production.view','cozinha.production.view','cozinha.production_all.view','relatorios.reports.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('producao_diaria', 'insert', array['bar.production.confirm','bar.production.create','bar.production.edit','cozinha.production.confirm','cozinha.production.create','cozinha.production.edit','cozinha.production_all.confirm','cozinha.production_all.create','cozinha.production_all.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('producao_diaria', 'delete', array['bar.production.cancel','bar.production.edit','configuracoes.stores.delete','configuracoes.units.delete','cozinha.production.cancel','cozinha.production.edit','cozinha.production_all.cancel','cozinha.production_all.edit','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('producoes', 'select', array['compras.orders.view','rh.overview.view','tarefas.notifications.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('producoes', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('producoes', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('produtos', 'select', array['bar.assembly.view','bar.production.view','bar.recipes.view','cardapio.products.view','cozinha.assembly.view','cozinha.production.view','cozinha.production_all.view','cozinha.recipes.view','dashboard.overview.view','estoque.labels.view','eventos.budget.view','eventos.events.view','fichas.assembly.view','fichas.recipes.view','financeiro.cashflow.view','financeiro.cmv.view','financeiro.dre.view','financeiro.pizza_lucro.view','relatorios.reports.view','rh.overview.view','salao.sector.view','vendas.ifood.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('produtos', 'insert', array['bar.recipes.create','bar.recipes.edit','cardapio.products.create','cardapio.products.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit','fichas.recipes.import']::text[], 'unidade', null, null, 'codigo', ''),
  ('produtos', 'update', array['bar.recipes.create','bar.recipes.edit','cardapio.products.create','cardapio.products.edit','cozinha.recipes.create','cozinha.recipes.edit','fichas.recipes.create','fichas.recipes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('produtos', 'delete', array['cardapio.products.delete','cardapio.products.edit','configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('registro_ponto', 'select', array['ponto.clock.view','ponto.kiosk.create','ponto.kiosk.view','rh.overview.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('registro_ponto', 'insert', array['ponto.clock.create','ponto.clock.edit','ponto.kiosk.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('registro_ponto', 'update', array['ponto.clock.create','ponto.clock.edit','ponto.kiosk.create']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('registro_ponto', 'delete', array['ponto.clock.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_advertencias_colab', 'select', array['rh.employees.view','rh.overview.view']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_advertencias_colab', 'insert', array['rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_advertencias_colab', 'update', array['rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_advertencias_colab', 'delete', array['rh.employees.delete','rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_atas', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas_reuniao', 'select', array['rh.minutes.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas_reuniao', 'insert', array['rh.minutes.create','rh.minutes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas_reuniao', 'update', array['rh.minutes.create','rh.minutes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atas_reuniao', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.minutes.delete','rh.minutes.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_atestados', 'select', array['rh.employees.view','rh.overview.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_atestados', 'insert', array['rh.employees.create','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_atestados', 'update', array['rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_atestados', 'delete', array['rh.employees.delete','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_banco_horas', 'select', array['ponto.clock.view','rh.employees.view','rh.overview.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_banco_horas', 'insert', array['ponto.clock.edit','rh.employees.edit','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_banco_horas', 'update', array['ponto.clock.edit','rh.employees.edit','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_banco_horas', 'delete', array['ponto.clock.delete','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_bonificacoes', 'select', array['rh.employees.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_bonificacoes', 'insert', array['rh.employees.edit','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_bonificacoes', 'update', array['rh.employees.edit','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_bonificacoes', 'delete', array['rh.employees.edit','rh.payroll.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_cargos', 'select', array['configuracoes.store.view','configuracoes.units.view','dashboard.overview.view','ponto.clock.view','rh.employee_portal.view','rh.employees.view','rh.extras.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_cargos', 'insert', array['configuracoes.store.edit','configuracoes.store.settings','configuracoes.units.create','configuracoes.units.edit','configuracoes.units.settings','dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_cargos', 'update', array['configuracoes.store.edit','configuracoes.store.settings','configuracoes.units.create','configuracoes.units.edit','configuracoes.units.settings','dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_cargos', 'delete', array['configuracoes.store.edit','configuracoes.stores.delete','configuracoes.units.delete','configuracoes.units.edit','dashboard.overview.view','gestao.units.delete','ponto.clock.delete','ponto.clock.edit','rh.employee_portal.edit','rh.employees.delete','rh.employees.edit','rh.extras.delete','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_consumo_funcionarios', 'select', array['rh.overview.view','rh.payroll.view','rh.staff_menu.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_consumo_funcionarios', 'insert', array['rh.employees.edit','rh.staff_menu.create','rh.staff_menu.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_consumo_funcionarios', 'update', array['rh.employees.edit','rh.staff_menu.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_consumo_funcionarios', 'delete', array['rh.employees.edit','rh.staff_menu.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_espelho_fechado', 'select', array['ponto.clock.view','rh.employees.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_espelho_fechado', 'insert', array['rh.payroll.confirm','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_espelho_fechado', 'update', array['rh.payroll.confirm','rh.payroll.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_espelho_fechado', 'delete', array['rh.payroll.delete']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_feriados', 'select', array['dashboard.overview.view','ponto.clock.view','rh.employee_portal.view','rh.employees.view','rh.extras.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_feriados', 'insert', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_feriados', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','dashboard.overview.view','gestao.units.delete','ponto.clock.delete','ponto.clock.edit','rh.employee_portal.edit','rh.employees.delete','rh.employees.edit','rh.extras.delete','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_folgas_esporadicas', 'select', array['ponto.clock.view','rh.employees.view','rh.overview.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_folgas_esporadicas', 'insert', array['ponto.clock.edit','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_folgas_esporadicas', 'update', array['ponto.clock.edit','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_folgas_esporadicas', 'delete', array['ponto.clock.delete','rh.employees.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_historico', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_historico', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_historico', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_historico_promocoes', 'select', array['rh.employees.view','rh.overview.view','rh.payroll.view']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_historico_promocoes', 'insert', array['rh.employees.edit','rh.payroll.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_ponto_liberado', 'select', array['dashboard.overview.view','ponto.clock.view','rh.employee_portal.view','rh.employees.view','rh.extras.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_ponto_liberado', 'insert', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_ponto_liberado', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','dashboard.overview.view','gestao.units.delete','ponto.clock.delete','ponto.clock.edit','rh.employee_portal.edit','rh.employees.delete','rh.employees.edit','rh.extras.delete','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_recibos_prestacao', 'select', array['financeiro.dre.view','rh.extras.view','rh.overview.view','rh.payroll.view']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_recibos_prestacao', 'insert', array['rh.extras.create','rh.extras.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_recibos_prestacao', 'update', array['rh.extras.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_recibos_prestacao', 'delete', array['rh.extras.delete','rh.extras.edit']::text[], 'unidade', null, null, 'curado-etapa3', ''),
  ('rh_regulamentos', 'select', array['dashboard.overview.view','ponto.clock.view','rh.employee_portal.view','rh.employees.view','rh.extras.view','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_regulamentos', 'insert', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_regulamentos', 'update', array['dashboard.overview.view','ponto.clock.create','ponto.clock.edit','rh.employee_portal.edit','rh.employees.create','rh.employees.edit','rh.extras.create','rh.extras.edit','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_regulamentos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_reunioes_colab', 'select', array['rh.employees.view','rh.overview.view']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_reunioes_colab', 'insert', array['rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_reunioes_colab', 'delete', array['rh.employees.delete','rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_tipos_bonificacao', 'select', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_tipos_bonificacao', 'insert', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_tipos_bonificacao', 'update', array['rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_tipos_bonificacao', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','rh.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('rh_treinamentos_colab', 'select', array['rh.employees.view','rh.overview.view']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_treinamentos_colab', 'insert', array['rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('rh_treinamentos_colab', 'delete', array['rh.employees.delete','rh.employees.edit']::text[], 'pai', 'colaboradores', 'colaborador_id', 'curado-1b', ''),
  ('suprimentos_catalogo', 'select', array['gestao.cleaning_supplies.view','gestao.supplies.view']::text[], 'global', null, null, 'codigo', 'catálogo de suprimentos compartilhado; o saldo por unidade fica em suprimentos_unidades'),
  ('suprimentos_catalogo', 'insert', array['gestao.cleaning_supplies.adjust_stock','gestao.cleaning_supplies.create','gestao.cleaning_supplies.edit','gestao.supplies.create','gestao.supplies.edit']::text[], 'global', null, null, 'codigo', 'catálogo de suprimentos compartilhado; o saldo por unidade fica em suprimentos_unidades'),
  ('suprimentos_catalogo', 'update', array['gestao.cleaning_supplies.adjust_stock','gestao.cleaning_supplies.create','gestao.cleaning_supplies.edit','gestao.supplies.create','gestao.supplies.edit']::text[], 'global', null, null, 'codigo', 'catálogo de suprimentos compartilhado; o saldo por unidade fica em suprimentos_unidades'),
  ('suprimentos_historico', 'insert', array['gestao.cleaning_supplies.adjust_stock','gestao.cleaning_supplies.create','gestao.cleaning_supplies.edit','gestao.supplies.create','gestao.supplies.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('suprimentos_historico', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('suprimentos_unidades', 'select', array['gestao.cleaning_supplies.view','gestao.supplies.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('suprimentos_unidades', 'insert', array['gestao.cleaning_supplies.adjust_stock','gestao.cleaning_supplies.create','gestao.cleaning_supplies.edit','gestao.supplies.create','gestao.supplies.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('suprimentos_unidades', 'update', array['gestao.cleaning_supplies.adjust_stock','gestao.cleaning_supplies.create','gestao.cleaning_supplies.edit','gestao.supplies.create','gestao.supplies.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('suprimentos_unidades', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('tarefas_instancias', 'select', array['gestao.overview.view','tarefas.tasks.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('tarefas_instancias', 'insert', array['gestao.overview.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('tarefas_instancias', 'update', array['tarefas.tasks.create','tarefas.tasks.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('tarefas_instancias', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'unidade', null, null, 'codigo', ''),
  ('tarefas_templates', 'select', array['gestao.overview.view']::text[], 'global', null, null, 'codigo', 'modelos de tarefa reaproveitados por todas as unidades'),
  ('tarefas_templates', 'insert', array['gestao.overview.view']::text[], 'global', null, null, 'codigo', 'modelos de tarefa reaproveitados por todas as unidades'),
  ('treinamentos', 'select', array['salao.training.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('treinamentos', 'insert', array['salao.training.create','salao.training.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('treinamentos', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','salao.training.delete','salao.training.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('venda_itens', 'insert', array['vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'pai', 'vendas', 'venda_id', 'codigo', ''),
  ('venda_itens', 'update', array['cozinha.sector.confirm','cozinha.sector.create','cozinha.sector.edit']::text[], 'pai', 'vendas', 'venda_id', 'codigo', ''),
  ('venda_itens', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete']::text[], 'pai', 'vendas', 'venda_id', 'codigo', ''),
  ('vendas', 'select', array['cozinha.sector.view','financeiro.cashflow.view','financeiro.pizza_lucro.view','salao.sector.view','vendas.delivery.view','vendas.pdv.view']::text[], 'unidade', null, null, 'codigo', ''),
  ('vendas', 'insert', array['financeiro.cashflow.approve','financeiro.cashflow.create','financeiro.cashflow.edit','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('vendas', 'update', array['vendas.pdv.cancel','vendas.pdv.confirm','vendas.pdv.create','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', ''),
  ('vendas', 'delete', array['configuracoes.stores.delete','configuracoes.units.delete','gestao.units.delete','vendas.pdv.cancel','vendas.pdv.delete','vendas.pdv.edit']::text[], 'unidade', null, null, 'codigo', '');

insert into hefisto_privado.tabelas_do_app (tabela) values
  ('advertencias'),
  ('avaliacoes_nps'),
  ('avisos'),
  ('campanhas'),
  ('candidatos'),
  ('cardapio'),
  ('cervejas'),
  ('checklists_execucoes'),
  ('checklists_templates'),
  ('clientes'),
  ('colaboradores'),
  ('comandas'),
  ('config_sistema'),
  ('contas_pagar'),
  ('controle_gas'),
  ('controle_limpeza'),
  ('controle_manutencoes'),
  ('controle_oleo'),
  ('cupons'),
  ('cursos'),
  ('delivery_configs'),
  ('documentos_rh'),
  ('empresa_documentos'),
  ('equipe_unidade'),
  ('escalas_dia'),
  ('estoque'),
  ('estoque_atual'),
  ('estoque_itens'),
  ('estoque_movimentacoes'),
  ('estoque_movimentacoes_multi'),
  ('estoque_movimentos'),
  ('estoques'),
  ('etiquetas'),
  ('evento_compras'),
  ('evento_custos_fixos'),
  ('evento_drinks'),
  ('evento_ingredientes'),
  ('evento_pratos'),
  ('evento_preparos'),
  ('evento_reservas'),
  ('eventos'),
  ('extras_cadastros'),
  ('ficha_itens'),
  ('fichas_alergenicos'),
  ('fichas_armazenamento'),
  ('fichas_custo_historico'),
  ('fichas_equipamentos'),
  ('fichas_etapas'),
  ('fichas_ingredientes'),
  ('fichas_lote_auditoria'),
  ('fichas_montagem_passos'),
  ('fichas_tecnicas'),
  ('fichas_versoes'),
  ('fornecedores'),
  ('func_documentos'),
  ('funcionarios'),
  ('gastos_administrativos'),
  ('guias_operacionais'),
  ('hefisto_auditoria'),
  ('holerites'),
  ('insumos'),
  ('insumos_fornecedores'),
  ('insumos_precos_fornecedores'),
  ('insumos_precos_historico'),
  ('inventario_itens'),
  ('inventario_movimentos'),
  ('lancamentos'),
  ('listas_etiquetas'),
  ('manutencao_servicos'),
  ('memorandos_operacao'),
  ('mesas'),
  ('montagem'),
  ('motoboys'),
  ('notas_fiscais'),
  ('observacoes_padrao'),
  ('op_acoes_corretivas'),
  ('op_agendas'),
  ('op_alertas'),
  ('op_auditoria'),
  ('op_evidencias'),
  ('op_execucoes'),
  ('op_itens'),
  ('op_nao_conformidades'),
  ('op_processos'),
  ('op_respostas'),
  ('op_secoes'),
  ('operacao_embalagens'),
  ('operacao_embalagens_consumo'),
  ('orcamentos_eventos'),
  ('pdv_caixas'),
  ('pdv_movimentacoes'),
  ('pedidos'),
  ('pedidos_itens'),
  ('ponto_marcacao'),
  ('producao_diaria'),
  ('producoes'),
  ('produtos'),
  ('registro_ponto'),
  ('rh_advertencias_colab'),
  ('rh_atas'),
  ('rh_atas_reuniao'),
  ('rh_atestados'),
  ('rh_banco_horas'),
  ('rh_bonificacoes'),
  ('rh_cargos'),
  ('rh_consumo_funcionarios'),
  ('rh_espelho_fechado'),
  ('rh_feriados'),
  ('rh_folgas_esporadicas'),
  ('rh_historico'),
  ('rh_historico_promocoes'),
  ('rh_ponto_liberado'),
  ('rh_recibos_prestacao'),
  ('rh_regulamentos'),
  ('rh_reunioes_colab'),
  ('rh_tipos_bonificacao'),
  ('rh_treinamentos_colab'),
  ('suprimentos_catalogo'),
  ('suprimentos_historico'),
  ('suprimentos_unidades'),
  ('tarefas_instancias'),
  ('tarefas_templates'),
  ('treinamentos'),
  ('unidades'),
  ('venda_itens'),
  ('vendas');
/* <<MAPA_FIM>> */

/* Reaplicada depois da 04: o quiosque continua sem leitura direta. */
do $$
begin
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-04' and tipo = 'marcador')
     and to_regprocedure('hefisto_privado.quiosque_sem_leitura_direta()') is not null then
    perform hefisto_privado.quiosque_sem_leitura_direta();
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('02 mapa', 'regra da 04 mantida: quiosque sem leitura direta', 'OK', '');
  end if;
end $$;

/* 3. ALVOS: toda tabela do schema public, menos as de regra própria */
create temp table if not exists hefisto_alvos_1b02 (tabela text primary key, tem_unidade boolean not null) on commit drop;
truncate hefisto_alvos_1b02;
insert into hefisto_alvos_1b02 (tabela, tem_unidade)
select c.relname,
       exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'unidade_id' and not a.attisdropped)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and c.relname not in ('usuarios_erp', 'usuario_escopos', 'usuario_permissoes', 'perfis_acesso', 'perfil_permissoes',
                        'setores', 'empresas', 'acessos_auditoria', 'permissoes_auditoria', 'unidades', 'config_pins');

/* 4. FOTOGRAFIA das policies e do RLS (só na primeira execução) */
do $$
begin
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-02') then
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('02 fotografia', 'fotografia anterior preservada', 'OK', 'reexecução');
    return;
  end if;
  insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
  select '1b-02', 'policy', format('public.%I.%I', p.tablename, p.policyname),
         jsonb_build_object('tabela', p.tablename, 'nome', p.policyname, 'permissive', p.permissive,
                            'roles', to_jsonb(p.roles), 'cmd', p.cmd, 'qual', p.qual, 'with_check', p.with_check)
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in (select tabela from hefisto_alvos_1b02);

  insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
  select '1b-02', 'rls', format('public.%I', c.relname), jsonb_build_object('tabela', c.relname, 'rls', c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in (select tabela from hefisto_alvos_1b02);

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
  select '02 fotografia', 'estado anterior guardado', 'OK',
         (select count(*) from hefisto_privado.snapshot_seguranca where etapa = '1b-02')::text || ' registros';
end $$;

/* 5. APLICAÇÃO
   Uma função por tabela, para a migração 04 (e correções futuras do mapa)
   reaplicarem a regra de UMA tabela sem repetir o construtor de policies. */
create or replace function hefisto_privado.aplicar_rls_tabela(p_tabela text)
returns text
language plpgsql
set search_path = ''
as $aplicar$
declare
  a record;
  pol record;
  v_escopo text;
  v_pai text;
  v_fk text;
  v_pai_coluna text;
  v_origem text;
  v_cmd text;
  v_perm text[];
  v_u text;
  v_ler text;
  v_escrever text;
  v_ligacao text;
  v_comandos text[];
  v_expr_ler text;
  v_expr_escrever text;
begin
  select c.relname as tabela,
         exists (select 1 from pg_attribute x where x.attrelid = c.oid and x.attname = 'unidade_id' and not x.attisdropped) as tem_unidade
  into a
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = p_tabela and c.relkind in ('r', 'p');
  if not found then return null; end if;

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = a.tabela loop
      execute format('drop policy %I on public.%I', pol.policyname, a.tabela);
    end loop;
    execute format('alter table public.%I enable row level security', a.tabela);

    select m.escopo, m.pai, m.fk into v_escopo, v_pai, v_fk
    from hefisto_privado.mapa_rls_v2 m where m.tabela = a.tabela
    order by m.comando limit 1;
    v_pai_coluna := 'id';
    v_origem := case when v_escopo is null then null else 'mapa' end;

    /* A coluna própria vale mais que o pai: é a unidade da linha. */
    if v_escopo = 'pai' and a.tem_unidade then
      v_escopo := 'unidade'; v_origem := 'mapa, coluna própria';
    end if;

    if v_escopo is null then
      if a.tem_unidade then
        v_escopo := 'unidade'; v_origem := 'sem regra no mapa';
      else
        /* Filha sem mapa: procura FK de uma coluna para uma tabela com unidade_id. */
        select cf.relname, af.attname, ap.attname into v_pai, v_fk, v_pai_coluna
        from pg_constraint con
        join pg_class cf on cf.oid = con.confrelid
        join pg_namespace nf on nf.oid = cf.relnamespace and nf.nspname = 'public'
        join pg_attribute af on af.attrelid = con.conrelid and af.attnum = con.conkey[1]
        join pg_attribute ap on ap.attrelid = con.confrelid and ap.attnum = con.confkey[1]
        where con.contype = 'f' and con.conrelid = format('public.%I', a.tabela)::regclass
          and cardinality(con.conkey) = 1
          and cf.relname <> 'unidades'
          and exists (select 1 from pg_attribute x where x.attrelid = con.confrelid and x.attname = 'unidade_id' and not x.attisdropped)
        order by cf.relname
        limit 1;
        if v_pai is not null then
          v_escopo := 'pai'; v_origem := 'FK descoberta (sem regra no mapa: nenhum comando liberado)';
        else
          v_escopo := 'negado'; v_origem := 'sem unidade, sem pai, sem regra';
        end if;
      end if;
    end if;

    if v_escopo = 'pai' then
      if to_regclass(format('public.%I', v_pai)) is null
         or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_pai and column_name = 'unidade_id')
         or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_pai and column_name = v_pai_coluna)
         or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = a.tabela and column_name = v_fk) then
        v_origem := format('pai inválido (%s.%s → %s): negado', a.tabela, v_fk, v_pai);
        v_escopo := 'negado';
      end if;
    end if;

    v_comandos := array[]::text[];
    if v_escopo <> 'negado' then
      if v_escopo = 'pai' then
        select case when format_type(cp.atttypid, cp.atttypmod) = format_type(cf.atttypid, cf.atttypmod)
                    then format('hefisto_pai.%I = %I.%I', v_pai_coluna, a.tabela, v_fk)
                    else format('hefisto_pai.%I::text = %I.%I::text', v_pai_coluna, a.tabela, v_fk) end
        into v_ligacao
        from pg_attribute cp, pg_attribute cf
        where cp.attrelid = format('public.%I', v_pai)::regclass and cp.attname = v_pai_coluna
          and cf.attrelid = format('public.%I', a.tabela)::regclass and cf.attname = v_fk;
      end if;

      foreach v_cmd in array array['select', 'insert', 'update', 'delete'] loop
        select m.permissoes into v_perm from hefisto_privado.mapa_rls_v2 m where m.tabela = a.tabela and m.comando = v_cmd;
        if not found then continue; end if;

        v_u := case when v_perm = array['*escopo*']
                    then '((select public.hefisto_escopo_unidades())::text[])'
                    else format('((select public.hefisto_unidades_com_permissao(%L::text[]))::text[])', v_perm) end;

        if v_escopo = 'global' then
          v_expr_ler := format('cardinality(%s) > 0', v_u);
          v_expr_escrever := v_expr_ler;
        else
          v_ler := format('((%1$s is not null and (%1$s::text = any (%2$s) or ''*'' = any (%2$s))) or (%1$s is null and cardinality(%2$s) > 0))',
                          case when v_escopo = 'pai' then 'hefisto_pai.unidade_id' else 'unidade_id' end, v_u);
          v_escrever := format('((%1$s is not null and (%1$s::text = any (%2$s) or ''*'' = any (%2$s))) or (%1$s is null and ''*'' = any (%2$s)))',
                               case when v_escopo = 'pai' then 'hefisto_pai.unidade_id' else 'unidade_id' end, v_u);
          if v_escopo = 'pai' then
            v_expr_ler := format('exists (select 1 from public.%I hefisto_pai where %s and %s)', v_pai, v_ligacao, v_ler);
            v_expr_escrever := format('exists (select 1 from public.%I hefisto_pai where %s and %s)', v_pai, v_ligacao, v_escrever);
          else
            v_expr_ler := v_ler;
            v_expr_escrever := v_escrever;
          end if;
        end if;

        if v_cmd = 'select' then
          execute format('create policy hefisto_select on public.%I for select to authenticated using (%s)', a.tabela, v_expr_ler);
        elsif v_cmd = 'insert' then
          execute format('create policy hefisto_insert on public.%I for insert to authenticated with check (%s)', a.tabela, v_expr_escrever);
        elsif v_cmd = 'update' then
          execute format('create policy hefisto_update on public.%I for update to authenticated using (%s) with check (%s)', a.tabela, v_expr_escrever, v_expr_escrever);
        else
          execute format('create policy hefisto_delete on public.%I for delete to authenticated using (%s)', a.tabela, v_expr_escrever);
        end if;
        v_comandos := v_comandos || v_cmd;
      end loop;
    end if;

    insert into hefisto_privado.rls_aplicado (tabela, escopo, pai, fk, comandos, origem)
    values (a.tabela, v_escopo, case when v_escopo = 'pai' then v_pai end, case when v_escopo = 'pai' then v_fk end, v_comandos, v_origem)
    on conflict (tabela) do update set escopo = excluded.escopo, pai = excluded.pai, fk = excluded.fk,
      comandos = excluded.comandos, origem = excluded.origem, aplicado_em = now();
  return v_escopo;
end;
$aplicar$;
revoke all on function hefisto_privado.aplicar_rls_tabela(text) from public;

do $$
declare
  a record;
begin
  for a in select tabela from hefisto_alvos_1b02 order by tabela loop
    perform hefisto_privado.aplicar_rls_tabela(a.tabela);
  end loop;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
  select '02 aplicação', format('tabelas com escopo %s', escopo), 'OK', count(*)::text
  from hefisto_privado.rls_aplicado group by escopo order by escopo;
end $$;

/* 6. PÓS-CHECK */
do $$
declare
  v_lista text;
begin
  select string_agg(c.relname, ', ') into v_lista
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in (select tabela from hefisto_alvos_1b02) and not c.relrowsecurity;
  if v_lista is not null then raise exception 'Pós-check falhou: RLS desligado em %', v_lista; end if;

  select string_agg(tablename || '.' || policyname, ', ') into v_lista
  from pg_policies
  where schemaname = 'public' and (qual = 'true' or with_check = 'true');
  if v_lista is not null then raise exception 'Pós-check falhou: policies abertas no schema public: %', v_lista; end if;

  select string_agg(tablename || '.' || policyname, ', ') into v_lista
  from pg_policies
  where schemaname = 'public' and tablename in (select tabela from hefisto_alvos_1b02)
    and (policyname not like 'hefisto\_%' or roles && array['anon', 'public']::name[]);
  if v_lista is not null then raise exception 'Pós-check falhou: policy fora do mapa ou para anônimo: %', v_lista; end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('02 pós-check', 'RLS ligado em todas as tabelas', 'OK', ''),
    ('02 pós-check', 'nenhuma policy aberta (using true) no schema public', 'OK', ''),
    ('02 pós-check', 'só policies do mapa, só para usuário logado', 'OK', '');
end $$;

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
select '02 atenção', 'tabelas USADAS PELO APP que ficaram sem nenhum comando', 'ATENÇÃO', string_agg(r.tabela || ' (' || r.origem || ')', ', ' order by r.tabela)
from hefisto_privado.rls_aplicado r
where cardinality(r.comandos) = 0 and r.tabela in (select tabela from hefisto_privado.tabelas_do_app)
having count(*) > 0;

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
select '02 informação', 'tabelas do banco que o app não usa: negadas', 'OK', coalesce(string_agg(r.tabela, ', ' order by r.tabela), 'nenhuma')
from hefisto_privado.rls_aplicado r
where cardinality(r.comandos) = 0 and r.tabela not in (select tabela from hefisto_privado.tabelas_do_app);

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
select '02 informação', 'tabelas-filho protegidas pela unidade da tabela-pai', 'OK', coalesce(string_agg(r.tabela || ' → ' || r.pai, ', ' order by r.tabela), 'nenhuma')
from hefisto_privado.rls_aplicado r where r.escopo = 'pai';

/* <<FIM_DA_APLICACAO>> — daqui para baixo a simulação troca por matriz + desfazer */
insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
select '1b-02', 'marcador', 'aplicada', jsonb_build_object('em', now())
where not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo = 'marcador');

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
values ('02 fim', 'Migração 02 concluída', 'OK', 'Mapa aplicado em hefisto_privado.rls_aplicado.');

commit;

select etapa, verificacao, situacao, detalhe from hefisto_relatorio order by ordem;
