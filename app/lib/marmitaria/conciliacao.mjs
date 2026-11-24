// CONCILIAÇÃO DA FATURA DO APP (especificação do dono, 21/11/2026, item F):
// importar a planilha de faturamento do app (99Food, iFood, Keeta), conferir
// pedido por pedido e mostrar a diferença entre a taxa do contrato e a taxa
// que o app cobrou de verdade.
//
// Os pedidos viram vendas (marmitaria_vendas, fonte "importacao", referência
// "fatura:<app>:<pedido>"): entram no DRE como receita REAL, não se repetem
// numa segunda importação e não podem ser editados (valor histórico imutável).
// Funções puras (testes em conciliacao.test.mjs).

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const r2 = (n) => Math.round(n * 100) / 100;

/** "1.234,56", "1234.56", "R$ 12,00", "-3,50", "(3,50)" → número; vazio → null. */
export function numeroDaPlanilha(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^r\$\s*/i, ""));
  s = s.replace(/[()\sR$r]/g, "").replace(/^-/, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || !/[0-9]/.test(s)) return null;
  return negativo ? -n : n;
}

/** "21/11/2026", "21/11/26 14:30", "2026-11-21T…", número de série do Excel → "2026-11-21". */
export function dataDaPlanilha(v) {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mes = m[2].padStart(2, "0"), dia = m[1].padStart(2, "0");
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(dia) >= 1 && Number(dia) <= 31) return `${ano}-${mes}-${dia}`;
  }
  return null;
}

/** CSV com ; ou , (detecta), aspas e quebras de linha dentro de aspas. Devolve linhas (arrays de texto). */
export function lerCsv(texto) {
  const t = String(texto ?? "").replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/).find((l) => l.trim()) || "";
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length && primeira.includes(";") ? ";" : primeira.includes("\t") && !primeira.includes(",") ? "\t" : ",";
  const linhas = [];
  let linha = [], campo = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

// Campos que a conciliação usa, com as palavras que costumam aparecer no cabeçalho.
export const CAMPOS = [
  { id: "pedido", rotulo: "Número do pedido", palavras: ["pedido", "order", "id do pedido", "codigo", "numero"] },
  { id: "data", rotulo: "Data", palavras: ["data", "date", "dia", "criado"] },
  { id: "bruto", rotulo: "Valor do pedido (ganhos)", palavras: ["ganhos", "valor do pedido", "valor bruto", "bruto", "total do pedido", "subtotal", "valor dos itens", "total"] },
  { id: "ofertas", rotulo: "Ofertas pagas pela loja", palavras: ["oferta", "promocao loja", "desconto loja", "promocao", "cupom", "desconto"] },
  { id: "taxas", rotulo: "Taxas do app", palavras: ["taxa", "comissao", "tarifa"] },
  { id: "liquido", rotulo: "Líquido (repasse)", palavras: ["liquido", "repasse", "a receber", "valor recebido", "cobranca liquida", "net"] },
  { id: "itens", rotulo: "Quantidade de itens", palavras: ["quantidade", "qtd", "itens"] },
];

/** Acha a linha de cabeçalho (a primeira com 2+ palavras conhecidas) e sugere a coluna de cada campo. */
export function detectarColunas(linhas = []) {
  const pontua = (l) => l.filter((c) => CAMPOS.some((f) => f.palavras.some((p) => semAcento(c).includes(p)))).length;
  let iCab = linhas.findIndex((l) => pontua(l) >= 2);
  if (iCab < 0) iCab = 0;
  const cab = (linhas[iCab] || []).map(semAcento);
  const usadas = new Set();
  const mapa = {};
  // ordem importa: "liquido" e "taxas" antes de "total"/"desconto" genéricos
  for (const id of ["pedido", "data", "liquido", "taxas", "ofertas", "bruto", "itens"]) {
    const f = CAMPOS.find((x) => x.id === id);
    let achou = -1;
    for (const p of f.palavras) {
      achou = cab.findIndex((c, i) => !usadas.has(i) && c.includes(p));
      if (achou >= 0) break;
    }
    if (achou >= 0) { mapa[id] = achou; usadas.add(achou); }
  }
  return { linhaCabecalho: iCab, cabecalho: linhas[iCab] || [], mapa };
}

