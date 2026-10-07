// INTERPRETADOR POR REGRAS — determinístico, sem rede, sem custo.
//
// Não é regex solta: o texto vira uma lista de palavras normalizadas e é
// comparado com a GRAMÁTICA DECLARADA no catálogo (frases por intenção,
// palavras proibidas, pesos). Entidades (período, quantidade, unidade,
// produto, motivo, destino) saem por léxico fechado. O resultado passa pelo
// MESMO esquema (interpretacaoSchema) que valida a saída da IA.

import { INTENCOES, DESTINOS, interpretacaoSchema } from "./catalogo.mjs";

const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, meio: 0.5, meia: 0.5 };
const UNIDADES = {
  kg: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg", kgs: "kg",
  g: "g", gr: "g", grama: "g", gramas: "g",
  l: "l", litro: "l", litros: "l", lt: "l",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  un: "un", unidade: "un", unidades: "un", und: "un", pecas: "un", peca: "un",
};
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos"]);
const PARADAS = new Set(["por", "porque", "pq", "pois", "motivo", "que", "hoje", "ontem", "agora", "devido", "na", "no", "em", "pela", "pelo", "e", "esta", "essa", "nessa", "nesta", "semana", "mes", "estoque", "aqui"]);
const DESTINO_PALAVRAS = {
  estoque: "estoque", estoques: "estoque", compras: "compras", compra: "compras", contas: "contas_pagar", conta: "contas_pagar", boletos: "contas_pagar",
  financeiro: "financeiro", cmv: "cmv", dre: "dre", validade: "validade", validades: "validade", ficha: "fichas", fichas: "fichas",
  contagem: "contagens", contagens: "contagens", inventario: "contagens", fornecedores: "fornecedores", fornecedor: "fornecedores",
  rh: "rh", equipe: "rh", funcionarios: "rh", eventos: "eventos", reservas: "eventos", inteligencia: "inteligencia", central: "inteligencia",
};

