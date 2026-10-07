// ESCOPO DE TENANT da inteligência.
//
// O escopo só nasce de um RequestContext resolvido no servidor
// (app/lib/server/contexto.mjs → hefisto_contexto_requisicao no banco): a
// unidade é a que o BANCO confirmou estar no escopo do usuário, e a empresa é a
// da unidade lida no banco. Nada que venha do navegador, do texto do usuário
// ou do modelo de IA entra aqui. Toda consulta e toda ação exigem um escopo
// autêntico — objeto montado à mão é recusado.

import { ehContexto } from "../../server/contexto.mjs";

const MARCA = Symbol("hefisto.intelligence.escopo");

export class ErroDeEscopo extends Error {
  constructor(mensagem, codigo = "ESCOPO_INVALIDO") {
    super(mensagem);
    this.name = "ErroDeEscopo";
    this.codigo = codigo;
  }
}

/**
 * @param {object} ctx RequestContext congelado (resolverContexto)
 * @returns {Readonly<{unidadeId:string, empresaId:string|null, userId:string, usuarioErpId:string|null, requestId:string}>}
 */
export function escopoDoContexto(ctx) {
  if (!ehContexto(ctx)) throw new ErroDeEscopo("Contexto de requisição inválido: a inteligência só roda com contexto resolvido no servidor.");
  if (ctx.actor?.tipo !== "usuario") throw new ErroDeEscopo("A inteligência responde só a usuários autenticados.");
  if (!ctx.unidadeId) throw new ErroDeEscopo("Selecione uma unidade para usar a inteligência.", "UNIDADE_NAO_SELECIONADA");
  const escopo = Object.create(null);
  Object.defineProperty(escopo, MARCA, { value: true, enumerable: false });
  Object.assign(escopo, {
    unidadeId: ctx.unidadeId,
    empresaId: ctx.empresaId || null,
    userId: ctx.userId,
    usuarioErpId: ctx.usuarioErpId || null,
    requestId: ctx.requestId || "",
  });
  return Object.freeze(escopo);
}

export function ehEscopo(e) {
  return Boolean(e && e[MARCA] === true && Object.isFrozen(e));
}

export function exigirEscopo(e) {
  if (!ehEscopo(e)) throw new ErroDeEscopo("Escopo de tenant ausente ou forjado.");
  return e;
}
