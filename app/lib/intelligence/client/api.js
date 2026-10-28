// Cliente das rotas /api/intelligence/* (navegador).
//
// Manda só: o token da sessão (Authorization), a unidade ESCOLHIDA na tela
// (x-hefisto-unidade — o servidor confere no banco se o usuário pode) e o
// pedido. Empresa, permissões e usuário quem decide é o servidor.

import { supabase, isSupabaseReady } from "../../supabase";

const TIMEOUT_PADRAO_MS = 25000;

async function token() {
  if (!isSupabaseReady()) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export function novaChaveDeEnvio() {
  try { return `env-${crypto.randomUUID()}`; } catch { return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

async function chamar(caminho, { unidadeId, metodo = "POST", corpo = null, sinal, timeoutMs = TIMEOUT_PADRAO_MS } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      status: 0,
      dados: {
        erro: "Você está sem conexão com a internet. Verifique sua rede e tente novamente.",
        codigo: "SEM_REDE",
      },
    };
  }

  const t = await token();
  if (!t) return { ok: false, status: 401, dados: { erro: "Sessão expirada. Entre novamente.", codigo: "SEM_SESSAO" } };
  if (!unidadeId || unidadeId === "todas") return { ok: false, status: 400, dados: { erro: "Selecione uma unidade para usar a inteligência.", codigo: "UNIDADE_NAO_SELECIONADA" } };

  const controladorInterno = new AbortController();
  let expirouPorTimeout = false;
  const timer = setTimeout(() => {
    expirouPorTimeout = true;
    controladorInterno.abort();
  }, timeoutMs);

  const abortarExterno = () => controladorInterno.abort();
  if (sinal) {
    if (sinal.aborted) {
      clearTimeout(timer);
      return { ok: false, status: 0, dados: { erro: "Cancelado." }, cancelado: true };
    }
    sinal.addEventListener("abort", abortarExterno, { once: true });
  }

  try {
    const r = await fetch(caminho, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${t}`,
        "x-hefisto-unidade": unidadeId,
        ...(corpo ? { "Content-Type": "application/json" } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controladorInterno.signal,
      cache: "no-store",
    });
    const dados = await r.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
    return { ok: r.ok, status: r.status, dados };
  } catch (e) {
    if (e?.name === "AbortError") {
      if (expirouPorTimeout) {
        return {
          ok: false,
          status: 408,
          dados: {
            erro: "O servidor demorou muito para responder. Verifique sua conexão e tente novamente.",
            codigo: "TIMEOUT",
          },
        };
      }
      return { ok: false, status: 0, dados: { erro: "Cancelado." }, cancelado: true };
    }
    return {
      ok: false,
      status: 0,
      dados: {
        erro: "Sem conexão com o servidor. Verifique a internet e tente novamente.",
        codigo: "FALHA_REDE",
      },
    };
  } finally {
    clearTimeout(timer);
    if (sinal) sinal.removeEventListener("abort", abortarExterno);
  }
}

export const buscarResumoDoDia = (unidadeId, sinal) => chamar("/api/intelligence/brief", { unidadeId, metodo: "GET", sinal });
export const perguntarAoHefisto = (unidadeId, pedido, sinal) => chamar("/api/intelligence/ask", { unidadeId, corpo: pedido, sinal });
export const confirmarAcao = (unidadeId, acaoId, confirmacaoTexto = null) => chamar("/api/intelligence/actions/confirm", { unidadeId, corpo: { acaoId, confirmacaoTexto } });
export const cancelarAcao = (unidadeId, acaoId) => chamar("/api/intelligence/actions/cancel", { unidadeId, corpo: { acaoId } });
export const responderInsight = (unidadeId, f) => chamar("/api/intelligence/feedback", { unidadeId, corpo: f });
export const buscarHistorico = (unidadeId, sinal) => chamar("/api/intelligence/history", { unidadeId, metodo: "GET", sinal });
export const buscarPreferencias = (unidadeId, sinal) => chamar("/api/intelligence/preferences", { unidadeId, metodo: "GET", sinal });
export const salvarPreferencias = (unidadeId, prefs) => chamar("/api/intelligence/preferences", { unidadeId, metodo: "PUT", corpo: prefs });
