// RECEITA RÁPIDA NO APARELHO (pedido do dono, 22/11/2026).
//
// "Arroz" → é pré-preparo ou prato? → Arroz branco ou Arroz paraense → quanto
// vai fazer (o arroz é cru ou cozido?) → a receita já na medida. Tudo com um
// toque, sem esperar o servidor nem o modelo de linguagem, e sem internet: as
// fichas ficam guardadas no aparelho (receitas-cache.js) e as contas são feitas
// aqui, de forma determinística.
//
// Nada é inventado: quantidades e passos vêm da ficha cadastrada. A conta da
// nova quantidade é proporcional (regra de três sobre a ficha) e o rendimento
// recalculado é ESTIMATIVA.

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Prefixo dos comandos internos dos botões (nunca vão ao servidor). */
export const PREFIXO = "§receita";

const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "do", "da", "dos", "das", "um", "uma", "e", "com", "pra", "para", "no", "na", "em", "me"]);

export function tokens(texto) {
  return semAcento(texto).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t && !PALAVRAS_VAZIAS.has(t));
}

export function chaveDoNome(nome) {
  return tokens(nome).join(" ");
}

// ─── Unidades ───────────────────────────────────────────────────────────────

const MASSA = { g: 1, gr: 1, grama: 1, gramas: 1, kg: 1000, quilo: 1000, quilos: 1000, kilo: 1000, kilos: 1000 };
const VOLUME = { ml: 1, l: 1000, lt: 1000, litro: 1000, litros: 1000 };

/** Quantidade numa unidade → { base: "g"|"ml"|null, valor (em g ou ml) | null }. */
export function paraBase(qtd, unidade) {
  const u = semAcento(unidade).trim();
  const n = Number(qtd);
  if (!Number.isFinite(n)) return { base: null, valor: null };
  if (MASSA[u]) return { base: "g", valor: n * MASSA[u] };
  if (VOLUME[u]) return { base: "ml", valor: n * VOLUME[u] };
  return { base: null, valor: n };
}

const fmt = (n, dec = 0) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: dec });

/** Arredonda para a cozinha: até 20 g de 1 em 1 (sal, tempero), até 200 de 5 em 5, acima de 10 em 10. */
export function arredondarCozinha(v) {
  if (!(v > 0)) return 0;
  if (v < 20) return Math.round(v * 10) / 10 >= 1 ? Math.round(v) : Math.round(v * 10) / 10;
  if (v < 200) return Math.round(v / 5) * 5;
  return Math.round(v / 10) * 10;
}

/** Quantidade legível em gramas / ml (pedido do dono: "deixe tudo em gramas"). */
export function quantidadeTexto(qtd, unidade) {
  const b = paraBase(qtd, unidade);
  if (b.valor == null) return "não cadastrado";
  if (b.base === "g") return `${fmt(arredondarCozinha(b.valor), 1)} g`;
  if (b.base === "ml") return `${fmt(arredondarCozinha(b.valor), 1)} ml`;
  const u = limpo(unidade) || "un";
  return `${fmt(Math.round(b.valor * 100) / 100, 2)} ${u}`;
}

// ─── Entender o pedido ──────────────────────────────────────────────────────

const NUM = "(\\d+(?:[.,]\\d+)?)";
const UNID = "(kg|quilos?|kilos?|g|gr|gramas?|l|lt|litros?|ml|por[cç](?:ao|ões|oes)|porcao|unidades?|un)";

