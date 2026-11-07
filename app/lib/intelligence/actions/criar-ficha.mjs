// AÇÃO recipe.create — montar uma ficha técnica conversando (Assistente Héfisto).
//
//   "Vamos montar uma receita. O nome vai ser molho de tomate, e vai tomate,
//    sal, alho, pimenta do reino."
//
// A conversa vai perguntando o que falta, UMA coisa por vez:
//   nome → ingredientes → para cada ingrediente: qual é no cadastro (ou
//   cadastrar o que não existe: quanto vem na embalagem e quanto custa) e
//   quanto vai → quanto rendeu → base ou prato → (prato) preço de venda →
//   prévia com custo total, custo por kg/porção, lucro → Confirmar.
//
// Regras:
//   - o custo é o da tela de fichas (custoDeProduzirFicha: perda do cadastro,
//     subfichas/bases), nunca uma conta à parte;
//   - nada é gravado antes do Confirmar; ingrediente novo só entra no cadastro
//     junto com a ficha, no executor;
//   - o que a pessoa não disse é perguntado, nunca inventado;
//   - grava pelo cliente do PRÓPRIO usuário (RLS do banco), como a tela.
//
// Estado da conversa: os parâmetros da ação (no servidor). `pendente` diz o
// que a última pergunta pediu; a resposta chega no campo "resposta" e é
// aplicada por aplicarResposta.

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo } from "../metrics/produtos.mjs";
import { carregarFichasComCusto, custoDetalhado, CAMPOS_INSUMO_CUSTO, quantidadeNoRendimento } from "../metrics/assistente.mjs";
import { calcularPrecoNormalizado } from "../../ingredientes-utils.mjs";

export const MAX_ITENS = 30;

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, c = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Texto: dobrar acentos sem mudar posições (o nome mantém o acento original) ─
const dobrar = (t) => [...String(t || "")].map((c) => c.normalize("NFD")[0] || c).join("").toLowerCase();
const limpar = (t) => String(t || "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
const capitalizar = (t) => { const x = limpar(t); return x ? x[0].toUpperCase() + x.slice(1) : x; };

const UNIDADE = {
  kg: "kg", kgs: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg",
  g: "g", gr: "g", grama: "g", gramas: "g",
  l: "l", lt: "l", litro: "l", litros: "l",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  un: "un", und: "un", unidade: "un", unidades: "un", peca: "un", pecas: "un",
  porcao: "porcao", porcoes: "porcao",
};
const RE_UN = "(kg|kgs|quilos?|kilos?|g|gr|gramas?|l|lt|litros?|ml|mililitros?|un|und|unidades?|pecas?|porcao|porcoes)";
const NUM = "(\\d+(?:[.,]\\d+)?)";
const PALAVRA_NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meio: 0.5, meia: 0.5 };
const paraNumero = (x) => Number(String(x).replace(/\./g, (m, i, s) => (/,\d/.test(s) ? "" : m)).replace(",", "."));

/** "2 kg", "300g", "meio quilo", "2" → { quantidade, unidade|null } | null */
export function lerQuantidade(texto) {
  const f = dobrar(texto).replace(/\bmeio quilo\b/, "0.5 kg").replace(/\bmeio litro\b/, "0.5 l");
  const m = f.match(new RegExp(`${NUM}\\s*${RE_UN}?\\b`));
  if (m) {
    const q = paraNumero(m[1]);
    return q > 0 ? { quantidade: q, unidade: m[2] ? UNIDADE[m[2]] : null } : null;
  }
  const w = f.match(new RegExp(`\\b(${Object.keys(PALAVRA_NUM).join("|")})\\s+${RE_UN}\\b`));
  return w ? { quantidade: PALAVRA_NUM[w[1]], unidade: UNIDADE[w[2]] } : null;
}