/** Linhas da planilha → pedidos normalizados. Linha sem número de pedido ou sem valor fica de fora (total, rodapé…). */
export function pedidosDaPlanilha(linhas = [], { linhaCabecalho = 0, mapa = {} } = {}) {
  const pegar = (l, id) => (mapa[id] == null ? null : l[mapa[id]]);
  const pedidos = [];
  const ignoradas = [];
  const vistos = new Set();
  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const l = linhas[i];
    const pedido = String(pegar(l, "pedido") ?? "").trim();
    const bruto = numeroDaPlanilha(pegar(l, "bruto"));
    if (!pedido || bruto == null) { ignoradas.push(i + 1); continue; }
    if (/^total/i.test(semAcento(pedido))) { ignoradas.push(i + 1); continue; }
    const chave = pedido.toLowerCase();
    if (vistos.has(chave)) { ignoradas.push(i + 1); continue; }
    vistos.add(chave);
    const abs = (v) => (v == null ? null : Math.abs(v));
    pedidos.push({
      linha: i + 1, pedido, data: dataDaPlanilha(pegar(l, "data")),
      bruto: r2(Math.abs(bruto)), ofertas: abs(numeroDaPlanilha(pegar(l, "ofertas"))), taxas: abs(numeroDaPlanilha(pegar(l, "taxas"))),
      liquido: numeroDaPlanilha(pegar(l, "liquido")), itens: (() => { const q = numeroDaPlanilha(pegar(l, "itens")); return q > 0 ? Math.round(q) : null; })(),
    });
  }
  return { pedidos, ignoradas };
}

/**
 * Confere pedido por pedido: taxa efetiva × contrato, e se bruto − ofertas −
 * taxas bate com o líquido. contratoPct = comissão + pagamento do canal (%).
 * tolerancia em pontos percentuais.
 */
export function conciliar(pedidos = [], { contratoPct = null, tolerancia = 1 } = {}) {
  const linhas = pedidos.map((p) => {
    const ofertas = p.ofertas ?? 0;
    const taxas = p.taxas;
    const liquidoCalc = taxas == null ? null : r2(p.bruto - ofertas - taxas);
    const taxaPct = taxas == null || !(p.bruto > 0) ? null : r2((taxas / p.bruto) * 100);
    const problemas = [];
    if (p.liquido != null && liquidoCalc != null && Math.abs(p.liquido - liquidoCalc) > 0.02) problemas.push(`O líquido da fatura (${p.liquido.toFixed(2)}) não bate com valor − ofertas − taxas (${liquidoCalc.toFixed(2)}).`);
    if (taxaPct != null && contratoPct != null && taxaPct - contratoPct > tolerancia) problemas.push(`Taxa de ${taxaPct}%, acima dos ${contratoPct}% do contrato.`);
    if (!p.data) problemas.push("Sem data.");
    return { ...p, ofertas, liquidoCalc, taxaPct, esperadoContrato: contratoPct == null ? null : r2(p.bruto * contratoPct / 100), problemas };
  });
  const soma = (f) => r2(linhas.reduce((t, l) => t + (Number(l[f]) || 0), 0));
  const total = { pedidos: linhas.length, bruto: soma("bruto"), ofertas: soma("ofertas"), taxas: soma("taxas"), liquido: linhas.every((l) => l.liquido != null) ? soma("liquido") : r2(soma("bruto") - soma("ofertas") - soma("taxas")) };
  const pct = (v) => (total.bruto > 0 ? Math.round((v / total.bruto) * 1e6) / 1e4 : null);
  const datas = linhas.map((l) => l.data).filter(Boolean).sort();
  return {
    linhas, total,
    taxasPct: pct(total.taxas), ofertasPct: pct(total.ofertas), totalPct: pct(total.taxas + total.ofertas),
    esperadoContrato: contratoPct == null ? null : r2(total.bruto * contratoPct / 100),
    diferencaContrato: contratoPct == null ? null : r2(total.taxas - total.bruto * contratoPct / 100),
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    comProblema: linhas.filter((l) => l.problemas.length).length,
  };
}

/**
 * Pedidos conciliados → linhas de marmitaria_vendas. Taxas da fatura vão em
 * "comissao" (o app não separa comissão e pagamento), ofertas da loja em
 * "promocoes". Quantidade: a da planilha, ou 1 por pedido (e a observação diz).
 */
export function vendasDaFatura(linhas = [], { canal, jaImportadas = new Set() } = {}) {
  const ref = (p) => `fatura:${canal}:${p.pedido}`;
  return linhas.filter((l) => l.data && !jaImportadas.has(ref(l))).map((l) => ({
    data: l.data, canal, ficha_id: null, quantidade: l.itens || 1,
    valor_bruto: l.bruto, descontos: 0, cancelamentos: 0, tributos: null,
    comissao: l.taxas ?? 0, taxa_pagamento: 0, entrega_subsidiada: 0, promocoes: l.ofertas ?? 0, outras_taxas: 0,
    repasse_liquido: l.liquido ?? l.liquidoCalc, referencia_externa: ref(l),
    observacao: `Fatura do app, pedido ${l.pedido}${l.itens ? "" : " (quantidade de itens não veio na fatura: contado 1)"}`,
  }));
}