function lerNumero(s) {
  const t = String(s || "").trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

/**
 * "Arroz" | "como faz arroz branco?" | "quero fazer 2 kg de arroz cru" →
 * { termo, qtd, unidade, estado: "cru"|"cozido"|null, tipo: "base"|"prato"|null } ou null.
 * null = não é pedido de receita (segue para o servidor).
 */
export function interpretarPedido(texto) {
  let t = semAcento(limpo(texto)).replace(/[?!.]+$/g, "");
  if (!t || t.length > 120) return null;
  let tipo = null;
  if (/\b(pre[ -]?preparo|receita base|base)\b/.test(t)) tipo = "base";
  else if (/\bprato\b/.test(t)) tipo = "prato";
  let estado = null;
  if (/\bcrus?\b|\bcruas?\b/.test(t)) estado = "cru";
  else if (/\bcozid[oa]s?\b|\bpront[oa]s?\b/.test(t)) estado = "cozido";

  let qtd = null, unidade = null;
  const mq = t.match(new RegExp(`${NUM}\\s*${UNID}\\b`));
  if (mq) {
    qtd = lerNumero(mq[1]);
    const u = mq[2];
    unidade = /^k|^qu/.test(u) ? "kg" : /^g/.test(u) ? "g" : /^ml/.test(u) ? "ml" : /^l/.test(u) ? "l" : /^por/.test(u) ? "porcoes" : "un";
    t = t.replace(mq[0], " ");
  }
  const ehReceita = /\b(como (?:faz|fazer|prepara|preparo)|receita|ficha|modo de preparo|quero fazer|vou fazer|preciso fazer|vamos fazer|fazer|preparar)\b/.test(t);
  t = t
    .replace(/\b(como (?:se )?(?:faz|fazer|prepara|preparo)|me (?:mostra|passa|da)|qual (?:e )?a|receita(?: base)?|ficha(?: tecnica)?|modo de preparo|quero|vou|preciso|vamos|fazer|preparar|o pre[ -]?preparo|pre[ -]?preparo|o prato|prato|base)\b/g, " ")
    .replace(/\b(crus?|cruas?|cozid[oa]s?|pront[oa]s?)\b/g, " ");
  const termo = tokens(t).join(" ");
  if (!termo) return null;
  // Sem verbo de receita, só aceita o nome curto ("arroz", "arroz branco").
  if (!ehReceita && termo.split(" ").length > 4) return null;
  return { termo, qtd: Number.isFinite(qtd) && qtd > 0 ? qtd : null, unidade, estado, tipo };
}

// ─── Achar a ficha ──────────────────────────────────────────────────────────

const completude = (f) => (f.ingredientes?.length || 0) * 10 + (f.modoPreparo || f.etapas?.length ? 5 : 0);

/**
 * Fichas que batem com o termo (todas as palavras no nome, começo de palavra),
 * sem repetir nome igual: fica a mais completa.
 */
export function buscarFichas(fichas = [], termo = "") {
  const ts = tokens(termo);
  if (!ts.length) return [];
  const casa = (f) => {
    const nome = tokens(f.nome);
    return ts.every((t) => nome.some((p) => p.startsWith(t) || (t.length > 4 && p.startsWith(t.slice(0, -1)))));
  };
  const porNome = new Map();
  for (const f of fichas.filter((x) => x && x.nome && casa(x))) {
    const k = `${f.base ? "b" : "p"}|${chaveDoNome(f.nome)}`;
    const atual = porNome.get(k);
    if (!atual || completude(f) > completude(atual)) porNome.set(k, f);
  }
  const exato = chaveDoNome(termo);
  return [...porNome.values()].sort((a, b) => (chaveDoNome(a.nome) === exato ? -1 : 0) - (chaveDoNome(b.nome) === exato ? -1 : 0)
    || tokens(a.nome).length - tokens(b.nome).length || a.nome.localeCompare(b.nome, "pt-BR"));
}

const rotuloTipo = (base) => (base ? "Pré-preparo" : "Prato");

function cmd(partes) {
  return `${PREFIXO} ${JSON.stringify(partes)}`;
}

/** Lê um comando de botão interno. */
export function lerComando(texto) {
  const s = String(texto || "");
  if (!s.startsWith(PREFIXO)) return null;
  try { return JSON.parse(s.slice(PREFIXO.length).trim()); } catch { return null; }
}

/**
 * A resposta no aparelho, no mesmo formato das respostas do servidor (o chat
 * mostra igual). null = não é com a receita rápida.
 * @param {string} texto  o que a pessoa escreveu, ou um comando §receita
 * @param {{ fichas: object[] }|null} cache
 */
export function respostaLocal(texto, cache) {
  const janta = respostaDaJanta(texto, cache);
  if (janta) return janta;
  const fichas = cache?.fichas || [];
  if (!fichas.length) return null;
  const c = lerComando(texto);
  const pedido = c || interpretarPedido(texto);
  if (!pedido) return null;

  if (pedido.fichaId) {
    const f = fichas.find((x) => x.id === pedido.fichaId);
    if (!f) return null;
    return respostaDaFicha(f, pedido);
  }

  let achadas = buscarFichas(fichas, pedido.termo);
  if (!achadas.length) return null; // sem ficha com esse nome: o servidor responde (e oferece montar)
  if (pedido.tipo) {
    const doTipo = achadas.filter((f) => (pedido.tipo === "base") === !!f.base);
    if (doTipo.length) achadas = doTipo;
  }
  const extra = { qtd: pedido.qtd ?? null, unidade: pedido.unidade ?? null, estado: pedido.estado ?? null };
  const bases = achadas.filter((f) => f.base);
  const pratos = achadas.filter((f) => !f.base);

  // 1) pré-preparo ou prato? (só quando há dos dois)
  if (!pedido.tipo && bases.length && pratos.length) {
    return {
      tipo: "local", local: true, texto: "É pré-preparo ou prato?",
      pergunta: { texto: "É pré-preparo ou prato?", opcoes: [
        { id: "base", rotulo: `Pré-preparo (${bases.length})`, comando: cmd({ termo: pedido.termo, tipo: "base", ...extra }) },
        { id: "prato", rotulo: `Prato (${pratos.length})`, comando: cmd({ termo: pedido.termo, tipo: "prato", ...extra }) },
      ] },
    };
  }
  // 2) qual deles?
  if (achadas.length > 1) {
    return {
      tipo: "local", local: true, texto: "Qual?",
      pergunta: { texto: "Qual?", opcoes: achadas.slice(0, 12).map((f) => ({ id: f.id, rotulo: f.nome, comando: cmd({ fichaId: f.id, ...extra }) })) },
    };
  }
  return respostaDaFicha(achadas[0], extra);
}

function respostaDaFicha(f, extra = {}) {
  return {
    tipo: "local", local: true, texto: f.nome,
    blocos: [{ tipo: "receita_rapida", ficha: f, pedido: { qtd: extra.qtd ?? null, unidade: extra.unidade ?? null, estado: extra.estado ?? null } }],
    acoes: [{ rotulo: "Abrir a ficha completa", rota: `/dashboard/operacao/fichas/${f.id}` }],
    referencia: { ficha: { id: f.id, nome: f.nome } },
  };
}

// ─── A receita na quantidade pedida ─────────────────────────────────────────

/**
 * O ingrediente que dá nome à receita ("arroz" no Arroz branco): o de maior
 * peso entre os que têm a primeira palavra do nome. É a ele que "cru" se refere.
 */
export function ingredientePrincipal(ficha) {
  const primeira = tokens(ficha?.nome)[0];
  if (!primeira) return null;
  const candidatos = (ficha.ingredientes || [])
    .map((ing, i) => ({ ...ing, i, b: paraBase(ing.qtd, ing.unidade) }))
    .filter((x) => x.b.valor > 0 && tokens(x.nome).some((t) => t.startsWith(primeira) || primeira.startsWith(t)));
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.b.valor - a.b.valor);
  return candidatos[0];
}

