// Dados de teste: empresa A (loja-a) com movimento realista e empresa B
// (loja-b) com valores-armadilha (999999…) — se algum aparecer numa resposta
// da loja-a, o isolamento falhou.

import { somarDias } from "../core/periodos.mjs";

export const HOJE = "2026-10-07"; // quarta-feira
export const PICANHA = "a0000000-0000-4000-8000-000000000001";
export const PICANHA_B = "a0000000-0000-4000-8000-000000000002"; // mesmo nome, empresa B
export const PICANHA_SUINA = "a0000000-0000-4000-8000-000000000003";
export const CAMARAO = "a0000000-0000-4000-8000-000000000004";
export const OLEO = "a0000000-0000-4000-8000-000000000005";
export const EST_COZINHA = "e0000000-0000-4000-8000-000000000001";
export const EST_B = "e0000000-0000-4000-8000-000000000002";
export const FORN = "f0000000-0000-4000-8000-000000000001";

const A = "loja-a";
const B = "loja-b";

function faturamentoA() {
  const out = [];
  // 8 semanas de histórico: ~2.000/dia; quartas ~2.400
  for (let i = 56; i >= 1; i--) {
    const d = somarDias(HOJE, -i);
    if (d === "2026-10-04") continue; // domingo sem lançamento
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    const base = dow === 3 ? 2400 : 2000;
    out.push({ unidade_id: A, data: d, vendas_brutas: base + (i % 3) * 10, cancelamentos: 0, descontos: (i % 3) * 10, receita: base, fonte: "Saipos — relatório do dia" });
  }
  // hoje (quarta) caiu bem: 1.200
  out.push({ unidade_id: A, data: HOJE, vendas_brutas: 1250, cancelamentos: 50, descontos: 0, receita: 1200, fonte: "Saipos — relatório do dia" });
  return out;
}