/** "1 kg por 8,90", "pacote de 500 g a R$ 4,50", "8,90 o quilo" → embalagem e preço. */
export function lerCadastro(texto) {
  const f = dobrar(texto).replace(/r\$\s*/g, "r$ ");
  const comUn = [];
  const semUn = [];
  const re = new RegExp(`(r\\$ )?${NUM}\\s*${RE_UN}?\\b`, "g");
  let m;
  while ((m = re.exec(f))) {
    const n = paraNumero(m[2]);
    if (!(n > 0)) continue;
    if (m[3] && !m[1] && UNIDADE[m[3]] !== "porcao") comUn.push({ n, u: UNIDADE[m[3]] });
    else semUn.push({ n, dinheiro: !!m[1] });
  }
  let emb = comUn[0] || null;
  if (!emb) {
    if (/\b(o|por|cada|1) ?(quilo|kg|kilo)\b/.test(f)) emb = { n: 1, u: "kg" };
    else if (/\b(o|por|cada|1) ?(litro|l)\b/.test(f)) emb = { n: 1, u: "l" };
    else if (/\b(a|por|cada) ?unidade\b|\bcada\b/.test(f)) emb = { n: 1, u: "un" };
  }
  const preco = semUn.find((x) => x.dinheiro) || semUn[semUn.length - 1];
  if (!emb || !preco) return null;
  return { tamanho: emb.n, unidade: emb.u, preco: Math.round(preco.n * 100) / 100 };
}

/** "3 kg", "rendeu 10 porções", "2 litros" → { rendimento, unidade } (sem unidade → null). */
export function lerRendimento(texto) {
  const q = lerQuantidade(texto);
  if (!q?.unidade) return null;
  return { rendimento: q.quantidade, unidade: q.unidade === "un" ? "porcao" : q.unidade };
}

/** "50", "R$ 49,90", "50 reais" → preço; "depois", "não sei" → 0 (definir depois). */
export function lerPreco(texto) {
  const f = dobrar(texto);
  if (/\b(depois|nao sei|sem preco|pular|ainda nao)\b/.test(f)) return 0;
  const m = f.match(new RegExp(NUM));
  const v = m ? paraNumero(m[1]) : NaN;
  return v > 0 ? Math.round(v * 100) / 100 : null;
}

/** "tomate 2 kg, sal 20 g, alho e pimenta do reino" → [{ termo, quantidade?, unidade? }] */
export function lerIngredientes(texto) {
  const partes = String(texto || "")
    .replace(/(\d),(\d)/g, "$1\u0000$2")
    .split(/[,;\n]+|\s+e\s+(?=\S)/i)
    .map((p) => p.replace(/\u0000/g, ",").trim())
    .filter(Boolean);
  const out = [];
  for (const p of partes) {
    const q = lerQuantidade(p);
    const re = new RegExp(`${NUM}\\s*${RE_UN}?\\b`, "i");
    let termo = q ? dobrar(p).match(re) ? removerTrecho(p, re) : p : p;
    termo = limpar(termo.replace(/^(e|de|da|do|com|mais|um pouco de|uma pitada de|a gosto)\s+/i, "").replace(/\s+(a gosto|q\.?b\.?)$/i, ""));
    if (!termo || termo.length < 2) continue;
    out.push({ termo: capitalizar(termo), ...(q ? { quantidade: q.quantidade, unidade: q.unidade } : {}) });
  }
  return out.slice(0, MAX_ITENS);
}

function removerTrecho(original, re) {
  const f = dobrar(original);
  const m = f.match(re);
  if (!m) return original;
  return `${original.slice(0, m.index)} ${original.slice(m.index + m[0].length)}`.replace(/\s+/g, " ").trim();
}

/**
 * Lê o pedido inicial ("o nome vai ser molho de tomate, e vai tomate, sal…").
 * @param {string} texto
 * @param {object|null} conversa  referência da conversa (ficha citada antes)
 */
