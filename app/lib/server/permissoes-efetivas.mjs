import { combina } from "./autorizacao.mjs";

// PERMISSÕES EFETIVAS DE UM USUÁRIO — lidas no banco pelo servidor.
//
// Mesma regra de hefisto_session_context (db/proposta_hefisto_session_context.sql):
//   super_admin              → tudo
//   perfil vinculado inativo → usuário sem contexto: nada
//   perfil ativo             → chaves de perfil_permissoes
//   usuario_permissoes allow → somam
//   usuario_permissoes deny  → vencem qualquer concessão
//
// Nada aqui lê user_metadata: é campo que o próprio usuário escreve.
// Qualquer falha de leitura NEGA (lista vazia) — nunca libera por omissão.

/**
 * @param {object} db       cliente service_role
 * @param {{ id: string, super_admin?: boolean }} usuario  linha de usuarios_erp
 * @returns {Promise<{ superAdmin: boolean, concedidas: string[], negadas: string[] }>}
 */
export async function carregarPermissoes(db, usuario) {
  const vazio = { superAdmin: false, concedidas: [], negadas: [] };
  if (!usuario?.id) return vazio;
  if (usuario.super_admin === true) return { superAdmin: true, concedidas: ["*"], negadas: [] };

  try {
    const { data: cadastro, error: e1 } = await db
      .from("usuarios_erp").select("perfil_id").eq("id", usuario.id).maybeSingle();
    if (e1) return vazio;

    const concedidas = [];
    const negadas = [];

    if (cadastro?.perfil_id) {
      const { data: perfil, error: e2 } = await db
        .from("perfis_acesso").select("id, ativo").eq("id", cadastro.perfil_id).maybeSingle();
      if (e2) return vazio;
      // Igual ao banco: perfil vinculado e inativo tira o contexto inteiro,
      // inclusive as concessões diretas ao usuário.
      if (perfil?.ativo !== true) return vazio;
      const { data: doPerfil, error: e3 } = await db
        .from("perfil_permissoes").select("permission_key").eq("perfil_id", perfil.id);
      if (e3) return vazio;
      for (const r of doPerfil || []) if (r?.permission_key) concedidas.push(String(r.permission_key));
    }

    const { data: doUsuario, error: e4 } = await db
      .from("usuario_permissoes").select("permission_key, effect").eq("usuario_id", usuario.id);
    if (e4) return vazio;
    for (const r of doUsuario || []) {
      if (!r?.permission_key) continue;
      if (r.effect === "deny") negadas.push(String(r.permission_key));
      else if (r.effect === "allow") concedidas.push(String(r.permission_key));
    }

    return { superAdmin: false, concedidas, negadas };
  } catch {
    return vazio;
  }
}

/** Basta uma das chaves; negação explícita de qualquer uma delas vence. */
export function permite(perms, chaves) {
  if (!perms) return false;
  if (perms.superAdmin) return true;
  const lista = Array.isArray(chaves) ? chaves : [chaves];
  return lista.some((chave) =>
    !perms.negadas.some((n) => combina(n, chave)) &&
    perms.concedidas.some((c) => combina(c, chave)));
}
