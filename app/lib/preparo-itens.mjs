// PREPARO NA COMANDA DO GARÇOM (pedido do dono, 07/11/2026)
//
// Cada item lançado mostra quanto falta para ficar pronto: contagem regressiva
// a partir do lançamento, com o tempo de preparo do produto (cadastro do
// produto, "Tempo de preparo"). Quando a cozinha ou o bar marca o item como
// pronto no Painel de produção, a tela do garçom avisa: "Mesa 4: 2× Tacacá
// pronto". Funções puras, testadas em preparo-itens.test.mjs.

export const TEMPO_PADRAO_MIN = 15;

/** Minutos de preparo do item (do produto); sem cadastro, o padrão. */
export function tempoDoItem(item) {
  const t = Math.round(Number(item?.produtos?.tempo_preparo_base));
  return t > 0 && t <= 600 ? t : TEMPO_PADRAO_MIN;
}

const ms = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Situação do item para o garçom.
 * fila/preparando: restanteSeg (negativo = atrasado); pronto: prontoHaMin;
 * servido e cancelado não contam mais.
 */
export function situacaoDoItem(item, agora = Date.now()) {
  const st = item?.status_kds || "pendente";
  if (st === "cancelado") return { estado: "cancelado" };
  if (st === "entregue") return { estado: "servido" };
  if (st === "pronto") return { estado: "pronto", prontoHaMin: Math.max(0, Math.floor((agora - ms(item.updated_at || item.created_at)) / 60000)) };
  const tempoMin = tempoDoItem(item);
  const restanteSeg = Math.ceil((ms(item.created_at) + tempoMin * 60000 - agora) / 1000);
  return { estado: st === "preparando" || st === "em_preparo" ? "preparando" : "fila", tempoMin, restanteSeg, atrasado: restanteSeg <= 0 };
}

/** 2530 s → "42:10"; 4000 s → "1h06"; sempre do valor absoluto. */
export function relogio(seg) {
  const s = Math.abs(Math.round(Number(seg) || 0));
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Itens prontos esperando o garçom levar, numa comanda. */
export function prontosDaComanda(pedido) {
  return (pedido?.pedidos_itens || []).filter((i) => i.status_kds === "pronto").length;
}

/** O pedido é deste garçom? Comanda aberta pelo caixa (sem garçom) avisa a todos. */
const doGarcom = (pedido, garcom) => !garcom || !pedido?.garcom_nome || pedido.garcom_nome === garcom;

/**
 * Itens que ficaram prontos desde a última leitura.
 * vistos: ids já avisados (ou já prontos quando a tela abriu); primeiraLeitura
 * marca tudo como visto sem avisar, para não tocar alerta ao abrir a tela.
 * Devolve { alertas: [{ itemId, mesaId, mesa, quantidade, nome }], vistos }.
 */
export function prontosNovos({ vistos = new Set(), pedidos = [], mesas = [], garcom = "", primeiraLeitura = false } = {}) {
  const novos = new Set(vistos);
  const alertas = [];
  const nomeDaMesa = new Map((mesas || []).map((m) => [m.id, String(m.numero_mesa || m.numero || "").trim()]));
  for (const p of pedidos || []) {
    for (const i of p.pedidos_itens || []) {
      // "entregue" também avisa: a cozinha pode tocar direto em "Entregar pedido"
      // no Painel de produção. Se foi o próprio garçom que serviu, o item já
      // estava visto quando ficou pronto e não repete.
      if (!["pronto", "entregue"].includes(i.status_kds) || novos.has(i.id)) continue;
      novos.add(i.id);
      if (primeiraLeitura || !doGarcom(p, garcom)) continue;
      const n = nomeDaMesa.get(p.mesa_id) || "";
      alertas.push({ itemId: i.id, mesaId: p.mesa_id, mesa: !n ? "Mesa" : /^mesa\b/i.test(n) ? n : `Mesa ${n}`, quantidade: Number(i.quantidade) || 1, nome: i.produtos?.nome_produto || "Item" });
    }
  }
  return { alertas, vistos: novos };
}

/** Minutos digitados na tela de tempo de preparo: inteiro de 1 a 240, ou null. */
export function minutosValidos(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const m = Math.round(n);
  return m >= 1 && m <= 240 ? m : null;
}

/** O que mudou na tela de tempo de preparo: [{ id, tempo }] só dos válidos e diferentes. */
export function alteracoesDeTempo(produtos = [], editados = {}) {
  const out = [];
  for (const p of produtos || []) {
    if (!(p.id in editados)) continue;
    const m = minutosValidos(editados[p.id]);
    if (m !== null && m !== Number(p.tempo_preparo_base)) out.push({ id: p.id, tempo: m });
  }
  return out;
}
