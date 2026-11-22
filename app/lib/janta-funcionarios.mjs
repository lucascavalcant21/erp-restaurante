// JANTA DOS FUNCIONÁRIOS (pedido do dono, 30/10/2026): "dividir por dia da
// semana, o que será servido, como fazer o cardápio do dia, todo o preparo e
// a quantidade conforme o número de pessoas — eu só ponho a base de quantas
// gramas por pessoa de cada coisa do prato do dia".
//
// Guardado em config_sistema.params.janta_funcionarios:
//   { pessoas_padrao, dias: { seg: { pessoas, pratos: [{ id, nome, preparo,
//     itens: [{ id, nome, insumo_id, g_pessoa }] }] }, … } }
//
// Quantas pessoas jantam no dia: o dono INFORMA o número de cada dia (31/10/2026:
// "não precisa puxar do RH, eu só falo quantas pessoas"); sem número no dia,
// vale o padrão. A ficha do dia muda sozinha com esse número.
// A conta é determinística: total = gramas por pessoa × pessoas. Custo só
// com produto ligado ao cadastro e com preço (senão DADOS INSUFICIENTES).

// 14/11/2026 (dono): arroz, feijão e salada são FIXOS todo dia; só a
// proteína muda. A porção é do PRODUTO PRONTO e o dono escolhe e muda quando
// quiser (arroz 150 g → 200 g; feijão já com caldo). Porção pode ser em
// gramas, em unidades (sobrecoxa 1 por pessoa, almôndega 5 por pessoa) ou em
// ml (molho). Ligado a uma ficha técnica, o item mostra a receita refeita
// para dar exatamente as porções do dia, sem sobra:
//   fator = (porção × pessoas) ÷ rendimento da ficha (na mesma medida).

import { precoNormalizadoDoInsumo } from "./ingredientes-utils.mjs";
import { pesoTotalDaFicha } from "./ficha-calculos.mjs";
import { qtdLegivel, rotuloDoFator } from "./intelligence/metrics/adaptar-receita.mjs";

export const DIAS_SEMANA = [
  { id: "seg", rotulo: "Segunda" }, { id: "ter", rotulo: "Terça" }, { id: "qua", rotulo: "Quarta" },
  { id: "qui", rotulo: "Quinta" }, { id: "sex", rotulo: "Sexta" }, { id: "sab", rotulo: "Sábado" }, { id: "dom", rotulo: "Domingo" },
];
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
export const novoIdJanta = (p = "j") => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// 22/11/2026 (dono): a salada "não é por pessoa, é o geral" (½ pé de alface,
// 1 tomate em rodelas, 1 cebola em tiras): modo "geral", com o texto da
// quantidade, que não muda com o número de pessoas.
export const MODOS_PORCAO = Object.freeze([
  { id: "g", rotulo: "g por pessoa", curto: "g" },
  { id: "un", rotulo: "unidades por pessoa", curto: "un" },
  { id: "ml", rotulo: "ml por pessoa", curto: "ml" },
  { id: "geral", rotulo: "quantidade geral (não muda)", curto: "geral" },
]);
const modoValido = (m) => (MODOS_PORCAO.some((x) => x.id === m) ? m : "g");

/** Item da janta, aceitando o formato antigo (g_pessoa). */
export function normalizarItem(i = {}) {
  const modo = modoValido(i.modo);
  const porcao = i.porcao ?? i.g_pessoa ?? "";
  return {
    id: i.id || novoIdJanta("i"), nome: String(i.nome || ""), insumo_id: i.insumo_id || null, ficha_id: i.ficha_id || null,
    modo, porcao,
    // telas antigas leem g_pessoa: continua igual quando a porção é em gramas
    g_pessoa: modo === "g" ? porcao : "",
    // modo "geral": a quantidade em texto ("½ pé de alface, 1 tomate em rodelas")
    geral: String(i.geral || ""),
    // pronto ÷ cru (macarrão: 100 g cru → 300 g pronto = 3). Sem ficha, diz
    // quanto cozinhar de cru para dar o pronto do dia (ESTIMATIVA).
    rend_cozimento: i.rend_cozimento ?? "",
  };
}

