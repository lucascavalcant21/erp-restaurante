// RequestContext: QUEM está pedindo, em QUE unidade e empresa, com QUAIS
// permissões, por QUAL canal — resolvido no servidor, conferido no banco.
//
// Regras que não mudam:
//   - A identidade vem do token validado no Auth, nunca de um campo do corpo.
//   - A unidade pedida pelo cliente só entra no contexto se o banco disser que
//     ela está no escopo do usuário (hefisto_contexto_requisicao).
//   - A empresa NUNCA vem do cliente: é a empresa da unidade, lida no banco.
//   - Usuário sem cadastro no ERP, bloqueado, fora da vigência ou sem perfil
//     ativo não tem contexto (403 SEM_PERFIL), mesmo com sessão válida.
//   - O contexto é congelado e o token não fica em propriedade enumerável:
//     serializar o contexto num log não vaza a sessão.
//
// Este módulo não conhece Next nem Supabase: as dependências entram por
// parâmetro (deps), para dar para testar e para o futuro Agent Core reusar.

import { CODIGOS, recusa } from "./codigos.mjs";

export const CANAIS = Object.freeze(["web", "quiosque", "sistema", "integracao", "agente"]);
export const CANAIS_DE_USUARIO = Object.freeze(["web", "quiosque", "agente"]);

const TOKENS = new WeakMap();
const MARCA = Symbol.for("hefisto.RequestContext");

/** Token da sessão do contexto (só para quem precisa falar com o banco como o usuário). */
export function tokenDoContexto(ctx) {
  return TOKENS.get(ctx) || null;
}

export function ehContexto(ctx) {
  return Boolean(ctx && ctx[MARCA] === true && Object.isFrozen(ctx));
}

/** Unidade só vale se for um id concreto: "todas"/"matriz" são curingas de tela, não escopo. */
export function unidadeConcreta(unidadeId) {
  const v = String(unidadeId ?? "").trim();
  if (!v || v === "todas" || v === "matriz") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) return null;
  return v;
}

/**
 * Lê a unidade pedida num cabeçalho/parâmetro do cliente.
 *   ausente, vazio, "todas" ou "matriz"  → sem unidade (null)
 *   id bem formado                        → o id (ainda será validado no banco)
 *   qualquer outra coisa                  → inválido
 */
export function unidadePedida(valor) {
  if (valor === null || valor === undefined) return { valor: null, invalida: false };
  const v = String(valor).trim();
  if (!v || v === "todas" || v === "matriz") return { valor: null, invalida: false };
  const concreta = unidadeConcreta(v);
  return concreta ? { valor: concreta, invalida: false } : { valor: null, invalida: true };
}

const lista = (v) => (Array.isArray(v) ? v.map(String) : []);

function congelar(dados, token) {
  const ctx = Object.create(null);
  Object.defineProperty(ctx, MARCA, { value: true, enumerable: false });
  Object.assign(ctx, dados);
  for (const k of ["permissions", "negacoes", "unidades"]) if (Array.isArray(ctx[k])) Object.freeze(ctx[k]);
  if (ctx.actor) Object.freeze(ctx.actor);
  if (ctx.perfil) Object.freeze(ctx.perfil);
  Object.freeze(ctx);
  if (token) TOKENS.set(ctx, token);
  return ctx;
}

/**
 * @param {object} p
 * @param {string|null} p.token
 * @param {string|null} [p.unidadeSolicitada]  o que o cliente pediu (cabeçalho, URL, corpo)
 * @param {"web"|"quiosque"|"agente"} [p.canal]
 * @param {string} p.requestId
 * @param {object} p.deps
 * @param {(token:string)=>Promise<{id:string}|null>} p.deps.validarToken
 * @param {(token:string, unidadeId:string|null)=>Promise<object|null>} p.deps.contextoDoBanco
 * @returns {Promise<{ok:true, contexto:object}|{ok:false,status:number,codigo:string,mensagem:string}>}
 */
export async function resolverContexto({ token, unidadeSolicitada = null, canal = "web", requestId, deps }) {
  if (!CANAIS_DE_USUARIO.includes(canal)) {
    return recusa(400, CODIGOS.CANAL_INVALIDO, "Canal inválido para uma requisição de usuário.");
  }
  if (!token) return recusa(401, CODIGOS.SEM_SESSAO, "Sessão ausente. Entre novamente no sistema.");

  let usuario;
  try {
    usuario = await deps.validarToken(token);
  } catch {
    return recusa(503, CODIGOS.VERIFICACAO_INDISPONIVEL, "Não foi possível validar a sessão agora. Tente de novo.");
  }
  if (!usuario?.id) return recusa(401, CODIGOS.SESSAO_INVALIDA, "Sessão inválida ou expirada. Entre novamente.");

  const pedida = unidadePedida(unidadeSolicitada);
  if (pedida.invalida) {
    return recusa(400, CODIGOS.UNIDADE_INVALIDA, "Unidade inválida.", { usuario });
  }

  let bruto;
  try {
    bruto = await deps.contextoDoBanco(token, pedida.valor);
  } catch {
    return recusa(503, CODIGOS.VERIFICACAO_INDISPONIVEL, "Não foi possível verificar seu acesso agora. Tente de novo.", { usuario });
  }

  // O banco lê o usuário do mesmo token: se discordar do Auth, algo está errado.
  if (bruto?.auth_user_id && bruto.auth_user_id !== usuario.id) {
    return recusa(401, CODIGOS.SESSAO_INVALIDA, "Sessão inválida. Entre novamente.", { usuario });
  }
  if (!bruto || !bruto.cadastrado || !bruto.valido) {
    return recusa(403, CODIGOS.SEM_PERFIL, "Seu usuário não tem acesso ativo ao sistema. Fale com o administrador.", { usuario });
  }
  if (pedida.valor && !bruto.unidade_permitida) {
    return recusa(403, CODIGOS.UNIDADE_FORA_DO_ESCOPO, "Você não tem acesso a esta unidade.", { usuario });
  }

  const contexto = congelar({
    userId: usuario.id,
    usuarioErpId: bruto.usuario_erp_id || null,
    empresaId: bruto.empresa_id || null,
    unidadeId: pedida.valor ? bruto.unidade_id : null,
    unidades: lista(bruto.unidades),
    perfil: { id: bruto.perfil_id || null, codigo: bruto.perfil_codigo || null },
    superAdmin: bruto.super_admin === true,
    permissions: lista(bruto.permissoes),
    negacoes: lista(bruto.negacoes),
    requestId: String(requestId || ""),
    channel: canal,
    actor: { tipo: "usuario", id: usuario.id },
    fonte: bruto.fonte || "hefisto_contexto_requisicao",
  }, token);

  return { ok: true, contexto };
}

/**
 * Contexto de uma integração já autenticada (cron, webhook). Sem usuário: as
 * permissões são as declaradas no registro de integrações, e nada mais.
 */
export function contextoDeIntegracao({ integracao, canal, permissoes = [], requestId }) {
  if (!["sistema", "integracao"].includes(canal)) throw new Error(`canal de integração inválido: ${canal}`);
  return congelar({
    userId: null,
    usuarioErpId: null,
    empresaId: null,
    unidadeId: null,
    unidades: [],
    perfil: { id: null, codigo: null },
    superAdmin: false,
    permissions: lista(permissoes),
    negacoes: [],
    requestId: String(requestId || ""),
    channel: canal,
    actor: { tipo: "integracao", id: integracao },
    fonte: "registro_de_integracoes",
  }, null);
}