/** Rendimento da ficha em g/ml ou porções. */
export function rendimentoBase(ficha) {
  const q = Number(ficha?.rendQtd);
  if (!(q > 0)) return { base: null, valor: null };
  const u = semAcento(ficha.rendUn || "porcoes");
  if (/^por/.test(u)) return { base: "porcoes", valor: q };
  const b = paraBase(q, ficha.rendUn);
  return b.base ? b : { base: semAcento(ficha.rendUn) || "un", valor: q };
}

/**
 * Quanto multiplicar a ficha para a quantidade pedida.
 * - "cru": a quantidade é do ingrediente principal (2 kg de arroz cru → arroz da ficha).
 * - "cozido" ou sem principal: a quantidade é do rendimento (2 kg de arroz pronto).
 * @returns {{ fator: number|null, precisaEstado: boolean, motivo: string|null, principal: object|null }}
 */
export function fatorDoPedido(ficha, { qtd, unidade, estado } = {}) {
  const principal = ingredientePrincipal(ficha);
  if (!(Number(qtd) > 0)) return { fator: 1, precisaEstado: false, motivo: null, principal };
  const alvo = /^por/.test(semAcento(unidade || "")) ? { base: "porcoes", valor: Number(qtd) } : paraBase(qtd, unidade || "g");
  const rend = rendimentoBase(ficha);
  const podeCru = principal && alvo.base && principal.b.base === alvo.base;
  const podeCozido = rend.valor > 0 && rend.base === alvo.base;
  const precisaEstado = !estado && podeCru && podeCozido;
  if (estado === "cru" && podeCru) return { fator: alvo.valor / principal.b.valor, precisaEstado: false, motivo: null, principal };
  if (estado !== "cru" && podeCozido) return { fator: alvo.valor / rend.valor, precisaEstado, motivo: null, principal };
  if (podeCru) return { fator: alvo.valor / principal.b.valor, precisaEstado: false, motivo: null, principal };
  return { fator: null, precisaEstado: false, principal,
    motivo: rend.valor > 0 ? `A ficha rende em ${ficha.rendUn}; informe a quantidade nessa medida.` : "A ficha não tem rendimento cadastrado para fazer a conta." };
}

/**
 * A ficha multiplicada. Ingredientes em gramas/ml; rendimento novo é estimativa.
 */
