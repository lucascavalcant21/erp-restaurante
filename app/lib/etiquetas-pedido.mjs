// PEDIDO DE ETIQUETAS FALADO OU DIGITADO (Assistente Héfisto, 07/11/2026).
//
// "Eu quero 20 etiquetas maniçoba, 30 de jambu" → [{20, maniçoba}, {30, jambu}]
// → cada nome casado com o que a tela de Etiquetas lista (produtos do estoque e
// pré-preparos) → a tela abre com a fila montada. Quem imprime é a tela, depois
// da prévia e da confirmação de sempre: imprimir etiqueta dá entrada de produção
// no estoque, então nada é impresso direto pela conversa.
//
// Funções puras: rodam no servidor (assistente) e no navegador (tela).

export const MAX_ITENS = 30;
export const MAX_COPIAS = 100;

const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chave = (t) => sem(t).replace(/[^a-z0-9]+/g, " ").trim();
/** Nome comparável: sem acento, minúsculo, só letras e números ("Maniçoba " = "maniçoba"). */
export const chaveDeNome = chave;
const VAZIAS = new Set(["de", "da", "do", "das", "dos", "a", "o", "e", "com"]);
const tokens = (t) => chave(t).split(" ").filter((x) => x && !VAZIAS.has(x));
const singular = (w) => (w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

const NUMEROS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
};

/** "vinte e cinco" → "25", "trinta" → "30". Só números por extenso até cem. */
export function numerosPorExtenso(texto) {
  const palavra = /(^|[^a-zA-ZÀ-ú])([a-zA-ZÀ-ú]+)(?=$|[^a-zA-ZÀ-ú])/g;
  const unidades = String(texto || "").replace(palavra, (todo, antes, w) => (NUMEROS[sem(w)] != null ? `${antes}${NUMEROS[sem(w)]}` : todo));
  // "20 e 5" (vinte e cinco) vira 25; "20 de X e 5 de Y" não muda
  return unidades.replace(/\b([2-9]0) e ([1-9])\b(?!\d)/g, (todo, d, u, pos, s) => (/^\s*(?:etiquetas?|de|do|da|x)\b/i.test(s.slice(pos + todo.length)) || /^\s*$/.test(s.slice(pos + todo.length)) ? String(Number(d) + Number(u)) : todo));
}

// Palavras de pedido antes da lista: "eu quero", "imprime", "faz pra mim"…
const ABERTURA = /^(?:(?:por favor|eu|me|pra mim|para mim|hefisto|ola|oi|ok)\s+)*(?:quero|queria|preciso(?: de)?|precisa(?: de)?|imprim\w*|gera\w*|ger[ae]|faz(?:er)?|faca|fazer|manda\w*|solta\w*|tira\w*|cri[ae]\w*|bota|coloca)?\s*/i;
const ETIQ = /\betiquetas?\b/i;

