// ═══════════════════════════════════════════════════════════════
// config-supabase.mjs — de onde vem a configuração do Supabase
//
// REGRA: nenhuma variável obrigatória tem valor de reserva. Se faltar, o app
// para e diz o que faltou. Antes, `process.env.X || "<projeto de produção>"`
// fazia qualquer build sem variável conversar com o banco real do restaurante
// — inclusive um preview de staging.
//
// Este arquivo é público (vai para o navegador): só trata URL e chave anônima,
// que são publicáveis por natureza. Service role mora em
// config-supabase-server.js, que não pode ser importado pelo client.
// ═══════════════════════════════════════════════════════════════

// Identificador PÚBLICO do projeto de produção (o mesmo que aparece na URL).
// Está aqui para RECUSAR conexão, nunca para montar uma: é a trava que impede
// um ambiente de staging de abrir o banco de produção por engano. Não é
// segredo — segredo nenhum entra neste arquivo.
export const REF_PRODUCAO = "sezccspqxgklicfndwxx";

export const AMBIENTES = ["development", "staging", "production"];

/** Extrai o project ref de uma URL do Supabase (https://<ref>.supabase.co). */
export function projectRefDaUrl(url) {
  const texto = String(url || "").trim();
  if (!texto) return "";
  const m = texto.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|red)/i);
  if (m) return m[1].toLowerCase();
  // Supabase local/self-hosted (http://127.0.0.1:54321) não tem ref.
  return "";
}

/** O ambiente declarado. HEFISTO_ENV manda; sem ele, deduz do Vercel; sem
 *  nada, development. Preview do Vercel conta como staging de propósito: é
 *  exatamente onde não se pode encostar em produção. */
export function ambienteHefisto(env = process.env) {
  const declarado = String(env.HEFISTO_ENV || env.NEXT_PUBLIC_HEFISTO_ENV || "").trim().toLowerCase();
  if (AMBIENTES.includes(declarado)) return declarado;
  const vercel = String(env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "staging";
  return "development";
}

/** Valida um par (ambiente, url, chave). Devolve { ok, erro }.
 *  Função pura: é ela que os testes exercitam. */
export function validarConfigSupabase({ ambiente, url, chave, rotuloChave = "NEXT_PUBLIC_SUPABASE_ANON_KEY", refProducao = REF_PRODUCAO } = {}) {
  const amb = AMBIENTES.includes(ambiente) ? ambiente : null;
  if (!amb) {
    return { ok: false, erro: `HEFISTO_ENV inválido ("${ambiente}"). Use development, staging ou production.` };
  }
  const endereco = String(url || "").trim();
  if (!endereco) {
    return { ok: false, erro: "NEXT_PUBLIC_SUPABASE_URL não está configurada. Configure a URL do projeto deste ambiente — não existe valor de reserva." };
  }
  if (!/^https?:\/\//i.test(endereco)) {
    return { ok: false, erro: "NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL completa (https://...)." };
  }
  if (!String(chave || "").trim()) {
    return { ok: false, erro: `${rotuloChave} não está configurada. Não existe valor de reserva: configure a chave deste ambiente.` };
  }
  const ref = projectRefDaUrl(endereco);
  if (amb !== "production" && ref && ref === refProducao) {
    return {
      ok: false,
      erro: `Ambiente "${amb}" apontando para o projeto de PRODUÇÃO (${ref}). Configure o Supabase deste ambiente ou declare HEFISTO_ENV=production.`,
    };
  }
  return { ok: true, erro: "", ambiente: amb, projectRef: ref };
}

/** Configuração pública (client e server). Lança se faltar qualquer peça. */
export function getSupabasePublicConfig(env = process.env) {
  const ambiente = ambienteHefisto(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = validarConfigSupabase({ ambiente, url, chave });
  if (!r.ok) throw new Error(`[config-supabase] ${r.erro}`);
  return { url: String(url).trim(), anonKey: String(chave).trim(), ambiente, projectRef: r.projectRef };
}
