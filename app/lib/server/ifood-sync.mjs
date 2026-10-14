// SINCRONIZAÇÃO DOS PEDIDOS DO iFOOD — só no servidor.
//
// Fluxo (documentação oficial: events/polling-overview, order/details):
//   1. RECEBER   eventos por polling (GET /events/v1.0/events:polling) ou
//                webhook (assinatura X-IFood-Signature).
//   2. GUARDAR   cada evento em integration_events (único por id do iFood).
//   3. ACK       só dos eventos que ficaram guardados — a documentação manda
//                persistir antes de confirmar; evento sem ACK volta no próximo
//                polling, então nada se perde.
//   4. PROCESSAR a fila: busca os detalhes do pedido (uma vez; 404 logo após o
//                PLACED é normal e é tentado de novo), calcula a situação com
//                TODOS os eventos do pedido e grava pedido + vendas numa
//                transação (delivery_gravar_pedido). Falha → nova tentativa com
//                espera crescente; esgotou → FALHA, visível e reprocessável.
//
// O Héfisto só OBSERVA: não confirma, não despacha e não cancela pedidos.
// Quem opera o pedido na loja continua sendo o PDV (ex.: Saipos). Cada
// credencial do iFood é um "dispositivo" separado, com ACK próprio.
//
// Banco, cofre, relógio e iFood entram por parâmetro (testes sem rede em
// ifood-sync.test.mjs). Nenhum segredo vai para log, erro ou resposta.

import crypto from "node:crypto";
import { PROVEDOR, IFOOD_API, clienteIfood } from "./ifood-conexao.mjs";
import { verificarHmac } from "./integracoes.mjs";
import { normalizarEvento, situacaoDoPedido, normalizarPedido, vendasDoPedido, normalizarRepasses, dataLocal, STATUS_DO_EVENTO } from "../ifood/nucleo.mjs";

export const CAMINHOS = Object.freeze({
  polling: "/events/v1.0/events:polling",
  ack: "/events/v1.0/events/acknowledgment",
  pedido: (id) => `/order/v1.0/orders/${encodeURIComponent(id)}`,
});
const ACK_LOTE = 1000; // a documentação cita 2.000 e 10.000 por chamada; fica abaixo dos dois
const MAX_TENTATIVAS = 8;
const DETALHE_404_TOLERANCIA_MS = 10 * 60_000; // doc: o PLACED pode chegar antes dos detalhes

// ─── Cliente do iFood (pedidos) ──────────────────────────────────────────────

