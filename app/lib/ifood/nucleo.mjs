// Núcleo dos pedidos do iFood — funções puras, sem banco, sem rede e sem React
// (testes em nucleo.test.mjs). O servidor (app/lib/server/ifood-sync.mjs) só
// busca, chama estas funções e grava.
//
// Fontes (documentação oficial do iFood Developer, lida em 14/10/2026):
//   eventos   docs/food/guides/modules/order/events e events/polling-overview
//   pedido    docs/food/guides/modules/order/details
// O que a documentação não deixou claro fica marcado "A CONFIRMAR NA HOMOLOGAÇÃO".
//
// Regras da casa aplicadas aqui:
//   - nada é inventado: taxa do iFood vem da configuração do canal e sai
//     marcada como ESTIMATIVA até o financeiro do iFood informar o valor real;
//   - o mínimo de dado pessoal: só o primeiro nome do cliente; telefone,
//     documento e endereço não são guardados (LGPD);
//   - o Héfisto só OBSERVA o pedido: quem confirma, prepara e despacha é o PDV
//     da loja (ex.: Saipos). Nenhuma função aqui produz ação no iFood.

import { parseNumero } from "../ficha-calculos.mjs";
import { consumoDaMarmita, normalizarCanal, canalConfigurado } from "../marmitaria/nucleo.mjs";

const cent = (v) => Math.round(parseNumero(v) * 100);
const reais = (c) => Math.round(c) / 100;
const pos = (v) => { const n = parseNumero(v); return n > 0 ? n : 0; };

// ─── Eventos ─────────────────────────────────────────────────────────────────

// Código curto → status do pedido no Héfisto (só os que mudam o ciclo de vida).
export const STATUS_DO_EVENTO = Object.freeze({
  PLC: "RECEBIDO", CFM: "CONFIRMADO", PRS: "EM_PREPARO", RTP: "PRONTO",
  DSP: "DESPACHADO", CON: "CONCLUIDO", CAN: "CANCELADO",
});
// Nome longo (fullCode) → código curto. Inclui a variante ORDER_* que aparece
// em exemplos antigos da documentação.
const CURTO = {
  PLACED: "PLC", CONFIRMED: "CFM", PREPARATION_STARTED: "PRS", READY_TO_PICKUP: "RTP", DISPATCHED: "DSP",
  CONCLUDED: "CON", CANCELLED: "CAN", CANCELLATION_REQUESTED: "CAR", CANCELLATION_REQUEST_FAILED: "CARF",
  HANDSHAKE_DISPUTE: "HSD", HANDSHAKE_SETTLEMENT: "HSS", ORDER_PATCHED: "OPA",
  DELIVERY_ADDRESS_CHANGE_REQUESTED: "DAR", RECOMMENDED_PREPARATION_START: "RPS",
};
export const RANK = Object.freeze({ RECEBIDO: 1, CONFIRMADO: 2, EM_PREPARO: 3, PRONTO: 4, DESPACHADO: 5, CONCLUIDO: 6, CANCELADO: 9 });
export const ROTULO_STATUS = Object.freeze({
  RECEBIDO: "Novo", CONFIRMADO: "Confirmado", EM_PREPARO: "Em preparo", PRONTO: "Pronto",
  DESPACHADO: "Saiu para entrega", CONCLUIDO: "Concluído", CANCELADO: "Cancelado",
});

export function codigoCurto(ev = {}) {
  const c = String(ev.code || "").toUpperCase();
  if (STATUS_DO_EVENTO[c] || Object.values(CURTO).includes(c)) return c;
  const longo = String(ev.fullCode || ev.code || "").toUpperCase().replace(/^ORDER_/, "");
  return CURTO[longo] || c || "DESCONHECIDO";
}

