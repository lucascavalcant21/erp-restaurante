// CARDÁPIO DA MARMITARIA (pedido do dono, 05/11/2026): a Ficha técnica mostra
// só o custo; o Cardápio forma o preço e mostra o que sobra. A equipe (CMO) e
// os custos fixos entram em cada marmita pela conta do mês ÷ marmitas por mês
// (ESTIMATIVA). Sem base, o valor fica null e a tela diz o que falta: nada é
// presumido. Funções puras (testes em cardapio.test.mjs).

import { MODELOS_CANAL, PLATAFORMAS_PADRAO, normalizarCanal, r2 } from "./nucleo.mjs";

export const CATEGORIAS_FICHA = ["Marmitas de frango", "Marmitas de carne", "Sobremesas", "Refrigerantes", "Sucos"];

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const preenchido = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const numero = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim();
  const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(x) ? x : 0;
};

/** Em que parte de um combo o item entra, pela categoria da ficha. */
export function grupoDaCategoria(categoria) {
  const c = semAcento(categoria);
  if (/refrigerante|suco|bebida|agua/.test(c)) return "bebida";
  if (/sobremesa|doce/.test(c)) return "sobremesa";
  return "marmita";
}

/** Categorias na ordem do cardápio: as combinadas com o dono e depois as outras. */
export function ordenarCategorias(categorias = []) {
  const ordem = (c) => { const i = CATEGORIAS_FICHA.indexOf(c); return i < 0 ? CATEGORIAS_FICHA.length : i; };
  return [...new Set(categorias)].sort((a, b) => ordem(a) - ordem(b) || String(a).localeCompare(String(b), "pt-BR"));
}

/** Plataformas ligadas; sem cadastro, as quatro de sempre, ainda sem taxa. */
export function canaisDoCardapio(config) {
  const ativos = (config?.canais || []).filter((c) => c.ativo);
  return ativos.length ? ativos : MODELOS_CANAL.filter((m) => PLATAFORMAS_PADRAO.includes(m.id)).map(normalizarCanal);
}

export const ehMei = (config) => config?.rateio?.regime === "mei";

