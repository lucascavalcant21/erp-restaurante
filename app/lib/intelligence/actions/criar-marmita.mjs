// AÇÃO marmita.create — montar uma marmita conversando com o Jhon (dono, 16/11/2026):
//
//   "Jhon, vamos montar uma marmita." → "São quantos componentes?" → "3" →
//   "Qual é cada um?" → batata, arroz branco, filé de frango empanado →
//   quantas gramas e por quanto comprou; sem ficha do arroz, monta a ficha do
//   arroz ali mesmo; frango empanado: gramas de frango e de empanado →
//   embalagem (pote, saco, adesivo) → em qual app (cria o app que não existe,
//   com a %) → "pelo nosso calculador tem que vender a tanto" → combo com
//   refrigerante → montagem → prévia → Confirmar.
//
// Regras (as mesmas da recipe.create):
//   - uma pergunta por vez; o que a pessoa não disse é perguntado, nunca inventado;
//   - custo pela conta da marmitaria (custoDaMarmita), preço pela calculadora
//     da Precificação (precoSugerido) com equipe, contas fixas e custos
//     variáveis por marmita (custosEmbutidos): SUGESTÃO, o dono decide;
//   - nada é gravado antes do Confirmar; tudo pelo cliente do PRÓPRIO usuário
//     (RLS) e pela função marmitaria_salvar_ficha, como a tela.

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo } from "../metrics/produtos.mjs";
import { CAMPOS_INSUMO_CUSTO } from "../metrics/assistente.mjs";
import { lerCadastro, lerIngredientes, lerPreco, lerQuantidade, paraUnidadeDoInsumo } from "./criar-ficha.mjs";
import { carregarDadosDaMarmitaria } from "../agents/marmitaria-agente.mjs";
import { custoDaMarmita, normalizarCanal, precoSugerido, resultadoPorCanal } from "../../marmitaria/nucleo.mjs";
import { lucroDoPedido } from "../../marmitaria/promocoes.mjs";
import { calcularPrecoNormalizado } from "../../ingredientes-utils.mjs";
import { plataformaDoTexto } from "../../marmitaria/concorrentes.mjs";
import { CHAVE_PARAMS, comVitrine, normalizarOrganizador, salvarItem, adicionarCategoria, vitrineDe } from "../../marmitaria/organizador.mjs";

/** A marmita nova entra na vitrine do app em que vai ser vendida (Organizador de plataforma), em "Marmitas". */
export function vitrineComMarmita(orgAtual, { plataforma, nome, fichaId, preco, componentes = [] }) {
  if (!plataforma) return null;
  let v = vitrineDe(orgAtual, plataforma);
  if (v.categorias.some((c) => c.itens.some((i) => i.ficha_id === fichaId || fold(i.nome) === fold(nome)))) return null;
  let cat = v.categorias.find((c) => fold(c.nome) === "marmitas");
  if (!cat) { const r = adicionarCategoria(v, "Marmitas"); if (r.erro) return null; v = r.vitrine; cat = v.categorias.find((c) => fold(c.nome) === "marmitas"); }
  const descricao = componentes.length ? componentes.join(", ") : "";
  const r = salvarItem(v, cat.id, { nome, ficha_id: fichaId, preco, descricao });
  return r.erro ? null : comVitrine(orgAtual, plataforma, r.vitrine);
}

export const MAX_COMP = 8;
export const MAX_LOTE = 10;
const MAX_SUB = 10;
const MAX_EMB = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, c = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c });
const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const limpar = (t) => String(t || "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
const cap = (t) => { const x = limpar(t); return x ? x[0].toUpperCase() + x.slice(1) : x; };
const r2 = (v) => Math.round(Number(v) * 100) / 100;
const ROTULO_UN = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un" };
const ehEmbalagem = (i) => fold(i?.departamento) === "embalagens";
const empanado = (termo) => /\bempanad[oa]s?\b/.test(fold(termo));
const semEmpanado = (termo) => cap(String(termo).replace(/\s*\b(empanad[oa]s?)\b\s*/gi, " "));
const SIM = /^(sim|s|isso|pode|ok|certo|esta certo|ta certo|claro|bora|vamos|usar|confirmo|beleza)\b/;
const NAO = /^(nao|n|agora nao|depois|deixa|deixar|sem|nenhum|nenhuma|pular)\b/;

// ─── Parâmetros ──────────────────────────────────────────────────────────────

const novoSchema = s.object({ tamanho: s.number({ min: 0.001, max: 100000 }), unidade: s.enum(["kg", "g", "l", "ml", "un"]), preco: s.number({ min: 0, max: 1000000 }) });
const subItem = s.object({
  termo: s.string({ min: 1, max: 80 }), insumoId: s.opcional(s.uuid()), novo: s.opcional(novoSchema), cadastrar: s.opcional(s.boolean()),
  quantidade: s.opcional(s.number({ min: 0.0001, max: 100000 })), unidade: s.opcional(s.enum(["kg", "g", "l", "ml", "un"])),
});
const compSchema = s.object({
  termo: s.string({ min: 1, max: 80 }),
  insumoId: s.opcional(s.uuid()), fichaId: s.opcional(s.uuid()),
  modo: s.opcional(s.enum(["comprado", "ficha"])),
  novo: s.opcional(novoSchema),
  sub: s.opcional(s.object({ itens: s.opcional(s.array(subItem, { max: MAX_SUB })), rendimento: s.opcional(s.number({ min: 0.001, max: 100000 })), rendimentoUnidade: s.opcional(s.enum(["kg", "g", "l", "ml", "un"])) })),
  quantidade: s.opcional(s.number({ min: 0.0001, max: 100000 })), unidade: s.opcional(s.enum(["kg", "g", "l", "ml", "un"])),
  empanadoOk: s.opcional(s.boolean()),
});
const embSchema = s.object({ termo: s.string({ min: 1, max: 80 }), insumoId: s.opcional(s.uuid()), novo: s.opcional(novoSchema), cadastrar: s.opcional(s.boolean()), quantidade: s.opcional(s.number({ min: 0.01, max: 1000 })) });
const comboSchema = s.object({
  nao: s.opcional(s.boolean()),
  bebida: s.opcional(s.string({ min: 1, max: 80 })), insumoId: s.opcional(s.uuid()), novo: s.opcional(novoSchema),
  precoBebida: s.opcional(s.number({ min: 0.01, max: 100000 })), preco: s.opcional(s.number({ min: 0.01, max: 100000 })),
});

export const paramsSchema = s.object({
  // "vamos montar umas marmitas" (dono, 17/11/2026): quantas nesta rodada, qual é esta e se é nesta unidade
  quantas: s.opcional(s.number({ min: 1, max: MAX_LOTE, inteiro: true })),
  ordem: s.opcional(s.number({ min: 1, max: MAX_LOTE, inteiro: true })),
  unidadeOk: s.opcional(s.boolean()),
  unidadeEscolha: s.opcional(s.enum(["outra", "nova"])),
  nome: s.opcional(s.string({ min: 1, max: 80 })),
  total: s.opcional(s.number({ min: 1, max: MAX_COMP, inteiro: true })),
  comps: s.opcional(s.array(compSchema, { max: MAX_COMP })),
  embs: s.opcional(s.array(embSchema, { max: MAX_EMB })),
  embOk: s.opcional(s.boolean()),
  canalId: s.opcional(s.string({ min: 2, max: 30 })),
  // vários apps (dono, 17/11/2026): "simular em todos" e depois escolher; cada app com o seu preço
  simular: s.opcional(s.boolean()),
  canaisEscolha: s.opcional(s.string({ min: 1, max: 200 })),
  precosExtras: s.opcional(s.array(s.object({ canal: s.string({ min: 2, max: 30 }), preco: s.number({ min: 0.01, max: 100000 }) }), { max: 6 })),
  canalNovo: s.opcional(s.object({ nome: s.opcional(s.string({ min: 1, max: 40 })), comissao: s.opcional(s.number({ min: 0, max: 99 })), pagamento: s.opcional(s.number({ min: 0, max: 99 })) })),
  lucroReais: s.opcional(s.number({ min: 0, max: 100000 })),
  lucroPct: s.opcional(s.number({ min: 0, max: 90 })),
  preco: s.opcional(s.number({ min: 0.01, max: 100000 })),
  combo: s.opcional(comboSchema),
  etapas: s.opcional(s.array(s.string({ min: 1, max: 160 }), { max: 15 })),
  montagemOk: s.opcional(s.boolean()),
  pendente: s.opcional(s.object({ tipo: s.string({ max: 20 }), canal: s.opcional(s.string({ max: 30 })), indice: s.opcional(s.number({ min: 0, max: 20, inteiro: true })), sub: s.opcional(s.number({ min: 0, max: 20, inteiro: true })), sugerido: s.opcional(s.number({ min: 0, max: 100000 })) })),
  aviso: s.opcional(s.string({ max: 200 })),
  resposta: s.opcional(s.string({ min: 1, max: 300 })),
});

/** "Vamos montar uma marmita, o nome vai ser Frango empanado com fritas" → { nome } */
const NUMEROS = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const numeroDe = (t) => { const n = Number(t); return Number.isInteger(n) ? n : NUMEROS[t] || null; };
const PALAVRA_NUM = "(\\d+|uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)";

/** "vamos montar 3 marmitas", "a marmita 2 de 3 nesta unidade" → { quantas, ordem, unidadeOk } */
export function loteDoComando(texto) {
  const f = fold(texto);
  const out = {};
  const deTotal = f.match(new RegExp(`marmita ${PALAVRA_NUM} de ${PALAVRA_NUM}\\b`));
  if (deTotal) {
    const o = numeroDe(deTotal[1]); const q = numeroDe(deTotal[2]);
    if (q >= 1 && q <= MAX_LOTE && o >= 1 && o <= q) { out.quantas = q; out.ordem = o; }
  } else {
    const qtd = f.match(new RegExp(`\\b(?:mais )?${PALAVRA_NUM} (?:marmitas|quentinhas)\\b`));
    const q = qtd ? numeroDe(qtd[1]) : null;
    if (q >= 1 && q <= MAX_LOTE) { out.quantas = q; out.ordem = 1; }
  }
  if (/\b(nesta|nessa|desta|dessa|aqui na|aqui nesta|na mesma) unidade\b/.test(f)) out.unidadeOk = true;
  return out;
}

export function paramsDoComando(texto) {
  const lote = loteDoComando(texto);
  // "umas marmitas" sem número: pergunta quantas; uma só ("uma marmita") segue direto
  const plural = /\b(umas|as|algumas|varias) marmitas\b|\bmontar marmitas\b/.test(fold(texto));
  const nomeLido = nomeDoComando(texto);
  return { ...lote, ...(nomeLido.nome ? nomeLido : { nome: null }), ...(!plural && !lote.quantas ? { quantas: 1, ordem: 1, unidadeOk: true } : {}) };
}

function nomeDoComando(texto) {
  const f = fold(texto);
  const m = f.match(/\b(?:o nome (?:dela|dele|da marmita)?\s*(?:vai ser|e|sera)|chamad[ao]|com o nome(?: de)?|marmita (?:de|do|da)(?! (?:hoje|agora)\b))\s+/);
  if (!m) return { nome: null };
  const ini = m.index + m[0].length;
  const resto = String(texto).slice(ini);
  const fim = resto.search(/[,.;:!?]|\s+(?:que vai|que leva|e vai|vai levar|leva)\b/i);
  const nome = cap(fim < 0 ? resto : resto.slice(0, fim));
  return { nome: nome && nome.length >= 2 && nome.length <= 80 ? nome : null };
}

/** "12% de comissão e 3,2% de pagamento", "só 12%" → { comissao, pagamento } */
export function lerTaxas(texto) {
  const nums = [...fold(texto).matchAll(/(\d+(?:[.,]\d+)?)\s*%?/g)].map((m) => Number(m[1].replace(",", "."))).filter((v) => v >= 0 && v < 100);
  if (!nums.length) return null;
  return { comissao: nums[0], pagamento: nums.length > 1 ? nums[1] : 0 };
}

/** "R$ 5", "5 reais" → { reais }; "15%" → { pct } */
export function lerLucro(texto) {
  const f = fold(texto);
  const m = f.match(/(\d+(?:[.,]\d+)?)\s*(%|por cento)?/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  if (!(v > 0)) return null;
  return m[2] ? { pct: v } : { reais: v };
}

/** "150 g de frango e 30 g de empanado" → [150 g, 30 g] */
export function lerDuasQuantidades(texto) {
  const partes = String(texto).split(/\s+e\s+|,|;/i).map((p) => lerQuantidade(p)).filter(Boolean);
  return partes.length >= 2 ? partes.slice(0, 2) : null;
}

/** "Coca lata 350 ml, 12 por 30,00" → { nome, novo } */
export function lerBebida(texto) {
  const original = String(texto || "");
  const corte = original.search(/,|\s(?:a|por|r\$|\d+\s*(?:un|unidades?|fardo|pacote)\b)/i);
  const nome = cap(corte > 0 ? original.slice(0, corte) : original.replace(/\d.*$/, ""));
  const pacote = fold(original).match(/(\d+)\s*(?:un|unidades?|latas?|garrafas?)?\s*(?:por|a)\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)/);
  if (pacote) return { nome: nome || "Refrigerante", novo: { tamanho: Number(pacote[1]), unidade: "un", preco: Number(pacote[2].replace(",", ".")) } };
  const so = fold(original).match(/(?:por|a|r\$)\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:reais)?\s*(?:cada|a unidade|unidade)?\s*$/);
  if (so) return { nome: nome || "Refrigerante", novo: { tamanho: 1, unidade: "un", preco: Number(so[1].replace(",", ".")) } };
  return nome ? { nome, novo: null } : null;
}