/** Evento do iFood → formato da fila. `valido` falso quando não dá para usar com segurança. */
export function normalizarEvento(ev) {
  if (!ev || typeof ev !== "object") return { valido: false, motivo: "Evento vazio." };
  const id = ev.id ? String(ev.id) : "";
  const codigo = codigoCurto(ev);
  const orderId = ev.orderId ? String(ev.orderId) : "";
  const merchantId = ev.merchantId ? String(ev.merchantId) : "";
  const criadoEm = ev.createdAt && !Number.isNaN(Date.parse(ev.createdAt)) ? new Date(ev.createdAt).toISOString() : null;
  if (!id) return { valido: false, motivo: "Evento sem id.", codigo, orderId, merchantId };
  return { valido: true, id, codigo, fullCode: ev.fullCode ? String(ev.fullCode) : null, orderId, merchantId, criadoEm, metadata: ev.metadata && typeof ev.metadata === "object" ? ev.metadata : {} };
}

/** Ordem de processamento: data do evento (a API não garante ordem), depois id. */
export function ordenarEventos(eventos = []) {
  return [...eventos].sort((a, b) => String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Situação de um pedido a partir de TODOS os eventos conhecidos dele.
 *   confirmado:  a loja aceitou em algum momento (CFM ou depois)
 *   preparoIniciado: comida já foi para o fogo (PRS/RTP/DSP/CON antes do cancelamento)
 */
export function situacaoDoPedido(eventos = []) {
  let status = null; let statusCanal = null; let confirmado = false; let preparoIniciado = false;
  let cancelamento = null; let disputa = null; let alterado = false;
  for (const e of ordenarEventos(eventos)) {
    const s = STATUS_DO_EVENTO[e.codigo];
    if (e.codigo === "OPA") alterado = true;
    if (e.codigo === "HSD" || e.codigo === "HSS") disputa = { etapa: e.codigo === "HSD" ? "aberta" : "resolvida", em: e.criadoEm, ...camposSimples(e.metadata) };
    if (!s) continue;
    if (s === "CANCELADO") cancelamento = resumoCancelamento(e.metadata, e.criadoEm);
    else if (RANK[s] >= 2) { confirmado = true; if (RANK[s] >= 3) preparoIniciado = true; }
    if (status === "CANCELADO") continue;
    if (s === "CANCELADO" || RANK[s] > (RANK[status] || 0)) { status = s; statusCanal = e.fullCode || e.codigo; }
  }
  return { status: status || "RECEBIDO", statusCanal, confirmado, preparoIniciado, cancelamento, disputa, alterado };
}

function resumoCancelamento(m = {}, em = null) {
  return { codigo: m.CANCEL_CODE ?? m.cancelCode ?? null, motivo: m.CANCEL_REASON ?? m.cancelReason ?? null, origem: m.CANCEL_ORIGIN ?? m.cancelOrigin ?? null, em };
}
// metadado da disputa: só valores simples (sem objetos de cliente)
function camposSimples(m = {}) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) if (["string", "number", "boolean"].includes(typeof v) && !/phone|document|cpf|address|email/i.test(k)) out[k] = v;
  return out;
}

// ─── Pedido ──────────────────────────────────────────────────────────────────