export function paramsDoComando(texto, conversa = null) {
  const original = String(texto || "");
  const f = dobrar(original);
  const p = { nome: null, tipo: null, itens: [], fichaBaseId: null };
  if (/\bprato\b/.test(f)) p.tipo = "prato";
  else if (/\b(base|pre[ -]?preparo)\b/.test(f)) p.tipo = "base";

  // "com essa base" / "com essa receita": a ficha citada na conversa entra como ingrediente
  if (/\b(essa|esta|dessa|desta|nessa|com a) (base|receita|ficha)\b/.test(f) && conversa?.ficha?.id && UUID.test(conversa.ficha.id)) {
    p.fichaBaseId = conversa.ficha.id;
    p.itens.push({ termo: capitalizar(conversa.ficha.nome || "Base"), fichaId: conversa.ficha.id });
  }

  const reNome = /\b(?:o nome (?:dele|dela|da receita|do prato|da ficha)?\s*(?:vai ser|e|sera)|nome:|chamad[oa]|com o nome(?: de)?|(?:receita|ficha|prato|base) (?:de|do|da)(?! (?:tecnica|ficha|receita)\b))\s+/;
  const mNome = f.match(reNome);
  let resto = f;
  let offsetResto = 0;
  if (mNome) {
    const ini = mNome.index + mNome[0].length;
    const fimRel = f.slice(ini).search(/[,.;:]|\s+e\s+(?:ele|ela)?\s*(?:vai|leva|tem)\b|\s+(?:vai|leva|levando|com|que leva|ingredientes)\b/);
    const fim = fimRel < 0 ? f.length : ini + fimRel;
    const nome = limpar(original.slice(ini, fim));
    if (nome && nome.length <= 80 && !/^(essa|esta|dessa) /.test(dobrar(nome))) p.nome = capitalizar(nome);
    resto = f.slice(fim);
    offsetResto = fim;
  }
  const mIng = resto.match(/\b(?:vai|leva|levando|ingredientes?|com|tem)\b\s*:?\s*/);
  if (mIng && !/^com (essa|esta|a) (base|receita|ficha)/.test(resto.slice(mIng.index))) {
    const ini = offsetResto + mIng.index + mIng[0].length;
    const lista = original.slice(ini).replace(/^(?:os ingredientes|ingredientes)\s*:?\s*/i, "");
    p.itens.push(...lerIngredientes(lista));
  }
  return p;
}

// ─── Parâmetros ──────────────────────────────────────────────────────────────

const itemSchema = s.object({
  termo: s.string({ min: 1, max: 80 }),
  insumoId: s.opcional(s.uuid()),
  fichaId: s.opcional(s.uuid()),
  novo: s.opcional(s.object({ tamanho: s.number({ min: 0.001, max: 100000 }), unidade: s.enum(["kg", "g", "l", "ml", "un"]), preco: s.number({ min: 0, max: 1000000 }) })),
  quantidade: s.opcional(s.number({ min: 0.0001, max: 100000 })),
  unidade: s.opcional(s.enum(["kg", "g", "l", "ml", "un", "porcao"])),
  cadastrar: s.opcional(s.boolean()),
});

export const paramsSchema = s.object({
  nome: s.opcional(s.string({ min: 1, max: 80 })),
  tipo: s.opcional(s.enum(["base", "prato"])),
  itens: s.opcional(s.array(itemSchema, { max: MAX_ITENS })),
  fichaBaseId: s.opcional(s.uuid()),
  extrasOk: s.opcional(s.boolean()),
  rendimento: s.opcional(s.number({ min: 0.001, max: 100000 })),
  rendimentoUnidade: s.opcional(s.enum(["kg", "g", "l", "ml", "porcao"])),
  precoVenda: s.opcional(s.number({ min: 0, max: 1000000 })),
  pendente: s.opcional(s.object({ tipo: s.string({ max: 20 }), indice: s.opcional(s.number({ min: 0, max: MAX_ITENS, inteiro: true })) })),
  aviso: s.opcional(s.string({ max: 200 })),
  resposta: s.opcional(s.string({ min: 1, max: 120 })),
});

/**
 * Aplica a resposta do usuário à pergunta pendente. Resposta que não dá para
 * entender volta como `aviso` e a mesma pergunta é feita de novo.
 */
