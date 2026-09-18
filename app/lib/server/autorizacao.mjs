// authorizeAction: a pergunta "este contexto pode fazer ESTA ação nesta
// unidade?" — a mesma para rota, ação de domínio e, no futuro, Tool Registry.
//
// Três conferências, nenhuma confia só na anterior:
//   1. A chave existe no catálogo (app/lib/permissions-catalog.mjs). Chave
//      digitada errada é recusada, não "passa por não existir".
//   2. O contexto (permissões efetivas lidas no banco ao montar o contexto)
//      concede a chave na unidade — recusa rápida, sem ida ao banco.
//   3. O BANCO confirma com hefisto_user_can(permissão, unidade), a mesma
//      função das policies de RLS. Só vale o "sim" do banco.
//
// Não existe outro catálogo nem outra regra de curinga: a conferência local
// espelha hefisto_permission_match e serve só para negar mais cedo.

import { CODIGOS, recusa } from "./codigos.mjs";
import { ehContexto, tokenDoContexto, unidadeConcreta } from "./contexto.mjs";
import { allPermissionKeys } from "../permissions-catalog.mjs";

const CHAVES = new Set(allPermissionKeys());
const PREFIXOS = new Set([...CHAVES].flatMap((k) => {
  const [m, p] = k.split(".");
  return [`${m}.*`, `${m}.${p}.*`];
}));

/** A chave (ou curinga) existe no catálogo? */
export function chaveDoCatalogo(chave) {
  const k = String(chave || "");
  return k === "*" || CHAVES.has(k) || PREFIXOS.has(k);
}

/** Espelho de hefisto_permission_match(concedida, pedida). */
export function combina(concedida, pedida) {
  if (concedida === "*" || concedida === pedida) return true;
  const [m, p] = String(pedida).split(".");
  return concedida === `${m}.*` || concedida === `${m}.${p}.*`;
}

/** O contexto concede a chave? (negação explícita vence) */
export function contextoConcede(ctx, chave) {
  if (!ehContexto(ctx)) return false;
  if (ctx.superAdmin) return true;
  if (ctx.negacoes.some((n) => combina(n, chave))) return false;
  return ctx.permissions.some((c) => combina(c, chave));
}

function unidadeNoEscopo(ctx, unidade) {
  if (!unidade) return true;
  return ctx.superAdmin || ctx.unidades.includes("*") || ctx.unidades.includes(unidade);
}

export class ErroDeAutorizacao extends Error {
  constructor(decisao) {
    super(decisao.mensagem);
    this.name = "ErroDeAutorizacao";
    this.status = decisao.status;
    this.codigo = decisao.codigo;
    this.decisao = decisao;
  }
}

/**
 * @param {object} ctx  RequestContext (resolverContexto ou contextoDeIntegracao)
 * @param {string} permissao  chave do catálogo, ex.: "estoque.overview.adjust_stock"
 * @param {object} [opcoes]
 * @param {string|null} [opcoes.unidadeId]  unidade do RECURSO (lida do banco pela ação); padrão: a do contexto
 * @param {string} [opcoes.acao]  nome da ação de domínio, para auditoria (ex.: "estoque.ajustar_saldo")
 * @param {object} [opcoes.deps]
 * @param {(token:string, permissao:string, unidadeId:string|null)=>Promise<boolean>} [opcoes.deps.podeFazer]
 */