export function jantaVazia() {
  return { pessoas_padrao: "", fixos: [], dias: Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, { pessoas: "", pratos: [] }])) };
}

/** Lê o que veio do banco sem quebrar com dado velho ou incompleto. */
export function normalizarJanta(salvo) {
  const base = jantaVazia();
  if (!salvo || typeof salvo !== "object") return base;
  const dias = {};
  for (const d of DIAS_SEMANA) {
    const x = salvo.dias?.[d.id] || {};
    dias[d.id] = {
      pessoas: x.pessoas ?? "",
      pratos: (Array.isArray(x.pratos) ? x.pratos : []).map((p) => ({
        id: p.id || novoIdJanta("p"), nome: String(p.nome || ""), preparo: String(p.preparo || ""),
        itens: (Array.isArray(p.itens) ? p.itens : []).map(normalizarItem),
      })),
    };
  }
  const fixos = (Array.isArray(salvo.fixos) ? salvo.fixos : []).map(normalizarItem);
  return { pessoas_padrao: salvo.pessoas_padrao ?? "", fixos, dias };
}

export const pessoasDoDia = (janta, diaId) => n(janta?.dias?.[diaId]?.pessoas) || n(janta?.pessoas_padrao);

/** "1,2 kg" ou "720 g". */
export function rotuloPeso(g) {
  if (!(g > 0)) return "—";
  return g >= 1000 ? `${(Math.round(g / 10) / 100).toLocaleString("pt-BR")} kg` : `${Math.round(g).toLocaleString("pt-BR")} g`;
}

/** Custo de `gramas` do produto (preço por kg ou por L do cadastro; L conta 1 g = 1 ml). */
export function custoDasGramas(insumo, gramas) {
  if (!insumo || !(gramas > 0)) return null;
  const base = String(insumo.unidade_medida || "").toLowerCase();
  const preco = precoNormalizadoDoInsumo(insumo);
  if (!(preco > 0)) return null;
  if (["kg", "g", "l", "ml"].includes(base)) return r2((gramas / 1000) * preco);
  const pesoUn = n(insumo.peso_peca_g) || n(insumo.peso_medio_g);
  if (base === "un" && pesoUn) return r2((gramas / pesoUn) * preco);
  return null;
}

/** "1,2 L" ou "300 ml". */
export function rotuloVolume(ml) {
  if (!(ml > 0)) return "—";
  return ml >= 1000 ? `${(Math.round(ml / 10) / 100).toLocaleString("pt-BR")} L` : `${Math.round(ml).toLocaleString("pt-BR")} ml`;
}
export function rotuloTotal(total, modo) {
  if (modo === "un") return total > 0 ? `${Number(Math.round(total * 100) / 100).toLocaleString("pt-BR")} un` : "—";
  if (modo === "ml") return rotuloVolume(total);
  return rotuloPeso(total);
}

function custoDoItem(ins, total, modo) {
  if (!ins || !(total > 0)) return null;
  if (modo === "un") {
    const base = String(ins.unidade_medida || "").toLowerCase();
    const preco = precoNormalizadoDoInsumo(ins);
    return base === "un" && preco > 0 ? r2(total * preco) : null;
  }
  return custoDasGramas(ins, total); // g e ml (1 ml ≈ 1 g para L)
}

/**
 * Quanto a ficha rende na medida da porção. null = a ficha não diz o
 * bastante (ex.: porção em unidades e ficha em kg sem o peso de cada uma).
 */
