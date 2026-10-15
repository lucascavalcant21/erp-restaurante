// Histórico de alterações de acesso (tabela permissoes_auditoria): transforma
// o "antes/depois" gravado pela rota /api/admin/access-control em linhas
// legíveis. Puro (sem banco), para a tela de usuários e para os testes.

const ROTULOS = {
  nome: "Nome", email: "E-mail", telefone: "Telefone", login: "Login", cargo: "Cargo",
  status: "Status", perfil_id: "Perfil", super_admin: "Administrador geral",
  unidade_principal_id: "Unidade principal", setor_principal_id: "Setor principal",
  tipo_acesso: "Tipo de acesso", pagina_inicial: "Página inicial",
  allowed_days: "Dias permitidos", allowed_start_time: "Início do horário", allowed_end_time: "Fim do horário",
  valid_from: "Acesso a partir de", valid_until: "Acesso até", locked_until: "Bloqueado até",
  allowed_device_ids: "Dispositivos permitidos", allowed_ips: "IPs permitidos", acesso_externo: "Acesso externo",
  max_failed_attempts: "Tentativas antes de bloquear", exigir_troca_senha: "Exigir troca de senha",
  encerrar_sessoes_anteriores: "Encerrar sessões anteriores", ativo: "Ativo", descricao: "Descrição",
};
// Campos que mudam sozinhos ou não dizem nada a quem lê o histórico.
const IGNORAR = new Set(["id", "auth_user_id", "created_at", "updated_at", "ultimo_acesso", "ultimo_acesso_em",
  "failed_attempts", "senha_alterada_em", "criado_por", "avatar_url"]);

const EVENTOS = {
  criado: "Criado", atualizado: "Alterado", excluido: "Excluído", duplicado: "Duplicado",
  ativado: "Ativado", desativado: "Desativado", permissoes_atualizadas: "Permissões individuais alteradas",
  senha_redefinida: "Senha redefinida", aplicado_a_usuarios: "Perfil aplicado a usuários",
  status_ativo: "Ativado", status_inativo: "Desativado", status_bloqueado: "Bloqueado",
};

export const rotuloEvento = (evento) => EVENTOS[evento] || String(evento || "").replaceAll("_", " ");

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function valorLegivel(campo, v, nomes) {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (campo === "perfil_id") return nomes.perfis.get(v) || "perfil removido";
  if (campo === "allowed_days" && Array.isArray(v)) {
    const D = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    return v.length === 7 ? "todos" : v.map((d) => D[d] ?? d).join(", ");
  }
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Chaves de permissão de uma lista de linhas {permission_key, effect}.
function chaves(linhas) {
  const out = new Map();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    if (l && l.permission_key) out.set(`${l.effect || "allow"}:${l.permission_key}`, l);
  }
  return out;
}

/**
 * @param log  linha de permissoes_auditoria
 * @param ctx  { users: [{auth_user_id, nome}], profiles: [{id, nome}] }
 * @returns { id, quando, evento, ator, mudancas: [{campo, antes, depois}] }
 */
export function resumirAlteracao(log, ctx = {}) {
  const nomes = {
    perfis: new Map((ctx.profiles || []).map((p) => [p.id, p.nome])),
    pessoas: new Map((ctx.users || []).filter((u) => u.auth_user_id).map((u) => [u.auth_user_id, u.nome])),
  };
  const mudancas = [];
  const antes = log.antes, depois = log.depois;

  if (log.evento === "permissoes_atualizadas") {
    const a = chaves(antes), d = chaves(depois);
    for (const [k, l] of d) if (!a.has(k)) mudancas.push({ campo: l.effect === "deny" ? "Negada" : "Concedida", antes: "—", depois: l.permission_key });
    for (const [k, l] of a) if (!d.has(k)) mudancas.push({ campo: l.effect === "deny" ? "Negação removida" : "Removida", antes: l.permission_key, depois: "—" });
  } else if (log.alvo_tipo === "perfil" && Array.isArray(depois?.permissions)) {
    const a = new Set(Array.isArray(antes?.permissions) ? antes.permissions : []);
    const d = new Set(depois.permissions);
    if (antes) {
      for (const k of d) if (!a.has(k)) mudancas.push({ campo: "Permissão incluída", antes: "—", depois: k });
      for (const k of a) if (!d.has(k)) mudancas.push({ campo: "Permissão retirada", antes: k, depois: "—" });
    } else {
      mudancas.push({ campo: "Permissões", antes: "—", depois: `${d.size} permissões` });
    }
  } else if (antes && depois && typeof antes === "object" && typeof depois === "object") {
    for (const campo of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
      if (IGNORAR.has(campo) || igual(antes[campo], depois[campo])) continue;
      mudancas.push({ campo: ROTULOS[campo] || campo, antes: valorLegivel(campo, antes[campo], nomes), depois: valorLegivel(campo, depois[campo], nomes) });
    }
  }
  if (log.evento === "aplicado_a_usuarios" && Array.isArray(depois?.userIds)) {
    mudancas.push({ campo: "Usuários", antes: "—", depois: `${depois.userIds.length} usuário(s)` });
  }

  return {
    id: log.id,
    quando: log.created_at,
    evento: rotuloEvento(log.evento),
    ator: nomes.pessoas.get(log.ator_auth_user_id) || (log.ator_auth_user_id ? "usuário removido ou de fora do seu escopo" : "sistema"),
    mudancas,
  };
}

/** Linhas do histórico de um usuário (alvo direto) e dos perfis que ele usa. */
export function historicoDoUsuario(logs, usuario, ctx = {}) {
  return (logs || [])
    .filter((l) => (l.alvo_tipo === "usuario" && l.alvo_id === usuario.id)
      || (l.alvo_tipo === "perfil" && usuario.perfil_id && l.alvo_id === usuario.perfil_id))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((l) => ({ ...resumirAlteracao(l, ctx), doPerfil: l.alvo_tipo === "perfil" }));
}
