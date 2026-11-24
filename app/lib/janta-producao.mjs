// FICHAS DE PRODUÇÃO DA JANTA (pedido do dono, 24/11/2026): "na janta não
// precisa ter ficha do dia, vai ter só ficha de produção, onde eu posso migrar
// do restaurante, das marmitas, dos eventos, ou criar uma nova… O feijão rende
// 3 kg; só vou precisar de 2,5 kg, então o sistema se readapta… o sistema já
// sabe que 1 kg de feijão cru vira 3 kg de feijão cozido."
//
// Guardado em config_sistema.params.janta_funcionarios.producao (lista):
//   { id, nome, origem: { tipo, rotulo, ficha_id }, ingredientes: [{ id, nome,
//     quantidade, unidade, principal }], indice, rendimento, rendimento_unidade,
//     preparo }
// Ficha trazida de outro lugar é uma CÓPIA: mudar aqui não mexe na original.
//
// Quanto a ficha rende (sempre do produto PRONTO):
//   1. o rendimento que o dono pesou → REAL;
//   2. sem peso: o ingrediente principal (cru) × índice de cocção → ESTIMATIVA;
//   3. nada disso → DADOS INSUFICIENTES.
// Para o dia: fator = (porção × pessoas) ÷ rendimento; cada ingrediente × fator.
//
// Índice de cocção (IC) = peso pronto ÷ peso cru (líquido). As sugestões vêm
// do Guia Prático de Indicadores de Pré-preparo e Preparo dos Alimentos (UFV,
// 2023) e são só um ponto de partida: o certo é o dono pesar a panela dele,
// porque o caldo do feijão, o fogo e a panela mudam muito o número.

import { qtdLegivel, rotuloDoFator } from "./intelligence/metrics/adaptar-receita.mjs";

const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const r4 = (v) => Math.round(v * 10000) / 10000;
export const novoIdProducao = (p = "fp") => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const FONTE_INDICES = "Guia Prático de Indicadores de Pré-preparo e Preparo dos Alimentos (UFV, 2023)";

// Do mais específico para o mais geral: o primeiro que casa vale.
export const INDICES_COCCAO = Object.freeze([
  { chave: /arroz.*integral/, nome: "Arroz integral cozido", indice: 2.39 },
  { chave: /arroz.*parbo/, nome: "Arroz parboilizado cozido", indice: 3.13 },
  { chave: /arroz/, nome: "Arroz branco cozido", indice: 2.86 },
  { chave: /macarr|espaguete|massa|penne|talharim/, nome: "Macarrão espaguete cozido", indice: 2.44 },
  { chave: /feij.*preto/, nome: "Feijão preto cozido com caldo", indice: 1.89 },
  { chave: /feij/, nome: "Feijão carioca cozido com caldo", indice: 1.81 },
  { chave: /mo[ií]d/, nome: "Carne moída refogada", indice: 0.74 },
  { chave: /frango.*(desfiad|cozid)/, nome: "Peito de frango cozido e desfiado", indice: 0.52 },
  { chave: /frango|peito/, nome: "Peito de frango grelhado", indice: 0.82 },
  { chave: /lombo/, nome: "Lombo suíno cozido", indice: 0.9 },
  { chave: /pernil|su[ií]n|porco/, nome: "Pernil suíno grelhado", indice: 0.72 },
  { chave: /peixe|til[aá]pia/, nome: "Filé de tilápia grelhado", indice: 0.76 },
  { chave: /batata.*assad/, nome: "Batata inglesa assada", indice: 0.89 },
  { chave: /batata/, nome: "Batata inglesa cozida", indice: 0.97 },
  { chave: /abobrinha/, nome: "Abobrinha cozida", indice: 0.85 },
  { chave: /br[oó]colis/, nome: "Brócolis cozido", indice: 1.25 },
  { chave: /cenoura/, nome: "Cenoura cozida", indice: 0.87 },
  { chave: /omelete/, nome: "Omelete", indice: 0.8 },
  { chave: /\bovos?\b/, nome: "Ovo cozido", indice: 0.82 },
]);

const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Sugestão de índice pelo nome (ESTIMATIVA da literatura) ou null. */
export function sugestaoIndice(nome) {
  const t = String(nome || "").toLowerCase();
  const t2 = semAcento(nome);
  const achado = INDICES_COCCAO.find((x) => x.chave.test(t) || x.chave.test(t2));
  return achado ? { indice: achado.indice, nome: achado.nome, fonte: FONTE_INDICES } : null;
}

export const UNIDADES_PRODUCAO = Object.freeze(["g", "kg", "ml", "L", "un"]);
const unidadeValida = (u) => {
  const x = String(u || "").trim();
  const achada = UNIDADES_PRODUCAO.find((y) => y.toLowerCase() === x.toLowerCase());
  return achada || "g";
};

/** Quantidade na base (g, ml ou un). */
export function naBase(quantidade, unidade) {
  const q = n(quantidade);
  const u = unidadeValida(unidade);
  if (u === "kg") return { q: q * 1000, base: "g" };
  if (u === "L") return { q: q * 1000, base: "ml" };
  return { q, base: u };
}