// ─── Respostas ───────────────────────────────────────────────────────────────

export function aplicarResposta(params, _campo, valor) {
  const p = JSON.parse(JSON.stringify({ ...params, aviso: null, resposta: null }));
  p.comps = p.comps || [];
  p.embs = p.embs || [];
  const pend = params.pendente || {};
  const v = String(valor ?? "").trim();
  const f = fold(v);
  const c = Number.isInteger(pend.indice) ? p.comps[pend.indice] : null;
  const sub = c && Number.isInteger(pend.sub) ? c.sub?.itens?.[pend.sub] : null;
  const e = Number.isInteger(pend.indice) ? p.embs[pend.indice] : null;
  const tirar = /^(tirar|tira|remover|remove|nao vai|sem esse|retirar)\b/.test(f);
  switch (pend.tipo) {
    case "quantas": {
      const n = numeroDe((f.match(/\d+/) || [])[0] || f.split(/\s+/)[0]);
      if (n >= 1 && n <= MAX_LOTE) { p.quantas = n; p.ordem = p.ordem || 1; } else p.aviso = `Diga um número de 1 a ${MAX_LOTE}.`;
      break;
    }
    case "unidade":
      if (f === "aqui" || /^(nesta|nessa|aqui|esta|essa|sim)\b/.test(f)) p.unidadeOk = true;
      else if (f === "outra" || /\boutra\b|ja temos|que ja tem/.test(f)) p.unidadeEscolha = "outra";
      else if (f === "nova" || /\bnova\b|criar/.test(f)) p.unidadeEscolha = "nova";
      else p.aviso = "Me diga a unidade de novo, do seu jeito.";
      break;
    case "nome": if (limpar(v).length >= 2) p.nome = cap(v).slice(0, 80); else p.aviso = "Preciso de um nome."; break;
    case "total": {
      const n = Number((f.match(/\d+/) || [])[0] || { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }[f.split(/\s+/)[0]]);
      if (n >= 1 && n <= MAX_COMP) p.total = n; else p.aviso = `Diga um número de 1 a ${MAX_COMP}.`;
      break;
    }
    case "componente": {
      const novos = lerIngredientes(v).map((x) => ({ termo: x.termo.slice(0, 80), ...(x.quantidade ? { quantidade: x.quantidade, unidade: x.unidade === "porcao" ? undefined : x.unidade || undefined } : {}) }));
      if (!novos.length) p.aviso = "Me diga o componente de novo, do seu jeito.";
      else { p.comps = [...p.comps, ...novos].slice(0, MAX_COMP).map((x) => JSON.parse(JSON.stringify(x))); p.total = Math.max(p.total || 1, p.comps.length); }
      break;
    }
    case "escolha":
      if (!c) break;
      if (tirar || v === "remover") { p.comps.splice(pend.indice, 1); p.total = Math.max(1, (p.total || 1) - 1); }
      else if (v === "ficha") { c.modo = "ficha"; delete c.insumoId; delete c.fichaId; }
      else if (v === "comprado") { c.modo = "comprado"; delete c.insumoId; delete c.fichaId; }
      else if (/^i:/.test(v) && UUID.test(v.slice(2))) c.insumoId = v.slice(2);
      else if (/^f:/.test(v) && UUID.test(v.slice(2))) c.fichaId = v.slice(2);
      else p.aviso = "Escolha uma das opções.";
      break;
    case "preco_compra": {
      if (!c) break;
      const k = lerCadastro(v);
      if (k) c.novo = k; else p.aviso = "Pode mandar assim: \"1 kg por 24,90\".";
      break;
    }
    case "sub_itens": {
      if (!c) break;
      const itens = lerIngredientes(v).map((x) => ({ termo: x.termo.slice(0, 80), ...(x.quantidade && x.unidade !== "porcao" ? { quantidade: x.quantidade, ...(x.unidade ? { unidade: x.unidade } : {}) } : {}) })).slice(0, MAX_SUB);
      if (itens.length) c.sub = { ...(c.sub || {}), itens }; else p.aviso = "Me diga o que vai de novo, do seu jeito. Ex.: \"arroz 1 kg, óleo 30 ml, sal 20 g\".";
      break;
    }
    case "sub_escolha":
      if (!sub) break;
      if (tirar || v === "remover") c.sub.itens.splice(pend.sub, 1);
      else if (/^i:/.test(v) && UUID.test(v.slice(2))) sub.insumoId = v.slice(2);
      else if (v === "novo") sub.cadastrar = true;
      else p.aviso = "Escolha uma das opções.";
      break;
    case "sub_preco": {
      if (!sub) break;
      if (tirar) { c.sub.itens.splice(pend.sub, 1); break; }
      const k = lerCadastro(v);
      if (k) sub.novo = k; else p.aviso = "Pode mandar assim: \"5 kg por 29,90\".";
      break;
    }
    case "sub_qtd": {
      if (!sub) break;
      const q = lerQuantidade(v);
      if (q && q.unidade !== "porcao") { sub.quantidade = q.quantidade; if (q.unidade) sub.unidade = q.unidade; } else p.aviso = "Quanto vai? Ex.: 1 kg ou 30 ml.";
      break;
    }
    case "sub_rendimento": {
      if (!c) break;
      const q = lerQuantidade(v);
      if (q?.unidade && q.unidade !== "porcao") { c.sub = { ...(c.sub || {}), rendimento: q.quantidade, rendimentoUnidade: q.unidade }; } else p.aviso = "Rende quanto pronto? Ex.: 2,5 kg.";
      break;
    }
    case "empanado": {
      if (!c) break;
      const dois = lerDuasQuantidades(v);
      if (/^(nao|n)\b/.test(f)) { c.empanadoOk = true; break; }
      if (!dois) { p.aviso = "Diga as duas medidas. Ex.: \"150 g de frango e 30 g de empanado\"."; break; }
      c.quantidade = dois[0].quantidade; if (dois[0].unidade) c.unidade = dois[0].unidade;
      c.termo = semEmpanado(c.termo) || c.termo;
      c.empanadoOk = true;
      if (p.comps.length < MAX_COMP) {
        p.comps.splice(pend.indice + 1, 0, { termo: "Mistura para empanar (farinha e ovo)", quantidade: dois[1].quantidade, ...(dois[1].unidade ? { unidade: dois[1].unidade } : {}), empanadoOk: true });
        p.total = Math.min(MAX_COMP, (p.total || p.comps.length - 1) + 1);
      }
      break;
    }
    case "quantidade": {
      if (!c) break;
      if (tirar) { p.comps.splice(pend.indice, 1); p.total = Math.max(1, (p.total || 1) - 1); break; }
      const q = lerQuantidade(v);
      if (q && q.unidade !== "porcao") { c.quantidade = q.quantidade; if (q.unidade) c.unidade = q.unidade; } else p.aviso = "Quanto vai? Ex.: 150 g.";
      break;
    }
    case "embalagens": {
      if (NAO.test(f) || /^nenhuma\b/.test(f)) { p.embOk = true; p.embs = []; break; }
      const itens = lerIngredientes(v).map((x) => ({ termo: x.termo.slice(0, 80), quantidade: x.quantidade && (!x.unidade || x.unidade === "un") ? x.quantidade : 1 })).slice(0, MAX_EMB);
      if (itens.length) { p.embs = itens; p.embOk = true; } else p.aviso = "Me diga as embalagens de novo, do seu jeito.";
      break;
    }
    case "emb_escolha":
      if (!e) break;
      if (tirar || v === "remover") p.embs.splice(pend.indice, 1);
      else if (/^i:/.test(v) && UUID.test(v.slice(2))) e.insumoId = v.slice(2);
      else if (v === "novo") e.cadastrar = true;
      break;
    case "emb_preco": {
      if (!e) break;
      if (tirar) { p.embs.splice(pend.indice, 1); break; }
      const k = lerCadastro(v.replace(/\b(\d+)\s*(?=por|a\b)/i, "$1 un "));
      if (k) e.novo = { ...k, unidade: k.unidade === "un" ? "un" : k.unidade }; else p.aviso = "Pode mandar assim: \"100 unidades por 25,00\".";
      break;
    }
    case "canal":
      if (v === "novo") p.canalNovo = {};
      else if (v === "simular" || /\bsimula/.test(f)) p.simular = true;
      else if (/^[a-z0-9_]{2,30}$/.test(v) && v !== "todos") p.canalId = v;
      else if (limpar(v).length >= 2) p.canaisEscolha = limpar(v).slice(0, 200);
      else p.aviso = "Escolha um app ou \"Criar outro app\".";
      break;
    case "canais_depois":
      if (/^[a-z0-9_]{2,30}$/.test(v) && v !== "todos") p.canalId = v;
      else if (limpar(v).length >= 2) p.canaisEscolha = limpar(v).slice(0, 200);
      else p.aviso = "Em quais apps vai cadastrar?";
      break;
    case "preco_extra": {
      const canalExtra = pend.canal;
      let pr = null;
      if (SIM.test(f) && pend.sugerido > 0) pr = pend.sugerido; else pr = lerPreco(v);
      if (pr > 0 && canalExtra) p.precosExtras = [...(p.precosExtras || []).filter((x) => x.canal !== canalExtra), { canal: canalExtra, preco: pr }];
      else p.aviso = "Por quanto vai vender nesse app?";
      break;
    }
    case "canal_nome": if (limpar(v).length >= 2) p.canalNovo = { ...(p.canalNovo || {}), nome: cap(v).slice(0, 40) }; else p.aviso = "Qual o nome do app?"; break;
    case "canal_taxas": {
      const t = lerTaxas(v);
      if (t) p.canalNovo = { ...(p.canalNovo || {}), ...t }; else p.aviso = "Quantos por cento? Ex.: \"12% de comissão e 3,2% de pagamento\".";
      break;
    }
    case "lucro": {
      const l = lerLucro(v);
      if (l?.reais) p.lucroReais = l.reais; else if (l?.pct) p.lucroPct = l.pct; else p.aviso = "Quanto de lucro? Ex.: R$ 5 ou 15%.";
      break;
    }
    case "preco": {
      if (SIM.test(f) && pend.sugerido > 0) { p.preco = pend.sugerido; break; }
      const pr = lerPreco(v);
      if (pr > 0) p.preco = pr; else p.aviso = "Por quanto vai vender?";
      break;
    }
    case "combo":
      if (NAO.test(f)) p.combo = { nao: true };
      else if (SIM.test(f) || /refri/.test(f)) p.combo = {};
      else p.aviso = "Monta o combo com refrigerante? Sim ou agora não.";
      break;
    case "bebida": {
      const b = lerBebida(v);
      if (b?.nome) p.combo = { ...(p.combo || {}), bebida: b.nome.slice(0, 80), ...(b.novo ? { novo: b.novo } : {}) };
      else p.aviso = "Qual refrigerante e por quanto compra? Ex.: \"Coca lata 350 ml, 12 por 30,00\".";
      break;
    }
    case "bebida_preco_compra": {
      const k = lerCadastro(v.replace(/\b(\d+)\s*(?=por|a\b)/i, "$1 un "));
      if (k) p.combo = { ...(p.combo || {}), novo: k }; else p.aviso = "Pode mandar assim: \"12 por 30,00\" ou \"1 un por 3,50\".";
      break;
    }
    case "bebida_preco": { const pr = lerPreco(v); if (pr > 0) p.combo = { ...(p.combo || {}), precoBebida: pr }; else p.aviso = "Por quanto vende o refrigerante sozinho?"; break; }
    case "combo_preco": {
      if (SIM.test(f) && pend.sugerido > 0) { p.combo = { ...(p.combo || {}), preco: pend.sugerido }; break; }
      const pr = lerPreco(v);
      if (pr > 0) p.combo = { ...(p.combo || {}), preco: pr }; else p.aviso = "Por quanto vai o combo?";
      break;
    }
    case "montagem": {
      if (SIM.test(f)) { p.montagemOk = true; break; }
      const etapas = String(v).split(/\n|;|,\s*(?=[a-zà-ú])|\s+depois\s+/i).map((x) => cap(x).slice(0, 160)).filter((x) => x.length >= 2).slice(0, 15);
      if (etapas.length) p.etapas = etapas; else p.aviso = "Diga a ordem. Ex.: \"arroz no fundo, batata do lado, frango por cima\".";
      break;
    }
    default: break;
  }
  return p;
}

