// Regra de CONCESSÃO da administração de acessos (/api/admin/access-control).
//
// Ter a permissão "configurar usuários" autoriza ENTRAR na tela; não autoriza
// dar a alguém — ou a si mesmo — mais do que se tem. Antes da 1B, quem podia
// salvar permissões de usuário salvava "*" no próprio usuário.
//
// Para quem não é administrador geral:
//   1. só gerencia usuário cujas unidades cabem no próprio escopo, nunca a si
//      mesmo e nunca um administrador geral;
//   2. só concede chaves (diretas ou via perfil) que ele mesmo tem;
//   3. só concede escopo (unidade, empresa, "todos") que ele mesmo tem;
//   4. só altera ou desativa perfil que não seja do sistema e cujos usuários
//      ele gerencia (editar o próprio perfil seria se promover);
//   5. migração de acessos legados é só do administrador geral.
//
// As perguntas "tem esta chave?", "gerencia este usuário?" e "cabe no escopo?"
// são respondidas pelo BANCO (funções da migração 1B-01), recebidas em deps.

import { CODIGOS, recusa } from "./codigos.mjs";

const negar = (mensagem, detalhe = {}) => recusa(403, CODIGOS.CONCESSAO_NEGADA, mensagem, { detalhe });
const unicos = (lista) => [...new Set((lista || []).filter(Boolean).map(String))];

function escoposPedidos(corpo) {
  const escopos = Array.isArray(corpo?.scopes) ? corpo.scopes.map((e) => ({
    data_scope: e?.data_scope || "setor",
    unidade_id: e?.unidade_id || null,
    empresa_id: e?.empresa_id || null,
  })) : [];
  const principal = corpo?.user?.unidade_principal_id;
  if (principal) escopos.push({ data_scope: "unidade", unidade_id: principal, empresa_id: null });
  return escopos;
}

async function exigirGerenciavel(deps, ator, usuarioId) {
  if (!usuarioId) return negar("Usuário alvo não informado.");
  if (!(await deps.podeGerenciarUsuario(ator, usuarioId))) {
    return negar("Você não pode alterar este usuário (fora do seu escopo, administrador geral ou você mesmo).");
  }
  return null;
}

async function exigirChaves(deps, ator, chaves) {
  const pedidas = unicos(chaves);
  if (!pedidas.length) return null;
  const negadas = await deps.chavesNaoConcediveis(ator, pedidas);
  return negadas.length ? negar("Você não pode conceder permissões que não tem.", { chaves: negadas }) : null;
}

async function exigirEscopos(deps, ator, escopos) {
  if (!escopos.length) return null;
  const negados = await deps.escoposNaoConcediveis(ator, escopos);
  return negados.length ? negar("Você não pode conceder acesso a unidades ou empresas fora do seu escopo.", { escopos: negados }) : null;
}

async function exigirPerfilAlteravel(deps, ator, perfilId) {
  const perfil = await deps.perfil(perfilId);
  if (!perfil) return negar("Perfil não encontrado.");
  if (perfil.sistema) return negar("Perfis do sistema só são alterados pelo administrador geral.");
  for (const usuarioId of await deps.usuariosDoPerfil(perfilId)) {
    if (!(await deps.podeGerenciarUsuario(ator, usuarioId))) {
      return negar("Este perfil está em uso por usuários fora do seu escopo (ou por você).");
    }
  }
  return null;
}

/**
 * @param {object} p
 * @param {string} p.acao     body.action da rota
 * @param {string} p.ator     auth user id de quem pede
 * @param {boolean} p.atorSuper
 * @param {object} p.corpo    body da requisição (perfil já resolvido em corpo.user.perfil_id)
 * @param {object} p.deps
 * @returns {Promise<null|{ok:false,status:number,codigo:string,mensagem:string,detalhe:object}>}
 */