export function normalizarIngrediente(i = {}) {
  return { id: i.id || novoIdProducao("ing"), nome: String(i.nome || ""), quantidade: i.quantidade ?? "", unidade: unidadeValida(i.unidade), principal: !!i.principal };
}

export const TIPOS_ORIGEM = Object.freeze({
  nova: "Criada na janta",
  restaurante: "Restaurante",
  marmita: "Marmitas",
  evento: "Eventos",
});

export function normalizarProducao(p = {}) {
  const ingredientes = (Array.isArray(p.ingredientes) ? p.ingredientes : []).map(normalizarIngrediente);
  // um principal só
  let achou = false;
  for (const ing of ingredientes) { if (ing.principal && !achou) achou = true; else ing.principal = false; }
  const tipo = TIPOS_ORIGEM[p.origem?.tipo] ? p.origem.tipo : "nova";
  return {
    id: p.id || novoIdProducao(),
    nome: String(p.nome || ""),
    origem: { tipo, rotulo: String(p.origem?.rotulo || TIPOS_ORIGEM[tipo]), ficha_id: p.origem?.ficha_id || null },
    ingredientes,
    indice: p.indice ?? "",
    rendimento: p.rendimento ?? "",
    rendimento_unidade: unidadeValida(p.rendimento_unidade || "kg"),
    preparo: String(p.preparo || ""),
  };
}

export const producaoVazia = () => normalizarProducao({ ingredientes: [normalizarIngrediente({ principal: true, unidade: "kg" })], rendimento_unidade: "kg" });

const rotuloBase = (q, base) => {
  if (base === "g" && q >= 1000) return qtdLegivel(q / 1000, "kg");
  if (base === "ml" && q >= 1000) return qtdLegivel(q / 1000, "L");
  return qtdLegivel(q, base === "ml" ? "ml" : base === "un" ? "un" : "g");
};

/**
 * Quanto a ficha rende, na base (g, ml ou un).
 * { valor, base, natureza: "REAL"|"ESTIMATIVA", como, rotulo } ou
 * { valor: null, motivo } (DADOS INSUFICIENTES).
 */
export function rendimentoDaProducao(prod) {
  const p = normalizarProducao(prod);
  const pesado = naBase(p.rendimento, p.rendimento_unidade);
  if (pesado.q > 0) return { valor: pesado.q, base: pesado.base, natureza: "REAL", como: "pesado", rotulo: rotuloBase(pesado.q, pesado.base) };
  const principal = p.ingredientes.find((i) => i.principal);
  if (!principal) return { valor: null, motivo: "Diga quanto a receita rende pronta, ou marque o ingrediente principal (o cru) e o índice de cocção." };
  const cru = naBase(principal.quantidade, principal.unidade);
  if (!(cru.q > 0) || cru.base === "un") return { valor: null, motivo: `Ponha a quantidade de ${principal.nome || "ingrediente principal"} em kg ou g.` };
  const ic = n(p.indice);
  if (!ic) return { valor: null, motivo: "Falta o índice de cocção (quanto 1 kg cru vira pronto) ou o rendimento pesado." };
  const valor = cru.q * ic;
  return { valor, base: "g", natureza: "ESTIMATIVA", como: "indice", rotulo: rotuloBase(valor, "g"), cru: cru.q, indice: ic };
}

/**
 * A ficha refeita para `total` (na base do item: g, ml ou un).
 * medidaItem: "g" | "ml" | "un". Medida cruzada g ↔ ml vale 1 ml ≈ 1 g (ESTIMATIVA).
 */
export function producaoParaTotal(prod, total, medidaItem = "g") {
  const p = normalizarProducao(prod);
  if (!(n(total) > 0)) return { status: "insuficiente", motivo: "Falta a porção ou o número de pessoas." };
  const rend = rendimentoDaProducao(p);
  if (rend.valor == null) return { status: "insuficiente", motivo: rend.motivo };
  const medida = ["g", "ml", "un"].includes(medidaItem) ? medidaItem : "g";
  if ((medida === "un") !== (rend.base === "un")) {
    return { status: "insuficiente", motivo: medida === "un" ? "A porção é em unidades e a ficha rende em peso: ponha o rendimento em unidades." : "A ficha rende em unidades e a porção é em peso: ponha o rendimento em kg ou g." };
  }
  const cruzado = medida !== rend.base;
  const fator = r4(n(total) / rend.valor);
  const ingredientes = p.ingredientes.filter((i) => i.nome || n(i.quantidade)).map((i) => {
    const q = n(i.quantidade);
    return { nome: i.nome || "Ingrediente", principal: i.principal, quantidade: q > 0 ? qtdLegivel(q * fator, i.unidade) : "—" };
  });
  return {
    status: "ok", fator, rotuloFator: rotuloDoFator(fator), aproximado: cruzado || rend.natureza !== "REAL",
    fichaNome: p.nome || "Ficha de produção", ingredientes, preparo: p.preparo,
    rendimento: rend.rotulo, comoRende: rend.como,
    natureza: cruzado || rend.natureza !== "REAL" ? "ESTIMATIVA" : "REAL",
  };
}