export function clientePedidos(fetchFn = fetch, base = IFOOD_API) {
  const auth = clienteIfood(fetchFn, base);
  const tokens = new Map(); // chave → { token, expiraEm }
  const erroHttp = (res, oQue) => {
    const e = new Error(res.status === 401 ? "Token recusado pelo iFood." : res.status === 403 ? `Sem permissão no iFood para ${oQue}.` : res.status === 429 ? "O iFood pediu para esperar (limite de chamadas)." : `O iFood respondeu ${res.status} ao ${oQue}.`);
    e.http = res.status;
    return e;
  };
  return {
    async token({ chave, clientId, clientSecret }) {
      const t = tokens.get(chave);
      if (t && t.expiraEm - Date.now() > 5 * 60_000) return t.token;
      const novo = await auth.autenticar(clientId, clientSecret);
      tokens.set(chave, novo);
      return novo.token;
    },
    esquecerToken(chave) { tokens.delete(chave); },
    async eventos(token, merchantIds = []) {
      const res = await fetchFn(`${base}${CAMINHOS.polling}`, {
        headers: { Authorization: `Bearer ${token}`, ...(merchantIds.length ? { "x-polling-merchants": merchantIds.join(",") } : {}) },
      });
      if (res.status === 204) return [];
      if (!res.ok) throw erroHttp(res, "buscar eventos");
      const d = await res.json();
      return Array.isArray(d) ? d : Array.isArray(d?.events) ? d.events : [];
    },
    async ack(token, ids = []) {
      for (let i = 0; i < ids.length; i += ACK_LOTE) {
        const lote = ids.slice(i, i + ACK_LOTE);
        const res = await fetchFn(`${base}${CAMINHOS.ack}`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(lote.map((id) => ({ id }))),
        });
        if (!res.ok) throw erroHttp(res, "confirmar o recebimento dos eventos");
      }
      return ids.length;
    },
    async pedido(token, id) {
      const res = await fetchFn(`${base}${CAMINHOS.pedido(id)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) return null;
      if (!res.ok) throw erroHttp(res, "ler o pedido");
      return res.json();
    },
  };
}

// ─── Credenciais da unidade ──────────────────────────────────────────────────

export async function credenciaisDaUnidade(db, unidadeId, decifrar) {
  const [c, s] = await Promise.all([
    db.from("integration_connections").select("unidade_id, status, external_merchant_id, config_json").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle(),
    db.from("integration_secrets").select("credentials_payload").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle(),
  ]);
  if (c.error || s.error) return { erro: "Não foi possível ler a conexão do iFood." };
  const conn = c.data;
  if (!conn || conn.status !== "CONNECTED") return { erro: "O iFood desta unidade não está conectado (teste a conexão em Configurações)." };
  let clientSecret = null;
  try { clientSecret = s.data?.credentials_payload?.isEncrypted ? decifrar(s.data.credentials_payload)?.clientSecret : null; } catch { clientSecret = null; }
  if (!clientSecret || !conn.config_json?.clientId) return { erro: "Credencial do iFood indisponível: cadastre de novo em Configurações." };
  return { unidadeId, merchantId: String(conn.external_merchant_id || "").toLowerCase(), clientId: conn.config_json.clientId, clientSecret, config: conn.config_json || {} };
}

// ─── 1–2. Receber e guardar ──────────────────────────────────────────────────

const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 32);

/**
 * Guarda os eventos (idempotente). Evento de outra loja não entra na unidade.
 * Devolve os ids do iFood que podem receber ACK (guardados agora ou antes).
 */
export async function receberEventos(db, { unidadeId, merchantId, eventos = [], agora = new Date().toISOString() } = {}) {
  const linhas = []; const ackIds = [];
  for (const bruto of eventos) {
    const ev = normalizarEvento(bruto);
    if (!ev.valido) {
      // sem id: guarda para auditoria com chave determinística (não há o que confirmar)
      linhas.push({ unidade_id: unidadeId, provider: PROVEDOR, provider_event_id: `QUARENTENA:${hash(bruto)}`, event_type: String(ev.codigo || "INVALIDO"), payload: bruto ?? {}, status: "QUARANTINED_INVALID_EVENT", last_error: ev.motivo, received_at: agora });
      continue;
    }
    const daLoja = !merchantId || !ev.merchantId || ev.merchantId.toLowerCase() === merchantId;
    linhas.push({
      unidade_id: daLoja ? unidadeId : null, provider: PROVEDOR, provider_event_id: ev.id, event_type: ev.codigo,
      payload: bruto, order_id: ev.orderId || null, merchant_id: ev.merchantId || null, evento_em: ev.criadoEm,
      status: !daLoja ? "IGNORADO" : ev.orderId ? "RECEBIDO" : "IGNORADO",
      last_error: !daLoja ? "Evento de uma loja que não está cadastrada nesta unidade." : ev.orderId ? null : "Evento sem pedido.",
      received_at: agora, attempts: 0,
    });
    ackIds.push(ev.id);
  }
  if (!linhas.length) return { guardados: 0, ackIds: [] };
  const { error } = await db.from("integration_events").upsert(linhas, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
  if (error) return { guardados: 0, ackIds: [], erro: "Não foi possível guardar os eventos: o ACK não será enviado (o iFood manda de novo)." };
  return { guardados: linhas.length, ackIds };
}

// ─── 4. Processar a fila ─────────────────────────────────────────────────────

export function proximaTentativa(tentativas, agora) {
  const min = Math.min(60, 2 ** Math.max(0, tentativas - 1)); // 1, 2, 4, … até 60 min
  return new Date(Date.parse(agora) + min * 60_000).toISOString();
}

async function contexto(db, unidadeId) {
  const [map, cfg] = await Promise.all([
    db.from("delivery_itens_mapeamento").select("codigo_externo, ficha_id, quantidade_por_item, ignorar").eq("unidade_id", unidadeId).eq("canal", "ifood"),
    db.from("marmitaria_configuracoes").select("canais").eq("unidade_id", unidadeId).maybeSingle(),
  ]);
  const mapeamento = new Map((map.data || []).map((m) => [m.codigo_externo, m]));
  const canal = (Array.isArray(cfg.data?.canais) ? cfg.data.canais : []).find((c) => c?.id === "ifood") || null;
  return { mapeamento, canal };
}

/**
 * Processa os eventos pendentes da unidade, pedido a pedido.
 *   ifood: { token(), pedido(token, id) } — sem credencial, pedidos sem
 *          detalhes ficam aguardando (o status ainda é gravado).
 */
export async function processarFila(db, { unidadeId, ifood = null, credenciais = null, agora = new Date().toISOString(), limite = 50 } = {}) {
  const r = { pedidos: 0, eventos: 0, tentarDepois: 0, falhas: 0, avisos: [] };
  const { data: fila, error } = await db.from("integration_events")
    .select("id, provider_event_id, event_type, order_id, evento_em, attempts, payload")
    .eq("unidade_id", unidadeId).eq("provider", PROVEDOR).in("status", ["RECEBIDO", "ERRO_PROCESSAMENTO"])
    .or(`proxima_tentativa_em.is.null,proxima_tentativa_em.lte.${agora}`)
    .order("evento_em", { ascending: true }).limit(limite);
  if (error) return { ...r, erro: "Não foi possível ler a fila de eventos." };
  if (!fila?.length) return r;

  const ctx = await contexto(db, unidadeId);
  const porPedido = new Map();
  for (const e of fila) { const l = porPedido.get(e.order_id) || []; l.push(e); porPedido.set(e.order_id, l); }
  let token = null;

  for (const [orderId, doLote] of porPedido) {
    try {
      // todos os eventos já conhecidos do pedido (não só os pendentes)
      const { data: todos, error: e1 } = await db.from("integration_events").select("payload")
        .eq("unidade_id", unidadeId).eq("provider", PROVEDOR).eq("order_id", orderId)
        .in("status", ["RECEBIDO", "ERRO_PROCESSAMENTO", "PROCESSADO", "FALHA"]);
      if (e1) throw new Error("Falha ao ler os eventos do pedido.");
      const situacao = situacaoDoPedido((todos || []).map((t) => normalizarEvento(t.payload)).filter((e) => e.valido));

      const { data: atual } = await db.from("delivery_pedidos").select("detalhes_carregados").eq("unidade_id", unidadeId).eq("canal", "ifood").eq("pedido_externo_id", orderId).maybeSingle();
      const precisaDetalhe = !atual?.detalhes_carregados || doLote.some((e) => e.event_type === "OPA");
      let pedido = null; let avisos = []; let semDetalhe = null;
      if (precisaDetalhe) {
        if (!ifood || !credenciais) semDetalhe = "Sem conexão ativa com o iFood para ler os detalhes do pedido.";
        else {
          token = token || await ifood.token({ chave: unidadeId, clientId: credenciais.clientId, clientSecret: credenciais.clientSecret });
          const det = await ifood.pedido(token, orderId);
          if (det) ({ pedido, avisos } = normalizarPedido(det, { unidadeId }));
          else semDetalhe = "O iFood ainda não liberou os detalhes do pedido.";
        }
      }
      const primeiro = doLote.reduce((m, e) => (e.evento_em && (!m || e.evento_em < m) ? e.evento_em : m), null);
      const base = pedido || {
        unidade_id: unidadeId, canal: "ifood", pedido_externo_id: orderId, detalhes_carregados: false,
        merchant_id: credenciais?.merchantId || null,
        criado_no_canal_em: primeiro, data_operacao: dataLocal(primeiro || agora),
      };
      const linha = {
        ...base, status: situacao.status, status_canal: situacao.statusCanal,
        confirmado: situacao.confirmado, preparo_iniciado: situacao.preparoIniciado,
        cancelado_em: situacao.cancelamento?.em || null, cancelamento: situacao.cancelamento, disputa: situacao.disputa,
      };
      // vendas só com detalhes (novos ou já gravados); sem detalhes, o status é gravado e as vendas não são tocadas
      let vendas = null;
      if (pedido) {
        const v = vendasDoPedido({ pedido: linha, situacao, mapeamento: ctx.mapeamento, canal: ctx.canal });
        vendas = v.vendas; avisos = [...avisos, ...v.avisos];
      } else if (atual?.detalhes_carregados) {
        const { data: completo } = await db.from("delivery_pedidos").select("*").eq("unidade_id", unidadeId).eq("canal", "ifood").eq("pedido_externo_id", orderId).maybeSingle();
        if (completo) {
          const v = vendasDoPedido({ pedido: { ...completo, status: situacao.status }, situacao, mapeamento: ctx.mapeamento, canal: ctx.canal });
          vendas = v.vendas; avisos = [...avisos, ...v.avisos];
        }
      }
      const { error: e2 } = await db.rpc("delivery_gravar_pedido", { p_pedido: linha, p_vendas: vendas });
      if (e2) throw new Error(`Falha ao gravar o pedido: ${e2.message}`);

      if (semDetalhe) {
        // status gravado; detalhes ainda faltam → tenta de novo depois
        const recente = primeiro && Date.parse(agora) - Date.parse(primeiro) < DETALHE_404_TOLERANCIA_MS;
        await marcarErro(db, doLote, semDetalhe, agora, { semContar: recente });
        r.tentarDepois += doLote.length;
      } else {
        await db.from("integration_events").update({ status: "PROCESSADO", processed_at: agora, last_error: avisos.length ? avisos.join(" ").slice(0, 500) : null, proxima_tentativa_em: null })
          .in("id", doLote.map((e) => e.id));
        r.eventos += doLote.length; r.pedidos++;
        r.avisos.push(...avisos);
      }
    } catch (e) {
      if (e?.http === 401 && ifood) ifood.esquecerToken?.(unidadeId);
      const falhou = await marcarErro(db, doLote, mensagemSegura(e), agora);
      r.falhas += falhou; r.tentarDepois += doLote.length - falhou;
    }
  }
  r.avisos = [...new Set(r.avisos)];
  return r;
}

async function marcarErro(db, eventos, mensagem, agora, { semContar = false } = {}) {
  let falhas = 0;
  for (const e of eventos) {
    const tentativas = (e.attempts || 0) + (semContar ? 0 : 1);
    const esgotou = tentativas >= MAX_TENTATIVAS;
    if (esgotou) falhas++;
    await db.from("integration_events").update({
      status: esgotou ? "FALHA" : "ERRO_PROCESSAMENTO", attempts: tentativas, last_error: String(mensagem).slice(0, 500),
      proxima_tentativa_em: esgotou ? null : proximaTentativa(Math.max(1, tentativas), agora),
    }).eq("id", e.id);
  }
  return falhas;
}

// Mensagem de erro sem dado sensível (token, segredo, corpo de resposta)
export function mensagemSegura(e) {
  const m = String(e?.message || "Erro inesperado.");
  return m.replace(/Bearer\s+[\w.-]+/gi, "Bearer ***").replace(/(secret|token|senha)[^\s,;]*[=:]\s*\S+/gi, "$1=***").slice(0, 300);
}

// ─── Sincronizar uma unidade (polling + ACK + fila) ──────────────────────────

export async function sincronizarUnidade(db, { unidadeId, decifrar, ifood, agora = new Date().toISOString() } = {}) {
  const cred = await credenciaisDaUnidade(db, unidadeId, decifrar);
  if (cred.erro) return { ok: false, erro: cred.erro };
  const out = { ok: true, recebidos: 0, ack: 0 };
  try {
    const token = await ifood.token({ chave: unidadeId, clientId: cred.clientId, clientSecret: cred.clientSecret });
    const eventos = await ifood.eventos(token, cred.merchantId ? [cred.merchantId] : []);
    const g = await receberEventos(db, { unidadeId, merchantId: cred.merchantId, eventos, agora });
    if (g.erro) out.avisos = [g.erro];
    out.recebidos = eventos.length;
    if (g.ackIds.length) {
      out.ack = await ifood.ack(token, g.ackIds);
      await db.from("integration_events").update({ ack_em: agora }).eq("provider", PROVEDOR).in("provider_event_id", g.ackIds);
    }
  } catch (e) {
    if (e?.http === 401) ifood.esquecerToken?.(unidadeId);
    out.ok = false; out.erro = mensagemSegura(e);
  }
  const fila = await processarFila(db, { unidadeId, ifood, credenciais: cred, agora });
  await db.from("integration_connections").update({ last_sync_at: agora, last_error: out.erro || fila.erro || null, updated_at: agora })
    .eq("unidade_id", unidadeId).eq("provider", PROVEDOR);
  return { ...out, fila };
}

/** Todas as unidades conectadas (rota do agendador). Uma unidade com erro não para as outras. */
export async function sincronizarTodas(db, { decifrar, ifood, agora = new Date().toISOString() } = {}) {
  const { data, error } = await db.from("integration_connections").select("unidade_id").eq("provider", PROVEDOR).eq("status", "CONNECTED");
  if (error) return { ok: false, erro: "Não foi possível listar as conexões." };
  const unidades = [];
  for (const c of data || []) {
    const r = await sincronizarUnidade(db, { unidadeId: c.unidade_id, decifrar, ifood, agora });
    unidades.push({ unidadeId: c.unidade_id, ok: r.ok, recebidos: r.recebidos || 0, processados: r.fila?.eventos || 0, falhas: r.fila?.falhas || 0, erro: r.erro || null });
  }
  return { ok: true, unidades };
}

// ─── Reprocessar ─────────────────────────────────────────────────────────────

/** Devolve à fila os eventos com falha da unidade. Seguro: gravar o mesmo pedido de novo é idempotente. */
export async function reprocessar(db, { unidadeId, eventoIds = null } = {}) {
  let q = db.from("integration_events").update({ status: "RECEBIDO", attempts: 0, proxima_tentativa_em: null, last_error: null })
    .eq("unidade_id", unidadeId).eq("provider", PROVEDOR).in("status", ["FALHA", "ERRO_PROCESSAMENTO"]);
  if (Array.isArray(eventoIds) && eventoIds.length) q = q.in("id", eventoIds);
  const { error } = await q;
  return error ? { ok: false, erro: "Não foi possível reprocessar." } : { ok: true };
}

// ─── Resumo para a tela ──────────────────────────────────────────────────────

export async function resumoSincronizacao(db, unidadeId) {
  const [conn, evs] = await Promise.all([
    db.from("integration_connections").select("status, last_sync_at, last_error, config_json").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle(),
    db.from("integration_events").select("id, event_type, order_id, status, attempts, last_error, evento_em, received_at, processed_at")
      .eq("unidade_id", unidadeId).eq("provider", PROVEDOR).order("received_at", { ascending: false }).limit(100),
  ]);
  if (conn.error || evs.error) return { ok: false, erro: "Não foi possível ler a sincronização." };
  const lista = evs.data || [];
  const conta = (s) => lista.filter((e) => e.status === s).length;
  return {
    ok: true,
    conectado: conn.data?.status === "CONNECTED",
    ultimaSincronizacao: conn.data?.last_sync_at || null,
    ultimoErro: conn.data?.last_error || null,
    baixaEstoque: conn.data?.config_json?.baixaEstoque === "pedido" ? "pedido" : "producao",
    contagem: { pendentes: conta("RECEBIDO"), tentando: conta("ERRO_PROCESSAMENTO"), falhas: conta("FALHA"), processados: conta("PROCESSADO") },
    historico: lista.slice(0, 50).map((e) => ({
      id: e.id, codigo: e.event_type, status: e.status, tentativas: e.attempts || 0, erro: e.last_error || null,
      pedido: e.order_id ? `${String(e.order_id).slice(0, 8)}…` : null, em: e.evento_em || e.received_at,
      descricao: STATUS_DO_EVENTO[e.event_type] || e.event_type,
    })),
  };
}

/** Preferência da unidade: baixa de estoque na produção (padrão) ou por pedido. */
export async function salvarPreferencias(db, unidadeId, { baixaEstoque } = {}) {
  if (!["producao", "pedido"].includes(baixaEstoque)) return { ok: false, erro: "Opção de baixa inválida." };
  const { data, error } = await db.from("integration_connections").select("config_json").eq("unidade_id", unidadeId).eq("provider", PROVEDOR).maybeSingle();
  if (error) return { ok: false, erro: "Não foi possível ler a conexão." };
  if (!data) return { ok: false, erro: "Cadastre o iFood antes de escolher a baixa de estoque." };
  const { error: e2 } = await db.from("integration_connections").update({ config_json: { ...(data.config_json || {}), baixaEstoque } })
    .eq("unidade_id", unidadeId).eq("provider", PROVEDOR);
  return e2 ? { ok: false, erro: "Não foi possível salvar." } : { ok: true };
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

/**
 * Webhook do iFood: valida a assinatura sobre o CORPO CRU antes de ler o JSON.
 * A assinatura é HMAC-SHA256 em hexadecimal com o Client Secret do aplicativo
 * (A CONFIRMAR NA HOMOLOGAÇÃO: a página de assinatura da documentação não
 * estava acessível em 14/10/2026). Cada unidade conectada tem o próprio
 * aplicativo; a unidade é a dona do segredo que confere — nunca o corpo.
 * Só guarda (resposta rápida, < 2 s); o processamento é feito pela fila.
 */
export async function receberWebhook(db, { corpoBruto, assinatura, decifrar, agora = new Date().toISOString() } = {}) {
  if (!assinatura) return { status: 401, corpo: { ok: false, erro: "assinatura ausente" } };
  const { data: conns, error } = await db.from("integration_connections").select("unidade_id, external_merchant_id").eq("provider", PROVEDOR).eq("status", "CONNECTED");
  if (error) return { status: 503, corpo: { ok: false, erro: "indisponível" } };
  let dono = null;
  for (const c of conns || []) {
    const { data: s } = await db.from("integration_secrets").select("credentials_payload").eq("unidade_id", c.unidade_id).eq("provider", PROVEDOR).maybeSingle();
    let segredo = null;
    try { segredo = s?.credentials_payload?.isEncrypted ? decifrar(s.credentials_payload)?.clientSecret : null; } catch { segredo = null; }
    if (segredo && verificarHmac({ segredo, corpoBruto, assinatura })) { dono = c; break; }
  }
  if (!dono) return { status: 401, corpo: { ok: false, erro: "assinatura inválida" } };
  let corpo;
  try { corpo = JSON.parse(corpoBruto); } catch { return { status: 400, corpo: { ok: false, erro: "JSON inválido" } }; }
  const eventos = Array.isArray(corpo) ? corpo : [corpo];
  const g = await receberEventos(db, { unidadeId: dono.unidade_id, merchantId: String(dono.external_merchant_id || "").toLowerCase(), eventos, agora });
  if (g.erro) return { status: 503, corpo: { ok: false, erro: "não guardado" } }; // o iFood reenvia
  return { status: 202, corpo: { ok: true, recebidos: eventos.length } };
}

// ─── Repasses (preparado; sem chamada de rede até a homologação) ─────────────

/**
 * Grava os repasses REAIS de uma resposta da API financeira do iFood.
 * Idempotente (único por unidade + referência). Não é chamado por nenhuma rota
 * nem pelo agendador até o caminho da API ser confirmado na homologação.
 */
export async function importarRepasses(db, { unidadeId, resposta } = {}) {
  const { repasses, ignorados } = normalizarRepasses(resposta, { unidadeId });
  if (!repasses.length) return { ok: true, gravados: 0, ignorados };
  const { error } = await db.from("delivery_repasses").upsert(repasses, { onConflict: "unidade_id,canal,referencia_externa" });
  return error ? { ok: false, erro: "Não foi possível gravar os repasses." } : { ok: true, gravados: repasses.length, ignorados };
}
