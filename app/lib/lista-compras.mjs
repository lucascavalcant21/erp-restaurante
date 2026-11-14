// LISTA DE COMPRAS PELO JHON (pedido do dono, 14/11/2026):
//   "Jhon, essa é a minha lista de compras para hoje" → o Jhon monta a lista,
//   o dono salva e manda no WhatsApp de quem compra;
//   "Jhon, comprei tudo, faltou isso" → o Jhon confere com a lista: o que veio
//   e o que faltou (que fica para a próxima). A compra em si (preço, estoque,
//   custo, conta a pagar) entra pela foto da nota/DANFE, que já existe: aqui
//   não se inventa preço.
// Módulo puro, testado em lista-compras.test.mjs.

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const UNIDADES = {
  kg: "kg", kgs: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg",
  g: "g", gr: "g", grama: "g", gramas: "g",
  l: "L", lt: "L", litro: "L", litros: "L", ml: "ml",
  un: "un", und: "un", unidade: "un", unidades: "un",
  cx: "cx", caixa: "cx", caixas: "cx", pct: "pct", pacote: "pct", pacotes: "pct",
  fardo: "fardo", fardos: "fardo", duzia: "dúzia", duzias: "dúzia", bandeja: "bandeja", bandejas: "bandeja",
  saco: "saco", sacos: "saco", maco: "maço", macos: "maço", garrafa: "garrafa", garrafas: "garrafa",
  lata: "lata", latas: "lata", pe: "pé", pes: "pé", galao: "galão", galoes: "galão", balde: "balde", baldes: "balde",
};
const RE_UN = Object.keys(UNIDADES).sort((a, b) => b.length - a.length).join("|");

// Abertura do pedido: "Jhon, minha lista de compras para hoje é: …"
const ABERTURA = /^.*?(lista de compras?( (pra|para|de) (hoje|amanha|semana))?( (e|eh|é))?|preciso comprar|tem que comprar|temos que comprar|comprar)\s*[:,-]?\s*/i;

/** Uma linha da lista: "10 kg de arroz", "arroz 10 kg", "3 abacaxis", "alface". */
export function lerItem(trecho) {
  const t = semAcento(trecho).replace(/(\d),(\d)/g, "$1.$2").replace(/[.;:!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const original = String(trecho).replace(/\s+/g, " ").trim().replace(/[.;:!?]+$/g, "");
  let m = t.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${RE_UN})\\b\\s*(?:de |da |do |das |dos )?(.+)$`));
  if (m) return { nome: nomeDe(original, m[3]), quantidade: Number(m[1]), unidade: UNIDADES[m[2]] };
  m = t.match(new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${RE_UN})?$`));
  if (m) return { nome: nomeDe(original, m[1]), quantidade: Number(m[2]), unidade: m[3] ? UNIDADES[m[3]] : "un" };
  m = t.match(/^(\d+(?:\.\d+)?)\s+(?:de\s+)?(.+)$/);
  if (m) return { nome: nomeDe(original, m[2]), quantidade: Number(m[1]), unidade: "un" };
  return { nome: nomeDe(original, t), quantidade: null, unidade: null };
}