const UNIDADE_DO_CADASTRO = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un", und: "un", unidade: "un" };

/**
 * Cópia de uma ficha técnica do sistema (restaurante, bar, marmitas).
 * origem: { tipo, rotulo }.
 */
export function producaoDaFicha(ficha, origem = {}) {
  const ingredientes = (ficha?.fichas_ingredientes || []).map((ing) => normalizarIngrediente({
    nome: ing?.insumos?.nome || ing?.subficha?.nome_receita || ing?.nome || "",
    quantidade: n(ing.quantidade) || "",
    unidade: UNIDADE_DO_CADASTRO[String(ing?.insumos?.unidade_medida || ing?.subficha?.rendimento_unidade || ing?.unidade || "g").toLowerCase()] || "g",
  }));
  // rendimento da ficha (kg/L direto; porções só com o peso da porção)
  const un = String(ficha?.rendimento_porcoes ? ficha?.rendimento_unidade || "porcao" : "").toLowerCase();
  const rend = n(ficha?.rendimento_porcoes);
  let rendimento = ""; let rendimento_unidade = "kg";
  if (rend && (un === "kg" || un === "g")) { rendimento = rend; rendimento_unidade = un; }
  else if (rend && (un === "l" || un === "ml")) { rendimento = rend; rendimento_unidade = un === "l" ? "L" : "ml"; }
  else if (rend && un === "un") { rendimento = rend; rendimento_unidade = "un"; }
  else if (rend && n(ficha?.peso_porcao_g)) { rendimento = Math.round(rend * n(ficha.peso_porcao_g)); rendimento_unidade = "g"; }
  // ingrediente principal: o de maior peso (só sugestão; o dono troca)
  const pesados = ingredientes.map((i) => ({ i, g: naBase(i.quantidade, i.unidade) })).filter((x) => x.g.base === "g" && x.g.q > 0);
  if (pesados.length) pesados.sort((a, b) => b.g.q - a.g.q)[0].i.principal = true;
  const principal = ingredientes.find((i) => i.principal);
  const sug = sugestaoIndice(principal?.nome) || sugestaoIndice(ficha?.nome_receita);
  return normalizarProducao({
    nome: ficha?.nome_receita || "",
    origem: { tipo: origem.tipo || "restaurante", rotulo: origem.rotulo || TIPOS_ORIGEM[origem.tipo] || "Restaurante", ficha_id: ficha?.id || null },
    ingredientes, rendimento, rendimento_unidade,
    indice: rendimento ? "" : sug?.indice ?? "",
    preparo: ficha?.modo_preparo || "",
  });
}

const UNIDADE_DO_EVENTO = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un" };

/** Cópia de uma ficha exclusiva de evento (ingredientes por porção). */
export function producaoDoEvento(item, nomeEvento = "") {
  const ingredientes = (item?.ingredientes || []).map((ing) => normalizarIngrediente({
    nome: ing.nome || "", quantidade: n(ing.quantidade) || "", unidade: UNIDADE_DO_EVENTO[String(ing.unidade_uso || "g").toLowerCase()] || "g",
  }));
  const pesados = ingredientes.map((i) => ({ i, g: naBase(i.quantidade, i.unidade) })).filter((x) => x.g.base === "g" && x.g.q > 0);
  if (pesados.length) pesados.sort((a, b) => b.g.q - a.g.q)[0].i.principal = true;
  return normalizarProducao({
    nome: item?.nome || "",
    origem: { tipo: "evento", rotulo: nomeEvento ? `Eventos · ${nomeEvento}` : "Eventos", ficha_id: item?.id || null },
    ingredientes,
    rendimento: n(item?.peso_porcao_g) || "", rendimento_unidade: "g",
    preparo: item?.descricao || "",
  });
}

/** Fichas exclusivas dos orçamentos de evento, sem repetir o mesmo nome. */
export function fichasDosEventos(eventos = []) {
  const vistos = new Set();
  const lista = [];
  for (const ev of eventos || []) {
    const cardapio = ev?.operacao_detalhes?.orcamento?.cardapio || [];
    for (const item of cardapio) {
      if (item?.origem !== "exclusiva" || !(item.ingredientes || []).length) continue;
      const chave = semAcento(item.nome).trim();
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      lista.push({ item, evento: ev.nome || ev.cliente_nome || ev.cliente || "" });
    }
  }
  return lista;
}

/** Em quais itens da semana a ficha é usada (para avisar antes de apagar). */
export function usosDaProducao(janta, producaoId) {
  const usos = [];
  for (const i of janta?.fixos || []) if (i.producao_id === producaoId) usos.push("Todo dia");
  for (const [dia, d] of Object.entries(janta?.dias || {})) {
    for (const p of d?.pratos || []) if ((p.itens || []).some((i) => i.producao_id === producaoId)) usos.push(dia);
  }
  return [...new Set(usos)];
}
