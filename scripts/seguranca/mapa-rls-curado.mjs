// Decisões de acesso tomadas À MÃO, que o código sozinho não revela.
// O gerador (gerar-mapa-rls.mjs) junta isto com o uso real medido no código
// (mapear-uso-tabelas.mjs) e com o mapa sensível da Etapa 3, e escreve o mapa
// dentro de db/1b/02_rls_permissao_e_tabelas_filho.sql.
//
// Precedência: TABELAS_FORA > ESCOPO_NEGADO > mapa sensível (Etapa 3 + SENSIVEIS_1B)
//              > uso medido no código. Cada decisão tem motivo.

/** Tabelas que a migração 02 não toca (têm regra própria). */
export const TABELAS_FORA = Object.freeze({
  usuarios_erp: "controle de acesso: só a API administrativa (service role)",
  usuario_escopos: "controle de acesso",
  usuario_permissoes: "controle de acesso",
  perfis_acesso: "controle de acesso",
  perfil_permissoes: "controle de acesso",
  setores: "controle de acesso",
  empresas: "controle de acesso",
  acessos_auditoria: "controle de acesso",
  permissoes_auditoria: "controle de acesso",
  unidades: "policies próprias da Etapa 3 (escopo do usuário; escrita só com escopo total)",
  config_pins: "sem acesso direto: só as funções de PIN (Etapa 1 e 3)",
});

/** Tabelas sem acesso nenhum para o usuário logado, mesmo que existam. */
export const ESCOPO_NEGADO = Object.freeze({
  acessos_modulo: "acessos legados com senha em texto puro: só a migração do administrador geral, pela API",
});

/** Tabelas sem unidade, de catálogo da empresa: basta a permissão (em qualquer unidade do escopo). */
export const ESCOPO_GLOBAL = Object.freeze({
  empresa_documentos: "documentos da empresa (contrato social, alvarás): não pertencem a uma unidade",
  suprimentos_catalogo: "catálogo de suprimentos compartilhado; o saldo por unidade fica em suprimentos_unidades",
  tarefas_templates: "modelos de tarefa reaproveitados por todas as unidades",
});

/**
 * Tabelas-filho: a unidade vem da tabela-pai pela coluna indicada. Se a tabela
 * tiver unidade_id própria no banco, a própria coluna vale (a migração decide).
 */
export const PAI = Object.freeze({
  pedidos_itens: { pai: "pedidos", fk: "pedido_id" },
  venda_itens: { pai: "vendas", fk: "venda_id" },
  fichas_ingredientes: { pai: "fichas_tecnicas", fk: "ficha_id" },
  ficha_itens: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_etapas: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_equipamentos: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_alergenicos: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_montagem_passos: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_armazenamento: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_versoes: { pai: "fichas_tecnicas", fk: "ficha_id" },
  fichas_custo_historico: { pai: "fichas_tecnicas", fk: "ficha_id" },
  evento_compras: { pai: "eventos", fk: "evento_id" },
  evento_custos_fixos: { pai: "eventos", fk: "evento_id" },
  evento_drinks: { pai: "eventos", fk: "evento_id" },
  evento_ingredientes: { pai: "eventos", fk: "evento_id" },
  evento_pratos: { pai: "eventos", fk: "evento_id" },
  evento_preparos: { pai: "eventos", fk: "evento_id" },
  evento_reservas: { pai: "eventos", fk: "evento_id" },
  op_itens: { pai: "op_processos", fk: "processo_id" },
  op_secoes: { pai: "op_processos", fk: "processo_id" },
  op_agendas: { pai: "op_processos", fk: "processo_id" },
  op_respostas: { pai: "op_execucoes", fk: "execucao_id" },
  op_evidencias: { pai: "op_execucoes", fk: "execucao_id" },
  op_acoes_corretivas: { pai: "op_nao_conformidades", fk: "nao_conformidade_id" },
  documentos_rh: { pai: "colaboradores", fk: "colaborador_id" },
  rh_advertencias_colab: { pai: "colaboradores", fk: "colaborador_id" },
  rh_historico_promocoes: { pai: "colaboradores", fk: "colaborador_id" },
  rh_reunioes_colab: { pai: "colaboradores", fk: "colaborador_id" },
  rh_treinamentos_colab: { pai: "colaboradores", fk: "colaborador_id" },
  insumos_fornecedores: { pai: "insumos", fk: "insumo_id" },
  insumos_precos_fornecedores: { pai: "insumos", fk: "insumo_id" },
  insumos_precos_historico: { pai: "insumos", fk: "insumo_id" },
  estoque_itens: { pai: "estoques", fk: "estoque_id" },
  pdv_movimentacoes: { pai: "pdv_caixas", fk: "caixa_id" },
});

/**
 * Tabelas sensíveis que a Etapa 3 não cobria. Comando ausente = negado.
 * (As da Etapa 3 são lidas do próprio arquivo da Etapa 3.)
 */
export const SENSIVEIS_1B = Object.freeze({
  /* RH por funcionário (sem unidade própria: unidade do colaborador). */
  documentos_rh: {
    select: ["rh.employees.view", "rh.overview.view"], insert: ["rh.employees.edit", "rh.employees.create"],
    update: ["rh.employees.edit"], delete: ["rh.employees.edit", "rh.employees.delete"],
  },
  rh_advertencias_colab: {
    select: ["rh.employees.view", "rh.overview.view"], insert: ["rh.employees.edit"], update: ["rh.employees.edit"], delete: ["rh.employees.edit", "rh.employees.delete"],
  },
  rh_historico_promocoes: {
    select: ["rh.employees.view", "rh.overview.view", "rh.payroll.view"], insert: ["rh.employees.edit", "rh.payroll.edit"],
  },
  rh_reunioes_colab: {
    select: ["rh.employees.view", "rh.overview.view"], insert: ["rh.employees.edit"], delete: ["rh.employees.edit", "rh.employees.delete"],
  },
  rh_treinamentos_colab: {
    select: ["rh.employees.view", "rh.overview.view"], insert: ["rh.employees.edit"], delete: ["rh.employees.edit", "rh.employees.delete"],
  },
  /* Clientes: nome, telefone, endereço. */
  clientes: {
    select: ["clientes.overview.view", "clientes.crm.view", "vendas.delivery.view"],
    insert: ["clientes.overview.create", "clientes.crm.create", "vendas.delivery.create"],
    update: ["clientes.overview.edit", "clientes.crm.edit", "vendas.delivery.edit"],
  },
});

/**
 * Exclusão de unidade (removerUnidade): apaga a linha da unidade em todas as
 * tabelas. Estas tabelas ficam FORA da cascata: livro legal e trilhas de auditoria.
 */
export const FORA_DA_CASCATA = Object.freeze([
  "ponto_marcacao", "hefisto_auditoria", "op_auditoria", "fichas_lote_auditoria", "rh_espelho_fechado",
]);

/** Ações do catálogo que valem para cada comando. */
export const ACOES_POR_COMANDO = Object.freeze({
  select: ["view"],
  insert: ["create", "edit", "confirm", "adjust_stock", "import", "inventory", "transfer", "record_loss", "settings", "approve", "close_inventory"],
  update: ["edit", "create", "confirm", "cancel", "approve", "reject", "adjust_stock", "inventory", "close_inventory", "transfer", "settings", "record_loss"],
  delete: ["delete", "edit", "cancel"],
});
