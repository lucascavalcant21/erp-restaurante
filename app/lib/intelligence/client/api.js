// Cliente das rotas /api/intelligence/* (navegador).
//
// Manda só: o token da sessão (Authorization), a unidade ESCOLHIDA na tela
// (x-hefisto-unidade — o servidor confere no banco se o usuário pode) e o
// pedido. Empresa, permissões e usuário quem decide é o servidor.

import { supabase, isSupabaseReady } from "../../supabase";

async function token() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export function novaChaveDeEnvio() {
  try { return `env-${crypto.randomUUID()}`; } catch { return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

async function chamar(caminho, { unidadeId, metodo = "POST", corpo = null, sinal } = {}) {
  const t = await token();
  if (!t) return { ok: false, status: 401, dados: { erro: "Sessão expirada. Entre novamente.", codigo: "SEM_SESSAO" } };
  if (!unidadeId || unidadeId === "todas") return { ok: false, status: 400, dados: { erro: "Selecione uma unidade para usar a inteligência.", codigo: "UNIDADE_NAO_SELECIONADA" } };
  try {
    const r = await fetch(caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${t}`, "x-hefisto-unidade": unidadeId, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: sinal,
      cache: "no-store",
    });
    const dados = await r.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
    return { ok: r.ok, status: r.status, dados };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, status: 0, dados: { erro: "Cancelado." }, cancelado: true };
    return { ok: false, status: 0, dados: { erro: "Sem conexão com o servidor. Verifique a internet." } };
  }
}

export const buscarResumoDoDia = (unidadeId, sinal) => chamar("/api/intelligence/brief", { unidadeId, metodo: "GET", sinal });
export const perguntarAoHefisto = (unidadeId, pedido) => chamar("/api/intelligence/ask", { unidadeId, corpo: pedido });
export const confirmarAcao = (unidadeId, acaoId, confirmacaoTexto = null) => chamar("/api/intelligence/actions/confirm", { unidadeId, corpo: { acaoId, confirmacaoTexto } });
export const cancelarAcao = (unidadeId, acaoId) => chamar("/api/intelligence/actions/cancel", { unidadeId, corpo: { acaoId } });
export const responderInsight = (unidadeId, f) => chamar("/api/intelligence/feedback", { unidadeId, corpo: f });
export const buscarHistorico = (unidadeId) => chamar("/api/intelligence/history", { unidadeId, metodo: "GET" });
