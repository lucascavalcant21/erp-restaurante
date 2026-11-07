// Baixa de estoque da comanda (decisão do dono, 06/11/2026): a venda baixa pela
// ficha técnica, por porção. Regras puras; quem movimenta é estoque_movimentar.

import { fatorSaldo } from "./marmitaria/nucleo.mjs";

const r3 = (v) => Math.round(v * 1000) / 1000;

/** Porções reais da ficha (mesma regra do CMV e do orçamento). */
export function porcoesDaFicha(f) {
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const peso = Number(f?.peso_porcao_g) || 0;
  const total = un === "kg" || un === "l" ? rend * 1000 : rend;
  return peso > 0 ? total / peso : rend;
}

function gastar(ficha, fracao, fichas, soma, caminho = new Set()) {
  if (!ficha || caminho.has(ficha.id)) return;
  caminho.add(ficha.id);
  for (const fi of ficha.fichas_ingredientes || []) {
    const qtd = (Number(fi.quantidade) || 0) * fracao;
    if (fi.insumo_id) soma.set(fi.insumo_id, (soma.get(fi.insumo_id) || 0) + qtd);
    else if (fi.subficha_id) {
      const base = fichas.find((f) => f.id === fi.subficha_id);
      if (base) gastar(base, qtd / (Number(base.rendimento_porcoes) || 1), fichas, soma, caminho);
    }
  }
  caminho.delete(ficha.id);
}

/** Quanto de cada insumo a venda consome, por setor, e o que ficou sem ficha. */
export function consumoDaVenda(itens = [], fichas = [], insumoDaEmbalagem = new Map()) {
  const porSetor = { cozinha: new Map(), bar: new Map() };
  const semFicha = new Set();
  for (const it of itens) {
    if (it.status_kds === "cancelado" || !it.produtos) continue;
    const p = it.produtos;
    const setor = p.departamento === "bar" ? "bar" : "cozinha";
    const comps = Array.isArray(p.composicao) && p.composicao.length ? p.composicao : p.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : [];
    if (!comps.length) semFicha.add(p.nome_produto || "Produto");
    for (const c of comps) {
      const ficha = fichas.find((f) => f.id === c.ficha_id);
      if (!ficha) { semFicha.add(p.nome_produto || "Produto"); continue; }
      gastar(ficha, ((Number(c.qtd) || 1) * it.quantidade) / (porcoesDaFicha(ficha) || 1), fichas, porSetor[setor]);
    }
    for (const e of Array.isArray(p.embalagens) ? p.embalagens : []) {
      const insumo = insumoDaEmbalagem.get(e.embalagem_id);
      if (insumo) porSetor[setor].set(insumo, (porSetor[setor].get(insumo) || 0) + (Number(e.qtd) || 1) * it.quantidade);
    }
  }
  return { porSetor, semFicha: [...semFicha] };
}

const ordemDosLocais = (setor) => [setor, `pre-preparos-${setor}`, `embalagens-${setor}`, "embalagens"];

/** Escolhe o local de cada baixa. Sem saldo, não força: entra em faltas para o caixa ver. */
export function planejarBaixas({ porSetor, semFicha = [] }, { insumos = new Map(), estoques = [], itensEstoque = [] } = {}) {
  const baixas = [];
  const faltas = semFicha.map((n) => `${n}: sem ficha técnica`);
  const saldo = new Map(itensEstoque.map((i) => [`${i.estoque_id}|${i.insumo_id}`, Number(i.quantidade_atual) || 0]));
  for (const setor of Object.keys(porSetor)) {
    const locais = ordemDosLocais(setor).map((s) => estoques.find((e) => e.slug === s)).filter(Boolean);
    for (const [insumoId, qtd] of porSetor[setor]) {
      const insumo = insumos.get(insumoId);
      const nome = insumo?.nome || "Insumo";
      const q = r3(qtd * fatorSaldo(insumo));
      if (!(q > 0)) continue;
      const local = locais.find((l) => (saldo.get(`${l.id}|${insumoId}`) || 0) >= q);
      if (!local) { faltas.push(`${nome}: sem saldo`); continue; }
      saldo.set(`${local.id}|${insumoId}`, saldo.get(`${local.id}|${insumoId}`) - q);
      baixas.push({ estoque_id: local.id, insumo_id: insumoId, nome, quantidade: q });
    }
  }
  return { baixas, faltas };
}

/** Pagamentos gravados: em centavos exatos, sem linha zerada. */
export function pagamentosDaConta(pagamentos = []) {
  return pagamentos.map((p) => ({ forma: p.forma === "vr" ? "voucher" : p.forma, valor: Math.round((Number(p.valor) || 0) * 100) / 100 })).filter((p) => p.valor > 0);
}

/**
 * Cancelamento da venda (COM-4, 07/11/2026): o que a venda tirou do estoque e
 * pode voltar. Lê as retiradas gravadas com a chave da venda
 * (`venda:<vendaId>:<estoque>:<insumo>`) e soma por estoque e insumo. Volta só o
 * que de fato saiu: nada é recalculado pela ficha de hoje.
 */
export function devolucoesDaVenda(movimentos = [], vendaId) {
  const prefixo = `venda:${vendaId}:`;
  const soma = new Map();
  for (const m of movimentos || []) {
    if (m?.tipo !== "saida" || !String(m.chave_idempotencia || "").startsWith(prefixo)) continue;
    const q = Number(m.quantidade);
    if (!(q > 0)) continue;
    const k = `${m.estoque_id}:${m.insumo_id}`;
    const atual = soma.get(k) || { estoque_id: m.estoque_id, insumo_id: m.insumo_id, quantidade: 0 };
    atual.quantidade = Math.round((atual.quantidade + q) * 1000) / 1000;
    soma.set(k, atual);
  }
  return [...soma.values()].map((d) => ({ ...d, chave: `cancelamento:${vendaId}:${d.estoque_id}:${d.insumo_id}` }));
}