// ─── Vários apps ─────────────────────────────────────────────────────────────

const plataformaDoCanal = (c) => plataformaDoTexto(c?.plataforma) || plataformaDoTexto(c?.nome) || plataformaDoTexto(c?.id) || null;

function opcoesDeCanais(ativos, depoisDaSimulacao) {
  return [
    ...(depoisDaSimulacao ? [] : [{ id: "simular", rotulo: "Simular em todos" }]),
    ...ativos.map((x) => ({ id: x.id, rotulo: `Só ${x.nome}` })),
    ...(ativos.length >= 2 ? [{ id: "todos", rotulo: ativos.length === 2 ? `${ativos[0].nome} e ${ativos[1].nome}` : "Todos os cadastrados" }] : []),
    ...(depoisDaSimulacao ? [] : [{ id: "novo", rotulo: "Criar outro app" }]),
    { id: "outros", rotulo: "Outra combinação (digite)", livre: true },
  ];
}

/** "todos", "iFood e 99", "ifood, keeta" → os apps cadastrados citados, na ordem do cadastro. */
export function canaisDaEscolha(ativos, texto) {
  const f = fold(texto);
  if (/^(todos|todas|os dois|as duas|ambos|em todos|nos dois)\b/.test(f) || f === "todos") return [...ativos];
  return ativos.filter((c) => {
    const nome = fold(c.nome).split(" · ")[0].trim();
    const pl = plataformaDoCanal(c);
    return f.includes(fold(c.id)) || (nome.length >= 2 && f.includes(nome)) || (pl && plataformaDoTexto(f.split(/,|\se\s|\//).find((t) => plataformaDoTexto(t) === pl) || "") === pl);
  });
}

/** Preço para a meta em cada app e o lucro de cada um vendendo todos pelo mesmo preço (SIMULAÇÃO). */
export function simularApps({ ativos, custo, custoCheio, d, margem, lucroReais }) {
  const sug = ativos.map((c) => ({ c, s: precoSugerido({ custoTecnico: custoCheio, canal: c, tributosPct: d.tributosPct, margemAlvoPct: margem, lucroAlvoReais: lucroReais }) })).filter((x) => x.s.preco > 0);
  if (!sug.length) return { linhas: [], melhor: null, precoComum: null };
  const precoComum = Math.max(...sug.map((x) => x.s.preco));
  const comLucro = sug.map((x) => ({ ...x, l: lucroDoPedido({ paga: precoComum, custo, canal: x.c, tributosPct: d.tributosPct, embutidos: d.embutidos, marmitas: 1 }) }));
  const validos = comLucro.filter((x) => x.l.lucro != null);
  const melhor = validos.length > 1 ? validos.reduce((a, b) => (b.l.lucro > a.l.lucro ? b : a)).c : null;
  const taxa = (c) => { const t = Number(c.comissao_pct || 0) + Number(c.taxa_pagamento_pct || 0); return t > 0 ? ` (taxa ${num(t, 1)}%)` : ""; };
  const linhas = comLucro.map((x) => `${x.c.nome}${taxa(x.c)}: vender a ${brl(x.s.preco)}${x.l.lucro != null && sug.length > 1 ? `; a ${brl(precoComum)} sobram ${brl(x.l.lucro)}` : ""}`);
  return { linhas, melhor, precoComum };
}

// ─── Preparar ────────────────────────────────────────────────────────────────

const pergunta = (tipo, texto, { indice = null, sub = null, opcoes = null, aviso = null, sugerido = null, canal = null } = {}) => ({
  faltando: {
    campo: "resposta", texto: aviso ? `${aviso} ${texto}` : texto, opcoes: opcoes ? opcoes.map(({ livre, ...o }) => o) : null, livre: !opcoes || opcoes.some((o) => o.livre),
    persistir: { pendente: { tipo, ...(canal ? { canal } : {}), ...(indice != null ? { indice } : {}), ...(sub != null ? { sub } : {}), ...(sugerido != null ? { sugerido } : {}) }, aviso: null },
  },
});

function pseudoInsumo(id, termo, novo, departamento = "marmitaria") {
  return {
    id, nome: termo, departamento, unidade_medida: novo.unidade, tamanho_embalagem: novo.tamanho, custo_compra: novo.preco,
    custo_unitario: novo.preco / novo.tamanho, preco_normalizado: calcularPrecoNormalizado(novo.tamanho, novo.unidade, novo.preco),
  };
}
const insumoParaGravar = (x, departamento) => ({
  nome: x.nome, departamento, unidade_medida: x.unidade_medida, tamanho_embalagem: x.tamanho_embalagem, custo_compra: x.custo_compra,
  custo_unitario: x.custo_unitario, preco_normalizado: x.preco_normalizado,
  // como o cadastro rápido da marmitaria (CadastrosRapidos)
  categoria: departamento === "embalagens" ? "Embalagens da marmitaria" : "",
  ...(departamento === "embalagens" ? {} : { tipo: "ingrediente" }),
});

async function preparar(ctx, params) {
  const p = params || {};
  const aviso = p.aviso || null;
  const comps = p.comps || [];
  if (!p.quantas) {
    return pergunta("quantas", "Bora. Vamos montar quantas marmitas agora?", { aviso, opcoes: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), rotulo: String(n) })).concat([{ id: "outro", rotulo: "Outro número (digite)", livre: true }]) });
  }
  if (p.unidadeEscolha === "outra") return { erro: "Para montar em outra unidade que já temos, troque para ela no topo do app e me diga de novo: \"vamos montar as marmitas nesta unidade\". Nada foi gravado." };
  if (p.unidadeEscolha === "nova") return { erro: "Unidade nova se cria em Configurações › Negócios (no plano Grátis cabe um negócio; nos pagos, mais de um). Depois de criar, troque para ela no topo e me chame de novo. Nada foi gravado." };
  if (!p.unidadeOk) {
    const qtas = p.quantas === 1 ? "essa marmita" : `essas ${p.quantas} marmitas`;
    return pergunta("unidade", `Vai montar ${qtas} nesta unidade (a que está aberta no topo) ou em outra?`, { aviso, opcoes: [{ id: "aqui", rotulo: "Nesta unidade" }, { id: "outra", rotulo: "Outra que já temos" }, { id: "nova", rotulo: "Uma unidade nova" }] });
  }
  const daVez = p.quantas > 1 ? `Marmita ${p.ordem || 1} de ${p.quantas}: ` : "";
  if (!p.nome) return pergunta("nome", `${daVez || "Vamos montar. "}${daVez ? "qual" : "Qual"} vai ser o nome${daVez ? " dela" : " da marmita"}?`, { aviso });
  if (!p.total) return pergunta("total", `${p.nome}: são quantos componentes?`, { aviso, opcoes: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), rotulo: String(n) })) });
  if (comps.length < p.total) {
    const k = comps.length + 1;
    return pergunta("componente", k === 1 ? `Qual é o componente 1? (pode mandar todos de uma vez: "batata frita, arroz branco, filé de frango empanado")` : `Qual é o componente ${k}?`, { aviso });
  }

  const d = await carregarDadosDaMarmitaria(ctx.dbe, ctx.hoje || new Date().toISOString().slice(0, 10));
  const todosInsumos = (await ler(ctx.dbe.from("insumos").select(CAMPOS_INSUMO_CUSTO).order("nome").limit(5000), "insumos")) || [];
  const insPorId = new Map(todosInsumos.map((x) => [x.id, x]));
  const ingredientes = todosInsumos.filter((x) => !ehEmbalagem(x));
  const embalagens = todosInsumos.filter(ehEmbalagem);
  const bases = d.fichas.filter((x) => x.eh_base && x.ativo !== false && x.departamento !== "marmitaria");
  const fichaPorId = new Map(d.fichas.map((x) => [x.id, x]));
  const insumos = new Map(insPorId);
  const fichas = [...d.fichas];
  const novosIns = []; // { chave, termo, novo, departamento }
  const novasSubs = []; // { chave, nome, itens, rendimento, unidade }
  const linhas = [];

  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const termoBusca = empanado(c.termo) ? semEmpanado(c.termo) : c.termo;
    // 1. Qual é
    let alvo = null;
    if (c.insumoId) { const x = insPorId.get(c.insumoId); if (!x) return { erro: `O produto escolhido para "${c.termo}" não existe nesta unidade.` }; alvo = { tipo: "insumo", insumo: x }; }
    else if (c.fichaId) { const x = fichaPorId.get(c.fichaId); if (!x) return { erro: `A ficha escolhida para "${c.termo}" não existe nesta unidade.` }; alvo = { tipo: "ficha", ficha: x }; }
    else if (c.modo === "comprado") {
      if (!c.novo) return pergunta("preco_compra", `Por quanto você compra ${termoBusca}? Ex.: "1 kg por 24,90" ou "pacote de 2 kg a 19,90".`, { indice: i, aviso });
      const chave = `novo:c${i}`;
      const x = pseudoInsumo(chave, termoBusca, c.novo);
      insumos.set(chave, x); novosIns.push({ chave, ...x });
      alvo = { tipo: "insumo", insumo: x };
    } else if (c.modo === "ficha") {
      // 1b. Ficha do que é feito aqui (ex.: arroz branco): o que vai num lote e quanto rende
      const sub = c.sub || {};
      if (!sub.itens?.length) return pergunta("sub_itens", `Vamos montar a ficha do ${termoBusca}. O que vai num lote e quanto? Ex.: "arroz 1 kg, óleo 30 ml, sal 20 g, alho 10 g".`, { indice: i, aviso });
      const subLinhas = [];
      for (let j = 0; j < sub.itens.length; j++) {
        const it = sub.itens[j];
        let ins = it.insumoId ? insPorId.get(it.insumoId) : null;
        if (!ins && !it.novo) {
          const cand = it.cadastrar ? [] : candidatosDoTermo(ingredientes, it.termo, 6);
          if (cand.length === 1) ins = cand[0];
          else if (cand.length > 1) return pergunta("sub_escolha", `Qual "${it.termo}" vai no ${termoBusca}?`, { indice: i, sub: j, aviso, opcoes: [...cand.map((x) => ({ id: `i:${x.id}`, rotulo: x.nome })), { id: "novo", rotulo: `Cadastrar "${it.termo}" novo` }, { id: "remover", rotulo: "Tirar" }] });
          else return pergunta("sub_preco", `"${it.termo}" não está cadastrado. Por quanto você compra? Ex.: "5 kg por 29,90".`, { indice: i, sub: j, aviso });
        }
        if (!ins) {
          const chave = `novo:c${i}s${j}`;
          ins = pseudoInsumo(chave, it.termo, it.novo);
          insumos.set(chave, ins); novosIns.push({ chave, ...ins });
        }
        if (it.quantidade == null) return pergunta("sub_qtd", `Quanto de ${ins.nome} vai num lote de ${termoBusca}?`, { indice: i, sub: j, aviso });
        const q = paraUnidadeDoInsumo(it.quantidade, it.unidade || null, ins.unidade_medida);
        if (q == null) return pergunta("sub_qtd", `${ins.nome} é controlado em ${ROTULO_UN[String(ins.unidade_medida).toLowerCase()] || ins.unidade_medida}. Quanto vai, nessa unidade?`, { indice: i, sub: j, aviso: "Essa unidade não combina com o cadastro." });
        subLinhas.push({ insumo_id: ins.id, quantidade: Math.round(q * 1e6) / 1e6, fator_correcao: 0, insumos: ins, nome: ins.nome });
      }
      if (!sub.rendimento) return pergunta("sub_rendimento", `Esse lote de ${termoBusca} rende quanto pronto? Ex.: "2,5 kg".`, { indice: i, aviso });
      const chave = `sub:c${i}`;
      const ficha = { id: chave, nome_receita: termoBusca, nome: termoBusca, eh_base: true, departamento: "cozinha", ativo: true, rendimento_porcoes: sub.rendimento, rendimento_unidade: sub.rendimentoUnidade, fichas_ingredientes: subLinhas };
      fichas.push(ficha);
      novasSubs.push({ chave, nome: termoBusca, itens: subLinhas, rendimento: sub.rendimento, unidade: sub.rendimentoUnidade });
      alvo = { tipo: "ficha", ficha };
    } else {
      const lista = [...ingredientes.map((x) => ({ ...x, _t: "i" })), ...bases.map((x) => ({ id: x.id, nome: x.nome_receita || x.nome, nome_interno: x.nome_interno, _t: "f" }))];
      const cand = candidatosDoTermo(lista, termoBusca, 6);
      if (cand.length === 1) alvo = cand[0]._t === "i" ? { tipo: "insumo", insumo: insPorId.get(cand[0].id) } : { tipo: "ficha", ficha: fichaPorId.get(cand[0].id) };
      else {
        const extra = [{ id: "ficha", rotulo: `É feito aqui: montar a ficha do ${termoBusca}` }, { id: "comprado", rotulo: "Comprado: cadastrar com o preço" }, { id: "remover", rotulo: "Tirar da marmita" }];
        if (cand.length > 1) return pergunta("escolha", `Qual "${termoBusca}" vai na ${p.nome}?`, { indice: i, aviso, opcoes: [...cand.map((x) => ({ id: `${x._t}:${x.id}`, rotulo: x._t === "f" ? `${x.nome} (ficha da casa)` : x.nome })), ...extra] });
        return pergunta("escolha", `Não achei "${termoBusca}" no cadastro. Ele é feito aqui ou comprado pronto?`, { indice: i, aviso, opcoes: extra });
      }
    }
    // 2. Empanado: frango e empanado separados no peso
    if (empanado(c.termo) && !c.empanadoOk) {
      return pergunta("empanado", `O ${termoBusca} vai empanado. Quantas gramas de ${termoBusca} e quantas de empanado (farinha e ovo) em cada marmita? Ex.: "150 g de frango e 30 g de empanado". (Se o empanado já vem no produto, responda "não".)`, { indice: i, aviso });
    }
    // 3. Quanto vai
    const nomeAlvo = alvo.tipo === "ficha" ? alvo.ficha.nome_receita || alvo.ficha.nome : alvo.insumo.nome;
    if (c.quantidade == null) return pergunta("quantidade", `Quantas gramas de ${nomeAlvo} vão na marmita? (ou "1 un", "80 ml")`, { indice: i, aviso });
    const unAlvo = alvo.tipo === "ficha" ? String(alvo.ficha.rendimento_unidade || "kg").toLowerCase() : String(alvo.insumo.unidade_medida || "un").toLowerCase();
    const q = paraUnidadeDoInsumo(c.quantidade, c.unidade || null, unAlvo === "porcao" ? "un" : unAlvo);
    if (q == null) return pergunta("quantidade", `${nomeAlvo} é controlado em ${ROTULO_UN[unAlvo] || unAlvo}. Quanto vai, nessa unidade?`, { indice: i, aviso: "Essa unidade não combina com o cadastro." });
    linhas.push({
      c, nome: nomeAlvo, qtdTexto: `${num(c.quantidade)} ${ROTULO_UN[c.unidade || unAlvo] || c.unidade || unAlvo}`,
      item: alvo.tipo === "ficha" ? { subficha_id: alvo.ficha.id, insumo_id: null, quantidade: Math.round(q * 1e6) / 1e6, fator_correcao: 0 } : { insumo_id: alvo.insumo.id, subficha_id: null, quantidade: Math.round(q * 1e6) / 1e6, fator_correcao: 0 },
    });
  }

  // 4. Embalagens
  if (!p.embOk) return pergunta("embalagens", `Agora a embalagem da ${p.nome}. O que vai? Ex.: "pote 750 ml, tampa, saco, adesivo" (ou "nenhuma").`, { aviso });
  const embs = p.embs || [];
  const linhasEmb = [];
  for (let j = 0; j < embs.length; j++) {
    const e = embs[j];
    let ins = e.insumoId ? insPorId.get(e.insumoId) : null;
    if (!ins && !e.novo) {
      const cand = e.cadastrar ? [] : candidatosDoTermo(embalagens, e.termo, 6);
      if (cand.length === 1) ins = cand[0];
      else if (cand.length > 1) return pergunta("emb_escolha", `Qual "${e.termo}"?`, { indice: j, aviso, opcoes: [...cand.map((x) => ({ id: `i:${x.id}`, rotulo: x.nome })), { id: "novo", rotulo: `Cadastrar "${e.termo}" novo` }, { id: "remover", rotulo: "Tirar" }] });
      else return pergunta("emb_preco", `"${e.termo}" não está cadastrado. Por quanto você compra? Ex.: "100 unidades por 25,00".`, { indice: j, aviso });
    }
    if (!ins) {
      const chave = `novo:e${j}`;
      ins = pseudoInsumo(chave, cap(e.termo), e.novo, "embalagens");
      insumos.set(chave, ins); novosIns.push({ chave, ...ins });
    }
    linhasEmb.push({ insumo_id: ins.id, quantidade: e.quantidade || 1, tipo: "outra", nome: ins.nome });
  }

  // 5. Em qual app
  let canal = p.canalId ? d.canais.find((x) => x.id === p.canalId) : null;
  if (p.canalId && !canal) return { erro: "O app escolhido não existe mais nas configurações." };
  let canalNovo = null;
  const ativos = d.canais.filter((x) => x.ativo !== false);
  // "iFood e 99", "todos": os apps citados; o primeiro é o principal (combo e guia)
  let extras = [];
  if (!canal && !p.canalNovo && p.canaisEscolha) {
    const esc = canaisDaEscolha(ativos, p.canaisEscolha);
    if (!esc.length) return pergunta(p.simular ? "canais_depois" : "canal", `Não achei esse app nos cadastrados (${ativos.map((x) => x.nome).join(", ")}). Em qual vai vender?`, { opcoes: opcoesDeCanais(ativos, p.simular) });
    [canal, ...extras] = esc;
  }
  if (!canal) {
    if (!p.canalNovo && !p.simular) {
      if (ativos.length >= 2) {
        return pergunta("canal", `Em quais apps a ${p.nome} vai ser vendida? Você tem cadastrados: ${ativos.map((x) => x.nome).join(", ")}. Quer que eu simule em todos para ver qual dá mais lucro?`, { aviso, opcoes: opcoesDeCanais(ativos, false) });
      }
      return pergunta("canal", "Você vai vender em qual app?", { aviso, opcoes: [...ativos.map((x) => ({ id: x.id, rotulo: x.nome })), { id: "novo", rotulo: "Criar outro app" }] });
    }
  }
  if (!canal && p.simular) {
    // simulação em todos os apps cadastrados (SIMULAÇÃO), depois a pessoa escolhe
    const custoS = custoDaMarmita({ itens: linhas.map((l) => l.item), embalagens: linhasEmb, fichas, insumos });
    const embS = d.embutidos?.totalPorMarmita || 0;
    const margemS = p.lucroPct ?? d.margemAlvoPct;
    const lucroS = p.lucroReais ?? (p.lucroPct == null ? d.lucroAlvoReais : null);
    if (margemS == null && !(lucroS > 0)) {
      return pergunta("lucro", `Para simular: a ${p.nome} custa ${brl(custoS.total)} de ingredientes e embalagem${embS ? ` + ${brl(embS)} de equipe e contas por marmita` : ""}. Quanto você quer de lucro limpo em cada uma? Ex.: "R$ 5" ou "15%".`, { aviso });
    }
    const sim = simularApps({ ativos, custo: custoS.total, custoCheio: r2(custoS.total + embS), d, margem: margemS, lucroReais: lucroS });
    if (!sim.linhas.length) return pergunta("canais_depois", "DADOS INSUFICIENTES para simular: o calculador não achou preço em nenhum app. Em quais apps vai vender?", { aviso, opcoes: opcoesDeCanais(ativos, true) });
    return pergunta("canais_depois", `Simulação da ${p.nome} (SIMULAÇÃO, custo ${brl(custoS.total)}): ${sim.linhas.join("; ")}.${sim.melhor ? ` Vendendo todos a ${brl(sim.precoComum)}, o ${sim.melhor.nome} é o que dá mais lucro.` : ""} Em quais vai cadastrar?`, { aviso, opcoes: opcoesDeCanais(ativos, true) });
  }
  if (!canal) {
    if (!p.canalNovo.nome) return pergunta("canal_nome", "Qual o nome do app novo?", { aviso });
    if (p.canalNovo.comissao == null) return pergunta("canal_taxas", `Quantos por cento o ${p.canalNovo.nome} cobra? Ex.: "12% de comissão e 3,2% de pagamento" (ou "0" se é venda direta).`, { aviso });
    let base = fold(p.canalNovo.nome).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "app";
    if (base.length < 2) base = `app_${base}`;
    let id = base; let k = 2;
    while (d.canais.some((x) => x.id === id)) id = `${base}_${k++}`;
    canalNovo = normalizarCanal({ id, nome: p.canalNovo.nome, ativo: true, comissao_pct: p.canalNovo.comissao, taxa_pagamento_pct: p.canalNovo.pagamento ?? 0 });
    canal = canalNovo;
  }

  // 6. Custo e preço pela calculadora
  const custo = custoDaMarmita({ itens: linhas.map((l) => l.item), embalagens: linhasEmb, fichas, insumos });
  const embutido = d.embutidos?.totalPorMarmita || 0;
  const custoCheio = r2(custo.total + embutido);
  const margem = p.lucroPct ?? d.margemAlvoPct;
  const lucroReais = p.lucroReais ?? (p.lucroPct == null ? d.lucroAlvoReais : null);
  if (margem == null && !(lucroReais > 0)) {
    return pergunta("lucro", `A ${p.nome} custa ${brl(custo.total)} de ingredientes e embalagem${embutido ? ` + ${brl(embutido)} de equipe e contas por marmita` : ""}. Quanto você quer de lucro limpo em cada uma? Ex.: "R$ 5" ou "15%".`, { aviso });
  }
  const sug = precoSugerido({ custoTecnico: custoCheio, canal, tributosPct: d.tributosPct, margemAlvoPct: margem, lucroAlvoReais: lucroReais });
  if (!p.preco) {
    if (!sug.preco) return pergunta("preco", `${sug.motivo || "Não consegui calcular o preço."} Por quanto vai vender no ${canal.nome}?`, { aviso });
    const meta = lucroReais > 0 ? `${brl(lucroReais)} de lucro` : `${num(margem, 1)}% de lucro`;
    return pergunta("preco", `Custo da ${p.nome}: ${brl(custo.total)}${embutido ? ` + ${brl(embutido)} de equipe e contas` : ""}. Pelo nosso calculador, para sobrar ${meta} no ${canal.nome}, tem que vender a ${brl(sug.preco)}. Vender a ${brl(sug.preco)}?`,
      { aviso, sugerido: sug.preco, opcoes: [{ id: "sim", rotulo: `Vender a ${brl(sug.preco)}` }, { id: "outro", rotulo: "Outro preço (digite)", livre: true }] });
  }
  const resultado = lucroDoPedido({ paga: p.preco, custo: custo.total, canal, tributosPct: d.tributosPct, embutidos: d.embutidos, marmitas: 1 });
  // os outros apps escolhidos: um preço para cada, pela mesma calculadora
  const porApp = [{ canal, preco: p.preco, resultado }];
  for (const cx of extras) {
    const ja = (p.precosExtras || []).find((x) => x.canal === cx.id);
    if (!ja) {
      const sx = precoSugerido({ custoTecnico: custoCheio, canal: cx, tributosPct: d.tributosPct, margemAlvoPct: margem, lucroAlvoReais: lucroReais });
      if (!sx.preco) return pergunta("preco_extra", `${sx.motivo || "Não consegui calcular o preço."} Por quanto vai vender no ${cx.nome}?`, { aviso, canal: cx.id });
      const meta = lucroReais > 0 ? `${brl(lucroReais)} de lucro` : `${num(margem, 1)}% de lucro`;
      return pergunta("preco_extra", `No ${cx.nome}, para sobrar ${meta}, tem que vender a ${brl(sx.preco)}. Vender a ${brl(sx.preco)} no ${cx.nome}?`,
        { aviso, canal: cx.id, sugerido: sx.preco, opcoes: [{ id: "sim", rotulo: `Vender a ${brl(sx.preco)}` }, { id: "outro", rotulo: "Outro preço (digite)", livre: true }] });
    }
    porApp.push({ canal: cx, preco: ja.preco, resultado: lucroDoPedido({ paga: ja.preco, custo: custo.total, canal: cx, tributosPct: d.tributosPct, embutidos: d.embutidos, marmitas: 1 }) });
  }

  // 7. Combo com refrigerante (sobremesa fica para depois, na tela de combos)
  if (!p.combo) return pergunta("combo", `Vamos montar um combo da ${p.nome} com refrigerante?`, { aviso, opcoes: [{ id: "sim", rotulo: "Sim, com refrigerante" }, { id: "nao", rotulo: "Agora não" }] });
  let combo = null;
  if (!p.combo.nao) {
    if (!p.combo.bebida && !p.combo.insumoId) return pergunta("bebida", "Qual refrigerante e por quanto você compra? Ex.: \"Coca lata 350 ml, 12 por 30,00\".", { aviso });
    let insB = p.combo.insumoId ? insPorId.get(p.combo.insumoId) : null;
    if (!insB && !p.combo.novo) {
      const cand = candidatosDoTermo(ingredientes, p.combo.bebida, 3);
      if (cand.length === 1) insB = cand[0];
      else return pergunta("bebida_preco_compra", `Por quanto você compra ${p.combo.bebida}? Ex.: "12 por 30,00" ou "1 un por 3,50".`, { aviso });
    }
    if (!insB) { insB = pseudoInsumo("novo:bebida", p.combo.bebida, p.combo.novo); insumos.set(insB.id, insB); novosIns.push({ chave: insB.id, ...insB }); }
    const custoBebida = custoDaMarmita({ itens: [{ insumo_id: insB.id, quantidade: 1 }], fichas, insumos }).total;
    if (!p.combo.precoBebida) return pergunta("bebida_preco", `O ${insB.nome} sai a ${brl(custoBebida)} a unidade. Por quanto vende ele sozinho?`, { aviso });
    // SUGESTÃO: os dois juntos com 5% de desconto, terminando em ,90
    const cheio = p.preco + p.combo.precoBebida;
    const alvo = cheio * 0.95;
    let sugCombo = Math.floor(alvo) + 0.9;
    if (sugCombo > alvo) sugCombo -= 1;
    sugCombo = r2(Math.max(0.9, sugCombo));
    const custoCombo = custo.total + custoBebida;
    if (!p.combo.preco) {
      const l = lucroDoPedido({ paga: r2(sugCombo), custo: custoCombo, canal, tributosPct: d.tributosPct, embutidos: d.embutidos, marmitas: 1 });
      return pergunta("combo_preco", `Separados dão ${brl(cheio)}. Sugestão: o combo ${p.nome} + ${insB.nome} por ${brl(sugCombo)}, sobrando ${brl(l.lucro)} de lucro (SUGESTÃO). Fica assim?`,
        { aviso, sugerido: r2(sugCombo), opcoes: [{ id: "sim", rotulo: `Combo a ${brl(sugCombo)}` }, { id: "outro", rotulo: "Outro preço (digite)", livre: true }] });
    }
    combo = { nome: `${p.nome} + ${insB.nome}`, preco: p.combo.preco, bebida: { insumo: insB, preco: p.combo.precoBebida, custo: custoBebida },
      lucro: lucroDoPedido({ paga: p.combo.preco, custo: custoCombo, canal, tributosPct: d.tributosPct, embutidos: d.embutidos, marmitas: 1 }) };
  }

  // 8. Montagem
  const sugeridas = [...linhas.map((l) => `${l.nome}: ${l.qtdTexto}`), ...(linhasEmb.length ? [`Fechar: ${linhasEmb.map((e) => e.nome).join(", ")}`] : [])];
  const etapas = p.etapas?.length ? p.etapas : p.montagemOk ? sugeridas.slice(0, 15) : null;
  if (!etapas) {
    return pergunta("montagem", `Agora a montagem da ${p.nome}. Proponho nesta ordem: ${sugeridas.map((x, i) => `${i + 1}. ${x}`).join("; ")}. Está certo ou me diga a ordem.`, { aviso, opcoes: [{ id: "sim", rotulo: "Está certo" }, { id: "outra", rotulo: "Outra ordem (digite)", livre: true }] });
  }

  // ─── prévia ───
  const pesoG = linhas.reduce((t, l) => {
    const u = l.c.unidade || "";
    return t + (u === "g" || u === "ml" ? l.c.quantidade : u === "kg" || u === "l" ? l.c.quantidade * 1000 : 0);
  }, 0);
  const linhasPrevia = [
    { rotulo: "Marmita", valor: p.nome },
    ...linhas.map((l, i) => ({ rotulo: l.nome, valor: `${l.qtdTexto} · ${brl(custo.linhas[i]?.custo ?? 0)}` })),
    ...linhasEmb.map((e, i) => ({ rotulo: `Embalagem: ${e.nome}`, valor: `${num(e.quantidade)} un · ${brl(custo.linhasEmbalagens[i]?.custo ?? 0)}` })),
    ...novasSubs.map((x) => ({ rotulo: "Montar ficha", valor: `${x.nome}: rende ${num(x.rendimento)} ${ROTULO_UN[x.unidade]}` })),
    ...novosIns.map((x) => ({ rotulo: "Cadastrar", valor: `${x.nome}: ${num(x.tamanho_embalagem)} ${ROTULO_UN[x.unidade_medida]} por ${brl(x.custo_compra)}` })),
    { rotulo: "Custo da marmita", valor: brl(custo.total) },
    ...(embutido ? [{ rotulo: "Equipe e contas por marmita", valor: `${brl(embutido)} (ESTIMATIVA)` }] : []),
    ...(canalNovo ? [{ rotulo: "App novo", valor: `${canalNovo.nome}: ${num(canalNovo.comissao_pct, 2)}% + ${num(canalNovo.taxa_pagamento_pct, 2)}%` }] : []),
    ...porApp.flatMap((a) => [
      { rotulo: `Preço no ${a.canal.nome}`, valor: brl(a.preco) },
      { rotulo: porApp.length > 1 ? `Lucro no ${a.canal.nome}` : "Lucro por marmita", valor: a.resultado.lucro == null ? "DADOS INSUFICIENTES" : `${brl(a.resultado.lucro)} (${num(a.resultado.lucroPct, 1)}%)` },
    ]),
    ...(combo ? [{ rotulo: "Combo", valor: `${combo.nome} por ${brl(combo.preco)} · lucro ${brl(combo.lucro.lucro)}` }] : []),
    { rotulo: "Montagem", valor: etapas.map((x, i) => `${i + 1}. ${x}`).join(" ") },
  ];
  if (custo.pendencias.length) linhasPrevia.push({ rotulo: "Atenção", valor: custo.pendencias.join(" ") });
  const dep = (x) => x.departamento || "marmitaria";
  return {
    pronto: {
      preview: {
        titulo: "Criar marmita", entidade: null, linhas: linhasPrevia,
        impacto: { texto: `Lucro de ${resultado.lucro == null ? "—" : brl(resultado.lucro)} por marmita no ${canal.nome} (ESTIMATIVA: equipe e contas divididas pelas marmitas do mês).` },
      },
      payload: {
        unidade_id: ctx.escopo.unidadeId,
        novosInsumos: novosIns.map((x) => ({ chave: x.chave, ...insumoParaGravar(x, dep(x)) })),
        subfichas: novasSubs.map((x) => ({ chave: x.chave, nome: x.nome, rendimento: x.rendimento, rendimento_unidade: x.unidade, itens: x.itens.map((y) => ({ insumo_id: y.insumo_id, quantidade: y.quantidade })) })),
        marmita: {
          nome: p.nome, categoria: "", tamanho: "M", peso_final_g: pesoG > 0 ? Math.round(pesoG) : null, ativo: true, preco_venda: p.preco,
          custo_embalagens_total: custo.embalagens || 0,
          itens: linhas.map((l) => l.item), embalagens: linhasEmb.map(({ insumo_id, quantidade, tipo }) => ({ insumo_id, quantidade, tipo })),
          precos: porApp.map((a) => ({ canal: a.canal.id, preco_venda: a.preco })),
        },
        canalNovo,
        combo: combo ? { nome: combo.nome, preco: combo.preco, bebida: { nome: combo.bebida.insumo.nome, insumo_id: combo.bebida.insumo.id, preco: combo.bebida.preco } } : null,
        etapas,
        vitrine: {
          apps: porApp.map((a) => ({ plataforma: plataformaDoCanal(a.canal), preco: a.preco, nome: a.canal.nome })).filter((a) => a.plataforma),
          componentes: linhas.map((l) => l.nome).filter(Boolean).slice(0, 12),
        },
        resumo: { quantas: p.quantas || 1, ordem: p.ordem || 1, apps: porApp.map((a) => ({ nome: a.canal.nome, preco: a.preco, lucro: a.resultado.lucro ?? null })), nome: p.nome, custo: custo.total, preco: p.preco, canal: canal.nome, lucro: resultado.lucro, lucroPct: resultado.lucroPct, combo: combo ? { nome: combo.nome, preco: combo.preco } : null },
      },
    },
  };
}