// Mantém a grafia do dono (acentos e maiúsculas) recortando o mesmo pedaço.
function nomeDe(original, semAc) {
  const alvo = semAc.trim();
  const i = semAcento(original).indexOf(alvo);
  const nome = i >= 0 ? original.slice(i, i + alvo.length) : alvo;
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Texto do dono → itens. Separa por vírgula, ponto e vírgula, linha e " e ". */
export function interpretarLista(texto) {
  const corpo = String(texto || "").replace(ABERTURA, "");
  return corpo
    .split(/\n|,|;| e (?=\d|[a-zà-ú])/i)
    .map((p) => p.replace(/^[-•*\s]+/, "").trim())
    .filter((p) => p.length >= 2)
    .map(lerItem)
    .filter(Boolean)
    .slice(0, 60);
}

/**
 * Liga cada item ao cadastro. `casar(nome)` devolve o insumo ou null (no
 * servidor usa a mesma busca de produto do resto do Héfisto).
 */
export function casarComCadastro(itens, casar) {
  return (itens || []).map((it, i) => {
    const ins = casar ? casar(it.nome) : null;
    return { id: `l${i + 1}`, ...it, insumoId: ins?.id || null, nomeCadastro: ins?.nome || null, status: "pendente" };
  });
}

/** O que está abaixo do mínimo e não está na lista (REAL: saldo × mínimo do estoque). */
export function sugestoesDoMinimo(lista, abaixo) {
  const ja = new Set((lista || []).map((i) => i.insumoId).filter(Boolean));
  return (abaixo || []).filter((a) => a.insumo_id && !ja.has(a.insumo_id)).slice(0, 10);
}

const fmtQtd = (q, u) => (q == null ? "" : `${Number(q).toLocaleString("pt-BR")}${u ? ` ${u}` : ""}`);
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** Texto para o WhatsApp de quem compra. */
export function mensagemWhatsApp(itens, { casa = "", data = "" } = {}) {
  const linhas = (itens || []).filter((i) => i.status !== "comprado").map((i) => `• ${i.nomeCadastro || i.nome}${i.quantidade != null ? `: ${fmtQtd(i.quantidade, i.unidade)}` : ""}`);
  return [`🛒 Lista de compras${casa ? ` · ${casa}` : ""}${data ? ` · ${ddmm(data)}` : ""}`, "", ...linhas, "", "Quando comprar, me avise o que faltou."].join("\n");
}

/** Link do WhatsApp: com número, abre a conversa; sem, o dono escolhe o contato. */
export function linkWhatsApp(mensagem, telefone = "") {
  const d = String(telefone || "").replace(/\D/g, "");
  const numero = d ? (d.length <= 11 ? `55${d}` : d) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

const tokens = (t) => semAcento(t).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !["kg", "com", "sem", "uma", "uns"].includes(w));
const singular = (w) => w.replace(/(oes|aes)$/, "ao").replace(/(es|s)$/, "");
function citado(item, frase) {
  const fs = new Set(tokens(frase).map(singular));
  const ws = tokens(item.nomeCadastro || item.nome).map(singular);
  const ws2 = tokens(item.nome).map(singular);
  return [ws, ws2].some((w) => w.length && w.some((x) => fs.has(x)));
}

/**
 * "Comprei tudo, faltou o tomate e a alface" / "comprei só o arroz".
 * Devolve a lista com o status de cada item e o que não bateu com a lista.
 */
export function aplicarCompra(lista, texto) {
  const t = semAcento(texto);
  const pendentes = (lista || []).filter((i) => i.status !== "comprado" && i.status !== "faltou");
  const mFaltou = t.match(/(?:faltou|faltaram|nao veio|nao vieram|nao tinha|nao achei|nao encontrei|acabou|esgotado)\s+(.+)$/);
  const mSo = t.match(/comprei (?:so|apenas|somente)\s+(.+?)(?:,? (?:faltou|faltaram|nao)|$)/);
  let faltaram = [];
  let vieram = [];
  if (mSo) {
    vieram = pendentes.filter((i) => citado(i, mSo[1]));
    faltaram = pendentes.filter((i) => !vieram.includes(i));
  } else {
    faltaram = mFaltou ? pendentes.filter((i) => citado(i, mFaltou[1])) : [];
    vieram = pendentes.filter((i) => !faltaram.includes(i));
  }
  const status = new Map([...vieram.map((i) => [i.id, "comprado"]), ...faltaram.map((i) => [i.id, "faltou"])]);
  return {
    lista: (lista || []).map((i) => (status.has(i.id) ? { ...i, status: status.get(i.id) } : i)),
    vieram, faltaram,
    // o dono disse que faltou algo, mas nada da lista bate com o que disse
    naoAchou: mFaltou && !faltaram.length && !mSo ? mFaltou[1].trim() : null,
  };
}

/** A lista nova do dia seguinte: o que faltou volta como pendente. */
export function proximaLista(lista) {
  return (lista || []).filter((i) => i.status === "faltou").map((i) => ({ ...i, status: "pendente" }));
}
