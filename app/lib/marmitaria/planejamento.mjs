// Produção do dia pelo Jhon (HDEV-015, pedido do dono 17/11/2026):
//   "Jhon, amanhã precisamos produzir 300 filés de frango empanado" → quanto
//   de frango, farinha de rosca e leite (pela ficha: 140 g cada, 64 g de frango);
//   "com esses 300, 150 vão ser parmegianas" → quanto molho fabricar, quanto
//   molho já tem, alho, sal, açúcar;
//   "amanhã é dia de limpar as fritadeiras" → tarefa + óleo, sal, água (pela
//   ficha de limpeza, se cadastrada);
//   "quanto tenho de frango empanado no estoque… se eu vender, quanto ganho?"
//
// Funções puras. A conta é a das fichas técnicas (necessidadeDeProducao, a
// mesma da tela Planejar): nada é inventado; sem ficha ou rendimento, o Jhon
// diz o que falta (DADOS INSUFICIENTES).

import { necessidadeDeProducao } from "./nucleo.mjs";

const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const r3 = (v) => Math.round(Number(v) * 1000) / 1000;
const PARADAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "com", "em", "no", "na", "para", "pra", "um", "uma", "file", "files", "fileh"]);

/** "filés" → "file", "parmegianas" → "parmegiana", "empanados" → "empanado". */
export function singular(p) {
  const w = fold(p);
  if (w.length <= 3) return w;
  if (w.endsWith("oes")) return `${w.slice(0, -3)}ao`;
  if (w.endsWith("aes")) return `${w.slice(0, -3)}ao`;
  if (w.endsWith("eis")) return `${w.slice(0, -3)}el`;
  if (w.endsWith("res") || w.endsWith("zes")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}
export const tokens = (t) => fold(t).split(/[^a-z0-9]+/).filter((w) => w && !PARADAS.has(w) && !PARADAS.has(singular(w))).map(singular);

/**
 * A ficha que a frase cita ("filés de frango empanado" → "Frango empanado").
 * Ganha a de mais palavras em comum; empate sem vencedor = null (o Jhon pergunta).
 */
export function fichaDaFrase(fichas = [], frase = "", { filtro = null } = {}) {
  const ts = new Set(tokens(frase));
  if (!ts.size) return null;
  const notas = [];
  for (const f of fichas) {
    if (filtro && !filtro(f)) continue;
    const nome = f.nome_receita || f.nome || "";
    const tf = tokens(nome);
    if (!tf.length) continue;
    const comuns = tf.filter((t) => ts.has(t)).length;
    if (!comuns) continue;
    // cobrir o nome todo pesa mais que palavras soltas
    notas.push({ f, nota: comuns + (comuns === tf.length ? 0.5 : 0) - (tf.length - comuns) * 0.1 });
  }
  notas.sort((a, b) => b.nota - a.nota);
  if (!notas.length || (notas[1] && Math.abs(notas[1].nota - notas[0].nota) < 0.01)) return null;
  return notas[0].f;
}

export const ehFichaDeLimpeza = (f) => fold(f?.departamento) === "limpeza" || /\blimp/.test(fold(f?.nome_receita || f?.nome));

/** "amanhã" → hoje + 1; "hoje" → hoje; "depois de amanhã" → hoje + 2. Sem dizer: amanhã. */
export function dataDoPedido(texto, hoje) {
  const t = fold(texto);
  const mais = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  if (/depois de amanha/.test(t)) return { data: mais(2), rotulo: "depois de amanhã" };
  if (/\bhoje\b/.test(t) && !/\bamanha\b/.test(t)) return { data: hoje, rotulo: "hoje" };
  return { data: mais(1), rotulo: "amanhã" };
}

const NUM = /(\d+(?:[.,]\d+)?)\s*(kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?|porc(?:oes|ao)|por[cç][oõ]es|por[cç][aã]o)?\b/;

/**
 * Lê o pedido do dono. Frases com número viram alvos de produção; "limpar X"
 * vira limpeza. O que não casou com nenhuma ficha volta em `semFicha`.
 */
export function lerPedidoDeProducao(texto, { fichas = [], hoje }) {
  const { data, rotulo } = dataDoPedido(texto, hoje);
  const pedacos = String(texto || "").split(/[.;!?\n]+|,(?!\d)|\s+e\s+(?=\d)/i).map((p) => p.trim()).filter(Boolean);
  const alvos = [];
  const limpezas = [];
  const semFicha = [];
  const producao = fichas.filter((f) => !ehFichaDeLimpeza(f) && f.ativo !== false && f.status !== "arquivada");
  for (const p of pedacos) {
    const f = fold(p);
    const limp = f.match(/\blimp(?:ar|eza|a)\b\s*(?:d[aeo]s?\s+)?(.+)?/);
    if (limp) {
      const alvo = (limp[1] || "").replace(/\b(amanha|hoje|dia)\b/g, "").trim();
      const nomeTarefa = alvo ? `Limpar ${alvo}` : "Limpeza";
      limpezas.push({ titulo: nomeTarefa.charAt(0).toUpperCase() + nomeTarefa.slice(1), ficha: fichaDaFrase(fichas, `limpeza ${alvo}`, { filtro: ehFichaDeLimpeza }) });
      continue;
    }
    const m = f.match(NUM);
    if (!m) continue;
    const quantidade = Number(m[1].replace(",", "."));
    if (!(quantidade > 0)) continue;
    const resto = f.slice(f.indexOf(m[0]) + m[0].length).replace(/\b(vao ser|vai ser|serao|sera|viram|vira|de|para)\b/g, " ");
    // "com esses 300" só retoma o número de antes: não é um pedido novo
    if (!tokens(resto).filter((w) => !["esse", "esses", "essa", "essas", "deles", "delas", "isso"].includes(w)).length) continue;
    const ficha = fichaDaFrase(producao, resto);
    if (!ficha) { semFicha.push({ frase: p.trim(), quantidade }); continue; }
    const un = m[2] ? (/^k|quilo/.test(m[2]) ? "kg" : /^g|grama/.test(m[2]) ? "g" : /^l|litro/.test(m[2]) ? "L" : /^ml/.test(m[2]) ? "ml" : "un") : null;
    const ja = alvos.find((a) => a.ficha.id === ficha.id);
    if (ja) ja.quantidade = Math.max(ja.quantidade, quantidade); else alvos.push({ ficha, quantidade, unidade: un, frase: p.trim() });
  }
  return { data, rotuloData: rotulo, alvos, limpezas, semFicha };
}

/** Rendimento da ficha na unidade em que o dono pede ("300 filés" numa ficha que rende 10 un). */
function vezesDaFicha(ficha, quantidade) {
  const rend = Number(ficha?.rendimento_porcoes);
  if (!(rend > 0)) return null;
  return quantidade / rend;
}

/**
 * A conta da produção. Cada alvo explode pela ficha; o que um alvo usa de
 * outro alvo (parmegiana usa empanado) sai da produção planejada, não do
 * estoque nem de uma produção a mais; pré-preparo que não é alvo (molho)
 * desconta o estoque e o resto vira "fabricar".
 *
 * @param {object} p
 * @param {Array} p.alvos  [{ ficha, quantidade }]  (do lerPedidoDeProducao; limpeza entra com quantidade = vezes)
 * @param {Array} p.fichas todas as fichas (com fichas_ingredientes)
 * @param {Map}   p.marmitas id → marmita com itens/embalagens (marmita de verdade usa a embalagem dela)
 * @param {Map}   p.insumos  id → insumo
 * @param {Map}   p.saldo    insumo_id → saldo na unidade do cadastro (estoques da marmitaria)
 * @param {Map}   p.espelho  ficha_id do pré-preparo → insumo_id do item de estoque dele
 */
export function contaDaProducao({ alvos = [], fichas = [], marmitas = new Map(), insumos = new Map(), saldo = new Map(), espelho = new Map() }) {
  const avisos = [];
  const plano = [];
  const mapa = new Map();
  const saldoVirtual = new Map(saldo);
  const porAlvo = [];
  for (const a of alvos) {
    const f = a.ficha;
    const marmita = marmitas.get(f.id);
    let vezes;
    if (marmita) {
      vezes = a.quantidade;
      mapa.set(f.id, marmita);
    } else {
      vezes = a.vezes ?? vezesDaFicha(f, a.quantidade);
      if (vezes == null) { avisos.push(`"${f.nome_receita}" está sem rendimento na ficha: não dá para calcular os ingredientes.`); continue; }
      mapa.set(f.id, { id: f.id, itens: (f.fichas_ingredientes || []).map((fi) => ({ ...fi })), embalagens: [] });
    }
    if (!(f.fichas_ingredientes?.length || marmita?.itens?.length)) { avisos.push(`"${f.nome_receita}" está sem ingredientes na ficha.`); continue; }
    plano.push({ ficha_id: f.id, quantidade: vezes });
    // o que este alvo produz cobre o que os outros alvos usam dele
    const esp = espelho.get(f.id);
    if (esp && !marmita) saldoVirtual.set(esp, (saldoVirtual.get(esp) || 0) + Number(a.quantidade));
    // 1º nível: o que vai neste alvo (frango, farinha, leite…), para a fala do Jhon
    const itens = (marmita?.itens || f.fichas_ingredientes || []).map((fi) => {
      const sub = fi.subficha_id ? fichas.find((x) => x.id === fi.subficha_id) : null;
      const ins = fi.insumos || insumos.get(fi.insumo_id);
      return {
        nome: sub?.nome_receita || ins?.nome || "Ingrediente sem cadastro",
        quantidade: r3((Number(fi.quantidade) || 0) * vezes),
        unidade: sub ? (sub.rendimento_unidade || "un") : (ins?.unidade_medida || ""),
        preparo: !!sub,
      };
    }).filter((i) => i.quantidade > 0);
    porAlvo.push({ fichaId: f.id, nome: f.nome_receita, quantidade: a.quantidade, unidade: a.unidade || f.rendimento_unidade || (marmita ? "marmitas" : "un"), itens, limpeza: !!a.limpeza });
  }
  const nec = necessidadeDeProducao({ plano, marmitas: mapa, fichas, insumos, saldo: saldoVirtual, espelho });
  const idsAlvo = new Set(alvos.map((a) => a.ficha.id));
  const fabricar = nec.prePreparos.filter((p) => !idsAlvo.has(p.ficha_id)).map((p) => ({
    ...p,
    // o saldo real (sem a produção planejada)
    temNoEstoque: r3(espelho.get(p.ficha_id) && saldo.has(espelho.get(p.ficha_id)) ? Math.max(0, saldo.get(espelho.get(p.ficha_id))) : 0),
  }));
  return { porAlvo, fabricar, itens: nec.itens, listaDeCompras: nec.listaDeCompras, valorEstimadoCompras: nec.valorEstimadoCompras, avisos: [...avisos, ...nec.avisos] };
}

/** Estoque de cada coisa citada ("frango empanado", "molho", "batata porcionada"), na unidade do cadastro. */
export function estoqueDasCoisas({ texto, insumos = new Map(), saldo = new Map(), fichas = [] }) {
  const lista = [...insumos.values()];
  const ts = tokens(texto).filter((t) => !["quanto", "tenho", "temos", "tem", "estoque", "mostra", "mim", "me", "eu", "que", "ja", "esta", "porcionada", "porcionado", "nao", "vender", "ganhar", "aquilo", "dali", "media", "producao", "jhon", "john", "se", "vou", "isso"].includes(t));
  const achados = new Map();
  for (const ins of lista) {
    const tn = tokens(ins.nome);
    if (!tn.some((t) => ts.includes(t))) continue;
    const ficha = ins.ficha_tecnica_id ? fichas.find((f) => f.id === ins.ficha_tecnica_id) : null;
    achados.set(ins.id, {
      insumoId: ins.id, nome: ins.nome, fichaId: ins.ficha_tecnica_id || null, preparo: !!ficha,
      quantidade: r3(Math.max(0, saldo.get(ins.id) || 0)), unidade: ficha?.rendimento_unidade || ins.unidade_medida || "",
      comSaldo: saldo.has(ins.id),
    });
  }
  return [...achados.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Quanto rende vender o que está pronto: as marmitas que usam o pré-preparo,
 * quantas dá para montar só com ele e o lucro de cada (raio-x). ESTIMATIVA:
 * supõe que o resto da marmita existe e que tudo é vendido no app do raio-x.
 * @param {(marmita) => {valido, lucro, canal, preco}} raioX
 */
export function lucroDoPronto({ fichaId, quantidade, marmitas = [], raioX }) {
  const usos = [];
  for (const m of marmitas) {
    const it = (m.itens || []).find((i) => i.subficha_id === fichaId);
    const q = Number(it?.quantidade);
    if (!(q > 0)) continue;
    const possiveis = Math.floor(quantidade / q + 1e-9);
    const rx = raioX(m);
    usos.push({ marmita: m.nome_receita || "Marmita", porMarmita: q, possiveis, lucroUnit: rx?.valido ? rx.lucro : null, canal: rx?.canal || null, preco: rx?.valido ? rx.preco : null,
      lucroTotal: rx?.valido ? Math.round(possiveis * rx.lucro * 100) / 100 : null, faltando: rx?.valido ? rx.faltando : [rx?.motivo].filter(Boolean) });
  }
  return usos.sort((a, b) => (b.lucroTotal ?? -Infinity) - (a.lucroTotal ?? -Infinity));
}