// ─── Executar ────────────────────────────────────────────────────────────────

const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null);

async function executar(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const db = ctx.dbUsuario;
  const unidade = ctx.escopo.unidadeId;
  const feito = [];
  const falhou = (msg) => ({ ok: false, erro: `${msg}${feito.length ? ` Já ficou gravado: ${feito.join(", ")}.` : ""}` });
  const ids = new Map();
  const id = (x) => (ids.has(x) ? ids.get(x) : x);

  // 1. Ingredientes, embalagens e bebida novos (reaproveita o mesmo nome)
  for (const n of payload.novosInsumos || []) {
    const { chave, ...dados } = n;
    const { data: ja } = await db.from("insumos").select("id").eq("unidade_id", unidade).eq("nome", dados.nome).maybeSingle();
    if (ja?.id) { ids.set(chave, ja.id); continue; }
    const { data, error } = await db.from("insumos").insert([{ ...dados, unidade_id: unidade, preco_atualizado_em: new Date().toISOString() }]).select("id").single();
    if (error || !data?.id) return falhou(`Não consegui cadastrar ${dados.nome}: ${error?.message || "sem resposta do banco"}.`);
    ids.set(chave, data.id); feito.push(dados.nome);
  }
  // 2. Fichas do que é feito aqui (pré-preparo), pela mesma função da tela
  for (const sf of payload.subfichas || []) {
    const { data, error } = await db.rpc("marmitaria_salvar_ficha", { p_dados: {
      id: uuid(), unidade_id: unidade, tipo: "pre_preparo", departamento: "cozinha", nome: sf.nome, ativo: true,
      rendimento: sf.rendimento, rendimento_unidade: sf.rendimento_unidade,
      itens: sf.itens.map((y) => ({ insumo_id: id(y.insumo_id), subficha_id: null, quantidade: y.quantidade, fator_correcao: 0 })),
    } });
    if (error || !data?.id) return falhou(`Não consegui montar a ficha de ${sf.nome}: ${error?.message || "sem resposta do banco"}.`);
    ids.set(sf.chave, data.id); feito.push(`ficha de ${sf.nome}`);
  }
  // 3. App novo nas configurações da marmitaria
  if (payload.canalNovo) {
    const { data: cfg, error: e0 } = await db.from("marmitaria_configuracoes").select("unidade_id, canais").eq("unidade_id", unidade).maybeSingle();
    if (e0) return falhou(`Não consegui ler os apps: ${e0.message}.`);
    const canais = Array.isArray(cfg?.canais) ? cfg.canais : [];
    if (!canais.some((c) => c?.id === payload.canalNovo.id)) {
      const { error } = cfg
        ? await db.from("marmitaria_configuracoes").update({ canais: [...canais, payload.canalNovo], updated_at: new Date().toISOString() }).eq("unidade_id", unidade)
        : await db.from("marmitaria_configuracoes").insert([{ unidade_id: unidade, canais: [payload.canalNovo] }]);
      if (error) return falhou(`Não consegui criar o app ${payload.canalNovo.nome}: ${error.message}.`);
      feito.push(`app ${payload.canalNovo.nome}`);
    }
  }
  // 4. A marmita
  const m = payload.marmita;
  const { data: mm, error: e1 } = await db.rpc("marmitaria_salvar_ficha", { p_dados: {
    ...m, id: uuid(), unidade_id: unidade, tipo: "marmita", descricao: "", foto: "",
    itens: m.itens.map((x) => ({ ...x, insumo_id: x.insumo_id ? id(x.insumo_id) : null, subficha_id: x.subficha_id ? id(x.subficha_id) : null })),
    embalagens: m.embalagens.map((x) => ({ ...x, insumo_id: id(x.insumo_id) })),
  } });
  if (e1 || !mm?.id) return falhou(`Não consegui criar a marmita: ${e1?.message || "sem resposta do banco"}.`);
  feito.push(`marmita ${m.nome}`);
  // 5. Refrigerante (ficha de venda) e combo
  let bebidaId = null;
  if (payload.combo) {
    const b = payload.combo.bebida;
    const { data: fb, error: e2 } = await db.rpc("marmitaria_salvar_ficha", { p_dados: {
      id: uuid(), unidade_id: unidade, tipo: "marmita", nome: b.nome, categoria: "Refrigerantes", tamanho: "M", ativo: true,
      preco_venda: b.preco, custo_embalagens_total: 0, itens: [{ insumo_id: id(b.insumo_id), subficha_id: null, quantidade: 1, fator_correcao: 0 }], embalagens: [], precos: [],
    } });
    if (e2 || !fb?.id) return falhou(`A marmita foi criada, mas não consegui cadastrar ${b.nome} para o combo: ${e2?.message || "sem resposta"}.`);
    bebidaId = fb.id; feito.push(b.nome);
  }
  // 6. Guia de montagem e combo (config da unidade): relê e acrescenta, sem apagar o que existe
  const { data: reg } = await db.from("config_sistema").select("id, params").eq("unidade_id", unidade).maybeSingle();
  const params = reg?.params || {};
  let naVitrine = null;
  const nasVitrines = [];
  for (const a of payload.vitrine?.apps || []) {
    const atual = naVitrine || normalizarOrganizador(params[CHAVE_PARAMS]);
    const novo = vitrineComMarmita(atual, { plataforma: a.plataforma, componentes: payload.vitrine.componentes, nome: m.nome, fichaId: String(mm.id), preco: a.preco });
    if (novo) { naVitrine = novo; nasVitrines.push(a.nome); }
  }
  const patch = {
    ...(naVitrine ? { [CHAVE_PARAMS]: naVitrine } : {}),
    marmitaria_processos: { ...(params.marmitaria_processos || {}), [mm.id]: { embalagens: m.embalagens.map((x) => id(x.insumo_id)), etapas: payload.etapas.map((t, i) => ({ id: `ia-${i + 1}`, grupo: "montagem", titulo: t, texto: "", minutos: "", graus: "", foto: "" })) } },
    ...(payload.combo ? { marmitaria_combos: [...(Array.isArray(params.marmitaria_combos) ? params.marmitaria_combos : []), { id: `combo-${String(mm.id).slice(0, 8)}`, nome: payload.combo.nome, modelo: "comida_bebida", itens: [{ grupo: "marmita", id: mm.id }, { grupo: "bebida", id: bebidaId }], preco: String(payload.combo.preco) }].slice(0, 30) } : {}),
  };
  const { error: e3 } = await db.rpc("merge_config_sistema_params", { p_unidade_id: unidade, p_patch: patch });
  if (e3) {
    const { error: e4 } = reg
      ? await db.from("config_sistema").update({ params: { ...params, ...patch } }).eq("id", reg.id)
      : await db.from("config_sistema").insert([{ unidade_id: unidade, params: patch }]);
    if (e4) return { ok: true, resultado: { ...payload.resumo, marmitaId: mm.id, avisoMontagem: "A marmita foi criada, mas o guia de montagem e o combo não foram salvos. Salve em Guia de montagem e em Preço e combos." }, antes: null, depois: { marmitaId: mm.id } };
  }
  return { ok: true, resultado: { ...payload.resumo, marmitaId: mm.id, codigo: mm.codigo || null, nasVitrines }, antes: null, depois: { marmitaId: mm.id } };
}

