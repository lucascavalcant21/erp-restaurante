// SALMOURAS E EMPANADOS (pedido do dono, 23/11/2026): receitas "por quilo".
//
// Salmoura: o dono cadastra o que vai para 1 kg do produto (carne, frango ou
// peixe) — "para 1 kg de filé de pirarucu: 1 L de água, 50 g de sal…" — e diz
// em quais produtos ela é usada. Na calculadora a pessoa escolhe o tipo, a
// salmoura e quantos kg tem; o sistema só multiplica.
//
// Empanado: o que vai para 1 kg da farinha (panko): sal, temperos, e a
// massinha (trigo, sal, ovos). A pessoa diz quantos kg de farinha vai usar e
// recebe tudo na medida.
//
// Serve para restaurante, delivery e eventos (mesma unidade). Guardado em
// config_sistema.params.formulas_cozinha. Conta determinística: quantidade
// cadastrada × kg ÷ kg de referência. Nada é inventado: sem cadastro, a tela e
// o assistente dizem que falta cadastrar.

export const TIPOS_FORMULA = Object.freeze({
  salmoura: { id: "salmoura", titulo: "Salmouras", singular: "salmoura", rota: "/dashboard/operacao/salmouras?dept=cozinha", referencia: "do produto" },
  empanado: { id: "empanado", titulo: "Empanados", singular: "empanado", rota: "/dashboard/operacao/empanados?dept=cozinha", referencia: "de farinha" },
});

// Sem "Outros" (dono, 24/11/2026: "não tem que estar outros, tem que estar um + para
// adicionar novas categorias"): além de Carne, Frango e Peixe, a categoria pode ser
// qualquer nome criado na hora ("Porco", "Camarão"…). "outro" antigo vira sem categoria.
export const CATEGORIAS_SALMOURA = Object.freeze([
  { id: "carne", rotulo: "Carne" },
  { id: "frango", rotulo: "Frango" },
  { id: "peixe", rotulo: "Peixe" },
]);

/** Categoria guardada: id fixo (carne/frango/peixe), nome criado, ou "" (sem categoria). */
export function categoriaSalmoura(v) {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!t || t === "outro") return "";
  const fixa = CATEGORIAS_SALMOURA.find((c) => c.id === t.toLowerCase() || c.rotulo.toLowerCase() === t.toLowerCase());
  return fixa ? fixa.id : (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 30);
}
export const rotuloCategoriaSalmoura = (cat) => CATEGORIAS_SALMOURA.find((c) => c.id === cat)?.rotulo || cat || "";