export function aplicarResposta(params, campo, valor) {
  const p = { ...params, itens: [...(params.itens || [])].map((x) => ({ ...x })), aviso: null, resposta: null };
  const pend = params.pendente || {};
  const v = String(valor ?? "").trim();
  const f = dobrar(v);
  const i = pend.indice;
  const item = Number.isInteger(i) ? p.itens[i] : null;
  const tirar = /^(tirar|tira|remover|remove|nao vai|sem esse|retirar)\b/.test(f);
  switch (pend.tipo) {
    case "nome":
      if (limpar(v).length >= 2) p.nome = capitalizar(v).slice(0, 80); else p.aviso = "Preciso de um nome.";
      break;
    case "ingredientes":
    case "extras": {
      if (pend.tipo === "extras" && /^(nao|n|nada|so isso|so|pronto|acabou|nenhum|sem mais)\b/.test(f)) { p.extrasOk = true; break; }
      const novos = lerIngredientes(v);
      if (!novos.length) p.aviso = "Não entendi os ingredientes.";
      else { p.itens = [...p.itens, ...novos].slice(0, MAX_ITENS); if (pend.tipo === "extras") p.extrasOk = true; }
      break;
    }
    case "escolha":
      if (!item) break;
      if (tirar || v === "remover") p.itens.splice(i, 1);
      else if (v === "novo") item.cadastrar = true;
      else if (/^i:/.test(v) && UUID.test(v.slice(2))) item.insumoId = v.slice(2);
      else if (/^f:/.test(v) && UUID.test(v.slice(2))) item.fichaId = v.slice(2);
      else if (limpar(v).length >= 2) item.termo = capitalizar(v).slice(0, 80);
      break;
    case "cadastro": {
      if (!item) break;
      if (tirar) { p.itens.splice(i, 1); break; }
      const c = lerCadastro(v);
      if (c) { item.novo = c; delete item.cadastrar; } else p.aviso = "Não entendi a embalagem e o preço.";
      break;
    }
    case "quantidade": {
      if (!item) break;
      if (tirar) { p.itens.splice(i, 1); break; }
      const q = lerQuantidade(v);
      if (q) { item.quantidade = q.quantidade; item.unidade = q.unidade; } else p.aviso = "Não entendi a quantidade.";
      break;
    }
    case "rendimento": {
      const r = lerRendimento(v);
      if (r) { p.rendimento = r.rendimento; p.rendimentoUnidade = r.unidade; } else p.aviso = "Rendeu quanto e em quê? Ex.: 3 kg ou 10 porções.";
      break;
    }
    case "tipo":
      if (/\b(base|pre ?preparo|preparo)\b/.test(f)) p.tipo = "base";
      else if (/\bprato\b|\bvend/.test(f)) p.tipo = "prato";
      else p.aviso = "É base ou prato?";
      break;
    case "preco": {
      const pr = lerPreco(v);
      if (pr != null) p.precoVenda = pr; else p.aviso = "Não entendi o preço.";
      break;
    }
    default:
      break;
  }
  // nada de item com termo inválido: o schema recusaria a ação inteira
  p.itens = p.itens.filter((x) => x.termo).map(({ cadastrar, ...x }) => (cadastrar ? { ...x, cadastrar } : x));
  return p;
}

// ─── Preparar ────────────────────────────────────────────────────────────────

const FAMILIA = { kg: "m", g: "m", l: "v", ml: "v", un: "u", garrafa: "u", lata: "u" };
const FATOR = { kg: 1000, g: 1, l: 1000, ml: 1, un: 1, garrafa: 1, lata: 1 };

/** Quantidade dita → unidade do cadastro do insumo (g↔kg, ml↔L). Incompatível → null. */
export function paraUnidadeDoInsumo(quantidade, unidadeDita, unidadeInsumo) {
  const para = String(unidadeInsumo || "un").toLowerCase();
  const de = unidadeDita ? String(unidadeDita).toLowerCase() : para;
  if (!FAMILIA[de] || !FAMILIA[para] || FAMILIA[de] !== FAMILIA[para]) return null;
  return (Number(quantidade) * FATOR[de]) / FATOR[para];
}

const ROTULO_UN = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un", porcao: "porção(ões)" };
const rotuloRend = (q, u) => (u === "porcao" ? `${num(q)} ${Number(q) === 1 ? "porção" : "porções"}` : `${num(q)} ${ROTULO_UN[u] || u}`);

const pergunta = (tipo, texto, { indice = null, opcoes = null, aviso = null } = {}) => ({
  faltando: {
    campo: "resposta", texto: aviso ? `${aviso} ${texto}` : texto, opcoes, livre: !opcoes,
    persistir: { pendente: { tipo, ...(indice != null ? { indice } : {}) }, aviso: null },
  },
});