/** Data (AAAA-MM-DD) no fuso da operação. */
export function dataLocal(iso, fuso = "America/Sao_Paulo") {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const g = (t) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/**
 * Detalhes do pedido (GET /order/v1.0/orders/{id}) → linha de delivery_pedidos.
 * Benefícios: patrocínio MERCHANT é desconto da loja; IFOOD/EXTERNAL/CHAIN é
 * pago por terceiros (não reduz a receita da loja). additionalFees são receita
 * do iFood. (doc: order/details)
 */
export function normalizarPedido(o, { unidadeId, fuso = "America/Sao_Paulo" } = {}) {
  if (!o || typeof o !== "object" || !o.id) throw new Error("Detalhes do pedido inválidos.");
  const avisos = [];
  let lojaC = 0; let canalC = 0;
  for (const b of Array.isArray(o.benefits) ? o.benefits : []) {
    const patrocinios = Array.isArray(b.sponsorshipValues) ? b.sponsorshipValues : [];
    if (!patrocinios.length) { lojaC += cent(b.value); avisos.push("Benefício sem patrocinador informado: contado como desconto da loja."); continue; }
    for (const s of patrocinios) (String(s.name || "").toUpperCase() === "MERCHANT" ? (lojaC += cent(s.value)) : (canalC += cent(s.value)));
  }
  const taxasC = (Array.isArray(o.additionalFees) ? o.additionalFees : []).reduce((t, f) => t + cent(f.value), 0);
  const agendado = String(o.orderTiming || "").toUpperCase() === "SCHEDULED";
  const agendadoPara = agendado ? (o.schedule?.deliveryDateTimeStart || null) : null;
  const metodos = (Array.isArray(o.payments?.methods) ? o.payments.methods : []).map((m) => ({
    metodo: m.method || null, tipo: m.type || null, valor: reais(cent(m.value)), carteira: m.wallet?.name || null, bandeira: m.card?.brand || null,
  }));
  return {
    pedido: {
      unidade_id: unidadeId, canal: "ifood", pedido_externo_id: String(o.id),
      display_id: o.displayId ? String(o.displayId) : null,
      merchant_id: o.merchant?.id ? String(o.merchant.id) : null,
      tipo: o.orderType || null, agendado, agendado_para: agendadoPara,
      criado_no_canal_em: o.createdAt || null,
      data_operacao: dataLocal(agendadoPara || o.createdAt, fuso),
      cliente_nome: String(o.customer?.name || "").trim().split(/\s+/)[0] || null,
      itens: (Array.isArray(o.items) ? o.items : []).map((i) => ({
        codigo: String(i.externalCode || i.id || i.uniqueId || ""), id: i.id ? String(i.id) : null,
        nome: i.name || "Item", quantidade: pos(i.quantity) || 1,
        preco_unit: reais(cent(i.unitPrice)), total: reais(cent(i.totalPrice ?? i.price)),
        opcoes: (Array.isArray(i.options) ? i.options : []).map((op) => ({ codigo: String(op.externalCode || op.id || ""), nome: op.name || "", grupo: op.groupName || null, quantidade: pos(op.quantity) || 1, preco: reais(cent(op.price)) })),
      })),
      subtotal: o.total?.subTotal == null ? null : reais(cent(o.total.subTotal)),
      taxa_entrega: o.total?.deliveryFee == null ? null : reais(cent(o.total.deliveryFee)),
      descontos_loja: reais(lojaC), beneficios_canal: reais(canalC), taxas_adicionais: reais(taxasC),
      valor_pedido: o.total?.orderAmount == null ? null : reais(cent(o.total.orderAmount)),
      pagamento: { prepago: o.payments?.prepaid == null ? null : reais(cent(o.payments.prepaid)), pendente: o.payments?.pending == null ? null : reais(cent(o.payments.pending)), metodos },
      entregue_por: o.delivery?.deliveredBy || null,
      teste: !!o.isTest,
      detalhes_carregados: true,
    },
    avisos: [...new Set(avisos)],
  };
}

// ─── Vendas (marmitaria_vendas) ──────────────────────────────────────────────

// Divide `total` (centavos) entre partes proporcionais a `pesos`, sem perder centavo.
export function ratear(totalC, pesos = []) {
  const somaP = pesos.reduce((t, p) => t + p, 0);
  if (!(somaP > 0) || !totalC) return pesos.map(() => 0);
  const brutos = pesos.map((p) => (totalC * p) / somaP);
  const out = brutos.map(Math.floor);
  let resto = totalC - out.reduce((t, x) => t + x, 0);
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; resto > 0 && k < ordem.length; k++, resto--) out[ordem[k][1]]++;
  return out;
}

/**
 * Linhas de venda de um pedido, uma por marmita (+ "outros itens" e entrega).
 *   mapeamento: Map código do item → { ficha_id, quantidade_por_item, ignorar }
 *   canal:      configuração do canal iFood da marmitaria (taxas do contrato)
 * Valores do pedido = REAL. Comissão e taxa de pagamento = ESTIMATIVA pela
 * configuração (taxas_estimadas: true) até o financeiro do iFood informar.
 *
 * Retorna { vendas, avisos, semMapeamento }. `vendas` vazio quando o pedido não
 * gera venda (teste, não confirmado, cancelado antes de confirmar).
 */