/** Categorias para escolher/filtrar: as fixas e as criadas que já estão em uso. */
export function categoriasSalmouraDe(lista = []) {
  const criadas = [...new Set(lista.map((f) => f.categoria).filter((c) => c && !CATEGORIAS_SALMOURA.some((x) => x.id === c)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...CATEGORIAS_SALMOURA, ...criadas.map((c) => ({ id: c, rotulo: c }))];
}

export const UNIDADES_FORMULA = Object.freeze(["g", "kg", "ml", "l", "un", "colher (sopa)", "colher (chá)", "pitada"]);

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const novoId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const novoIdFormula = novoId;

export function numeroFormula(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizarItem(i = {}) {
  const unidade = UNIDADES_FORMULA.includes(i.unidade) ? i.unidade : "g";
  return { id: i.id || novoId("i"), nome: limpo(i.nome).slice(0, 80), qtd: numeroFormula(i.qtd), unidade };
}

function normalizarSecao(s = {}, i = 0) {
  return { id: s.id || novoId("s"), titulo: limpo(s.titulo).slice(0, 60) || (i === 0 ? "Ingredientes" : `Parte ${i + 1}`), itens: (Array.isArray(s.itens) ? s.itens : []).map(normalizarItem).filter((x) => x.nome) };
}

export function normalizarFormula(f = {}, tipo = f.tipo) {
  const t = TIPOS_FORMULA[tipo] ? tipo : "salmoura";
  const secoes = (Array.isArray(f.secoes) ? f.secoes : []).map(normalizarSecao).filter((s) => s.itens.length);
  return {
    id: f.id || novoId("f"),
    tipo: t,
    nome: limpo(f.nome).slice(0, 80),
    categoria: t === "salmoura" ? categoriaSalmoura(f.categoria) : null,
    // empanado: a farinha de referência (ex.: Farinha panko); salmoura: o produto
    referencia: limpo(f.referencia).slice(0, 60) || (t === "empanado" ? "Farinha panko" : ""),
    kgReferencia: numeroFormula(f.kgReferencia) || 1,
    produtos: (Array.isArray(f.produtos) ? f.produtos : String(f.produtos || "").split(/[,;\n]/)).map(limpo).filter(Boolean).slice(0, 30),
    secoes,
    tempo: limpo(f.tempo).slice(0, 80),
    preparo: String(f.preparo ?? "").trim().slice(0, 2000),
    atualizado_em: f.atualizado_em || null,
  };
}

/** O que está guardado → { salmouras, empanados }, cada lista por nome. */
export function normalizarFormulas(v) {
  const lista = (arr, tipo) => (Array.isArray(arr) ? arr : []).map((f) => normalizarFormula(f, tipo)).filter((f) => f.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { versao: 1, salmouras: lista(v?.salmouras, "salmoura"), empanados: lista(v?.empanados, "empanado") };
}

export const listaDoTipo = (formulas, tipo) => (tipo === "empanado" ? formulas.empanados : formulas.salmouras);

/** Erros antes de salvar. */
export function conferirFormula(f, outros = []) {
  const n = normalizarFormula(f);
  const erros = [];
  if (!n.nome) erros.push("Escreva o nome.");
  if (!n.secoes.some((s) => s.itens.length)) erros.push("Coloque pelo menos um ingrediente.");
  const semQtd = n.secoes.flatMap((s) => s.itens).filter((i) => !i.qtd).map((i) => i.nome);
  if (semQtd.length) erros.push(`Falta a quantidade de: ${semQtd.join(", ")}.`);
  const k = semAcento(n.nome);
  if (k && outros.some((o) => o.id !== n.id && semAcento(o.nome) === k)) erros.push("Já tem uma com esse nome.");
  return erros;
}

// ─── Conta ──────────────────────────────────────────────────────────────────

const fmt = (v, dec = 0) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: dec });

/** Precisão de balança: sal e tempero contam no grama. */
function arredondarBalanca(v) {
  if (v < 10) return Math.round(v * 10) / 10;
  if (v < 1000) return Math.round(v);
  return Math.round(v / 5) * 5;
}

/** Quantidade para mostrar: em g/ml (pedido do dono), com litros/kg junto quando passa de 1000. */
export function textoQuantidade(qtd, unidade) {
  if (!(qtd > 0)) return "sem quantidade";
  const u = unidade || "g";
  if (u === "g" || u === "kg" || u === "ml" || u === "l") {
    const ml = u === "ml" || u === "l";
    const base = arredondarBalanca(u === "kg" || u === "l" ? qtd * 1000 : qtd);
    const un = ml ? "ml" : "g";
    const grande = base >= 1000 ? ` (${fmt(base / 1000, 2)} ${ml ? "L" : "kg"})` : "";
    return `${fmt(base, 1)} ${un}${grande}`;
  }
  const v = Math.round(qtd * 10) / 10;
  if (u === "un") return `${fmt(v, 1)} un`;
  return `${fmt(v, 1)} ${u}`;
}

/**
 * A fórmula na medida pedida.
 * @returns {{ fator, kg, secoes: [{ titulo, itens: [{ nome, qtd, unidade, texto }] }] } | { erro }}
 */
export function calcularFormula(formula, kg) {
  const f = normalizarFormula(formula);
  const k = numeroFormula(kg);
  if (!k) return { erro: "Diga quantos kg." };
  if (!f.secoes.length) return { erro: "Esta receita ainda não tem ingredientes cadastrados." };
  const fator = k / f.kgReferencia;
  return {
    fator, kg: k,
    secoes: f.secoes.map((s) => ({
      titulo: s.titulo,
      itens: s.itens.map((i) => {
        const qtd = i.qtd ? i.qtd * fator : null;
        return { nome: i.nome, qtd, unidade: i.unidade, texto: i.qtd ? textoQuantidade(qtd, i.unidade) : "sem quantidade" };
      }),
    })),
  };
}

export const textoKg = (kg) => `${fmt(kg, 2)} kg`;

// ─── Busca e assistente ─────────────────────────────────────────────────────

const VAZIAS = new Set(["a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "pra", "para", "com", "um", "uma", "qual", "quais", "me", "mostra", "ver",
  "salmoura", "salmouras", "empanado", "empanados", "empanamento", "empanar", "empanada", "empanadas", "massinha", "farinha", "panko", "usa", "uso", "usar", "vai", "e", "que", "calculadora", "receita", "kg", "quilos", "quilo", "kilos", "fazer", "faco", "como"]);
const tokens = (t) => semAcento(t).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);

/** Fórmulas que casam com o termo pelo nome ou pelos produtos que as usam. */
export function buscarFormulas(lista = [], termo = "") {
  const q = tokens(termo).filter((w) => !VAZIAS.has(w) && !/^\d+$/.test(w));
  if (!q.length) return [];
  const casa = (txt) => { const ws = tokens(txt); return q.every((p) => ws.some((w) => w.startsWith(p) || (p.length > 3 && w.startsWith(p.replace(/s$/, ""))))); };
  return lista.filter((f) => casa(f.nome) || f.produtos.some(casa) || casa(`${f.nome} ${f.produtos.join(" ")}`));
}

/**
 * "salmoura", "salmoura de frango", "qual a salmoura do filé de pirarucu
 * empanado", "salmoura para 3 kg de frango", "empanado", "empanado do camarão".
 * → { tipo, categoria?, termo?, kg? } ou null.
 */
export function interpretarFormula(texto) {
  const t = semAcento(texto);
  if (!t || t.length > 140) return null;
  const tipo = /\bsalmouras?\b/.test(t) ? "salmoura" : /\b(empanad[oa]s?|empanamento|empanar|massinha)\b/.test(t) ? "empanado" : null;
  if (!tipo) return null;
  const mk = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|quilos?|kilos?)\b/);
  const kg = mk ? numeroFormula(mk[1]) : null;
  const resto = mk ? t.replace(mk[0], " ") : t;
  let termo = tokens(resto).filter((w) => !VAZIAS.has(w)).join(" ");
  let categoria = null;
  // "salmoura de frango" (só o tipo) → pergunta qual salmoura de frango
  const CAT = { frango: "frango", frangos: "frango", peixe: "peixe", peixes: "peixe", carne: "carne", carnes: "carne", boi: "carne", bovina: "carne" };
  if (tipo === "salmoura" && CAT[termo]) { categoria = CAT[termo]; termo = ""; }
  return { tipo, categoria, termo: termo || null, kg };
}

