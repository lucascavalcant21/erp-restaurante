// ═══════════════════════════════════════════════════════════════
// sessao.mjs — por que uma sessão foi recusada, sem tocar no token
//
// Separado da rota para poder ser testado. Nada aqui registra, devolve ou
// guarda o token: o máximo que se lê dele é o campo `iss`, que diz de qual
// projeto Supabase ele veio — e isso é identificador público.
//
// A ordem importa. Falta de variável no servidor é problema de AMBIENTE (503),
// não de login (401). Era esse o engano do preview: o servidor sem
// NEXT_PUBLIC_SUPABASE_URL respondia "Sessão ausente" e parecia que o usuário
// não estava logado.
// ═══════════════════════════════════════════════════════════════

const texto = (v) => String(v ?? "").trim();

/** <ref> de https://<ref>.supabase.co. Vazio para local/self-hosted. */
export function refDaUrl(url) {
  const m = texto(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return m ? m[1].toLowerCase() : "";
}

/** De qual projeto veio o token, lendo só o `iss`. Não valida assinatura —
 *  quem valida é o Supabase. Token que não é JWT devolve string vazia. */
export function refDoToken(token) {
  const partes = texto(token).split(".");
  if (partes.length !== 3) return "";
  try {
    const bruto = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(bruto, "base64").toString("utf8"));
    return refDaUrl(payload?.iss || "") || texto(payload?.ref).toLowerCase();
  } catch {
    return "";
  }
}

export function configuracaoDoAmbiente(env = process.env) {
  const url = texto(env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = texto(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const faltando = [
    url ? null : "NEXT_PUBLIC_SUPABASE_URL",
    anon ? null : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  return { url, anon, faltando, projectRef: refDaUrl(url) };
}

/**
 * Decide se dá para sequer tentar validar a sessão.
 * Devolve { ok } ou { ok:false, status, corpo } com o diagnóstico.
 */
export function diagnosticoDeSessao({ config, token }) {
  if (config.faltando.length) {
    return {
      ok: false,
      status: 503,
      corpo: {
        error: "Ambiente sem configuração do Supabase.",
        diagnostico: "config_ausente",
        faltando: config.faltando,
      },
    };
  }
  if (!texto(token)) {
    return { ok: false, status: 401, corpo: { error: "Sessão ausente.", diagnostico: "sessao_ausente" } };
  }
  const refToken = refDoToken(token);
  if (refToken && config.projectRef && refToken !== config.projectRef) {
    return {
      ok: false,
      status: 401,
      corpo: {
        error: "Sua sessão é de outro projeto Supabase.",
        diagnostico: "projeto_incompativel",
        projeto_do_servidor: config.projectRef,
        projeto_do_token: refToken,
      },
    };
  }
  return { ok: true, projectRefDoToken: refToken };
}
