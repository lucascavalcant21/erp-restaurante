// CALENDÁRIO DOS EVENTOS (pedido do dono, 21/11/2026): vários eventos
// separados por categoria, num calendário que mostra o dia do evento, o dia de
// cada pagamento (parcial ou integral), quando vence o restante e se atrasou.
// Funções puras. O valor do evento é o do orçamento (receita) ou, sem ele, o
// valor contratado; o recebido é a soma de historico_pagamentos.

export const CATEGORIAS_EVENTO = [
  "Casamento", "Aniversário", "Aniversário infantil", "Corporativo", "Formatura",
  "Batizado e comunhão", "Chá (bebê, revelação, panela)", "Confraternização", "Outro",
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pos = (v) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const isoOk = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || ""));
const dia = (s) => String(s).slice(0, 10);
export function somarDias(iso, n) {
  const d = new Date(`${dia(iso)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diasEntre = (a, b) => Math.round((new Date(`${dia(b)}T12:00:00Z`) - new Date(`${dia(a)}T12:00:00Z`)) / 86400000);

/** Vencimento padrão do restante: X dias antes do evento (condição da proposta). */
export function vencimentoPadrao(dataEvento, restanteDias) {
  if (!isoOk(dataEvento)) return null;
  return somarDias(dataEvento, -Math.max(0, Math.round(Number(restanteDias) || 0)));
}

/**
 * Situação do pagamento de um evento.
 * estado: "sem_valor" | "nada" (nada pago) | "parcial" | "pago"
 */
export function situacaoDoPagamento({ total, pagamentos = [], vencimentoRestante = null, dataEvento = null, restanteDias = null, hojeIso }) {
  const lista = (Array.isArray(pagamentos) ? pagamentos : []).filter((p) => pos(p.valor) > 0);
  const recebido = r2(lista.reduce((t, p) => t + pos(p.valor), 0));
  const t = r2(pos(total));
  const datas = lista.map((p) => (isoOk(p.data) ? dia(p.data) : null)).filter(Boolean).sort();
  const base = { total: t, recebido, primeiraData: datas[0] || null, ultimaData: datas[datas.length - 1] || null, pagamentos: lista.length };
  if (!(t > 0)) return { ...base, estado: "sem_valor", falta: null, vencimento: null, atrasado: false, diasAtraso: 0 };
  const falta = r2(Math.max(0, t - recebido));
  if (falta <= 0.009) return { ...base, estado: "pago", falta: 0, vencimento: null, atrasado: false, diasAtraso: 0 };
  const vencimento = isoOk(vencimentoRestante) ? dia(vencimentoRestante) : vencimentoPadrao(dataEvento, restanteDias);
  const atraso = vencimento && isoOk(hojeIso) ? diasEntre(vencimento, hojeIso) : 0;
  return { ...base, estado: recebido > 0 ? "parcial" : "nada", falta, vencimento, atrasado: atraso > 0, diasAtraso: Math.max(0, atraso), venceEm: vencimento && atraso <= 0 ? -atraso : null };
}

/**
 * Linha do banco (eventos) → item do calendário.
 * Lê categoria e vencimento de operacao_detalhes.orcamento (JSON do orçamento).
 */
export function eventoDoCalendario(e, { hojeIso, restanteDias = null } = {}) {
  const orc = e?.operacao_detalhes?.orcamento || {};
  const total = pos(e?.operacao_detalhes?.resumo?.receita) || pos(e?.valor_contratado);
  const data = isoOk(e?.data_evento) ? dia(e.data_evento) : null;
  return {
    id: e.id,
    nome: e.nome || orc?.cliente?.nome_evento || e.cliente_nome || "Evento",
    cliente: e.cliente_nome || orc?.cliente?.cliente_nome || "",
    categoria: String(orc?.cliente?.categoria || "").trim() || "Sem categoria",
    data,
    hora: String(e.hora_inicio || orc?.cliente?.hora_inicio || "").slice(0, 5),
    pessoas: Number(e.capacidade) || Number(orc?.cliente?.convidados) || null,
    etapa: e.funil_status || null,
    pagamentosLista: Array.isArray(e.historico_pagamentos) ? e.historico_pagamentos : [],
    pagamento: situacaoDoPagamento({ total, pagamentos: e.historico_pagamentos, vencimentoRestante: orc?.financeiro?.vencimento_restante, dataEvento: data, restanteDias, hojeIso }),
  };
}

/**
 * Marcas de cada dia: evento, pagamento recebido (parcial ou integral),
 * vencimento do restante (a vencer ou atrasado).
 */
export function marcasDosEventos(eventos = []) {
  const m = new Map();
  const add = (d, x) => { if (!isoOk(d)) return; const k = dia(d); if (!m.has(k)) m.set(k, []); m.get(k).push(x); };
  for (const ev of eventos) {
    if (ev.data) add(ev.data, { tipo: "evento", ev });
    // pagamentos na ordem: o que fecha o total é "integral" (ou "quitação")
    let acumulado = 0;
    const ordenados = [...ev.pagamentosLista].filter((p) => pos(p.valor) > 0 && isoOk(p.data)).sort((a, b) => dia(a.data).localeCompare(dia(b.data)));
    for (const p of ordenados) {
      acumulado = r2(acumulado + pos(p.valor));
      const fecha = ev.pagamento.total > 0 && acumulado >= ev.pagamento.total - 0.009;
      const tipoPag = fecha ? (ordenados.length === 1 ? "integral" : "quitacao") : "parcial";
      add(p.data, { tipo: "pagamento", ev, valor: r2(pos(p.valor)), tipoPag, metodo: p.metodo || "" });
    }
    if ((ev.pagamento.estado === "parcial" || ev.pagamento.estado === "nada") && ev.pagamento.vencimento) {
      add(ev.pagamento.vencimento, { tipo: "vencimento", ev, valor: ev.pagamento.falta, atrasado: ev.pagamento.atrasado });
    }
  }
  return m;
}

/** Semanas do mês (domingo a sábado) com o ISO de cada dia; fora do mês = null. */
export function semanasDoMes(mes) {
  const [a, mm] = String(mes).split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, mm - 1, 1));
  const dias = new Date(Date.UTC(a, mm, 0)).getUTCDate();
  const celulas = Array(primeiro.getUTCDay()).fill(null);
  for (let d = 1; d <= dias; d++) celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (celulas.length % 7) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** Contas a receber dos eventos: atrasados primeiro, depois por vencimento. */
export function recebimentosDosEventos(eventos = []) {
  const abertos = eventos.filter((e) => e.pagamento.estado === "parcial" || e.pagamento.estado === "nada");
  const atrasados = abertos.filter((e) => e.pagamento.atrasado).sort((a, b) => b.pagamento.diasAtraso - a.pagamento.diasAtraso);
  const aVencer = abertos.filter((e) => !e.pagamento.atrasado).sort((a, b) => String(a.pagamento.vencimento || "9999").localeCompare(String(b.pagamento.vencimento || "9999")));
  return {
    atrasados, aVencer,
    totalAtrasado: r2(atrasados.reduce((t, e) => t + e.pagamento.falta, 0)),
    totalAReceber: r2(abertos.reduce((t, e) => t + e.pagamento.falta, 0)),
  };
}
