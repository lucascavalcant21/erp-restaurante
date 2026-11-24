// Início dos eventos no modelo do Delivery (pedido do dono, 24/11/2026:
// "deixe o evento rápido e prático como o do delivery", "é visual também").
// Funções puras: o que acontece hoje, o que vem pela frente, os orçamentos
// em aberto e o que falta receber. Só números que estão no evento (REAL);
// sem valor, a tela mostra "—", nunca zero inventado.

import { faseDaEtapa, normalizarEtapa } from "./evento-financeiro.mjs";

const dia = (e) => String(e?.data_evento || "").slice(0, 10);
const valorDe = (e) => Number(e?.valor_contratado) || 0;
const recebidoDe = (e) => (Array.isArray(e?.historico_pagamentos) ? e.historico_pagamentos : [])
  .reduce((t, p) => t + (Number(p?.valor) || 0), 0);

/** Soma dias a uma data ISO (yyyy-mm-dd), sem fuso. */
export function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "SÁB", "29", "NOV" para o bloco de data do cartão. */
export function blocoDaData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
  const mes = d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
  return { semana, dia: String(d.getUTCDate()), mes };
}

/** "Hoje", "Amanhã", "Em 5 dias" ou "Há 2 dias". */
export function quandoFalta(iso, hoje) {
  if (!iso || !hoje) return "";
  const dias = Math.round((new Date(`${iso}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias > 1) return `Em ${dias} dias`;
  if (dias === -1) return "Ontem";
  return `Há ${-dias} dias`;
}

/**
 * Resumo do Início.
 * - hoje: eventos com data de hoje (não cancelados);
 * - proximos: próximos `dias` dias (sem hoje), confirmados ou em negociação, em ordem de data;
 * - abertos: contato + proposta (orçamentos ainda não fechados), com o valor que já tem preço;
 * - fechadosMes: fechados/confirmados com data no mês de `hoje`;
 * - aReceber: o que falta receber dos eventos fechados e ainda não finalizados.
 */
export function inicioDosEventos(eventos, hoje, { dias = 30, limite = 6 } = {}) {
  const lista = (Array.isArray(eventos) ? eventos : []).filter((e) => normalizarEtapa(e?.funil_status) !== "CANCELADO");
  const fim = somarDias(hoje, dias);
  const mes = String(hoje).slice(0, 7);
  const fase = (e) => faseDaEtapa(e?.funil_status).id;
  const porData = (a, b) => dia(a).localeCompare(dia(b));

  const doDia = lista.filter((e) => dia(e) === hoje).sort(porData);
  const futuros = lista.filter((e) => dia(e) > hoje && dia(e) <= fim && fase(e) !== "encerrados").sort(porData);
  const abertos = lista.filter((e) => fase(e) === "contato" || fase(e) === "proposta");
  const fechados = lista.filter((e) => fase(e) === "fechamento" || fase(e) === "confirmados" || normalizarEtapa(e?.funil_status) === "FINALIZADO");
  const doMes = fechados.filter((e) => dia(e).slice(0, 7) === mes);
  const pendentes = fechados.filter((e) => normalizarEtapa(e?.funil_status) !== "FINALIZADO" && valorDe(e) > 0);
  const aReceber = pendentes.reduce((t, e) => t + Math.max(0, valorDe(e) - recebidoDe(e)), 0);
  // Orçamento sem data e sem retorno há tempo: aparece para não esquecer.
  const semData = abertos.filter((e) => !dia(e)).length;
  const atrasados = lista.filter((e) => dia(e) && dia(e) < hoje && fase(e) !== "encerrados" && normalizarEtapa(e?.funil_status) !== "EVENTO").length;

  return {
    hoje: doDia,
    proximos: futuros.slice(0, limite),
    maisProximos: Math.max(0, futuros.length - limite),
    abertos: { n: abertos.length, valor: abertos.reduce((t, e) => t + valorDe(e), 0), semValor: abertos.filter((e) => !valorDe(e)).length },
    fechadosMes: { n: doMes.length, valor: doMes.reduce((t, e) => t + valorDe(e), 0) },
    aReceber: pendentes.length ? aReceber : null,
    semData,
    atrasados,
  };
}

/** Recebido e falta receber de um evento (para o cartão). */
export function pagamentoDoEvento(e) {
  const valor = valorDe(e);
  const recebido = recebidoDe(e);
  return { valor, recebido, falta: valor > 0 ? Math.max(0, valor - recebido) : null, quitado: valor > 0 && recebido >= valor };
}
