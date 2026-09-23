// ═══════════════════════════════════════════════════════════════
// config-supabase-server.js — configuração PRIVILEGIADA (service role)
//
// Só pode ser importado por código de servidor (route handlers, server
// actions). O ideal seria `import "server-only"`, mas esse pacote não está nas
// dependências do projeto; até alguém aprovar essa linha no package.json, a
// trava abaixo faz o mesmo serviço: se este módulo cair num bundle de
// navegador, ele estoura na hora em vez de vazar a chave.
//
// A service role NUNCA aparece em log, em resposta de API ou em mensagem de
// erro — daqui saem só a URL e a chave para quem já está no servidor.
// ═══════════════════════════════════════════════════════════════

import { ambienteHefisto, validarConfigSupabase } from "./config-supabase.mjs";

if (typeof window !== "undefined") {
  throw new Error(
    "[config-supabase-server] Este módulo é do servidor e foi importado no navegador. " +
    "Nenhuma chave privilegiada pode ir para o client: mova a chamada para um route handler."
  );
}

/** Configuração com service role. Lança se faltar qualquer peça — não existe
 *  valor de reserva e não há queda silenciosa para a chave anônima. */
export function getSupabaseServerConfig(env = process.env) {
  const ambiente = ambienteHefisto(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = validarConfigSupabase({ ambiente, url, chave: service, rotuloChave: "SUPABASE_SERVICE_ROLE_KEY" });
  if (!r.ok) throw new Error(`[config-supabase-server] ${r.erro}`);
  return { url: String(url).trim(), serviceRoleKey: String(service).trim(), ambiente, projectRef: r.projectRef };
}

/** Versão que não lança: para rotas que preferem responder 503 com uma
 *  mensagem de configuração em vez de quebrar. Devolve { config, erro }. */
export function tentarSupabaseServerConfig(env = process.env) {
  try {
    return { config: getSupabaseServerConfig(env), erro: "" };
  } catch (e) {
    return { config: null, erro: String(e?.message || e) };
  }
}
