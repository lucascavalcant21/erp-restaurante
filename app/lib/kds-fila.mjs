// FILA DO KDS (regras puras, testadas em kds-fila.test.mjs)
//
// O KDS lê pedidos_itens (status_kds): é onde caem os pedidos do salão
// (comanda do garçom), do cardápio digital (mesa pelo QR e delivery, depois de
// aceitos) e do iFood. A tela antiga lia vendas/venda_itens.status_preparo,
// coluna que não existe no banco real: a cozinha nunca via pedido nenhum.
//
// Ciclo do item: pendente → preparando → pronto (toque de novo volta a
// pendente). "Entregar" marca os itens do setor como entregue.

export const STATUS_NA_FILA = ["pendente", "preparando", "pronto"];

// Pedido nesses estados já saiu da cozinha (pago, servido, despachado ou cancelado).
const PEDIDO_FORA_DA_COZINHA = new Set(["cancelado", "recusado", "pago", "entregue", "fechado", "finalizado", "concluido", "saiu"]);

// Só pedidos online mudam de estado quando a cozinha termina: a comanda do salão
// fica "aberto" até o garçom fechar a conta.
const TIPOS_ONLINE = new Set(["delivery", "retirada", "qrcode", "ifood"]);
const ESTADOS_EM_PREPARO = new Set(["preparando_delivery", "preparando", "aberto", "pendente"]);

export function proximoStatusKDS(status) {
  if (!status || status === "pendente") return "preparando";
  if (status === "preparando") return "pronto";
  return "pendente";
}

/** Setor do produto: "bar" ou "cozinha" (sem cadastro, vai para a cozinha). */
export function setorDoProduto(departamento) {
  return /bar/i.test(String(departamento || "")) ? "bar" : "cozinha";
}

/** De onde veio o pedido, para o cabeçalho do ticket. */
export function origemDoPedido(pedido) {
  const t = pedido?.tipo_pedido;
  if (t === "qrcode") return "Mesa (QR)";
  if (t === "delivery") return "Delivery";
  if (t === "retirada") return "Retirada";
  if (t === "ifood") return "iFood";
  if (t === "balcao") return "Balcão";
  return "Salão";
}

/**
 * Agrupa as linhas de pedidos_itens (com produtos e pedidos embutidos) em
 * tickets, do mais antigo para o mais novo.
 * @param {Array} linhas
 * @param {"cozinha"|"bar"|"todos"} setor
 */
