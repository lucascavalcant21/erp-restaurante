// ═══════════════════════════════════════════════════════════════
// cliente.js — como a tela fala com o Héfisto com IA
//
// Só monta a requisição: manda a pergunta, o contexto da tela e o token da
// sessão. Papel, permissões e unidade quem decide é o servidor — o que vai
// daqui é contexto, não autorização.
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "../supabase";

export const HEFISTO_IA_INDISPONIVEL = "Héfisto está temporariamente indisponível.";

export async function perguntarAoHefisto({ mensagem, pageContext = {}, unidadeAtiva = null }) {
  if (!isSupabaseReady()) return { ok: false, tipo: "INDISPONIVEL", texto: HEFISTO_IA_INDISPONIVEL };

  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    token = null;
  }
  if (!token) return { ok: false, tipo: "INDISPONIVEL", texto: HEFISTO_IA_INDISPONIVEL };

  const unidadeId = typeof unidadeAtiva === "string" ? unidadeAtiva : unidadeAtiva?.id || "";

  try {
    const resposta = await fetch("/api/hefisto/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        mensagem,
        contexto: {
          unidadeId,
          unidadeNome: unidadeAtiva?.nome || null,
          rota: pageContext.route || null,
          modulo: pageContext.module || pageContext.domain || null,
          entidade: pageContext.entityName || null,
          setor: pageContext.setor || null,
        },
      }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      return { ok: false, tipo: dados.tipo || "INDISPONIVEL", texto: dados.texto || dados.error || HEFISTO_IA_INDISPONIVEL };
    }
    return dados;
  } catch {
    return { ok: false, tipo: "INDISPONIVEL", texto: HEFISTO_IA_INDISPONIVEL };
  }
}