async function preparar(ctx, params) {
  const p = params || {};
  const aviso = p.aviso || null;
  const itens = p.itens || [];
  const ehPrato = p.tipo === "prato";
  const oQue = ehPrato ? "o prato" : "a receita";
  const naReceita = ehPrato ? "no prato" : "na receita";

  if (!p.nome) return pergunta("nome", ehPrato ? "Qual vai ser o nome do prato?" : "Qual vai ser o nome da receita?", { aviso });
  const deBase = itens.length === 1 && itens[0].fichaId && p.fichaBaseId;
  if (!itens.length) return pergunta("ingredientes", `Quais ingredientes vão em ${p.nome}? Pode mandar tudo de uma vez, com ou sem quantidade. Ex.: "tomate 2 kg, sal 20 g, alho".`, { aviso });

  const { todas, ativas } = await carregarFichasComCusto(ctx.dbe);
  const insumos = (await ler(ctx.dbe.from("insumos").select(CAMPOS_INSUMO_CUSTO).order("nome"), "insumos")) || [];
  const insPorId = new Map(insumos.map((x) => [x.id, x]));
  const fichaPorId = new Map(ativas.map((x) => [x.id, x]));
  const bases = ativas.filter((x) => x.eh_base);
  const base = p.fichaBaseId ? fichaPorId.get(p.fichaBaseId) : null;
  if (p.fichaBaseId && !base) return { erro: "A base citada não foi encontrada nesta unidade." };

  // setor: o da base; senão o que mais aparece nos ingredientes; senão cozinha
  const linhas = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    // 1. Qual é no cadastro
    let alvo = null;
    if (it.insumoId) {
      const ins = insPorId.get(it.insumoId);
      if (!ins) return { erro: `O produto escolhido para "${it.termo}" não existe nesta unidade.` };
      alvo = { tipo: "insumo", insumo: ins };
    } else if (it.fichaId) {
      const fb = fichaPorId.get(it.fichaId);
      if (!fb) return { erro: `A ficha escolhida para "${it.termo}" não existe nesta unidade.` };
      alvo = { tipo: "ficha", ficha: fb };
    } else if (it.novo) {
      alvo = { tipo: "novo" };
    } else {
      const lista = [...insumos.map((x) => ({ ...x, _t: "i" })), ...bases.map((x) => ({ id: x.id, nome: x.nome, nome_interno: x.nome_interno, _t: "f" }))];
      const c = it.cadastrar ? [] : candidatosDoTermo(lista, it.termo, 6);
      if (c.length === 1) alvo = c[0]._t === "i" ? { tipo: "insumo", insumo: insPorId.get(c[0].id) } : { tipo: "ficha", ficha: fichaPorId.get(c[0].id) };
      else if (c.length > 1) {
        return pergunta("escolha", `Qual "${it.termo}" vai em ${p.nome}?`, {
          indice: i, aviso,
          opcoes: [...c.map((x) => ({ id: `${x._t}:${x.id}`, rotulo: x._t === "f" ? `${x.nome} (base da casa)` : x.nome })), { id: "novo", rotulo: `Cadastrar "${it.termo}" novo` }, { id: "remover", rotulo: "Tirar da receita" }],
        });
      } else {
        return pergunta("cadastro", `"${it.termo}" não está cadastrado. Vamos cadastrar: quanto vem na embalagem e quanto custa? Ex.: "1 kg por 8,90" ou "pacote de 500 g a 4,50". (Se não vai, responda "tirar".)`, { indice: i, aviso });
      }
    }
    // 2. Quanto vai
    if (it.quantidade == null) {
      const un = alvo.tipo === "ficha" ? ROTULO_UN[alvo.ficha.rendimento_unidade] || alvo.ficha.rendimento_unidade : alvo.tipo === "insumo" ? ROTULO_UN[String(alvo.insumo.unidade_medida).toLowerCase()] || alvo.insumo.unidade_medida : ROTULO_UN[it.novo.unidade];
      const nomeAlvo = alvo.tipo === "ficha" ? alvo.ficha.nome : alvo.tipo === "insumo" ? alvo.insumo.nome : it.termo;
      return pergunta("quantidade", `Quanto de ${nomeAlvo} vai ${naReceita}? (em ${un}, ou diga a unidade: "300 g", "2 kg")`, { indice: i, aviso });
    }
    let quantidade;
    let insumo = null;
    if (alvo.tipo === "ficha") {
      const conv = quantidadeNoRendimento({ quantidade: it.quantidade, unidade: it.unidade && it.unidade !== "porcao" ? it.unidade : null, ficha: alvo.ficha });
      if (!conv) return pergunta("quantidade", `${alvo.ficha.nome} rende em ${ROTULO_UN[alvo.ficha.rendimento_unidade] || alvo.ficha.rendimento_unidade}. Quanto vai, nessa unidade?`, { indice: i, aviso: "Não consegui converter essa unidade." });
      quantidade = conv.q;
    } else {
      insumo = alvo.tipo === "insumo" ? alvo.insumo : novoInsumo(it, null);
      quantidade = paraUnidadeDoInsumo(it.quantidade, it.unidade === "porcao" ? null : it.unidade, insumo.unidade_medida);
      if (quantidade == null) return pergunta("quantidade", `${insumo.nome} é controlado em ${ROTULO_UN[String(insumo.unidade_medida).toLowerCase()] || insumo.unidade_medida}. Quanto vai, nessa unidade?`, { indice: i, aviso: "Essa unidade não combina com o cadastro." });
    }
    linhas.push({ it, alvo, insumo, quantidade: Math.round(quantidade * 1e6) / 1e6 });
  }

  // prato montado a partir de uma base: mais algum ingrediente?
  if (deBase && !p.extrasOk) return pergunta("extras", `Vai mais algum ingrediente além de ${base.nome}? Mande a lista ou responda "não".`, { aviso });

  const contagem = {};
  for (const l of linhas) {
    const d = l.alvo.tipo === "ficha" ? l.alvo.ficha.departamento : l.insumo?.departamento;
    if (d) contagem[d] = (contagem[d] || 0) + 1;
  }
  const departamento = base?.departamento || Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] || "cozinha";

  // custo pela conta da tela de fichas
  const novos = [];
  const fichaNova = {
    id: "ficha-nova", rendimento_porcoes: p.rendimento || 0, rendimento_unidade: p.rendimentoUnidade || null, custo_embalagens_total: 0,
    fichas_ingredientes: linhas.map((l) => {
      if (l.alvo.tipo === "ficha") return { subficha_id: l.alvo.ficha.id, quantidade: l.quantidade, fator_correcao: 0, insumos: null };
      if (l.alvo.tipo === "novo") {
        const n = novoInsumo(l.it, departamento);
        novos.push(n);
        return { insumo_id: null, quantidade: l.quantidade, fator_correcao: 0, insumos: n, _novo: novos.length - 1 };
      }
      return { insumo_id: l.insumo.id, quantidade: l.quantidade, fator_correcao: 0, insumos: l.insumo };
    }),
  };
  const custo = custoDetalhado(fichaNova, todas);

  if (!p.rendimento) {
    const doBase = deBase || (ehPrato && linhas.length <= 3);
    return pergunta("rendimento", `Custo dos ingredientes: ${brl(custo.total)}. Quanto ${oQue} rende? Ex.: ${doBase ? "1 porção" : "3 kg, 2 L ou 10 porções"}.`, {
      aviso, opcoes: null,
    });
  }
  if (!p.tipo) return pergunta("tipo", `Rendeu ${rotuloRend(p.rendimento, p.rendimentoUnidade)} e custou ${brl(custo.total)}. Isso é uma base (vai em outros pratos) ou um prato (vendido)?`, { aviso, opcoes: [{ id: "base", rotulo: "Base" }, { id: "prato", rotulo: "Prato" }] });

  const porUn = custo.total / p.rendimento;
  const custoPorcao = p.rendimentoUnidade === "porcao" ? porUn : null;
  if (p.tipo === "prato" && p.precoVenda == null) {
    const ref = custoPorcao != null ? `O custo por porção é ${brl(custoPorcao)}` : `O custo é ${brl(porUn)} por ${ROTULO_UN[p.rendimentoUnidade]}`;
    return pergunta("preco", `${ref}. Por quanto vai vender${custoPorcao != null ? " a porção" : ""}? (ou "depois")`, { aviso });
  }

  // ─── prévia ───
  const linhasPrevia = [
    { rotulo: "Nome", valor: p.nome },
    { rotulo: "Tipo", valor: p.tipo === "base" ? "Base (pré-preparo)" : "Prato" },
    { rotulo: "Setor", valor: departamento === "bar" ? "Bar" : departamento === "cozinha" ? "Cozinha" : departamento },
    ...linhas.map((l, n) => ({
      rotulo: l.alvo.tipo === "ficha" ? `${l.alvo.ficha.nome} (base)` : l.alvo.tipo === "novo" ? `${l.it.termo} (novo)` : l.insumo.nome,
      valor: `${num(l.it.quantidade)} ${ROTULO_UN[l.it.unidade] || (l.alvo.tipo === "ficha" ? ROTULO_UN[l.alvo.ficha.rendimento_unidade] || l.alvo.ficha.rendimento_unidade : ROTULO_UN[String(l.insumo.unidade_medida).toLowerCase()] || l.insumo.unidade_medida)} · ${brl(custo.linhas[n]?.custo ?? 0)}`,
    })),
    ...novos.map((n) => ({ rotulo: "Cadastrar ingrediente", valor: `${n.nome}: ${num(n.tamanho_embalagem)} ${ROTULO_UN[n.unidade_medida]} por ${brl(n.custo_compra)}` })),
    { rotulo: "Custo total", valor: brl(custo.total) },
    { rotulo: "Rendimento", valor: rotuloRend(p.rendimento, p.rendimentoUnidade) },
    { rotulo: p.rendimentoUnidade === "porcao" ? "Custo por porção" : `Custo por ${ROTULO_UN[p.rendimentoUnidade]}`, valor: brl(porUn) },
  ];
  let lucro = null;
  if (p.tipo === "prato" && p.precoVenda > 0) {
    const custoVenda = porUn;
    lucro = { preco: p.precoVenda, custo: custoVenda, lucro: p.precoVenda - custoVenda, cmvPct: (custoVenda / p.precoVenda) * 100 };
    linhasPrevia.push(
      { rotulo: "Preço de venda", valor: brl(p.precoVenda) },
      { rotulo: "Lucro bruto por venda", valor: `${brl(lucro.lucro)} (${num(100 - lucro.cmvPct, 1)}%)` },
      { rotulo: "CMV do prato", valor: `${num(lucro.cmvPct, 1)}%` },
    );
  }
  if (custo.semPreco.length) linhasPrevia.push({ rotulo: "Atenção", valor: `Sem preço no cadastro: ${custo.semPreco.join(", ")} (custo abaixo do real)` });

  return {
    pronto: {
      preview: {
        titulo: p.tipo === "base" ? "Criar base na ficha técnica" : "Criar prato na ficha técnica",
        entidade: null, linhas: linhasPrevia,
        impacto: lucro ? { texto: `Lucro bruto de ${brl(lucro.lucro)} por venda (SIMULAÇÃO: sem impostos, taxas e mão de obra).` } : null,
      },
      payload: {
        unidade_id: ctx.escopo.unidadeId,
        ficha: {
          nome_receita: p.nome, departamento, eh_base: p.tipo === "base", rendimento_porcoes: p.rendimento,
          rendimento_unidade: p.rendimentoUnidade, preco_venda: p.tipo === "prato" && p.precoVenda > 0 ? p.precoVenda : null,
          versao: "1.0", status: "ativa", ativo: true, observacoes: "Criada pela conversa (Assistente Héfisto). Falta o modo de preparo.",
        },
        ingredientes: fichaNova.fichas_ingredientes.map((x) => ({ insumo_id: x.insumo_id || null, subficha_id: x.subficha_id || null, quantidade: x.quantidade, fator_correcao: 0, novo: x._novo ?? null })),
        novos: novos.map(({ _novo, ...n }) => n),
        resumo: { nome: p.nome, tipo: p.tipo, custoTotal: custo.total, rendimento: p.rendimento, rendimentoUnidade: p.rendimentoUnidade, custoPorUnidade: porUn, lucro },
      },
    },
  };
}

