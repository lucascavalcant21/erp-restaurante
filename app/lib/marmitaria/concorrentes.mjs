// CARDÁPIOS DOS CONCORRENTES (pedido do dono, 16 e 17/11/2026):
// "o Jhon também analisa cardápios de delivery e monta o que vem em cada um e
// o valor, para comparar com os nossos, incluindo os adicionais ofertados. E
// ficam salvos em um banco de dados."
//
// Este arquivo é só cálculo (roda no navegador, no servidor e nos testes):
//   cardapioDoOcr        leitura dos prints (/api/ocr/cardapio) → itens limpos
//   resumoDoCardapio     quantos pratos, adicionais…, faixa de preço dos pratos
//   compararComNossas    nossas marmitas × pratos deles; nossos adicionais × os deles
//   textoDaComparacao    a resposta do Jhon
//
// Regra: o preço do concorrente é o que estava no cardápio dele naquela data
// (REAL observado). Item sem preço lido NÃO entra (não se inventa preço). Peso
// só quando o cardápio escreve ("500 g"). A comparação é conta sobre esses
// números; o "parecido" entre pratos é por palavras do nome e do que vem no
// prato, e é dito como tal.

export const PLATAFORMAS = Object.freeze([
  { id: "ifood", rotulo: "iFood" }, { id: "99food", rotulo: "99Food" }, { id: "keeta", rotulo: "Keeta" },
  { id: "rappi", rotulo: "Rappi" }, { id: "aiqfome", rotulo: "aiqfome" }, { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "site", rotulo: "Site / cardápio digital" }, { id: "outro", rotulo: "Outro" },
]);
const IDS_PLATAFORMA = new Set(PLATAFORMAS.map((p) => p.id));
export const TIPOS_ITEM = Object.freeze(["prato", "combo", "adicional", "bebida", "sobremesa", "outro"]);
const IDS_TIPO = new Set(TIPOS_ITEM);
export const MAX_ITENS_CARDAPIO = 300;
export const MAX_PRINTS = 6;

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpar = (v, max) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t ? t.slice(0, max) : null; };
const r2 = (n) => Math.round(Number(n) * 100) / 100;
export const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const rotuloPlataforma = (id) => PLATAFORMAS.find((p) => p.id === id)?.rotulo || "Outro";

