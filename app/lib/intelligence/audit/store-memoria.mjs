// Store em memória (testes e desenvolvimento sem banco). Mesmo contrato do
// store do Supabase: toda leitura e escrita filtra por unidade e usuário.

export function criarStoreMemoria({ falharAuditoria = false } = {}) {
  const eventos = [];
  const acoes = new Map();
  const feedback = [];
  const preferencias = new Map();
  let seq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

  return {
    eventos, acoes, feedback,
    async registrarEvento(ev) {
      if (falharAuditoria) throw new Error("auditoria fora do ar");
      eventos.push({ id: uuid(), ...ev });
    },
    async listarEventos({ unidadeId, authUserId, limite = 20 }) {
      return eventos.filter((e) => e.unidade_id === unidadeId && e.auth_user_id === authUserId && e.etapa === "pedido")
        .slice(-limite).reverse();
    },
    async criarAcao(a) {
      for (const x of acoes.values()) {
        if (x.auth_user_id === a.auth_user_id && x.chave_idempotencia === a.chave_idempotencia) return { ...x, repetida: true };
      }
      const linha = { id: uuid(), ...a };
      acoes.set(linha.id, linha);
      return { ...linha, repetida: false };
    },
    async buscarAcao({ id, unidadeId, authUserId }) {
      const a = acoes.get(id);
      return a && a.unidade_id === unidadeId && a.auth_user_id === authUserId ? { ...a } : null;
    },
    async transicionarAcao({ id, unidadeId, authUserId, de, para, campos = {}, agora = new Date() }) {
      const a = acoes.get(id);
      if (!a || a.unidade_id !== unidadeId || a.auth_user_id !== authUserId || !de.includes(a.status)) return null;
      if (para === "executando" && Date.parse(a.expira_em) <= agora.getTime()) return null;
      Object.assign(a, campos, { status: para, updated_at: agora.toISOString() });
      return { ...a };
    },
    async registrarFeedback(linha) { feedback.push({ id: uuid(), ...linha }); },
    async listarFeedback({ unidadeId, desde }) {
      return feedback.filter((f) => f.unidade_id === unidadeId && (!desde || f.created_at >= desde));
    },
    async lerPreferencias(unidadeId) { return preferencias.get(unidadeId) || null; },
    definirPreferencias(unidadeId, p) { preferencias.set(unidadeId, p); },
  };
}