export function rendimentoNaMedida(ficha, modo) {
  if (!ficha) return null;
  const rend = n(ficha.rendimento_porcoes);
  const un = String(ficha.rendimento_unidade || "porcao").toLowerCase();
  const pesoPorcao = n(ficha.peso_porcao_g);
  if (!rend) return null;
  if (modo === "un") {
    if (un === "un" || un === "porcao") return { valor: rend, aproximado: false };
    if (pesoPorcao > 0) return { valor: pesoTotalDaFicha(rend, un, pesoPorcao) / pesoPorcao, aproximado: false };
    return null;
  }
  const total = pesoTotalDaFicha(rend, un, pesoPorcao);
  if (!(total > 0)) return null;
  // ficha em litro e porção em grama (feijão com caldo), ou o contrário: 1 ml ≈ 1 g
  const cruzado = (modo === "g" && (un === "l" || un === "ml")) || (modo === "ml" && (un === "kg" || un === "g"));
  return { valor: total, aproximado: cruzado };
}

const nomeDoIngrediente = (ing) => ing?.insumos?.nome || ing?.subficha?.nome_receita || ing?.nome || "Ingrediente";
const unidadeDoIngrediente = (ing) => ing?.insumos?.unidade_medida || ing?.subficha?.rendimento_unidade || ing?.unidade || "un";

/**
 * A receita refeita para as porções do dia.
 * status: "ok" | "sem_ficha" | "insuficiente" (com o motivo).
 */
export function receitaDoItem(item, ficha, totalNaMedida) {
  if (!item?.ficha_id) return { status: "sem_ficha" };
  if (!ficha) return { status: "insuficiente", motivo: "A ficha ligada a este item não foi encontrada (arquivada ou de outra unidade)." };
  if (!(totalNaMedida > 0)) return { status: "insuficiente", motivo: "Falta a porção ou o número de pessoas." };
  const rend = rendimentoNaMedida(ficha, item.modo);
  if (!rend) {
    return {
      status: "insuficiente",
      motivo: item.modo === "un"
        ? "A ficha não diz quanto pesa cada unidade. Ponha o peso da porção na ficha técnica."
        : "A ficha não tem rendimento em peso ou volume. Ponha o rendimento na ficha técnica.",
    };
  }
  const fator = Math.round((totalNaMedida / rend.valor) * 10000) / 10000;
  const ingredientes = (ficha.fichas_ingredientes || []).map((ing) => {
    const q = n(ing.quantidade);
    const un = unidadeDoIngrediente(ing);
    return { nome: nomeDoIngrediente(ing), quantidade: q > 0 ? qtdLegivel(q * fator, un) : "—" };
  });
  return {
    status: "ok", fator, rotuloFator: rotuloDoFator(fator), aproximado: rend.aproximado,
    fichaNome: ficha.nome_receita || "Ficha", ingredientes, preparo: String(ficha.modo_preparo || ""),
    // A conta é REAL (ficha × porção × pessoas); medida cruzada (L ↔ kg) é ESTIMATIVA.
    natureza: rend.aproximado ? "ESTIMATIVA" : "REAL",
  };
}

/**
 * Quantidades e custo do dia para `pessoas` (quando não vier, as do dia).
 * insumos: Map(id → insumo) do cadastro. fichas: Map(id → ficha com
 * fichas_ingredientes), para a receita refeita de cada item.
 * Os fixos (arroz, feijão, salada) entram primeiro, como "Todo dia".
 */