export function montarFilaKDS(linhas, setor = "cozinha") {
  const tickets = new Map();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const ped = l?.pedidos;
    if (!ped?.id || PEDIDO_FORA_DA_COZINHA.has(ped.status)) continue;
    if (!STATUS_NA_FILA.includes(l.status_kds || "pendente")) continue;
    const s = setorDoProduto(l.produtos?.departamento);
    if (setor !== "todos" && s !== setor) continue;
    if (!tickets.has(ped.id)) {
      tickets.set(ped.id, {
        id: ped.id,
        tipo_pedido: ped.tipo_pedido || null,
        status: ped.status || null,
        origem: origemDoPedido(ped),
        cliente: ped.cliente_nome || null,
        identificacao: ped.identificacao || null,
        created_at: ped.created_at || l.created_at,
        itens: [],
      });
    }
    tickets.get(ped.id).itens.push({
      id: l.id,
      nome: l.produtos?.nome_produto || "Item",
      quantidade: Number(l.quantidade) || 1,
      observacao: l.observacao || null,
      status: l.status_kds || "pendente",
      setor: s,
      created_at: l.created_at,
      updated_at: l.updated_at || null,
    });
  }
  return [...tickets.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * Depois de entregar os itens de um setor: o pedido online vira "pronto"
 * (coluna Prontos do painel de pedidos online e TV) só quando nenhum item,
 * de nenhum setor, ainda está na fila.
 */
export function pedidoFicaPronto(pedido, itensDoPedido) {
  if (!pedido || !TIPOS_ONLINE.has(pedido.tipo_pedido)) return false;
  if (!ESTADOS_EM_PREPARO.has(pedido.status)) return false;
  const itens = Array.isArray(itensDoPedido) ? itensDoPedido : [];
  return itens.length > 0 && itens.every((i) => ["pronto", "entregue", "cancelado"].includes(i.status_kds));
}

// ─── QUADRO (protótipo KDS, 9D.2) ────────────────────────────────────────────
// Três colunas: Na fila → Em preparo → Prontos. Passou do prazo da estação, o
// pedido vira PRIORIDADE (a mais antiga é a 1) e pisca; a cada 5 min de atraso
// pisca mais rápido (níveis 1 a 4).

export const PRAZO_KDS_MIN = 15;
export const ATENCAO_KDS_MIN = 10;

/** Coluna do ticket: todos pendentes = fila; todos prontos = pronto; o resto = preparo. */
export function etapaDoTicket(ticket) {
  const st = (ticket?.itens || []).map((i) => i.status || "pendente");
  if (!st.length || st.every((s) => s === "pendente")) return "fila";
  if (st.every((s) => s === "pronto")) return "pronto";
  return "preparo";
}

/** Cor do cronômetro e nível da piscada. `segundos` desde a chegada. */
export function cronometroKDS(segundos, prazoMin = PRAZO_KDS_MIN) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const min = Math.floor(s / 60);
  const texto = `${String(min).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  if (min >= prazoMin) {
    const atraso = min - prazoMin;
    return { texto, cor: "atrasado", atraso, nivel: Math.min(4, 1 + Math.floor(atraso / 5)) };
  }
  return { texto, cor: min >= ATENCAO_KDS_MIN ? "atencao" : "ok", atraso: 0, nivel: 0 };
}

/** "Mesa 12": da identificação do salão ou do "[MESA 12]" que o cardápio põe no nome. */
export function localDoTicket(ticket) {
  const doNome = /^\[MESA ([^\]]{1,10})\]\s*/i.exec(String(ticket?.cliente || ""));
  if (doNome) return `Mesa ${doNome[1]}`;
  const id = String(ticket?.identificacao || "").trim();
  if (id) return /^mesa\b/i.test(id) ? id : `Mesa ${id}`;
  if (ticket?.tipo_pedido === "delivery") return "Delivery";
  if (ticket?.tipo_pedido === "retirada") return "Retirada";
  if (ticket?.tipo_pedido === "balcao") return "Balcão";
  if (ticket?.tipo_pedido === "ifood") return "iFood";
  return "Salão";
}

/** Nome do cliente sem o "[MESA N]". */
export function clienteDoTicket(ticket) {
  return String(ticket?.cliente || "").replace(/^\[MESA [^\]]{1,10}\]\s*/i, "").trim();
}

/**
 * Observação do item em partes: complementos (cada um numa linha), VIAGEM,
 * alergia e o resto como "Obs". O cardápio grava "PARA VIAGEM · Tamanho:
 * Cuia grande · sem cebola".
 */
export function partesDoItem(observacao) {
  const partes = String(observacao || "").split(" · ").map((p) => p.trim()).filter(Boolean);
  const viagem = partes.some((p) => /^para viagem$/i.test(p));
  const alergia = partes.filter((p) => /alerg/i.test(p));
  const resto = partes.filter((p) => !/^para viagem$/i.test(p) && !/alerg/i.test(p));
  // Complemento escolhido no cardápio tem "Grupo: opção"; o resto é observação livre.
  const escolhas = resto.filter((p) => /^[^:]{1,40}:\s/.test(p));
  const obs = resto.filter((p) => !escolhas.includes(p)).join(" · ");
  // Na tela só a opção ("Cuia grande"); o que tirar fica "SEM cebola"; combo diz de qual combo veio.
  const mods = escolhas.flatMap((p) => {
    const [grupo, ...v] = p.split(":");
    const valor = v.join(":").trim();
    if (/^sem$/i.test(grupo.trim())) return valor.split(/,\s*/).map((x) => `SEM ${x.toLowerCase()}`);
    if (/^combo$/i.test(grupo.trim())) return [p];
    return valor.split(/,\s*/);
  });
  return { viagem, alergia, mods, obs };
}

/**
 * Monta as três colunas com as prioridades numeradas (mais antiga = 1, em
 * todas as colunas abertas). Na coluna: prioridades no topo, depois quem
 * chegou primeiro. Prontos: o mais recente em cima.
 */
export function quadroKDS(tickets, agoraMs = Date.now(), prazoMin = PRAZO_KDS_MIN) {
  const lista = (Array.isArray(tickets) ? tickets : []).map((t) => {
    const segundos = (agoraMs - new Date(t.created_at).getTime()) / 1000;
    const etapa = etapaDoTicket(t);
    const prontoEm = etapa === "pronto"
      ? (t.itens || []).map((i) => i.updated_at).filter(Boolean).sort().pop() || null
      : null;
    return { ...t, etapa, segundos, relogio: cronometroKDS(segundos, prazoMin), prontoEm, prioridade: null };
  });
  const atrasados = lista.filter((t) => t.etapa !== "pronto" && t.relogio.cor === "atrasado").sort((a, b) => b.segundos - a.segundos);
  atrasados.forEach((t, i) => { t.prioridade = i + 1; });
  const ordem = (a, b) => {
    if (a.prioridade && b.prioridade) return a.prioridade - b.prioridade;
    if (a.prioridade) return -1;
    if (b.prioridade) return 1;
    return b.segundos - a.segundos;
  };
  return {
    fila: lista.filter((t) => t.etapa === "fila").sort(ordem),
    preparo: lista.filter((t) => t.etapa === "preparo").sort(ordem),
    pronto: lista.filter((t) => t.etapa === "pronto").sort((a, b) => String(b.prontoEm || "").localeCompare(String(a.prontoEm || ""))),
    prioridades: atrasados.length,
  };
}

/** Tempo médio (min) dos pedidos abertos na tela; null sem pedido. */
export function tempoMedioKDS(quadro) {
  const abertos = [...(quadro?.fila || []), ...(quadro?.preparo || [])];
  if (!abertos.length) return null;
  return Math.round(abertos.reduce((s, t) => s + t.segundos, 0) / abertos.length / 60);
}