export function vendasDoPedido({ pedido, situacao, mapeamento = new Map(), canal = null } = {}) {
  const avisos = [];
  const semMapeamento = [];
  if (!pedido?.detalhes_carregados) return { vendas: null, avisos: ["Pedido sem detalhes: vendas não calculadas."], semMapeamento };
  if (pedido.teste) return { vendas: [], avisos: ["Pedido de teste do iFood: não entra nas vendas."], semMapeamento };
  const cancelado = situacao?.status === "CANCELADO";
  if (!situacao?.confirmado) return { vendas: [], avisos: cancelado ? ["Cancelado antes de ser confirmado: não gera venda."] : [], semMapeamento };

  const prefixo = `ifood:${pedido.pedido_externo_id}:`;
  const grupos = new Map(); // chave → { ficha_id, quantidade, brutoC }
  const somar = (chave, ficha, q, c) => { const g = grupos.get(chave) || { ficha_id: ficha, quantidade: 0, brutoC: 0 }; g.quantidade += q; g.brutoC += c; grupos.set(chave, g); };
  for (const it of pedido.itens || []) {
    const m = mapeamento.get(it.codigo);
    const valorC = cent(it.total);
    if (m && !m.ignorar && m.ficha_id) somar(m.ficha_id, m.ficha_id, pos(it.quantidade) * (pos(m.quantidade_por_item) || 1), valorC);
    else if (m?.ignorar) somar("outros", null, 0, valorC);
    else { somar("sem_marmita", null, pos(it.quantidade), valorC); semMapeamento.push({ codigo: it.codigo, nome: it.nome }); }
  }
  // Taxa de entrega é receita da loja só quando a própria loja entrega.
  const entregaC = cent(pedido.taxa_entrega);
  if (entregaC > 0) {
    const quem = String(pedido.entregue_por || "").toUpperCase();
    if (quem === "MERCHANT") somar("entrega", null, 0, entregaC);
    else if (!quem) avisos.push("O pedido não diz quem entregou: a taxa de entrega ficou fora da receita.");
  }
  if (semMapeamento.length) avisos.push(`${semMapeamento.length} item(ns) sem marmita associada: associe em Configurações → iFood.`);

  const chaves = [...grupos.keys()];
  const brutos = chaves.map((k) => grupos.get(k).brutoC);
  const descontos = ratear(cent(pedido.descontos_loja), brutos);

  const c = canal ? normalizarCanal(canal) : null;
  const configurado = c && canalConfigurado(c);
  if (!configurado) avisos.push("Taxas do iFood não configuradas na marmitaria: comissão e taxa de pagamento ficaram zeradas (estimativa).");
  const receitaTotalC = brutos.reduce((t, b) => t + b, 0) - descontos.reduce((t, d) => t + d, 0);
  const prepago = pedido.pagamento?.prepago;
  const fracaoOnline = prepago == null || !(cent(pedido.valor_pedido) > 0) ? 1 : Math.min(1, cent(prepago) / cent(pedido.valor_pedido));
  const pctOf = (v) => (v == null ? 0 : pos(v) / 100);

  const vendas = chaves.map((k, i) => {
    const g = grupos.get(k);
    const receitaC = g.brutoC - descontos[i];
    let comissaoC = 0; let pagamentoC = 0; let fixaC = 0;
    if (configurado && !cancelado) {
      comissaoC = Math.round((c.comissao_base === "bruto" ? g.brutoC : receitaC) * pctOf(c.comissao_pct));
      pagamentoC = c.pagamento_na_comissao ? 0 : Math.round(receitaC * fracaoOnline * pctOf(c.taxa_pagamento_pct));
    }
    if (configurado && !cancelado && receitaTotalC > 0) fixaC = ratear(cent(c.taxa_fixa_pedido), brutos.map((b, j) => b - descontos[j]))[i];
    return {
      referencia_externa: `${prefixo}${k}`,
      ficha_id: g.ficha_id,
      quantidade: cancelado ? 0 : Math.round(g.quantidade * 1000) / 1000,
      valor_bruto: reais(g.brutoC),
      descontos: reais(descontos[i]),
      cancelamentos: cancelado ? reais(receitaC) : 0,
      comissao: reais(comissaoC),
      taxa_pagamento: reais(pagamentoC),
      outras_taxas: reais(fixaC),
      repasse_liquido: cancelado ? null : reais(receitaC - comissaoC - pagamentoC - fixaC),
      taxas_estimadas: true,
      observacao: `Pedido iFood #${pedido.display_id || pedido.pedido_externo_id}${k === "outros" ? " — outros itens" : k === "entrega" ? " — taxa de entrega" : k === "sem_marmita" ? " — itens sem marmita associada" : ""}`,
    };
  });
  return { vendas, avisos: [...new Set(avisos)], semMapeamento };
}

