// CONTEXTO DA REQUISIÇÃO quando o banco ainda NÃO tem a Fase 1B
// (hefisto_contexto_requisicao). Encontrado no Supabase real em 08/10/2026:
// a 1A/1B de segurança não foi aplicada e o banco só tem as funções de acesso
// de docs/controle-acesso-rbac.sql.
//
// Não é uma segunda lógica de permissão: monta o MESMO formato que
// hefisto_contexto_requisicao devolve, só com as funções que já existem e que
// o ERP inteiro usa hoje:
//   hefisto_session_context()   quem é, perfil, permissões, escopos
//   hefisto_user_in_unit(uid,u) a unidade pedida está no escopo?
//   unidades.empresa_id         empresa da unidade (do banco, nunca do cliente)
// E a decisão de cada ação continua em hefisto_user_can (authorizeAction →
// podeFazer), que também confere status, bloqueio, vigência, dia e horário.
// Quando a 1B for aplicada, o caminho principal assume sozinho.

const FONTE = "hefisto_session_context+hefisto_user_in_unit (Fase 1B não aplicada)";

/** O erro do PostgREST/Postgres diz que a função não existe? */
export function funcaoAusente(error) {
  const t = `${error?.code || ""} ${error?.message || ""}`;
  return /PGRST202|42883|could not find the function|does not exist/i.test(t);
}

/**
 * @param {object} cliente  supabase-js com o token do usuário (rpc/from)
 * @param {string} uid      auth user id JÁ validado pelo Auth (validarToken)
 * @param {string|null} unidadeId  unidade pedida no cabeçalho (não confiável)
 */
export async function contextoLegado(cliente, uid, unidadeId) {
  const { data: s, error } = await cliente.rpc("hefisto_session_context");
  if (error) throw new Error("contexto indisponível");
  if (!s) return { autenticado: true, cadastrado: false, valido: false, fonte: FONTE };

  const superAdmin = s.super_admin === true;
  const escopos = Array.isArray(s.scopes) ? s.scopes : [];
  // mesma regra de hefisto_user_in_unit em produção: escopo "todos"/"empresa" vale todas as unidades
  const todas = superAdmin || escopos.some((e) => e?.data_scope === "todos" || e?.data_scope === "empresa");
  const unidades = todas ? ["*"] : [...new Set([s.unidade, ...escopos.map((e) => e?.unidade_id)].filter(Boolean).map(String))];

  let unidade = null;
  let permitida = true;
  let empresa = null;
  if (unidadeId) {
    const [noEscopo, linha] = await Promise.all([
      cliente.rpc("hefisto_user_in_unit", { p_auth_user_id: uid, p_unidade_id: unidadeId }),
      cliente.from("unidades").select("id, empresa_id").eq("id", unidadeId).maybeSingle(),
    ]);
    if (noEscopo.error || linha.error) throw new Error("contexto indisponível");
    permitida = noEscopo.data === true && !!linha.data;
    unidade = permitida ? unidadeId : null;
    empresa = permitida ? linha.data.empresa_id ?? null : null;
  }

  const permissoes = s.permissions === "*" ? ["*"] : Array.isArray(s.permissions) ? s.permissions.map(String) : [];
  return {
    autenticado: true,
    cadastrado: true,
    // status do cadastro; bloqueio/vigência/horário são conferidos por hefisto_user_can em cada autorização
    valido: s.status === "ativo",
    auth_user_id: uid,
    usuario_erp_id: s.erp_user_id || null,
    super_admin: superAdmin,
    tipo_acesso: s.tipo_acesso || null,
    perfil_id: s.perfil_id || null,
    perfil_codigo: null,
    unidade_solicitada: unidadeId || null,
    unidade_id: unidade,
    unidade_permitida: !unidadeId || permitida,
    unidade_principal_id: s.unidade || null,
    empresa_id: empresa,
    unidades,
    permissoes,
    // negações: o banco aplica em hefisto_user_can (o "sim" é sempre do banco)
    negacoes: [],
    fonte: FONTE,
  };
}