function limparNome(t) {
  return String(t || "")
    .replace(/\betiquetas?\b/gi, " ")
    .replace(/\b(?:por favor|pra mim|para mim|tambem|também|mais)\b/gi, " ")
    .replace(/^\s*(?:de|do|da|dos|das|pra|para|x)\s+/i, "")
    .replace(/[.!?:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lê a lista de etiquetas do texto. Sem número, vale 1 ("etiqueta de vatapá").
 * Nomes repetidos somam. Devolve [] quando não há nenhum produto.
 * @returns {{ termo: string, copias: number }[]}
 */
export function lerPedidoDeEtiquetas(texto) {
  let t = numerosPorExtenso(String(texto || "").slice(0, 600)).replace(/\s+/g, " ").trim();
  // "Imprimir etiquetas: 20 de X, 30 de Y" (comando que o próprio assistente monta)
  t = t.replace(/^[^:]*\betiquetas?\b[^:]*:\s*/i, "");
  t = t.replace(ABERTURA, "");
  // separa itens por vírgula/ponto e vírgula/quebra e por " e " seguido de número
  const partes = t.split(/\s*[,;\n]\s*|\s+e\s+(?=\d)/i).map((p) => p.trim()).filter(Boolean);
  const porNome = new Map();
  for (const parte of partes) {
    let copias = null;
    let nome = parte;
    const antes = parte.match(/^(\d{1,4})\s*(?:x\b|×)?\s*(.*)$/i);
    const depois = parte.match(/^(.*?\D)\s*(?:x|×)?\s*(\d{1,4})\s*(?:etiquetas?|unidades?|copias|cópias)?$/i);
    if (antes) { copias = Number(antes[1]); nome = antes[2]; } else if (depois) { copias = Number(depois[2]); nome = depois[1]; }
    nome = limparNome(nome.replace(ABERTURA, ""));
    if (!nome || !/[a-zà-ú]/i.test(nome)) continue;
    if (copias == null) copias = 1;
    copias = Math.max(1, Math.min(MAX_COPIAS, Math.floor(copias)));
    const k = chave(nome);
    const atual = porNome.get(k);
    if (atual) atual.copias = Math.min(MAX_COPIAS, atual.copias + copias);
    else porNome.set(k, { termo: nome, copias });
    if (porNome.size >= MAX_ITENS) break;
  }
  return [...porNome.values()];
}

/** O texto pede etiquetas? ("20 etiquetas de X"; "quantas etiquetas vencem" não). */
export function pedeEtiquetas(texto) {
  const t = sem(texto);
  if (!ETIQ.test(t)) return false;
  if (/\b(quantas|quais|vencid\w*|vencend\w*|vence\w*|validade|ativas|ativa|lidas|baixad\w*)\b/.test(t)) return false;
  return lerPedidoDeEtiquetas(texto).length > 0 || /\b(imprim\w*|ger[ae]\w*|faz\w*|quero|preciso)\b/.test(t);
}

/**
 * Casa um termo com o catálogo da tela de etiquetas ({ nome, origem }).
 * Ordem: nome igual > nome que começa com o termo > pré-preparo com todas as
 * palavras > qualquer nome com todas as palavras (o mais curto). Empate no
 * topo volta como ambíguo: quem chama pergunta, nunca escolhe sozinho.
 * @returns {{ item: object|null, opcoes: object[] }}
 */
export function casarNoCatalogo(catalogo, termo) {
  const alvo = tokens(termo).map(singular);
  if (!alvo.length) return { item: null, opcoes: [] };
  const exato = alvo.join(" ");
  const vistos = new Map();
  for (const c of catalogo || []) {
    const k = chave(c?.nome);
    if (k && !vistos.has(k)) vistos.set(k, c);
  }
  const pontos = [];
  for (const c of vistos.values()) {
    const ts = tokens(c.nome).map(singular);
    if (!ts.length) continue;
    let p = 0;
    if (ts.join(" ") === exato) p = 100;
    else if (alvo.every((a, i) => ts[i] === a)) p = 80;
    else if (alvo.every((a) => ts.includes(a) || ts.some((x) => a.length >= 4 && x.startsWith(a)))) p = (c.origem === "Pré-preparo" ? 70 : 60) - Math.min(ts.length, 9);
    if (p) pontos.push({ c, p });
  }
  if (!pontos.length) return { item: null, opcoes: [] };
  pontos.sort((a, b) => b.p - a.p || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
  const topo = pontos.filter((x) => x.p === pontos[0].p);
  if (topo.length === 1) return { item: topo[0].c, opcoes: [] };
  return { item: null, opcoes: topo.slice(0, 6).map((x) => x.c) };
}

/** Casa o pedido inteiro: achados (com o nome do cadastro), ambíguos e sem cadastro. */
export function casarPedido(catalogo, pedido) {
  const achados = [];
  const ambiguos = [];
  const semCadastro = [];
  for (const p of pedido || []) {
    const r = casarNoCatalogo(catalogo, p.termo);
    if (r.item) achados.push({ ...p, nome: r.item.nome, origem: r.item.origem || null });
    else if (r.opcoes.length) ambiguos.push({ ...p, opcoes: r.opcoes.map((o) => o.nome) });
    else semCadastro.push(p);
  }
  return { achados, ambiguos, semCadastro };
}

/** Comando que refaz o pedido com nomes exatos ("Imprimir etiquetas: 20 de X, 30 de Y"). */
export function comandoDoPedido(itens) {
  return `Imprimir etiquetas: ${itens.map((i) => `${i.copias} de ${String(i.nome || i.termo).replace(/[,;:]/g, " ")}`).join(", ")}`;
}

// ─── Fila na URL da tela de Etiquetas (?lote=) ───────────────────────────────
export const PARAMETRO_LOTE = "lote";

const diasValidos = (d) => d !== null && d !== undefined && d !== "" && Number.isInteger(Number(d)) && Number(d) >= 0 && Number(d) <= 3650;

/** [cópias, nome] ou [cópias, nome, dias de validade] quando a validade foi escolhida. */
export function loteParaUrl(itens) {
  const lista = (itens || []).slice(0, MAX_ITENS).map((i) => {
    const linha = [Math.max(1, Math.min(MAX_COPIAS, Math.floor(Number(i.copias) || 1))), String(i.nome || i.termo || "").slice(0, 80)];
    return diasValidos(i.dias) ? [...linha, Number(i.dias)] : linha;
  });
  return `/dashboard/operacao/etiquetas?${PARAMETRO_LOTE}=${encodeURIComponent(JSON.stringify(lista))}`;
}

/** Lê o ?lote= com desconfiança: lista curta, cópias inteiras 1..100, nomes curtos. */
export function loteDaUrl(valor) {
  try {
    const bruto = JSON.parse(String(valor || ""));
    if (!Array.isArray(bruto)) return [];
    return bruto.slice(0, MAX_ITENS).map((x) => (Array.isArray(x) ? { copias: Number(x[0]), nome: String(x[1] ?? "").trim().slice(0, 80), ...(diasValidos(x[2]) ? { dias: Number(x[2]) } : {}) } : null))
      .filter((x) => x && x.nome && Number.isInteger(x.copias) && x.copias >= 1 && x.copias <= MAX_COPIAS);
  } catch { return []; }
}

// ─── Etiquetas que a casa sempre pede (histórico da tabela etiquetas) ────────
export const VALIDADES_RAPIDAS = Object.freeze([1, 3, 7, 15, 30, 60, 90]);
const mediana = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const moda = (xs) => { const c = new Map(); let melhor = null; let n = 0; for (const x of xs) { const k = (c.get(x) || 0) + 1; c.set(x, k); if (k > n || (k === n && x > melhor)) { n = k; melhor = x; } } return melhor; };

/**
 * Agrupa as etiquetas impressas por produto ("Vatapá" e "Vatapa" juntas):
 * quantas vezes pediu, quantas etiquetas costuma pedir (mediana), a validade
 * mais usada e a última vez. Mais pedidas primeiro. Números REAIS do histórico.
 * @param {{produto:string, copias?:number, validade_dias?:number, created_at?:string}[]} linhas
 */
export function agruparHabituais(linhas, limite = 15) {
  const grupos = new Map();
  for (const l of linhas || []) {
    const nome = String(l?.produto || "").trim();
    const k = chave(nome);
    if (!k) continue;
    const g = grupos.get(k) || { nomes: new Map(), copias: [], dias: [], vezes: 0, etiquetas: 0, ultima: "" };
    g.nomes.set(nome, (g.nomes.get(nome) || 0) + 1);
    const c = Math.max(1, Math.floor(Number(l.copias) || 1));
    g.copias.push(c);
    g.etiquetas += c;
    if (l.validade_dias !== null && l.validade_dias !== undefined && Number.isInteger(Number(l.validade_dias)) && Number(l.validade_dias) >= 0) g.dias.push(Number(l.validade_dias));
    g.vezes += 1;
    const d = String(l.created_at || "").slice(0, 10);
    if (d > g.ultima) g.ultima = d;
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      nome: [...g.nomes.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0], "pt-BR"))[0][0],
      vezes: g.vezes, etiquetas: g.etiquetas, copias: Math.min(MAX_COPIAS, mediana(g.copias)), dias: moda(g.dias), ultima: g.ultima || null,
    }))
    .sort((a, b) => b.vezes - a.vezes || b.etiquetas - a.etiquetas || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}