export function tabelasPadrao() {
  return {
    fin_faturamento_diario: [
      ...faturamentoA(),
      { unidade_id: B, data: HOJE, vendas_brutas: 999999, cancelamentos: 0, descontos: 0, receita: 999999, fonte: "B" },
    ],
    insumos: [
      { id: PICANHA, unidade_id: A, nome: "Picanha", unidade_medida: "kg", departamento: "cozinha", categoria: "Carnes", tamanho_embalagem: 1, unidade_comercial: "kg" },
      { id: PICANHA_SUINA, unidade_id: A, nome: "Picanha Suína", unidade_medida: "kg", departamento: "cozinha", categoria: "Carnes", tamanho_embalagem: 1, unidade_comercial: "kg" },
      { id: CAMARAO, unidade_id: A, nome: "Camarão 40/60", unidade_medida: "kg", departamento: "cozinha", categoria: "Pescados", tamanho_embalagem: 1, unidade_comercial: "kg" },
      { id: OLEO, unidade_id: A, nome: "Óleo de soja", unidade_medida: "L", departamento: "cozinha", categoria: "Mercearia", tamanho_embalagem: 0.9, unidade_comercial: "garrafa" },
      { id: PICANHA_B, unidade_id: B, nome: "Picanha", unidade_medida: "kg", departamento: "cozinha", categoria: "Carnes", tamanho_embalagem: 1 },
    ],
    estoques: [
      { id: EST_COZINHA, unidade_id: A, nome: "Cozinha", status: "ativo" },
      { id: EST_B, unidade_id: B, nome: "Cozinha B", status: "ativo" },
    ],
    estoque_itens: [
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: PICANHA, quantidade_atual: 12.5, estoque_minimo: 5, validade: somarDias(HOJE, 2) },
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: CAMARAO, quantidade_atual: 7.8, estoque_minimo: 2, validade: somarDias(HOJE, -1) },
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: OLEO, quantidade_atual: 10, estoque_minimo: 3, validade: null },
      { unidade_id: B, estoque_id: EST_B, insumo_id: PICANHA_B, quantidade_atual: 999999, estoque_minimo: 1 },
    ],
    estoque_lotes: [
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: PICANHA, validade: somarDias(HOJE, 2), quantidade: 4.5 },
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: PICANHA, validade: somarDias(HOJE, 20), quantidade: 8 },
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: CAMARAO, validade: somarDias(HOJE, -1), quantidade: 7.8 },
      { unidade_id: A, estoque_id: EST_COZINHA, insumo_id: OLEO, validade: null, quantidade: 9 }, // soma 9 ≠ saldo 10 → integridade
      { unidade_id: B, estoque_id: EST_B, insumo_id: PICANHA_B, validade: HOJE, quantidade: 999999 },
    ],
    estoque_custos: [
      { unidade_id: A, insumo_id: PICANHA, custo_medio_base: 0.0689 },  // R$ 68,90/kg
      { unidade_id: A, insumo_id: CAMARAO, custo_medio_base: 0.084 },   // R$ 84/kg
      { unidade_id: B, insumo_id: PICANHA_B, custo_medio_base: 9999 },
    ],
    fornecedores: [
      { id: FORN, unidade_id: A, nome: "Frigorífico Bom Corte" },
      { id: "f0000000-0000-4000-8000-00000000000b", unidade_id: B, nome: "Fornecedor B" },
    ],
    vw_compras: [
      { id: "c1", unidade_id: A, data_compra: "2026-09-02", data_recebimento: null, status: "confirmada", valor_itens: 640, valor_total: 640, fornecedor_id: FORN, created_at: "2026-09-02T10:00:00Z" },
      { id: "c2", unidade_id: A, data_compra: "2026-09-23", data_recebimento: null, status: "confirmada", valor_itens: 650, valor_total: 650, fornecedor_id: FORN, created_at: "2026-09-23T10:00:00Z" },
      { id: "c3", unidade_id: A, data_compra: "2026-10-06", data_recebimento: null, status: "confirmada", valor_itens: 704.8, valor_total: 714.8, fornecedor_id: FORN, created_at: "2026-10-06T10:00:00Z" },
      { id: "c4", unidade_id: A, data_compra: "2026-10-06", data_recebimento: null, status: "rascunho", valor_itens: 100, valor_total: 100, fornecedor_id: FORN, created_at: "2026-10-06T11:00:00Z" },
      { id: "c5", unidade_id: A, data_compra: "2026-09-29", data_recebimento: null, status: "confirmada", valor_itens: 500, valor_total: 500, fornecedor_id: FORN, created_at: "2026-09-29T11:00:00Z" },
      { id: "cb", unidade_id: B, data_compra: "2026-10-06", data_recebimento: null, status: "confirmada", valor_itens: 999999, valor_total: 999999, fornecedor_id: null, created_at: "2026-10-06T10:00:00Z" },
    ],
    compras_itens: [
      { id: "i1", unidade_id: A, compra_id: "c1", insumo_id: PICANHA, quantidade_embalagens: 10, conteudo_por_embalagem: 1000, quantidade_base: 10000, unidade_base: "g", valor_total: 640 },
      { id: "i2", unidade_id: A, compra_id: "c2", insumo_id: PICANHA, quantidade_embalagens: 10, conteudo_por_embalagem: 1000, quantidade_base: 10000, unidade_base: "g", valor_total: 650 },
      { id: "i3", unidade_id: A, compra_id: "c3", insumo_id: PICANHA, quantidade_embalagens: 10, conteudo_por_embalagem: 1000, quantidade_base: 10000, unidade_base: "g", valor_total: 704.8 },
      { id: "i5", unidade_id: A, compra_id: "c5", insumo_id: CAMARAO, quantidade_embalagens: 5, conteudo_por_embalagem: 1000, quantidade_base: 5000, unidade_base: "g", valor_total: 500 },
      { id: "ib", unidade_id: B, compra_id: "cb", insumo_id: PICANHA_B, quantidade_embalagens: 1, conteudo_por_embalagem: 1000, quantidade_base: 1000, unidade_base: "g", valor_total: 999999 },
    ],
    estoque_contagens: [
      { id: "k1", unidade_id: A, tipo: "intermediaria", data_referencia: "2026-10-05", status: "fechada", estoque_id: null, fechada_em: "2026-10-05T11:00:00Z" },
    ],
    estoque_contagens_itens: [
      { unidade_id: A, contagem_id: "k1", insumo_id: CAMARAO, estoque_id: EST_COZINHA, quantidade_contada: 7800, quantidade_sistema: 11400, unidade_base: "g", custo_unitario: 0.084, diferenca: -3600, valor_total: 655.2 },
      { unidade_id: A, contagem_id: "k1", insumo_id: PICANHA, estoque_id: EST_COZINHA, quantidade_contada: 12500, quantidade_sistema: 12600, unidade_base: "g", custo_unitario: 0.0689, diferenca: -100, valor_total: 861.25 },
    ],
    vw_fin_contas_pagar: [
      { id: "p1", unidade_id: A, descricao: "Energia", fornecedor_id: null, saldo: 820.5, valor_original: 820.5, data_vencimento: somarDias(HOJE, -2), situacao: "vencido", vencida: true },
      { id: "p2", unidade_id: A, descricao: "Frigorífico", fornecedor_id: FORN, saldo: 714.8, valor_original: 714.8, data_vencimento: somarDias(HOJE, 1), situacao: "pendente", vencida: false },
      { id: "p3", unidade_id: A, descricao: "Aluguel", fornecedor_id: null, saldo: 5000, valor_original: 5000, data_vencimento: somarDias(HOJE, 25), situacao: "pendente", vencida: false },
      { id: "pb", unidade_id: B, descricao: "B", fornecedor_id: null, saldo: 999999, valor_original: 999999, data_vencimento: HOJE, situacao: "pendente", vencida: false },
    ],
    colaboradores: [
      { id: "co1", unidade_id: A, salario: 2500, vale_alimentacao: 300, tipo_contrato: "CLT", status: "ativo" },
      { id: "co2", unidade_id: A, salario: 2200, vale_alimentacao: 300, tipo_contrato: "CLT", status: "ativo" },
      { id: "co3", unidade_id: A, salario: 150, tipo_contrato: "Freelancer", status: "ativo" },
      { id: "cob", unidade_id: B, salario: 999999, tipo_contrato: "CLT", status: "ativo" },
    ],
    rh_recibos_prestacao: [
      { unidade_id: A, valor_total: 180, data_trabalho: "2026-10-03", data_pagamento: "2026-10-03", pagamento_realizado: true },
      { unidade_id: A, valor_total: 180, data_trabalho: "2026-10-06", data_pagamento: null, pagamento_realizado: false },
    ],
    estoque_movimentacoes_multi: [
      { id: "m1", unidade_id: A, insumo_id: PICANHA, tipo: "saida", motivo: "perda", quantidade: 1.2, valor_total: 82.68, unidade_medida: "kg", data_movimento: "2026-10-06T15:00:00Z" },
      { id: "m2", unidade_id: A, insumo_id: CAMARAO, tipo: "saida", motivo: "vencimento", quantidade: 0.5, valor_total: 42, unidade_medida: "kg", data_movimento: "2026-10-05T15:00:00Z" },
      { id: "mb", unidade_id: B, insumo_id: PICANHA_B, tipo: "saida", motivo: "perda", quantidade: 1, valor_total: 999999, unidade_medida: "kg", data_movimento: "2026-10-06T15:00:00Z" },
    ],
    etiquetas: [
      { unidade_id: A, codigo: "ET1", produto: "Molho branco", validade_em: `${somarDias(HOJE, 1)}T12:00:00Z`, quantidade: 2, unidade: "L", status: "ativa" },
    ],
    fin_categorias: [],
  };
}
