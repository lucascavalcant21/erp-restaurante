// Ligações de SERVIDOR do Intelligence Core com o Supabase (server-only).
//
// Leitura e ações usam o cliente DO USUÁRIO (anon key + token dele): o banco
// aplica RLS e as funções (estoque_movimentar, hefisto_user_can…) enxergam o
// auth.uid() verdadeiro. A service role fica restrita à auditoria e às ações
// pendentes da própria inteligência (tabelas que o usuário não escreve).

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "../../config/supabase-public.mjs";

if (typeof window !== "undefined") {
  throw new Error("SERVER_ONLY_MODULE: intelligence/context/servidor.mjs é de uso exclusivo do servidor.");
}

const SEM_SESSAO = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function clienteAnonimo() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createClient(url, anonKey, { auth: SEM_SESSAO });
}

/** Cliente que fala com o banco COMO o usuário do token. */
export function clienteDoUsuario(token) {
  if (!token) throw new Error("Sem token do usuário.");
  const { url, anonKey } = getSupabasePublicConfig();
  return createClient(url, anonKey, {
    auth: SEM_SESSAO,
    global: { headers: { Authorization: `Bearer ${token}`, "x-hefisto-canal": "agente" } },
  });
}

/** Dependências de resolverContexto/authorizeAction ligadas ao Supabase real. */
export function depsDoContexto() {
  return {
    async validarToken(token) {
      const { data, error } = await clienteAnonimo().auth.getUser(token);
      if (error) return null;
      return data?.user?.id ? { id: data.user.id } : null;
    },
    async contextoDoBanco(token, unidadeId) {
      const { data, error } = await clienteDoUsuario(token).rpc("hefisto_contexto_requisicao", { p_unidade_id: unidadeId });
      if (error) throw new Error("contexto indisponível");
      return data;
    },
    async podeFazer(token, permissao, unidadeId) {
      const { data, error } = await clienteDoUsuario(token).rpc("hefisto_user_can", { p_permission: permissao, p_unidade_id: unidadeId });
      if (error) throw new Error("permissão indisponível");
      return data === true;
    },
  };
}