// ─── Estoque ─────────────────────────────────────────────────────────────────

/**
 * Consumo de estoque que o pedido DEVE ter (unidade do saldo), por insumo.
 * Pedido não confirmado, de teste, ou cancelado antes de ir para o preparo
 * não consome nada. Cancelado depois do preparo: a comida foi feita, o
 * consumo fica.
 */
export function consumoDoPedido({ pedido, situacao, mapeamento = new Map(), marmitas = new Map(), fichas = [], insumos = new Map(), espelho = new Map() } = {}) {
  const total = new Map(); const faltas = []; const semMarmita = [];
  if (!pedido?.detalhes_carregados || pedido.teste || !situacao?.confirmado) return { consumo: total, faltas, semMarmita };
  if (situacao.status === "CANCELADO" && !situacao.preparoIniciado) return { consumo: total, faltas, semMarmita };
  const porFicha = new Map();
  for (const it of pedido.itens || []) {
    const m = mapeamento.get(it.codigo);
    if (m?.ignorar) continue;
    if (!m?.ficha_id) { semMarmita.push(it.nome); continue; }
    porFicha.set(m.ficha_id, (porFicha.get(m.ficha_id) || 0) + pos(it.quantidade) * (pos(m.quantidade_por_item) || 1));
  }
  for (const [fichaId, q] of porFicha) {
    const marmita = marmitas.get(fichaId);
    if (!marmita) { faltas.push("Marmita associada não encontrada (removida?)."); continue; }
    const r = consumoDaMarmita({ marmita, quantidade: q, fichas, insumos, espelho });
    faltas.push(...r.faltas);
    for (const [insumoId, { q: qtd, nome }] of r.precisa) {
      const a = total.get(insumoId) || { q: 0, nome };
      a.q += qtd; total.set(insumoId, a);
    }
  }
  for (const a of total.values()) a.q = Math.round(a.q * 1000) / 1000;
  return { consumo: total, faltas: [...new Set(faltas)], semMarmita: [...new Set(semMarmita)] };
}

/**
 * Movimentos que levam o estoque do que JÁ foi aplicado ao que o pedido deve
 * consumir. aplicado: { "estoque_id:insumo_id": qtd }. Mais consumo sai do
 * primeiro local com saldo (prioridade da marmitaria); menos consumo volta aos
 * mesmos locais de onde saiu. Reprocessar o mesmo pedido gera zero movimento.
 *   saldos: Map insumo_id → [{ estoque_id, saldo, prioridade }]
 */
