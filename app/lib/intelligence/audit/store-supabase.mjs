// Store do Intelligence Core no Supabase (server-only, service role).
//
// Tabelas da migração db/intelligence/IC_01_INTELLIGENCE_CORE.sql:
//   intelligence_eventos       auditoria imutável (só insert)
//   intelligence_acoes         ações propostas/confirmadas/executadas
//   intelligence_feedback      respostas aos insights (aprendizado)
//   intelligence_preferencias  limiares por unidade
// O usuário do app não escreve nessas tabelas; o servidor escreve com a
// service role e TODA consulta aqui filtra por unidade (e usuário, quando é
// dado pessoal) — a service role ignora RLS, então o filtro é obrigatório.
//
// Sem a migração aplicada ou sem a service role: leituras devolvem vazio e
// escritas LANÇAM — ações ficam bloqueadas (auditoria é obrigatória).

import { getSupabaseServerClient } from "../../server/supabase-server.mjs";

const ausente = (e) => /does not exist|não existe|schema cache|could not find|PGRST205|42P01/i.test(String(e?.message || e?.code || ""));

// codigo = AUDITORIA_INDISPONIVEL: a casca HTTP responde 503 com a mensagem.
class ErroDeStore extends Error {
  constructor(m) { super(`Ações indisponíveis: auditoria da inteligência não está configurada (${m}).`); this.name = "ErroDeStore"; this.codigo = "AUDITORIA_INDISPONIVEL"; }
}

export function criarStoreSupabase(db = null) {
  let cliente = db;
  const banco = () => {
    if (!cliente) cliente = getSupabaseServerClient();
    return cliente;
  };
  const falhar = (op, e) => { throw new ErroDeStore(`${op}: ${ausente(e) ? "tabela da inteligência ausente (migração IC_01 não aplicada)" : "falha de gravação"}`); };

  return {
    async registrarEvento(ev) {
      const { error } = await banco().from("intelligence_eventos").insert(ev);
      if (error) falhar("auditoria", error);
    },
    async listarEventos({ unidadeId, authUserId, limite = 20 }) {
      const { data, error } = await banco().from("intelligence_eventos")
        .select("id, correlation_id, etapa, comando, intencao, resultado, created_at")
        .eq("unidade_id", unidadeId).eq("auth_user_id", authUserId).eq("etapa", "pedido")
        .order("created_at", { ascending: false }).limit(Math.min(50, limite));
      if (error) return [];
      return data || [];
    },
    async criarAcao(a) {
      const { data, error } = await banco().from("intelligence_acoes").insert(a).select("*").single();
      if (!error) return { ...data, repetida: false };
      if (error.code === "23505") {
        const { data: ja } = await banco().from("intelligence_acoes").select("*")
          .eq("auth_user_id", a.auth_user_id).eq("unidade_id", a.unidade_id).eq("chave_idempotencia", a.chave_idempotencia).maybeSingle();
        if (ja) return { ...ja, repetida: true };
      }
      falhar("ação", error);
    },
    async buscarAcao({ id, unidadeId, authUserId }) {
      const { data, error } = await banco().from("intelligence_acoes").select("*")
        .eq("id", id).eq("unidade_id", unidadeId).eq("auth_user_id", authUserId).maybeSingle();
      if (error) return null;
      return data || null;
    },
    async transicionarAcao({ id, unidadeId, authUserId, de, para, campos = {}, agora = new Date() }) {
      let q = banco().from("intelligence_acoes").update({ ...campos, status: para, updated_at: agora.toISOString() })
        .eq("id", id).eq("unidade_id", unidadeId).eq("auth_user_id", authUserId).in("status", de);
      if (para === "executando") q = q.gt("expira_em", agora.toISOString());
      const { data, error } = await q.select("*").maybeSingle();
      if (error) falhar("transição de ação", error);
      return data || null;
    },
    async registrarFeedback(linha) {
      const { error } = await banco().from("intelligence_feedback").insert(linha);
      if (error) falhar("feedback", error);
    },
    async listarFeedback({ unidadeId, desde }) {
      let q = banco().from("intelligence_feedback").select("insight_id, insight_tipo, resposta, opcao_id, created_at").eq("unidade_id", unidadeId);
      if (desde) q = q.gte("created_at", desde);
      const { data, error } = await q.limit(2000);
      if (error) return [];
      return data || [];
    },
    async lerPreferencias(unidadeId) {
      const { data, error } = await banco().from("intelligence_preferencias")
        .select("limiares, alertas, sensibilidade, meta_faturamento_mensal, meta_faturamento_semanal, meta_faturamento_diaria, updated_at")
        .eq("unidade_id", unidadeId).maybeSingle();
      if (error) return null;
      return data || null;
    },
    // Configuração da unidade: só pelo servidor, depois de authorizeAction(dashboard.intelligence.settings).
    async salvarPreferencias(linha) {
      const { data, error } = await banco().from("intelligence_preferencias").upsert(linha, { onConflict: "unidade_id" })
        .select("limiares, alertas, sensibilidade, meta_faturamento_mensal, meta_faturamento_semanal, meta_faturamento_diaria, updated_at")
        .eq("unidade_id", linha.unidade_id).maybeSingle();
      if (error) falhar("preferências", error);
      return data || null;
    },
    async nomeDoUsuario(authUserId) {
      const { data } = await banco().from("usuarios_erp").select("nome").eq("auth_user_id", authUserId).maybeSingle();
      return data?.nome || "";
    },
  };
}

/** Store usado quando o servidor não tem service role: lê vazio, recusa escrita. */
export const storeIndisponivel = Object.freeze({
  async registrarEvento() { throw new ErroDeStore("auditoria: servidor sem SUPABASE_SERVICE_ROLE_KEY"); },
  async listarEventos() { return []; },
  async criarAcao() { throw new ErroDeStore("ação: servidor sem SUPABASE_SERVICE_ROLE_KEY"); },
  async buscarAcao() { return null; },
  async transicionarAcao() { throw new ErroDeStore("ação: servidor sem SUPABASE_SERVICE_ROLE_KEY"); },
  async registrarFeedback() { throw new ErroDeStore("feedback: servidor sem SUPABASE_SERVICE_ROLE_KEY"); },
  async salvarPreferencias() { throw new ErroDeStore("preferências: servidor sem SUPABASE_SERVICE_ROLE_KEY"); },
  async listarFeedback() { return []; },
  async lerPreferencias() { return null; },
  async nomeDoUsuario() { return ""; },
});