export async function authorizeAction(ctx, permissao, { unidadeId, acao = null, deps = {} } = {}) {
  if (!ehContexto(ctx)) {
    return recusa(500, CODIGOS.CONTEXTO_INVALIDO, "Contexto de requisição inválido.");
  }
  const base = { permissao, acao, requestId: ctx.requestId, channel: ctx.channel, actor: ctx.actor };

  if (!chaveDoCatalogo(permissao)) {
    return recusa(403, CODIGOS.PERMISSAO_DESCONHECIDA, "Permissão inexistente no catálogo.", base);
  }

  let unidade = ctx.unidadeId;
  if (unidadeId !== undefined) {
    unidade = unidadeId === null ? null : unidadeConcreta(unidadeId);
    if (unidadeId !== null && !unidade) {
      return recusa(400, CODIGOS.UNIDADE_INVALIDA, "Unidade inválida para esta operação.", base);
    }
  }
  const comUnidade = { ...base, unidadeId: unidade };

  if (ctx.actor.tipo === "integracao") {
    // Integração não tem usuário no banco: vale só o que o registro declarou,
    // e só em operação com unidade explícita.
    if (!unidade) return recusa(400, CODIGOS.UNIDADE_INVALIDA, "Integração precisa de unidade explícita.", comUnidade);
    if (!ctx.permissions.some((c) => combina(c, permissao))) {
      return recusa(403, CODIGOS.SEM_PERMISSAO, "Integração sem permissão para esta ação.", comUnidade);
    }
    return Object.freeze({ ok: true, status: 200, ...comUnidade, empresaId: null, verificadoNoBanco: false });
  }

  if (!unidadeNoEscopo(ctx, unidade)) {
    return recusa(403, CODIGOS.UNIDADE_FORA_DO_ESCOPO, "Você não tem acesso a esta unidade.", comUnidade);
  }
  if (!contextoConcede(ctx, permissao)) {
    return recusa(403, CODIGOS.SEM_PERMISSAO, unidade
      ? "Você não tem permissão para esta operação nesta unidade."
      : "Você não tem permissão para esta operação.", comUnidade);
  }
  if (typeof deps.podeFazer !== "function") {
    return recusa(500, CODIGOS.CONTEXTO_INVALIDO, "Autorização sem verificação no banco.", comUnidade);
  }

  let confirmado;
  try {
    confirmado = await deps.podeFazer(tokenDoContexto(ctx), permissao, unidade);
  } catch {
    return recusa(503, CODIGOS.VERIFICACAO_INDISPONIVEL, "Não foi possível verificar sua permissão agora. Tente de novo.", comUnidade);
  }
  if (confirmado !== true) {
    return recusa(403, CODIGOS.SEM_PERMISSAO, "Você não tem permissão para esta operação.", { ...comUnidade, divergencia: true });
  }

  return Object.freeze({
    ok: true,
    status: 200,
    ...comUnidade,
    empresaId: unidade && unidade === ctx.unidadeId ? ctx.empresaId : null,
    verificadoNoBanco: true,
  });
}

/** Basta uma das permissões. Devolve a primeira decisão positiva ou a última recusa. */
export async function authorizeAny(ctx, permissoes, opcoes = {}) {
  if (!Array.isArray(permissoes) || permissoes.length === 0) {
    return recusa(403, CODIGOS.SEM_PERMISSAO, "Operação sem permissão configurada.");
  }
  let ultima = null;
  for (const p of permissoes) {
    const d = await authorizeAction(ctx, p, opcoes);
    if (d.ok) return d;
    if ([500, 503].includes(d.status)) return d;
    // Unidade fora do escopo não melhora trocando de chave.
    if (d.codigo === CODIGOS.UNIDADE_FORA_DO_ESCOPO || d.codigo === CODIGOS.UNIDADE_INVALIDA) return d;
    ultima = d;
  }
  return ultima;
}

/** Igual a authorizeAction, mas lança ErroDeAutorizacao na recusa. */
export async function exigirAcao(ctx, permissao, opcoes = {}) {
  const d = await authorizeAction(ctx, permissao, opcoes);
  if (!d.ok) throw new ErroDeAutorizacao(d);
  return d;
}

/**
 * O que toda ação (e, no futuro, toda ação de IA) precisa carregar para a
 * auditoria. Não inclui token, permissões completas nem dado pessoal.
 */
export function paraAuditoria(ctx, decisao) {
  return Object.freeze({
    requestId: ctx?.requestId || null,
    actorTipo: ctx?.actor?.tipo || null,
    actorUserId: ctx?.actor?.tipo === "usuario" ? ctx.actor.id : null,
    integracao: ctx?.actor?.tipo === "integracao" ? ctx.actor.id : null,
    empresaId: decisao?.empresaId ?? ctx?.empresaId ?? null,
    unidadeId: decisao?.unidadeId ?? ctx?.unidadeId ?? null,
    channel: ctx?.channel || null,
    action: decisao?.acao || null,
    permission: decisao?.permissao || null,
    permitido: Boolean(decisao?.ok),
    codigo: decisao?.ok ? null : decisao?.codigo || null,
  });
}