function resumoResultado(rec) {
  const r = rec.resultado || {};
  const proxima = r.quantas > 1 && r.ordem < r.quantas ? r.ordem + 1 : null;
  const vitrines = r.nasVitrines || [];
  const vitrine = vitrines.length ? ` Ela já entrou no Delivery e na vitrine ${vitrines.length > 1 ? "de cada app" : "do"} ${vitrines.join(" e ")} (Organizador de plataforma), cada uma com o seu preço; falta a foto.` : " Ela já entrou no Delivery.";
  const apps = r.apps?.length > 1 ? r.apps : null;
  const seguir = proxima ? ` Agora a marmita ${proxima} de ${r.quantas}.` : r.quantas > 1 ? ` Pronto: as ${r.quantas} marmitas estão montadas.` : "";
  return {
    texto: `Marmita criada: ${r.nome}${r.codigo ? ` (${r.codigo})` : ""}. Custo ${brl(r.custo)}, ${apps ? apps.map((a) => `no ${a.nome} vende a ${brl(a.preco)}${a.lucro != null ? ` e sobram ${brl(a.lucro)}` : ""}`).join("; ") : `vende a ${brl(r.preco)} no ${r.canal}${r.lucro != null ? `, sobram ${brl(r.lucro)} de lucro` : ""}`}.${r.combo ? ` Combo ${r.combo.nome} a ${brl(r.combo.preco)}.` : ""} Sobremesa no combo fica para depois, em Preço e combos.${r.avisoMontagem ? ` ${r.avisoMontagem}` : ""}${vitrine}${seguir}`,
    linhas: [
      { rotulo: "Marmita", valor: r.nome },
      { rotulo: "Custo", valor: brl(r.custo) },
      ...(apps
        ? apps.flatMap((a) => [{ rotulo: `Preço no ${a.nome}`, valor: brl(a.preco) }, ...(a.lucro != null ? [{ rotulo: `Lucro no ${a.nome}`, valor: brl(a.lucro) }] : [])])
        : [{ rotulo: `Preço no ${r.canal}`, valor: brl(r.preco) }, ...(r.lucro != null ? [{ rotulo: "Lucro por marmita", valor: brl(r.lucro) }] : [])]),
      ...(r.combo ? [{ rotulo: "Combo", valor: `${r.combo.nome} · ${brl(r.combo.preco)}` }] : []),
    ],
    sugestoes: [...(proxima ? [`Vamos montar a marmita ${proxima} de ${r.quantas} nesta unidade`] : []), `Raio-x da marmita ${r.nome}`, `Como monta a marmita ${r.nome}?`],
    acoes: [{ rotulo: "Imprimir o guia de montagem", rota: "/dashboard/marmitaria/marmitas/processos" }, { rotulo: "Abrir preço e combos", rota: "/dashboard/marmitaria/marmitas/cardapio" }, ...(vitrines.length ? [{ rotulo: "Abrir o organizador", rota: "/dashboard/marmitaria/marmitas/organizador" }] : [])],
    referencia: null,
  };
}