export function ajusteDeEstoque({ aplicado = {}, consumo = new Map(), saldos = new Map(), nomes = new Map() } = {}) {
  const porInsumo = new Map();
  for (const [chave, q] of Object.entries(aplicado || {})) {
    const [estoqueId, insumoId] = chave.split(":");
    if (!estoqueId || !insumoId || !(parseNumero(q) > 0)) continue;
    const l = porInsumo.get(insumoId) || [];
    l.push({ estoque_id: estoqueId, q: parseNumero(q) });
    porInsumo.set(insumoId, l);
  }
  const novo = {}; const movimentos = []; const faltas = [];
  for (const [chave, q] of Object.entries(aplicado || {})) if (parseNumero(q) > 0) novo[chave] = parseNumero(q);
  const ids = new Set([...porInsumo.keys(), ...consumo.keys()]);
  for (const insumoId of ids) {
    const ja = (porInsumo.get(insumoId) || []).reduce((t, l) => t + l.q, 0);
    const deve = consumo.get(insumoId)?.q || 0;
    const delta = Math.round((deve - ja) * 1000) / 1000;
    const nome = consumo.get(insumoId)?.nome || nomes.get(insumoId) || "Item";
    if (Math.abs(delta) < 0.001) continue;
    if (delta > 0) {
      const locais = [...(saldos.get(insumoId) || [])].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9));
      const local = locais.find((l) => parseNumero(l.saldo) >= delta);
      if (!local) { faltas.push(`${nome}: faltam ${delta} no estoque para este pedido.`); continue; }
      movimentos.push({ estoque_id: local.estoque_id, insumo_id: insumoId, tipo: "saida", quantidade: delta, nome });
      const k = `${local.estoque_id}:${insumoId}`;
      novo[k] = Math.round(((novo[k] || 0) + delta) * 1000) / 1000;
    } else {
      let devolver = -delta;
      for (const l of [...(porInsumo.get(insumoId) || [])].sort((a, b) => b.q - a.q)) {
        if (devolver <= 0) break;
        const q = Math.min(l.q, devolver);
        movimentos.push({ estoque_id: l.estoque_id, insumo_id: insumoId, tipo: "entrada", quantidade: Math.round(q * 1000) / 1000, nome });
        const k = `${l.estoque_id}:${insumoId}`;
        novo[k] = Math.round((novo[k] - q) * 1000) / 1000;
        if (novo[k] <= 0) delete novo[k];
        devolver -= q;
      }
    }
  }
  return { movimentos, aplicado: novo, faltas };
}

// ─── Conciliação e duplicidade ───────────────────────────────────────────────

/**
 * Dias em que o mesmo canal tem venda lançada à mão E venda automática:
 * provável duplicidade (ex.: alguém lançou o iFood do dia e os pedidos também
 * chegaram sozinhos). Nada é apagado: o dono decide.
 */