export function receitaNaMedida(ficha, pedido = {}) {
  const r = fatorDoPedido(ficha, pedido);
  const fator = r.fator;
  const ingredientes = (ficha.ingredientes || []).map((ing, i) => {
    const q = Number(ing.qtd);
    const novo = fator != null && Number.isFinite(q) ? q * fator : null;
    return { nome: ing.nome, base: !!ing.base, principal: r.principal?.i === i, texto: novo == null ? "não cadastrado" : quantidadeTexto(novo, ing.unidade) };
  });
  const rend = rendimentoBase(ficha);
  let rendeTexto = null;
  if (rend.valor > 0 && fator != null) {
    const v = rend.valor * fator;
    rendeTexto = rend.base === "g" || rend.base === "ml" ? quantidadeTexto(v, rend.base)
      : `${fmt(Math.round(v * 10) / 10, 1)} ${ficha.rendUn || "porções"}`;
  }
  return { fator, precisaEstado: r.precisaEstado, motivo: r.motivo, principal: r.principal ? { nome: r.principal.nome } : null, ingredientes, rendeTexto, mudou: fator != null && Math.abs(fator - 1) > 0.001 };
}

/** Passos do modo de preparo (texto livre numerado ou etapas cadastradas). */
export function passosDaFicha(ficha) {
  if (ficha?.etapas?.length) return ficha.etapas.map((e) => limpo(e.instrucao || e.titulo)).filter(Boolean);
  const linhas = String(ficha?.modoPreparo || "").split(/\r?\n/).map((l) => limpo(l.replace(/^\s*\d{1,2}\s*[.):º°-]+\s*/, "").replace(/^\s*[•·*-]\s*/, ""))).filter(Boolean);
  if (linhas.length === 1) return linhas[0].split(/(?<=[.!])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z])/).map(limpo).filter((x) => x.length > 1);
  return linhas;
}

// ─── Janta da equipe (dono, 22/11/2026) ─────────────────────────────────────
// "janta" → hoje é dia tal, a janta é essa → quantas pessoas (1 a 12 ou
// digitar) → as quantidades, as receitas multiplicadas e o prato de cada um.

const DIAS = { domingo: "dom", segunda: "seg", terca: "ter", quarta: "qua", quinta: "qui", sexta: "sex", sabado: "sab" };
const ORDEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

/** "janta", "janta de hoje", "janta de amanhã", "janta de quinta" → { dia } ou null. */
export function interpretarJanta(texto, hoje = new Date()) {
  const t = semAcento(limpo(texto)).replace(/[?!.]+$/g, "");
  if (!/\bjanta(r)?\b/.test(t) || t.length > 60) return null;
  const resto = t.replace(/\bjanta(r)?\b/g, " ").replace(/\b(a|o|da|de|do|dos|das|para|pra|hoje|equipe|funcionarios?|pessoal|qual|e|feira|como|vai|ser|fica|ficou|mostra|me)\b/g, " ").replace(/-/g, " ").trim();
  let dia = ORDEM[hoje.getDay()];
  if (/\bamanha\b/.test(t)) dia = ORDEM[(hoje.getDay() + 1) % 7];
  for (const [nome, id] of Object.entries(DIAS)) if (new RegExp(`\\b${nome}\\b`).test(t)) dia = id;
  const sobra = resto.replace(/\bamanha\b/g, " ").replace(new RegExp(`\\b(${Object.keys(DIAS).join("|")})\\b`, "g"), " ").trim();
  if (sobra) return null; // "custo da janta do mês" etc. segue para o servidor
  return { dia };
}

/** Ficha guardada no aparelho → formato que a conta da janta usa. */
export function fichaParaJanta(f) {
  return {
    id: f.id, nome_receita: f.nome, rendimento_porcoes: f.rendQtd, rendimento_unidade: f.rendUn, peso_porcao_g: f.porcaoG, modo_preparo: f.modoPreparo,
    fichas_ingredientes: (f.ingredientes || []).map((i) => ({ quantidade: i.qtd, nome: i.nome, unidade: i.unidade })),
  };
}

function respostaDaJanta(texto, cache) {
  const c = lerComando(texto);
  const pedido = c?.janta ? { dia: c.dia } : interpretarJanta(texto);
  if (!pedido) return null;
  if (!cache) return null; // aparelho ainda sem nada guardado: o servidor responde
  const janta = cache.janta;
  if (!janta) {
    return { tipo: "local", local: true, texto: "A janta da equipe ainda não foi montada. O dono monta em RH › Janta dos funcionários." };
  }
  // só as fichas usadas na janta vão junto (o resto fica no aparelho)
  const ids = new Set([...(janta.fixos || []), ...Object.values(janta.dias || {}).flatMap((d) => (d.pratos || []).flatMap((p) => p.itens || []))].map((i) => i.ficha_id).filter(Boolean));
  const fichas = (cache.fichas || []).filter((f) => ids.has(f.id)).map(fichaParaJanta);
  return { tipo: "local", local: true, texto: "Janta", blocos: [{ tipo: "janta", janta, dia: pedido.dia, fichas }] };
}
