// Respostas do BANCO para as regras de concessão (concessao.mjs), via cliente
// de service_role da rota /api/admin/access-control (S-31).
//
// Unidades de um cadastro: unidade principal, escopos de unidade e de setor, e
// escopo "empresa"/"todos" SÓ da empresa do escopo (ou da empresa da unidade
// principal) — a mesma regra de hefisto_unidades_do_usuario, mas SEM filtrar
// status: um usuário inativo de outra empresa continua sendo de outra empresa.
// Cadastro sem unidade nenhuma só o administrador geral gerencia.

export function criarDepsConcessao(db) {
  const cacheUnidades = new Map();

  async function empresaDaUnidade(unidadeId) {
    if (!unidadeId) return null;
    const { data } = await db.from("unidades").select("empresa_id").eq("id", unidadeId).maybeSingle();
    return data?.empresa_id || null;
  }

  async function unidadesDaEmpresa(empresaId) {
    if (!empresaId) return [];
    const { data, error } = await db.from("unidades").select("id").eq("empresa_id", empresaId);
    if (error) throw error;
    return (data || []).map((u) => String(u.id));
  }

  // Unidades que um escopo cobre; `principal` resolve o escopo amplo sem empresa_id.
  async function unidadesDoEscopo(e, principal) {
    const escopo = e?.data_scope || "setor";
    if (escopo === "empresa" || escopo === "todos") {
      return unidadesDaEmpresa(e.empresa_id || (await empresaDaUnidade(principal)));
    }
    if (e?.unidade_id) return [String(e.unidade_id)];
    if (e?.setor_id) {
      const { data } = await db.from("setores").select("unidade_id").eq("id", e.setor_id).maybeSingle();
      return data?.unidade_id ? [String(data.unidade_id)] : [];
    }
    if (e?.empresa_id) return unidadesDaEmpresa(e.empresa_id);
    return [];
  }

  async function cadastro(filtro) {
    const [col, valor] = filtro;
    const { data, error } = await db.from("usuarios_erp")
      .select("id, auth_user_id, super_admin, unidade_principal_id").eq(col, valor).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function unidadesDoCadastro(u) {
    if (!u) return [];
    if (cacheUnidades.has(u.id)) return cacheUnidades.get(u.id);
    const { data: escopos, error } = await db.from("usuario_escopos")
      .select("data_scope, unidade_id, empresa_id, setor_id").eq("usuario_id", u.id);
    if (error) throw error;
    const todas = new Set(u.unidade_principal_id ? [String(u.unidade_principal_id)] : []);
    for (const e of escopos || []) for (const id of await unidadesDoEscopo(e, u.unidade_principal_id)) todas.add(id);
    const lista = [...todas];
    cacheUnidades.set(u.id, lista);
    return lista;
  }

  const contem = (de, para) => para.every((id) => de.includes(id));

  return {
    async unidadesDoAtor(atorAuthId) {
      const ator = await cadastro(["auth_user_id", atorAuthId]);
      if (ator?.super_admin) return ["*"];
      return unidadesDoCadastro(ator);
    },

    async chavesNaoConcediveis(atorAuthId, chaves) {
      const negadas = [];
      for (const chave of chaves) {
        const { data, error } = await db.rpc("hefisto_user_has_permission", { p_auth_user_id: atorAuthId, p_permission: chave });
        if (error || data !== true) negadas.push(chave);
      }
      return negadas;
    },

    async escoposNaoConcediveis(atorAuthId, escopos) {
      const ator = await cadastro(["auth_user_id", atorAuthId]);
      if (ator?.super_admin) return [];
      const doAtor = await unidadesDoCadastro(ator);
      const negados = [];
      for (const e of escopos) {
        const cobre = await unidadesDoEscopo(e, ator?.unidade_principal_id);
        // escopo que não aponta para unidade nenhuma conhecida não é concedível
        if (!cobre.length || !contem(doAtor, cobre)) negados.push(e);
      }
      return negados;
    },

    async podeGerenciarUsuario(atorAuthId, usuarioId) {
      const [ator, alvo] = await Promise.all([cadastro(["auth_user_id", atorAuthId]), cadastro(["id", usuarioId])]);
      if (!ator || !alvo) return false;
      if (ator.super_admin) return alvo.auth_user_id !== atorAuthId;
      if (alvo.auth_user_id === atorAuthId || alvo.super_admin) return false;
      const doAlvo = await unidadesDoCadastro(alvo);
      if (!doAlvo.length) return false;
      return contem(await unidadesDoCadastro(ator), doAlvo);
    },

    async chavesDoPerfil(perfilId) {
      if (!perfilId) return [];
      const { data, error } = await db.from("perfil_permissoes").select("permission_key").eq("perfil_id", perfilId);
      if (error) throw error;
      return (data || []).map((p) => p.permission_key);
    },

    async perfil(perfilId) {
      const { data } = await db.from("perfis_acesso").select("id, sistema").eq("id", perfilId).maybeSingle();
      return data || null;
    },

    async usuariosDoPerfil(perfilId) {
      const { data, error } = await db.from("usuarios_erp").select("id").eq("perfil_id", perfilId);
      if (error) throw error;
      return (data || []).map((u) => u.id);
    },
  };
}