export function duplicidadesDeFonte(vendas = []) {
  const m = new Map();
  for (const v of vendas) {
    if (v.canal !== "ifood") continue;
    const k = String(v.data).slice(0, 10);
    const a = m.get(k) || { data: k, manualC: 0, automaticoC: 0, manual: 0, automatico: 0 };
    if (v.fonte === "ifood") { a.automaticoC += cent(v.valor_bruto); a.automatico++; } else { a.manualC += cent(v.valor_bruto); a.manual++; }
    m.set(k, a);
  }
  return [...m.values()].filter((a) => a.manual && a.automatico)
    .map((a) => ({ data: a.data, valorManual: reais(a.manualC), valorAutomatico: reais(a.automaticoC), lancamentosManuais: a.manual }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Pedido equivalente vindo de outra fonte (ex.: exportação da Saipos, que traz
 * o número curto do iFood). Casa por canal + número curto + dia (±1) e, se
 * informado, valor (±R$ 0,01). Ambíguo = não casa (o dono decide).
 */
export function pedidoEquivalente(pedidos = [], { canal = "ifood", pedidoExternoId = null, displayId = null, data = null, valor = null } = {}) {
  if (pedidoExternoId) {
    const p = pedidos.find((x) => x.canal === canal && x.pedido_externo_id === String(pedidoExternoId));
    if (p) return { pedido: p, criterio: "id do pedido" };
  }
  if (!displayId || !data) return { pedido: null, criterio: null };
  const dia = (d) => Date.parse(`${String(d).slice(0, 10)}T12:00:00Z`);
  const cands = pedidos.filter((x) => x.canal === canal && String(x.display_id || "") === String(displayId)
    && Math.abs(dia(x.data_operacao) - dia(data)) <= 86_400_000
    && (valor == null || x.valor_pedido == null || Math.abs(cent(x.valor_pedido) - cent(valor)) <= 1));
  if (cands.length === 1) return { pedido: cands[0], criterio: "número curto + dia" + (valor == null ? "" : " + valor") };
  return { pedido: null, criterio: cands.length > 1 ? "ambíguo" : null, candidatos: cands.length };
}

/**
 * O que precisa de atenção na sincronização: eventos que falharam, pedidos sem
 * detalhes, pedidos parados há horas e itens sem marmita.
 */
export function pendenciasDaSincronizacao({ pedidos = [], eventos = [], mapeamento = new Map(), agora = new Date().toISOString(), horasParado = 12 } = {}) {
  const t = Date.parse(agora);
  const falhas = eventos.filter((e) => e.status === "FALHA");
  const tentando = eventos.filter((e) => e.status === "ERRO_PROCESSAMENTO");
  const semDetalhes = pedidos.filter((p) => !p.detalhes_carregados);
  const parados = pedidos.filter((p) => RANK[p.status] < RANK.CONCLUIDO && p.criado_no_canal_em && t - Date.parse(p.criado_no_canal_em) > horasParado * 3_600_000);
  const semMarmita = new Map();
  for (const p of pedidos) {
    if (p.teste) continue;
    for (const it of p.itens || []) if (it.codigo && !mapeamento.has(it.codigo)) semMarmita.set(it.codigo, { codigo: it.codigo, nome: it.nome });
  }
  return {
    falhas: falhas.length, tentando: tentando.length, semDetalhes: semDetalhes.length, parados: parados.length,
    itensSemMarmita: [...semMarmita.values()],
    tudoCerto: !falhas.length && !tentando.length && !semDetalhes.length && !parados.length,
  };
}

/**
 * Conciliação do período: repasse ESPERADO (estimado pelas taxas configuradas
 * sobre os pedidos) × repasse REAL (informado pelo iFood). Sem repasse real o
 * resultado é "aguardando dados do iFood" — nunca uma diferença inventada.
 */
export function conciliarRepasses({ vendas = [], repasses = [] } = {}) {
  const doIfood = vendas.filter((v) => v.fonte === "ifood");
  const receitaC = doIfood.reduce((t, v) => t + cent(v.valor_bruto) - cent(v.descontos) - cent(v.cancelamentos), 0);
  const esperadoC = doIfood.reduce((t, v) => t + (v.repasse_liquido == null ? 0 : cent(v.repasse_liquido)), 0);
  const estimado = doIfood.some((v) => v.taxas_estimadas);
  const reais_ = repasses.filter((r) => String(r.tipo || "").toUpperCase() === "REPASSE");
  const recebidoC = reais_.reduce((t, r) => t + cent(r.valor), 0);
  const outrosC = repasses.filter((r) => String(r.tipo || "").toUpperCase() !== "REPASSE").reduce((t, r) => t + cent(r.valor), 0);
  const temReal = reais_.length > 0;
  return {
    pedidos: new Set(doIfood.map((v) => String(v.referencia_externa || "").split(":")[1])).size,
    receita: reais(receitaC),
    repasseEsperado: doIfood.length ? reais(esperadoC) : null,
    naturezaEsperado: estimado ? "estimativa" : "real",
    repasseRecebido: temReal ? reais(recebidoC) : null,
    outrosLancamentos: repasses.length && outrosC ? reais(outrosC) : null,
    diferenca: temReal && doIfood.length ? reais(recebidoC - esperadoC) : null,
    situacao: !doIfood.length ? "sem_pedidos" : temReal ? "conciliavel" : "aguardando_dados_ifood",
  };
}