/** Ingrediente novo no formato da tela de Ingredientes (salvarInsumo). */
function novoInsumo(it, departamento) {
  const n = it.novo;
  return {
    nome: it.termo, departamento: departamento || "cozinha", unidade_medida: n.unidade, tamanho_embalagem: n.tamanho,
    custo_compra: n.preco, custo_unitario: n.preco / n.tamanho, preco_normalizado: calcularPrecoNormalizado(n.tamanho, n.unidade, n.preco),
    categoria: "Outros", tipo: "ingrediente",
  };
}

// ─── Executar ────────────────────────────────────────────────────────────────

async function executar(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const db = ctx.dbUsuario;
  const unidade = ctx.escopo.unidadeId;
  // 1. Ingredientes novos (reaproveita se alguém cadastrou o mesmo nome nesse meio-tempo)
  const idsNovos = [];
  for (const n of payload.novos || []) {
    const { data: ja } = await db.from("insumos").select("id, nome").eq("unidade_id", unidade).eq("nome", n.nome).maybeSingle();
    if (ja?.id) { idsNovos.push(ja.id); continue; }
    const { data, error } = await db.from("insumos").insert([{ ...n, unidade_id: unidade, preco_atualizado_em: new Date().toISOString() }]).select("id").single();
    if (error || !data?.id) return { ok: false, erro: `Não consegui cadastrar ${n.nome}: ${error?.message || "sem resposta do banco"}.` };
    idsNovos.push(data.id);
  }
  // 2. Ficha
  const { data: ficha, error: e1 } = await db.from("fichas_tecnicas").insert([{ ...payload.ficha, unidade_id: unidade }]).select("id").single();
  if (e1 || !ficha?.id) return { ok: false, erro: `Não consegui criar a ficha: ${e1?.message || "sem resposta do banco"}.` };
  // 3. Ingredientes da ficha (falhou → a ficha recém-criada sai, para não ficar vazia)
  const itens = (payload.ingredientes || []).map((x) => ({
    ficha_id: ficha.id, insumo_id: x.novo != null ? idsNovos[x.novo] : x.insumo_id, subficha_id: x.subficha_id, quantidade: x.quantidade, fator_correcao: x.fator_correcao || 0,
  }));
  if (itens.length) {
    const { error: e2 } = await db.from("fichas_ingredientes").insert(itens);
    if (e2) {
      await db.from("fichas_tecnicas").delete().eq("id", ficha.id).eq("unidade_id", unidade);
      return { ok: false, erro: `Não consegui gravar os ingredientes da ficha: ${e2.message}.` };
    }
  }
  return { ok: true, resultado: { fichaId: ficha.id, novosInsumos: idsNovos.length, ...payload.resumo }, antes: null, depois: { fichaId: ficha.id } };
}

