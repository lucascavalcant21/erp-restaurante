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
    fixosContasMes: somar(filhos.filter((f) => !ehEquipe(f))),
    vendidasMes: r2((mesApurado?.vendas || []).reduce((t, v) => t + numero(v.quantidade), 0)),
  };
}

/**
 * Quanto a equipe e os custos fixos pesam em cada marmita. O que o dono digita
 * em Configurações vale sobre o que veio do sistema; o volume digitado vale
 * sobre as vendas do mês. ESTIMATIVA.
 */
export function custosEmbutidos({ cmoMes = 0, fixosContasMes = 0, vendidasMes = 0, config = {} } = {}) {
  const r = config?.rateio || {};
  const marmitasMes = numero(r.marmitas_mes) > 0 ? numero(r.marmitas_mes) : numero(vendidasMes) > 0 ? numero(vendidasMes) : null;
  const equipe = preenchido(r.cmo_mes) ? numero(r.cmo_mes) : numero(cmoMes) > 0 ? numero(cmoMes) : null;
  const fixos = preenchido(r.fixos_mes) ? numero(r.fixos_mes) : numero(fixosContasMes) > 0 ? numero(fixosContasMes) : null;
  const porMarmita = (v) => (v === null || marmitasMes === null ? null : r2(v / marmitasMes));
  const cmoPorMarmita = porMarmita(equipe);
  const fixosPorMarmita = porMarmita(fixos);
  const faltando = [];
  if (marmitasMes === null) faltando.push("marmitas por mês");
  if (equipe === null) faltando.push("equipe");
  if (fixos === null) faltando.push("custos fixos");
  return {
    marmitasMes, cmoMes: equipe, fixosMes: fixos, cmoPorMarmita, fixosPorMarmita,
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
