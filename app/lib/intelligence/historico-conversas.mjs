// Histórico das conversas com o Jhon e o Nico (dono, 17/11/2026: "todas as
// conversas ficam salvas, nenhuma é apagada, tudo eu consigo ver como um
// histórico"). Lê a auditoria (intelligence_eventos), que o banco não deixa
// apagar nem alterar (gatilhos de IC-01). O dono (relatorios.audit.view) vê as
// conversas de todos; os outros, só as próprias (RLS).

export const ETAPAS_DA_CONVERSA = Object.freeze(["pedido", "acao_confirmada", "acao_cancelada", "acao_executada", "acao_falhou", "bloqueio"]);
const ROTULO_ETAPA = { acao_confirmada: "Confirmou", acao_cancelada: "Cancelou", acao_executada: "Feito", acao_falhou: "Não deu certo", bloqueio: "Bloqueado" };

const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "jhon" | "nico" | null, pelo que foi gravado na hora da conversa. */
export function assistenteDoEvento(e) {
  const a = fold(e?.resultado?.assistente?.id || e?.resultado?.assistente?.nome || e?.resultado?.assistente);
  if (a.includes("jhon") || a.includes("john")) return "jhon";
  if (a.includes("nico")) return "nico";
  return null;
}

/** Evento → item da tela (pergunta da pessoa e resposta do assistente). */
export function itemDoEvento(e, nomes = new Map()) {
  const etapa = e?.etapa;
  return {
    id: e.id,
    em: e.created_at,
    dia: String(e.created_at || "").slice(0, 10),
    pessoa: nomes.get(e.auth_user_id) || "Usuário",
    assistente: assistenteDoEvento(e),
    canal: e.canal === "voz" ? "voz" : e.canal === "whatsapp" ? "whatsapp" : "texto",
    pergunta: etapa === "pedido" ? (e.comando || null) : null,
    resposta: etapa === "pedido" ? (e.recomendacao || null) : null,
    marco: etapa !== "pedido" ? `${ROTULO_ETAPA[etapa] || etapa}${e.acao_tipo ? `: ${e.acao_tipo}` : ""}${e.erro ? ` (${e.erro})` : ""}` : null,
    intencao: e?.intencao?.intencao || null,
  };
}

/** Filtros da tela: assistente, pessoa e texto (procura na pergunta e na resposta). */
export function filtrar(itens, { assistente = "todos", pessoa = "todas", busca = "" } = {}) {
  const b = fold(busca).trim();
  return itens.filter((i) =>
    (assistente === "todos" || i.assistente === assistente)
    && (pessoa === "todas" || i.pessoa === pessoa)
    && (!b || fold(`${i.pergunta || ""} ${i.resposta || ""} ${i.marco || ""}`).includes(b)));
}

/** Agrupa por dia (mais recente primeiro), cada dia em ordem de conversa (mais antigo em cima). */
export function porDia(itens) {
  const mapa = new Map();
  for (const i of itens) { if (!mapa.has(i.dia)) mapa.set(i.dia, []); mapa.get(i.dia).push(i); }
  return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([dia, lista]) => ({ dia, itens: [...lista].sort((a, b) => (a.em < b.em ? -1 : 1)) }));
}

export function rotuloDoDia(dia, hoje = new Date().toISOString().slice(0, 10)) {
  if (dia === hoje) return "Hoje";
  const ontem = new Date(`${hoje}T12:00:00Z`); ontem.setUTCDate(ontem.getUTCDate() - 1);
  if (dia === ontem.toISOString().slice(0, 10)) return "Ontem";
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}