export function cardapioDoDia(janta, diaId, { pessoas = null, insumos = new Map(), fichas = new Map() } = {}) {
  const dia = janta?.dias?.[diaId] || { pratos: [] };
  const p = n(pessoas) || pessoasDoDia(janta, diaId);
  let custo = 0; let semCusto = 0;
  const calcular = (itens) => (itens || []).map(normalizarItem).filter((i) => i.nome || i.insumo_id || i.ficha_id).map((i) => {
    if (i.modo === "geral") {
      const ficha = i.ficha_id ? fichas.get(i.ficha_id) : null;
      return { ...i, nome: i.nome || ficha?.nome_receita || "", porcaoN: 0, gPessoa: 0, totalG: 0, total: 0, geralTexto: i.geral,
        rotulo: i.geral || "—", custo: null, cru: null, receita: ficha ? receitaDaFichaInteira(ficha) : { status: "sem_ficha" } };
    }
    const porcao = n(i.porcao);
    const total = porcao * p;
    const ins = i.insumo_id ? insumos.get(i.insumo_id) : null;
    const c = custoDoItem(ins, total, i.modo);
    if (c == null) { if (total > 0) semCusto += 1; } else custo += c;
    const ficha = i.ficha_id ? fichas.get(i.ficha_id) : null;
    return {
      ...i, nome: i.nome || ins?.nome || ficha?.nome_receita || "",
      porcaoN: porcao, gPessoa: i.modo === "g" ? porcao : 0, totalG: i.modo === "g" ? total : 0, total,
      rotulo: rotuloTotal(total, i.modo), custo: c,
      // cru para cozinhar (sem ficha ligada): pronto ÷ rendimento do cozimento
      cru: !i.ficha_id && i.modo === "g" && n(i.rend_cozimento) > 0 && total > 0 ? { g: r2(total / n(i.rend_cozimento)), rotulo: rotuloPeso(total / n(i.rend_cozimento)), natureza: "ESTIMATIVA" } : null,
      receita: receitaDoItem(i, ficha, total),
    };
  });
  const fixos = calcular(janta?.fixos);
  const pratos = [
    ...(fixos.length ? [{ id: "fixos", nome: "Todo dia", preparo: "", fixo: true, itens: fixos }] : []),
    ...dia.pratos.map((prato) => ({ ...prato, itens: calcular(prato.itens) })),
  ].map((prato) => ({ ...prato, totalG: prato.itens.reduce((t, x) => t + x.totalG, 0) }));
  return {
    pessoas: p, pratos, custo: r2(custo), semCusto,
    custoPorPessoa: p > 0 && custo > 0 ? r2(custo / p) : null,
    natureza: semCusto ? "ESTIMATIVA" : "REAL",
  };
}

/** A ficha como está (item "geral" ligado a uma ficha: não multiplica). */
function receitaDaFichaInteira(ficha) {
  const ingredientes = (ficha.fichas_ingredientes || []).map((ing) => {
    const q = n(ing.quantidade);
    return { nome: nomeDoIngrediente(ing), quantidade: q > 0 ? qtdLegivel(q, unidadeDoIngrediente(ing)) : "—" };
  });
  return { status: "ok", fator: 1, rotuloFator: rotuloDoFator(1), aproximado: false, fichaNome: ficha.nome_receita || "Ficha", ingredientes, preparo: String(ficha.modo_preparo || ""), natureza: "REAL" };
}

/** Dia da semana (id) de uma data: "seg", "ter"… */
export function diaDaData(data = new Date()) {
  const d = data instanceof Date ? data : new Date(`${data}T12:00:00`);
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][d.getDay()];
}

/**
 * Como montar o prato de cada pessoa no fim (dono, 22/11/2026): a porção de
 * cada item por pessoa; o que é geral (salada) vai à parte.
 */
export function pratoDaPessoa(cardapio) {
  const itens = (cardapio?.pratos || []).flatMap((p) => p.itens || []);
  return itens.filter((i) => i.nome).map((i) => ({
    nome: i.nome,
    texto: i.modo === "geral" ? "à parte, para todos" : i.porcaoN > 0 ? `${i.porcaoN.toLocaleString("pt-BR")} ${MODOS_PORCAO.find((m) => m.id === i.modo)?.curto || "g"}` : "—",
    geral: i.modo === "geral",
  }));
}

/** A janta tem algo para servir neste dia? */
export const temJantaNoDia = (janta, diaId) => (janta?.fixos || []).some((i) => i.nome || i.ficha_id) || (janta?.dias?.[diaId]?.pratos || []).some((p) => p.nome || (p.itens || []).length);