/** "R$ 24,90", "24.90", 24.9, "1.234,50" → número ≥ 0; senão null. */
export function numeroBR(v) {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  const t = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "iFood", "i food", "99", "whats"… → id da plataforma; nada reconhecido → null. */
export function plataformaDoTexto(t) {
  const f = fold(t).replace(/\s+/g, "");
  if (!f) return null;
  if (f.includes("ifood")) return "ifood";
  if (f.includes("99")) return "99food";
  if (f.includes("keeta")) return "keeta";
  if (f.includes("rappi")) return "rappi";
  if (f.includes("aiqfome")) return "aiqfome";
  if (f.includes("whats") || f.includes("zap")) return "whatsapp";
  if (f.includes("site") || f.includes("instagram") || f.includes("cardapiodigital") || f.includes("goomer") || f.includes("anota")) return "site";
  return IDS_PLATAFORMA.has(f) ? f : null;
}

/** Peso escrito no nome ou na descrição: "Marmita 500g", "1 kg", "350 gramas" → gramas. ml não é peso. */
export function pesoDoTexto(...textos) {
  for (const t of textos) {
    const m = fold(t).replace(/(\d),(\d)/g, "$1.$2").match(/(\d+(?:\.\d+)?)\s*(kg|quilos?|g|gr|grs|gramas?)\b/);
    if (!m) continue;
    const n = Number(m[1]) * (/^(kg|quilo)/.test(m[2]) ? 1000 : 1);
    if (n >= 1 && n <= 20000) return Math.round(n * 10) / 10;
  }
  return null;
}

/** "Arroz, feijão, frango grelhado e salada" → ["Arroz", "feijão", "frango grelhado", "salada"]. */
export function componentesDaDescricao(descricao) {
  const t = String(descricao ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  return t
    .replace(/^(acompanha|vem com|contem|contém|composto por|composta por|ingredientes)\s*:?\s*/i, "")
    .split(/\s*(?:,|;|\+|\s\/\s|\.\s|\s+e\s+(?=[a-záéíóúâêôãõç]))\s*/i)
    .map((x) => x.replace(/[.!]+$/, "").trim())
    .filter((x) => x.length >= 2 && x.length <= 80 && !/^\d+([.,]\d+)?\s*(g|kg|ml)$/i.test(x))
    .slice(0, 30);
}

/**
 * Resposta do /api/ocr/cardapio → o cardápio que o servidor aceita.
 * Itens sem nome ou sem preço lido saem; adicional repetido em dois prints entra uma vez.
 * @returns {object|null} null quando não há nenhum item com nome e preço.
 */
export function cardapioDoOcr(ocr) {
  if (!ocr || typeof ocr !== "object") return null;
  const vistos = new Set();
  const itens = [];
  for (const i of Array.isArray(ocr.itens) ? ocr.itens : []) {
    const nome = limpar(i?.nome, 160);
    const preco = numeroBR(i?.preco);
    if (!nome || preco == null || preco >= 100000) continue;
    const tipo = IDS_TIPO.has(fold(i?.tipo)) ? fold(i.tipo) : "outro";
    const grupo = limpar(i?.grupo, 80);
    const chave = `${tipo}|${fold(grupo)}|${fold(nome)}|${preco}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const descricao = limpar(i?.descricao, 600);
    const lidos = (Array.isArray(i?.componentes) ? i.componentes : []).map((c) => limpar(c, 80)).filter(Boolean).slice(0, 30);
    const original = numeroBR(i?.preco_original);
    const serve = Math.round(numeroBR(i?.serve_pessoas) || 0);
    const item = {
      tipo, nome, preco: r2(preco),
      ...(limpar(i?.categoria, 80) ? { categoria: limpar(i.categoria, 80) } : {}),
      ...(grupo ? { grupo } : {}),
      ...(descricao ? { descricao } : {}),
      componentes: lidos.length ? lidos : componentesDaDescricao(descricao),
    };
    const pesoLido = i?.peso_g ?? i?.peso;
    const peso = typeof pesoLido === "number" ? pesoLido : (pesoDoTexto(pesoLido, nome, descricao) ?? numeroBR(pesoLido));
    if (peso >= 1 && peso <= 20000) item.peso_g = Math.round(peso * 10) / 10;
    if (serve >= 1 && serve <= 50) item.serve_pessoas = serve;
    if (original != null && original > preco) item.preco_original = r2(original);
    itens.push(item);
    if (itens.length >= MAX_ITENS_CARDAPIO) break;
  }
  if (!itens.length) return null;
  const opc = (v, max) => (numeroBR(v) != null && numeroBR(v) <= max ? r2(numeroBR(v)) : undefined);
  const out = {
    concorrente: limpar(ocr.estabelecimento ?? ocr.concorrente, 120) || undefined,
    plataforma: plataformaDoTexto(ocr.plataforma) || undefined,
    taxa_entrega: opc(ocr.taxa_entrega, 999),
    pedido_minimo: opc(ocr.pedido_minimo, 9999),
    tempo_entrega: limpar(ocr.tempo_entrega, 40) || undefined,
    avaliacao: opc(ocr.avaliacao, 5),
    itens,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== null));
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : r2((s[m - 1] + s[m]) / 2);
};

/** Quantos de cada tipo e a faixa de preço dos pratos. */
export function resumoDoCardapio(cardapio) {
  const itens = cardapio?.itens || [];
  const conta = Object.fromEntries(TIPOS_ITEM.map((t) => [t, itens.filter((i) => i.tipo === t).length]));
  const precos = itens.filter((i) => i.tipo === "prato").map((i) => Number(i.preco)).filter((p) => p > 0);
  return {
    ...conta, total: itens.length,
    faixaPratos: precos.length ? { min: Math.min(...precos), mediana: mediana(precos), max: Math.max(...precos), n: precos.length } : null,
  };
}

// ─── Parecido entre pratos: palavras do nome e do que vem no prato ──────────
const PARADAS = new Set(["de", "da", "do", "das", "dos", "com", "sem", "e", "a", "o", "as", "os", "ao", "na", "no", "em", "para", "pra", "ou",
  "marmita", "marmitas", "marmitex", "quentinha", "quentinhas", "prato", "pratos", "executivo", "refeicao", "acompanha", "acompanhamento", "acompanhamentos",
  "porcao", "unidade", "un", "g", "gr", "kg", "ml", "grande", "media", "pequena", "tradicional", "especial", "casa", "nosso", "nossa", "opcao", "escolha"]);
const raiz = (w) => (w.length > 4 ? w.replace(/(oes|aes|ais|eis|ns|s)$/, (m) => ({ oes: "ao", aes: "ao", ais: "al", eis: "el", ns: "m", s: "" }[m])) : w);
export function palavras(...textos) {
  const out = new Set();
  for (const t of textos.flat()) {
    for (const w of fold(t).split(/[^a-z0-9]+/)) if (w.length >= 3 && !PARADAS.has(w) && !/^\d+$/.test(w)) out.add(raiz(w));
  }
  return out;
}

/** Jaccard com peso: palavra que aparece em quase todo prato (arroz, feijão) pesa menos. */
function parecido(a, b, freq, total) {
  const peso = (w) => (total >= 4 && (freq.get(w) || 0) / total > 0.5 ? 0.3 : 1);
  let inter = 0;
  let uniao = 0;
  for (const w of new Set([...a, ...b])) {
    const p = peso(w);
    uniao += p;
    if (a.has(w) && b.has(w)) inter += p;
  }
  return uniao ? inter / uniao : 0;
}

export const LIMIAR_PARECIDO = 0.3;
const por100g = (preco, peso) => (preco > 0 && peso > 0 ? r2((preco / peso) * 100) : null);

/**
 * @param {object} p
 * @param {Array<{id, nome, preco:number|null, peso_g?:number|null, componentes?:string[]}>} p.nossas  preço no app do concorrente
 * @param {Array<{nome, preco:number, grupo?:string}>|null} p.nossosAdicionais  null = não cadastrados
 * @param {{ concorrente:string, plataforma?:string, observado_em?:string, itens:Array }} p.leitura
 */
export function compararComNossas({ nossas = [], nossosAdicionais = null, leitura }) {
  const deles = (leitura?.itens || []).filter((i) => i.tipo === "prato" || i.tipo === "combo");
  const docs = [
    ...nossas.map((m) => palavras(m.nome, m.componentes || [])),
    ...deles.map((i) => palavras(i.nome, i.componentes || [], i.descricao || "")),
  ];
  const freq = new Map();
  for (const d of docs) for (const w of d) freq.set(w, (freq.get(w) || 0) + 1);
  const total = docs.length;

  const usados = new Set();
  const pares = nossas.map((m, k) => {
    const pm = docs[k];
    let melhor = null;
    deles.forEach((i, j) => {
      const nota = parecido(pm, docs[nossas.length + j], freq, total);
      if (nota >= LIMIAR_PARECIDO && (!melhor || nota > melhor.nota)) melhor = { item: i, j, nota };
    });
    const nosso = Number(m.preco) > 0 ? r2(m.preco) : null;
    if (!melhor) return { nossa: m, preco: nosso, par: null };
    usados.add(melhor.j);
    const dif = nosso != null ? r2(nosso - melhor.item.preco) : null;
    return {
      nossa: m, preco: nosso, par: melhor.item, parecido: Math.round(melhor.nota * 100) / 100,
      diferenca: dif, diferencaPct: dif != null && melhor.item.preco > 0 ? Math.round((dif / melhor.item.preco) * 1000) / 10 : null,
      nosso100g: por100g(nosso, Number(m.peso_g) || null), deles100g: por100g(melhor.item.preco, Number(melhor.item.peso_g) || null),
      soNosso: (m.componentes || []).filter((c) => ![...palavras(c)].some((w) => docs[nossas.length + melhor.j].has(w))).slice(0, 6),
      soDeles: (melhor.item.componentes || []).filter((c) => ![...palavras(c)].some((w) => pm.has(w))).slice(0, 6),
    };
  });
  const semPar = deles.filter((_, j) => !usados.has(j));

  // Adicionais: os deles × os nossos (por palavra do nome)
  const adicDeles = (leitura?.itens || []).filter((i) => i.tipo === "adicional");
  let adicionais = null;
  if (nossosAdicionais) {
    const nossosP = nossosAdicionais.map((a) => ({ a, p: palavras(a.nome) }));
    const casados = new Set();
    const lista = adicDeles.map((i) => {
      const pi = palavras(i.nome);
      const achou = nossosP.find((x, k) => !casados.has(k) && [...pi].some((w) => x.p.has(w)) && (casados.add(k) || true));
      return achou
        ? { deles: i, nosso: achou.a, diferenca: r2(Number(achou.a.preco) - i.preco) }
        : { deles: i, nosso: null, diferenca: null };
    });
    adicionais = {
      lista,
      soEles: lista.filter((x) => !x.nosso).map((x) => x.deles),
      soNos: nossosAdicionais.filter((_, k) => !casados.has(k)),
    };
  }
  const comPreco = pares.filter((p) => p.par && p.diferenca != null);
  return {
    concorrente: leitura?.concorrente || "concorrente",
    plataforma: leitura?.plataforma || null,
    observadoEm: leitura?.observado_em || null,
    resumo: resumoDoCardapio(leitura),
    pares, semPar, adicionaisDeles: adicDeles, adicionais,
    maisCaras: comPreco.filter((p) => p.diferenca > 0.009).length,
    maisBaratas: comPreco.filter((p) => p.diferenca < -0.009).length,
    iguais: comPreco.filter((p) => Math.abs(p.diferenca) <= 0.009).length,
  };
}

const ddmm = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null);
const sinal = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${brl(Math.abs(v))}`;

/** A resposta do Jhon: frase curta + linhas para a lista. */
export function textoDaComparacao(cmp) {
  const quando = ddmm(cmp.observadoEm);
  const onde = cmp.plataforma ? ` no ${rotuloPlataforma(cmp.plataforma)}` : "";
  const partes = [];
  const f = cmp.resumo.faixaPratos;
  partes.push(`${cmp.concorrente}${onde}${quando ? ` (cardápio visto em ${quando})` : ""}: ${cmp.resumo.prato} ${cmp.resumo.prato === 1 ? "prato" : "pratos"}${f ? ` de ${brl(f.min)} a ${brl(f.max)}` : ""}, ${cmp.resumo.adicional} ${cmp.resumo.adicional === 1 ? "adicional" : "adicionais"}${cmp.resumo.combo ? `, ${cmp.resumo.combo} ${cmp.resumo.combo === 1 ? "combo" : "combos"}` : ""}.`);
  const comPar = cmp.pares.filter((p) => p.par);
  if (!cmp.pares.length) partes.push("DADOS INSUFICIENTES do nosso lado: não há marmita cadastrada nesta unidade para comparar.");
  else if (!comPar.length) partes.push("Nenhuma das nossas marmitas é parecida com os pratos deles pelo nome e pelo que vem no prato.");
  else {
    const semPreco = comPar.filter((p) => p.preco == null).length;
    const t = [];
    if (cmp.maisCaras) t.push(`${cmp.maisCaras} das nossas ${cmp.maisCaras === 1 ? "está mais cara" : "estão mais caras"}`);
    if (cmp.maisBaratas) t.push(`${cmp.maisBaratas} ${cmp.maisBaratas === 1 ? "está mais barata" : "estão mais baratas"}`);
    if (cmp.iguais) t.push(`${cmp.iguais} no mesmo preço`);
    if (t.length) partes.push(`Comparando os pratos parecidos: ${t.join(", ")}.`);
    if (semPreco) partes.push(`${semPreco} das nossas não tem preço${onde} cadastrado.`);
  }
  if (cmp.adicionais) {
    if (cmp.adicionais.soEles.length) partes.push(`Eles oferecem ${cmp.adicionais.soEles.length} ${cmp.adicionais.soEles.length === 1 ? "adicional" : "adicionais"} que nós não temos: ${cmp.adicionais.soEles.slice(0, 5).map((a) => `${a.nome} (${brl(a.preco)})`).join(", ")}${cmp.adicionais.soEles.length > 5 ? "…" : ""}.`);
  } else if (cmp.resumo.adicional) {
    partes.push("DADOS INSUFICIENTES dos nossos adicionais: não há grupo de adicionais cadastrado no cardápio desta unidade, então mostro só os deles.");
  }
  return partes.join(" ");
}

/** Linhas para a lista da resposta (nossa × deles). */
export function linhasDaComparacao(cmp) {
  const linhas = [];
  for (const p of cmp.pares) {
    if (!p.par) { linhas.push({ rotulo: p.nossa.nome, valor: `${p.preco != null ? brl(p.preco) : "sem preço"} · sem prato parecido` }); continue; }
    const peso = p.nosso100g != null && p.deles100g != null ? ` · 100 g: ${brl(p.nosso100g)} × ${brl(p.deles100g)}` : "";
    linhas.push({
      rotulo: `${p.nossa.nome} × ${p.par.nome}`,
      valor: `${p.preco != null ? brl(p.preco) : "sem preço"} × ${brl(p.par.preco)}${p.diferenca != null ? ` (${sinal(p.diferenca)})` : ""}${peso}`,
    });
  }
  return linhas;
}

export function linhasDosAdicionais(cmp) {
  if (cmp.adicionais) {
    return [
      ...cmp.adicionais.lista.map((x) => ({ rotulo: x.deles.nome + (x.deles.grupo ? ` (${x.deles.grupo})` : ""), valor: x.nosso ? `${brl(x.deles.preco)} × nosso ${brl(x.nosso.preco)}` : `${brl(x.deles.preco)} · não temos` })),
      ...cmp.adicionais.soNos.map((a) => ({ rotulo: a.nome, valor: `só nós: ${brl(a.preco)}` })),
    ];
  }
  return cmp.adicionaisDeles.map((a) => ({ rotulo: a.nome + (a.grupo ? ` (${a.grupo})` : ""), valor: brl(a.preco) }));
}

/** Nossos adicionais: grupos "adicional" do cardápio digital da unidade (config_sistema.params.cardapio_digital.grupos). */
export function nossosAdicionaisDaConfig(params) {
  const grupos = params?.cardapio_digital?.grupos;
  if (!Array.isArray(grupos)) return null;
  const out = [];
  for (const g of grupos) {
    if ((g?.tipo || "adicional") !== "adicional") continue;
    for (const o of Array.isArray(g?.opcoes) ? g.opcoes : []) {
      const preco = numeroBR(o?.preco);
      if (limpar(o?.nome, 60) && preco > 0) out.push({ nome: limpar(o.nome, 60), preco: r2(preco), grupo: limpar(g?.nome, 60) });
    }
  }
  return out.length ? out : null;
}