export async function verificarConcessao({ acao, ator, atorSuper, corpo, deps }) {
  if (atorSuper) return null;
  const c = corpo || {};

  switch (acao) {
    case "migrate-legacy":
      return negar("A migração de acessos legados é exclusiva do administrador geral.");

    case "create-user": {
      if (c.user?.super_admin) return negar("Só o administrador geral cria outro administrador geral.");
      const escopos = escoposPedidos(c);
      if (!escopos.some((e) => e.unidade_id || e.empresa_id || e.data_scope === "todos")) {
        return negar("Informe a unidade do novo usuário.");
      }
      const perfilChaves = c.user?.perfil_id ? await deps.chavesDoPerfil(c.user.perfil_id) : [];
      return (await exigirEscopos(deps, ator, escopos))
        || (await exigirChaves(deps, ator, [...perfilChaves, ...(c.allowPermissions || [])]));
    }

    case "update-user": {
      if (c.user?.super_admin) return negar("Só o administrador geral promove a administrador geral.");
      const alvo = await exigirGerenciavel(deps, ator, c.id);
      if (alvo) return alvo;
      const perfilChaves = c.user?.perfil_id ? await deps.chavesDoPerfil(c.user.perfil_id) : [];
      return (await exigirEscopos(deps, ator, escoposPedidos(c))) || (await exigirChaves(deps, ator, perfilChaves));
    }

    case "save-user-permissions":
      return (await exigirGerenciavel(deps, ator, c.id)) || (await exigirChaves(deps, ator, c.allowPermissions));

    case "set-user-status":
    case "reset-password":
    case "delete-user":
      return exigirGerenciavel(deps, ator, c.id);

    case "save-profile": {
      const chaves = await exigirChaves(deps, ator, c.permissions);
      if (chaves) return chaves;
      // Nova versão só para novos usuários não mexe em quem já usa o perfil.
      if (c.profile?.id && c.applyMode !== "new_only") return exigirPerfilAlteravel(deps, ator, c.profile.id);
      return null;
    }

    case "duplicate-profile":
      return exigirChaves(deps, ator, await deps.chavesDoPerfil(c.id));

    case "set-profile-status":
    case "delete-profile":
      return exigirPerfilAlteravel(deps, ator, c.id);

    case "apply-profile": {
      const chaves = await exigirChaves(deps, ator, await deps.chavesDoPerfil(c.profileId));
      if (chaves) return chaves;
      for (const id of unicos(c.userIds)) {
        const alvo = await exigirGerenciavel(deps, ator, id);
        if (alvo) return alvo;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Listagem da tela de acessos para quem não é administrador geral: só os
 * usuários que ele gerencia (e ele mesmo), e os registros ligados a eles.
 */
export async function filtrarListagem({ ator, atorSuper, atorUsuarioId, dados, unidadesDoAtor, deps }) {
  if (atorSuper) return dados;
  const visiveis = new Set([atorUsuarioId].filter(Boolean));
  for (const u of dados.users || []) {
    if (u.id !== atorUsuarioId && await deps.podeGerenciarUsuario(ator, u.id)) visiveis.add(u.id);
  }
  const authVisiveis = new Set((dados.users || []).filter((u) => visiveis.has(u.id)).map((u) => u.auth_user_id).filter(Boolean));
  const todas = unidadesDoAtor.includes("*");
  const naUnidade = (id) => todas || unidadesDoAtor.includes(id);
  return {
    ...dados,
    users: (dados.users || []).filter((u) => visiveis.has(u.id)),
    userPermissions: (dados.userPermissions || []).filter((p) => visiveis.has(p.usuario_id)),
    scopes: (dados.scopes || []).filter((e) => visiveis.has(e.usuario_id)),
    units: (dados.units || []).filter((u) => naUnidade(u.id)),
    sectors: (dados.sectors || []).filter((s) => !s.unidade_id || naUnidade(s.unidade_id)),
    employees: (dados.employees || []).filter((e) => naUnidade(e.unidade_id)),
    accessLogs: (dados.accessLogs || []).filter((l) => visiveis.has(l.usuario_id) || authVisiveis.has(l.auth_user_id)),
    legacyCount: 0,
  };
}