const PREFIXO = "§formula";
export const PREFIXO_FORMULA = PREFIXO;
const cmd = (o) => `${PREFIXO} ${JSON.stringify(o)}`;
export function lerComandoFormula(texto) {
  const s = String(texto || "");
  if (!s.startsWith(PREFIXO)) return null;
  try { return JSON.parse(s.slice(PREFIXO.length).trim()); } catch { return null; }
}

/**
 * Resposta do Nico/Jhon no aparelho. null = não é com salmoura/empanado.
 * Caminho: "salmoura" → Carne / Frango / Peixe → qual → cartão com a calculadora
 * (kg). Direto: "salmoura do filé de pirarucu" → cartão daquela.
 */
export function respostaDaFormula(texto, cache) {
  const c = lerComandoFormula(texto);
  const pedido = c || interpretarFormula(texto);
  if (!pedido?.tipo) return null;
  const T = TIPOS_FORMULA[pedido.tipo];
  const acoes = [{ rotulo: `Abrir ${T.titulo.toLowerCase()}`, rota: T.rota }];
  if (!cache) return { tipo: "local", local: true, atualizar: true, texto: `Ainda estou baixando as ${T.titulo.toLowerCase()} neste aparelho. Tente de novo em alguns segundos.`, acoes };
  const formulas = normalizarFormulas(cache.formulas);
  let lista = listaDoTipo(formulas, pedido.tipo);
  if (!lista.length) return { tipo: "local", local: true, atualizar: true, texto: `Nenhuma ${T.singular} cadastrada ainda. Cadastre em Cozinha › ${T.titulo}.`, acoes };

  const cartao = (f) => ({ tipo: "local", local: true, atualizar: true, texto: f.nome, blocos: [{ tipo: "formula", formula: f, kg: pedido.kg ?? null }], acoes });

  if (pedido.id) {
    const f = lista.find((x) => x.id === pedido.id);
    return f ? cartao(f) : null;
  }
  if (pedido.termo) {
    const achadas = buscarFormulas(lista, pedido.termo);
    if (achadas.length === 1) return cartao(achadas[0]);
    if (achadas.length > 1) return escolher(achadas, "Qual?", pedido, acoes);
    return { ...escolher(lista, `Não achei ${T.singular} para "${pedido.termo}". Qual destas?`, pedido, acoes) };
  }
  if (pedido.tipo === "salmoura" && !pedido.categoria) {
    const cats = categoriasSalmouraDe(lista).map((cat) => ({ ...cat, n: lista.filter((f) => f.categoria === cat.id).length })).filter((cat) => cat.n);
    if (cats.length > 1) {
      return {
        tipo: "local", local: true, atualizar: true, texto: "Salmoura para quê?",
        pergunta: { texto: "Salmoura para quê?", opcoes: cats.map((cat) => ({ id: cat.id, rotulo: `${cat.rotulo} (${cat.n})`, comando: cmd({ tipo: "salmoura", categoria: cat.id, kg: pedido.kg ?? null }) })) },
        acoes,
      };
    }
  }
  if (pedido.categoria) lista = lista.filter((f) => f.categoria === pedido.categoria);
  if (!lista.length) return { tipo: "local", local: true, texto: "Nenhuma salmoura cadastrada para esse tipo.", acoes };
  if (lista.length === 1) return cartao(lista[0]);
  return escolher(lista, "Qual?", pedido, acoes);
}

function escolher(lista, texto, pedido, acoes) {
  return {
    tipo: "local", local: true, atualizar: true, texto,
    pergunta: { texto, opcoes: lista.slice(0, 12).map((f) => ({ id: f.id, rotulo: f.produtos.length ? `${f.nome} · ${f.produtos.slice(0, 2).join(", ")}` : f.nome, comando: cmd({ tipo: f.tipo, id: f.id, kg: pedido.kg ?? null }) })) },
    acoes,
  };
}