/** Resposta depois de executar: texto, linhas e a ficha como referência da conversa. */
function resumoResultado(rec) {
  const r = rec.resultado || {};
  const un = ROTULO_UN[r.rendimentoUnidade] || r.rendimentoUnidade;
  const linhas = [
    { rotulo: "Ficha", valor: r.nome },
    { rotulo: "Custo total", valor: brl(r.custoTotal) },
    { rotulo: "Rendimento", valor: rotuloRend(r.rendimento, r.rendimentoUnidade) },
    { rotulo: r.rendimentoUnidade === "porcao" ? "Custo por porção" : `Custo por ${un}`, valor: brl(r.custoPorUnidade) },
    ...(r.lucro ? [{ rotulo: "Lucro bruto por venda", valor: `${brl(r.lucro.lucro)} (CMV ${num(r.lucro.cmvPct, 1)}%)` }] : []),
    ...(r.novosInsumos ? [{ rotulo: "Ingredientes cadastrados", valor: String(r.novosInsumos) }] : []),
  ];
  const sugestoes = [];
  if (r.rendimentoUnidade && ["kg", "g", "l", "ml"].includes(r.rendimentoUnidade)) sugestoes.push(`Quanto custa 200 ${["l", "ml"].includes(r.rendimentoUnidade) ? "ml" : "g"} dessa receita?`);
  if (r.tipo === "base") sugestoes.push("Vamos montar um prato com essa base");
  return {
    texto: r.tipo === "base" ? `Base criada. ${r.nome} custa ${brl(r.custoTotal)} e rende ${rotuloRend(r.rendimento, r.rendimentoUnidade)}.` : `Prato criado. ${r.nome}: custo ${brl(r.custoPorUnidade)} por ${r.rendimentoUnidade === "porcao" ? "porção" : un}.`,
    linhas, sugestoes,
    acoes: [{ rotulo: "Abrir fichas técnicas", rota: "/dashboard/operacao/fichas" }],
    referencia: r.fichaId ? { intencao: "fichas.criar", produto: null, insights: null, ficha: { id: r.fichaId, nome: r.nome } } : null,
  };
}

export const criarFicha = Object.freeze({
  id: "recipe.create",
  nome: "Criar ficha técnica",
  descricao: "Monta uma ficha técnica (base ou prato) conversando: ingredientes, cadastro do que falta, rendimento, custo, preço e lucro.",
  modulo: "fichas",
  capacidade: "criar_ficha",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["nome", "tipo", "itens", "fichaBaseId", "extrasOk", "rendimento", "rendimentoUnidade", "precoVenda", "pendente", "aviso", "resposta"],
  validacoes: [
    "ingrediente existe no cadastro da unidade (ou é cadastrado junto, com embalagem e preço informados)",
    "base (subficha) é uma ficha ativa da unidade",
    "quantidade na unidade do cadastro (kg↔g, L↔ml)",
    "custo pela mesma conta da tela de fichas",
    "gravação pelo usuário logado (RLS)",
  ],
  rollback: "Arquivar ou excluir a ficha em Fichas técnicas; o ingrediente cadastrado fica no cadastro (pode ser arquivado em Ingredientes).",
  paramsSchema,
  aplicarResposta,
  preparar,
  executar,
  resumoResultado,
});
