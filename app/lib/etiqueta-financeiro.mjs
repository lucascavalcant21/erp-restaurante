// FILA DE PERDAS → CONTAS A PAGAR
//
// A RPC etiqueta_perda tira a comida do estoque e, na MESMA transação, deixa
// uma linha em etiqueta_financeiro_pendente. Este módulo é quem transforma
// essas linhas em lançamento no financeiro.
//
// Por que não inserir contas_pagar direto na RPC: o lançamento tem regras que
// não pertencem a uma função de estoque (categoria, competência, o RLS do
// financeiro, e amanhã centro de custo). E por que não deixar como estava, com
// o app inserindo logo depois da baixa: porque entre uma chamada e outra a rede
// cai, e aí a comida sumia do estoque sem o prejuízo aparecer no DRE.
//
// Funções puras aqui; o acesso ao Supabase fica em etiqueta-financeiro.js.

export const CATEGORIA_PERDA = "inventarios";

// Uma pendência da fila → a linha de contas_pagar correspondente.
//
// A perda já aconteceu e o dinheiro já foi gasto lá atrás, quando o produto foi
// comprado: por isso entra como paga, na competência do dia da perda, e não
// como uma dívida a vencer.
export function contaPagarDaPendencia(pendencia = {}) {
  const valor = Number(pendencia.valor) || 0;
  if (!(valor > 0)) return null;
  const dia = String(pendencia.competencia || "").slice(0, 10) || hoje();
  return {
    unidade_id: pendencia.unidade_id,
    descricao: String(pendencia.descricao || "Perda registrada por etiqueta").trim(),
    valor,
    data_vencimento: dia,
    data_pagamento: dia,
    categoria: CATEGORIA_PERDA,
    status: "pago",
  };
}

export function hoje(agora = new Date()) {
  return agora.toISOString().slice(0, 10);
}

// Resumo do que a fila fez, para a tela e para o log dizerem a verdade em vez
// de "ok".
export function resumoDoProcessamento(resultados = []) {
  const lancados = resultados.filter((r) => r.status === "lancado");
  const falhas = resultados.filter((r) => r.status === "erro");
  const dispensados = resultados.filter((r) => r.status === "dispensado");
  return {
    total: resultados.length,
    lancados: lancados.length,
    dispensados: dispensados.length,
    falhas: falhas.length,
    valorLancado: Math.round(lancados.reduce((s, r) => s + (Number(r.valor) || 0), 0) * 100) / 100,
    erros: falhas.map((r) => r.erro).filter(Boolean),
  };
}