export function mesAnterior(diaIso) {
  const [a, m] = String(diaIso).split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** Tira do DRE do mês o que é equipe e o que é custo fixo. */
export function baseDosCustos(mesApurado) {
  const op = (mesApurado?.dre?.linhas || []).find((l) => l.id === "operacionais");
  const filhos = op?.filhos || [];
  const ehEquipe = (f) => /^(CMO|Pessoal)/.test(f.rotulo || "");
  const somar = (lista) => r2(lista.reduce((t, f) => t + numero(f.valor), 0));
  return {
    cmoMes: somar(filhos.filter(ehEquipe)),
    cmoLinhas: (mesApurado?.cmo?.linhas || []).filter((l) => numero(l.marmitaria) > 0).map((l) => ({ nome: l.nome, valor: numero(l.marmitaria) })),
    fixosContasMes: somar(filhos.filter((f) => !ehEquipe(f))),
    vendidasMes: r2((mesApurado?.vendas || []).reduce((t, v) => t + numero(v.quantidade), 0)),
  };
}

/**
 * Quanto a equipe e os custos fixos pesam em cada marmita. O que o dono digita
 * em Configurações vale sobre o que veio do sistema; o volume digitado vale
 * sobre as vendas do mês. ESTIMATIVA.
 */
export function custosEmbutidos({ cmoMes = 0, cmoLinhas = [], fixosContasMes = 0, vendidasMes = 0, config = {} } = {}) {
  const r = config?.rateio || {};
  const mapa = (Array.isArray(r.custos_fixos) ? r.custos_fixos : []).filter((c) => String(c?.nome || "").trim() && numero(c?.valor) > 0).map((c) => ({ nome: String(c.nome).trim(), valor: numero(c.valor) }));
  const marmitasMes = numero(r.marmitas_mes) > 0 ? numero(r.marmitas_mes) : numero(vendidasMes) > 0 ? numero(vendidasMes) : null;
  const equipe = preenchido(r.cmo_mes) ? numero(r.cmo_mes) : numero(cmoMes) > 0 ? numero(cmoMes) : null;
  // O que o dono mapeou em Configurações manda; sem mapa, valem as contas do mês.
  const fixos = mapa.length ? r2(mapa.reduce((t, c) => t + c.valor, 0)) : preenchido(r.fixos_mes) ? numero(r.fixos_mes) : numero(fixosContasMes) > 0 ? numero(fixosContasMes) : null;
  const porMarmita = (v) => (v === null || marmitasMes === null ? null : r2(v / marmitasMes));
  const cmoPorMarmita = porMarmita(equipe);
  const fixosPorMarmita = porMarmita(fixos);
  const faltando = [];
  if (marmitasMes === null) faltando.push("marmitas por mês");
  if (equipe === null) faltando.push("equipe");
  if (fixos === null) faltando.push("custos fixos");
  return {
    marmitasMes, cmoMes: equipe, fixosMes: fixos, fixosLinhas: mapa, cmoLinhas: preenchido(r.cmo_mes) ? [] : cmoLinhas, cmoPorMarmita, fixosPorMarmita,
    totalPorMarmita: cmoPorMarmita === null && fixosPorMarmita === null ? null : r2((cmoPorMarmita || 0) + (fixosPorMarmita || 0)),
    faltando, completo: faltando.length === 0,
  };
}

/** O nome do número diz o que ainda não foi descontado dele. */
export function rotuloDoLucro(embutidos) {
  if (embutidos?.completo) return "Lucro";
  if (!embutidos || embutidos.marmitasMes === null) return "Lucro antes da equipe e dos custos fixos";
  return `Lucro antes de ${embutidos.faltando.join(" e ")}`;
}

export const markupEmPct = (markup) => (markup == null ? null : r2((numero(markup) - 1) * 100));

const pedacos = (lista, total, valorPedido) => (total > 0 ? lista.map((l) => ({ rotulo: l.nome, valor: r2((l.valor / total) * valorPedido) })) : []);

/**
 * Do que o cliente paga, quanto vai para cada coisa. Cada linha abre o detalhe:
 * CMO por funcionário, custos fixos por conta, taxas por tipo.
 * custoFicha: { embalagens } de 1 unidade, quando a linha é um item da ficha.
 */
export function composicaoDoPreco({ linha, custoFicha = null, embutidos = null }) {
  const r = linha?.sim?.com;
  if (!r?.valido || r.custo == null) return null;
  const base = r.preco;
  const emb = custoFicha ? r2(numero(custoFicha.embalagens) * (r.pedido?.unidades || 1)) : 0;
  const pct = (v) => (base > 0 ? r2((v / base) * 100) : null);
  const taxas = [["Comissão da plataforma", r.comissao], ["Maquininha e pagamento", r.taxaPagamento], ["Taxa fixa", r.taxaFixa], ["Entrega", r.entrega]].filter(([, v]) => v > 0).map(([rotulo, valor]) => ({ rotulo, valor }));
  const brutas = [
    { id: "cmv", rotulo: "CMV", valor: r2(r.custo - emb) },
    { id: "embalagens", rotulo: "Embalagens", valor: emb },
    { id: "cmo", rotulo: "CMO (equipe)", valor: r.cmo, filhos: pedacos(embutidos?.cmoLinhas || [], embutidos?.cmoMes, r.cmo || 0) },
    { id: "fixos", rotulo: "Custos fixos", valor: r.fixos, filhos: pedacos(embutidos?.fixosLinhas || [], embutidos?.fixosMes, r.fixos || 0) },
    { id: "taxas", rotulo: "Taxas e entrega", valor: r2(r.variaveis), filhos: taxas },
    { id: "impostos", rotulo: "Impostos", valor: r.tributos },
    { id: "promocao", rotulo: "Promoção", valor: r.promocao },
    { id: "lucro", rotulo: "Lucro", valor: r.lucro },
  ];
  const linhas = brutas.filter((l) => l.id === "lucro" || l.valor > 0).map((l) => ({
    ...l, pct: pct(l.valor), filhos: (l.filhos || []).map((f) => ({ ...f, pct: pct(f.valor) })),
  }));
  return { preco: base, markupPct: markupEmPct(r.markup), linhas };
}
