// CMO — CUSTO DE MÃO DE OBRA
// Não é digitado: sai do RH (salário dos contratados) e do módulo de Extras
// (diárias já pagas em recibo). Contratado é custo do mês inteiro; extra é
// custo do dia em que trabalhou.

import { faixaCompras, isoData } from "./compras.mjs";

const naoEhExtra = (c) => String(c?.tipo_contrato || "") !== "Freelancer";
const ativo = (c) => (c?.status || "ativo") !== "inativo" && c?.ativo !== false;

// Folha dos contratados: salário + vale-alimentação, quando houver.
export function folhaDoMes(colaboradores = []) {
  return (colaboradores || [])
    .filter(c => c && naoEhExtra(c) && ativo(c))
    .reduce((soma, c) => soma + (Number(c.salario) || 0) + (Number(c.vale_alimentacao) || 0), 0);
}

// Diárias dos extras no período: só recibo pago conta como custo realizado.
export function diariasNoPeriodo(recibos = [], referencia = new Date(), modo = "mes") {
  const faixa = faixaCompras(referencia, modo);
  const de = isoData(faixa.de), ate = isoData(faixa.ate);
  const doPeriodo = (recibos || []).filter(r => {
    const d = String(r?.data_pagamento || r?.data_trabalho || "").slice(0, 10);
    return d >= de && d <= ate;
  });
  const pagos = doPeriodo.filter(r => r.pagamento_realizado);
  return {
    total: pagos.reduce((s, r) => s + (Number(r.valor_total) || 0), 0),
    aberto: doPeriodo.filter(r => !r.pagamento_realizado).reduce((s, r) => s + (Number(r.valor_total) || 0), 0),
    recibos: pagos.length,
  };
}

// O CMO do período: folha (proporcional quando o recorte é menor que o mês)
// mais as diárias efetivamente pagas.
export function calcularCMO({ colaboradores = [], recibos = [], referencia = new Date(), modo = "mes" }) {
  const folhaMes = folhaDoMes(colaboradores);
  const faixa = faixaCompras(referencia, modo);
  const diasNoMes = new Date(faixa.de.getFullYear(), faixa.de.getMonth() + 1, 0).getDate();
  const diasDoRecorte = Math.max(1, Math.round((faixa.ate - faixa.de) / 86400000) + 1);
  const folha = modo === "mes" ? folhaMes : (folhaMes / diasNoMes) * diasDoRecorte;
  const extras = diariasNoPeriodo(recibos, referencia, modo);
  return {
    folha,
    folhaMes,
    extras: extras.total,
    extrasEmAberto: extras.aberto,
    recibos: extras.recibos,
    total: folha + extras.total,
  };
}

// Quanto o CMO representa do faturamento.
export function pesoDoCMO(cmoTotal, faturamento) {
  const f = Number(faturamento) || 0;
  if (f <= 0) return null;
  return ((Number(cmoTotal) || 0) / f) * 100;
}