export const criarMarmita = Object.freeze({
  id: "marmita.create",
  nome: "Criar marmita",
  descricao: "Monta uma marmita conversando: componentes, gramas, ficha do que é feito aqui, embalagens, app, preço pela calculadora, combo e montagem.",
  modulo: "marmitaria",
  capacidade: "criar_marmita",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["quantas", "ordem", "unidadeOk", "unidadeEscolha", "nome", "total", "comps", "embs", "embOk", "canalId", "simular", "canaisEscolha", "precosExtras", "canalNovo", "lucroReais", "lucroPct", "preco", "combo", "etapas", "montagemOk", "pendente", "aviso", "resposta"],
  validacoes: [
    "ingrediente, embalagem e ficha existem na unidade (ou são cadastrados junto, com o preço informado)",
    "quantidade na unidade do cadastro (g↔kg, ml↔L)",
    "custo pela conta da marmitaria e preço pela calculadora da Precificação",
    "gravação pelo usuário logado (RLS) e pela função marmitaria_salvar_ficha",
  ],
  rollback: "Tirar a marmita do cardápio (ou excluir) na Ficha técnica; app, combo e guia são editados nas telas da marmitaria.",
  paramsSchema,
  aplicarResposta,
  preparar,
  executar,
  resumoResultado,
});