export function normalizarTexto(t) {
  return String(t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d)\s*(kg|g|gr|l|ml|un)\b/g, "$1 $2")       // "2kg" → "2 kg"
    .replace(/(\d),(\d)/g, "$1.$2")                         // "2,5" → "2.5"
    .replace(/[^a-z0-9.\s%-]/g, " ")
    .replace(/(^|\s)[.-]+|[.-]+(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const palavras = (t) => normalizarTexto(t).split(" ").filter(Boolean);

function contemFrase(ps, frase) {
  const f = frase.split(" ");
  outer: for (let i = 0; i + f.length <= ps.length; i++) {
    for (let j = 0; j < f.length; j++) if (ps[i + j] !== f[j]) continue outer;
    return true;
  }
  return false;
}

export function extrairPeriodo(ps) {
  const t = ` ${ps.join(" ")} `;
  if (t.includes(" semana passada ")) return "semana_passada";
  if (t.includes(" mes passado ")) return "mes_passado";
  if (/ ultimos 7 dias | ultima semana /.test(t)) return "ultimos_7_dias";
  if (/ ultimos 30 dias | ultimo mes /.test(t)) return "ultimos_30_dias";
  if (t.includes(" ontem ")) return "ontem";
  if (t.includes(" hoje ")) return "hoje";
  if (/ (esta|essa|nesta|nessa|da|na) semana | semana /.test(t)) return "semana";
  if (/ (este|esse|neste|nesse|do|no) mes | mes /.test(t)) return "mes";
  return null;
}

export function extrairDias(ps) {
  const t = ps.join(" ");
  if (/\bamanha\b/.test(t)) return 1;
  const m = t.match(/\bproximos? (\d{1,2}|[a-z]+) dias?\b/);
  if (m) { const n = Number(m[1]) || NUMEROS[m[1]]; if (n) return Math.min(60, n); }
  if (/\bproximos dias\b/.test(t)) return 7;
  return null;
}

const ehNumero = (w) => /^\d+(\.\d+)?$/.test(w) || w in NUMEROS;
const valorNumero = (w) => (/^\d+(\.\d+)?$/.test(w) ? Number(w) : NUMEROS[w]);

/** Primeira quantidade (+ unidade) do texto, e onde ela termina. */
export function extrairQuantidade(ps) {
  for (let i = 0; i < ps.length; i++) {
    if (!ehNumero(ps[i])) continue;
    // "um/uma" sozinho costuma ser artigo ("uma perda"): só vale com unidade logo depois
    let q = valorNumero(ps[i]);
    let fim = i;
    let unidade = null;
    if (ps[i + 1] && UNIDADES[ps[i + 1]]) { unidade = UNIDADES[ps[i + 1]]; fim = i + 1; }
    else if (ps[i + 1] === "e" && ps[i + 2] === "meio" && ps[i + 3] && UNIDADES[ps[i + 3]]) { q += 0.5; unidade = UNIDADES[ps[i + 3]]; fim = i + 3; }
    if (["um", "uma"].includes(ps[i]) && !unidade) continue;
    if ((ps[i] === "meio" || ps[i] === "meia") && !unidade) continue;
    if (!(q > 0)) continue;
    return { quantidade: Math.round(q * 1000) / 1000, unidade, fim };
  }
  return { quantidade: null, unidade: null, fim: -1 };
}

/** Produto: palavras depois da quantidade (ou do verbo), pulando "de/da/do", até uma palavra de parada. */
export function extrairProduto(ps, inicio) {
  let i = inicio;
  while (i < ps.length && (PREPOSICOES.has(ps[i]) || ["o", "a", "os", "as"].includes(ps[i]))) i++;
  const out = [];
  for (; i < ps.length; i++) {
    if (PARADAS.has(ps[i]) && out.length) break;
    if (PARADAS.has(ps[i])) continue;
    if (ehNumero(ps[i]) || UNIDADES[ps[i]]) break;
    out.push(ps[i]);
    if (out.length >= 6) break;
  }
  while (out.length && PREPOSICOES.has(out[out.length - 1])) out.pop();
  return out.length ? out.join(" ") : null;
}

export function extrairMotivo(ps) {
  const t = ` ${ps.join(" ")} `;
  if (/ (venceu|vencido|vencida|vencidos|vencidas|validade|vencimento) /.test(t)) return "validade";
  if (/ (limpeza|aparas|apara|limpar|limpando) /.test(t)) return "limpeza";
  if (/ (queimou|queimado|queimada|erro de producao|erro na producao|passou do ponto) /.test(t)) return "erro_producao";
  if (/ (caiu|queda|quebrou|quebrado|quebrada|danificado|danificada|dano|derramou) /.test(t)) return "dano";
  return null;
}

export function extrairDestino(ps) {
  for (const w of ps) if (DESTINO_PALAVRAS[w]) return DESTINO_PALAVRAS[w];
  return null;
}

function posicaoDoGatilho(ps, intencao) {
  for (const grupo of intencao.frases) {
    for (const f of grupo) {
      const fw = f.split(" ");
      for (let i = 0; i + fw.length <= ps.length; i++) {
        if (fw.every((w, j) => ps[i + j] === w)) return i + fw.length;
      }
    }
  }
  return 0;
}

/**
 * @param {string} texto
 * @returns {{ ok: true, valor: object } | { ok: false, erros: object[] }}
 */
export function interpretarPorRegras(texto) {
  const ps = palavras(texto);
  const destino = extrairDestino(ps);
  const candidatas = INTENCOES.filter((it) =>
    it.frases.every((grupo) => grupo.some((f) => contemFrase(ps, f)))
    && !(it.proibidas || []).some((f) => contemFrase(ps, f))
    && (!it.requerDestino || destino));
  candidatas.sort((a, b) => b.peso - a.peso);
  let escolhida = candidatas[0] || null;

  const q = extrairQuantidade(ps);
  let produto = null;
  if (escolhida?.id === "estoque.registrar_perda" || escolhida?.id === "compras.criar") {
    produto = extrairProduto(ps, q.fim >= 0 ? q.fim + 1 : posicaoDoGatilho(ps, escolhida));
  } else if (escolhida?.id === "estoque.saldo_produto" || escolhida?.id === "produto.explicar_variacao" || escolhida?.id === "compras.total") {
    const ult = ps.reduce((acc, w, i) => (PREPOSICOES.has(w) && i >= posicaoDoGatilho(ps, escolhida) - 1 ? i : acc), -1);
    produto = ult >= 0 ? extrairProduto(ps, ult) : null;
    if (escolhida.id === "estoque.saldo_produto" && !produto) produto = extrairProduto(ps, posicaoDoGatilho(ps, escolhida));
  }
  // "por que aumentou?" só vale com produto (do texto ou da tela, resolvido depois)
  if (escolhida?.requerProduto && !produto) escolhida = candidatas.find((c) => !c.requerProduto) || escolhida;

  const id = escolhida?.id || "desconhecido";
  const acao = escolhida?.tipo === "acao";
  const bruto = {
    intencao: id,
    periodo: extrairPeriodo(ps),
    dias: extrairDias(ps),
    produto,
    quantidade: acao ? q.quantidade : null,
    unidade: acao ? q.unidade : null,
    motivo: id === "estoque.registrar_perda" ? extrairMotivo(ps) : null,
    destino: id === "navegar" ? destino : null,
    confianca: !escolhida ? "baixa" : candidatas.length > 1 && candidatas[1].peso === escolhida.peso ? "media" : "alta",
  };
  return interpretacaoSchema.parse(bruto);
}
