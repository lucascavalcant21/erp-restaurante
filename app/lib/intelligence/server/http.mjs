// Casca HTTP das rotas /api/intelligence/* (server-only).
//
// Em todo pedido, nesta ordem:
//   1. sessão: token do cabeçalho Authorization, validado no Auth;
//   2. contexto: unidade do cabeçalho x-hefisto-unidade confirmada NO BANCO
//      (hefisto_contexto_requisicao); empresa = a da unidade; o corpo do
//      pedido nunca define tenant;
//   3. freio por usuário (limite de pedidos por minuto);
//   4. monta Context Engine, banco escopado (cliente do usuário), verificador
//      de permissão, Metrics Engine, store de auditoria e serviço de ações;
//   5. erros sem detalhe interno; falha de isolamento vira bloqueio auditado.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolverContexto } from "../../server/contexto.mjs";
import { authorizeAction } from "../../server/autorizacao.mjs";
import { dentroDoLimite } from "../../server/limite-por-ip.mjs";
import { depsDoContexto, clienteDoUsuario } from "../context/servidor.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { ErroDeEscopo } from "../context/escopo.mjs";
import { criarDbEscopado, ErroDeIsolamento } from "../context/db-escopado.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { criarStoreSupabase, storeIndisponivel } from "../audit/store-supabase.mjs";
import { auditar, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";
import { registrarFabricaDeProvedor, provedorConfigurado } from "../providers/ai-provider.mjs";
import { criarProvedorAnthropic } from "../providers/anthropic.mjs";

registrarFabricaDeProvedor(() => criarProvedorAnthropic());

export const PERMISSAO_INTELIGENCIA = "dashboard.intelligence.view";
const SEM_CACHE = { "Cache-Control": "no-store" };
export const responder = (corpo, status = 200) => NextResponse.json(corpo, { status, headers: SEM_CACHE });
const recusar = (status, codigo, erro) => responder({ erro, codigo }, status);

function storeDoServidor() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { store: storeIndisponivel, persistente: false };
  try { return { store: criarStoreSupabase(), persistente: true }; } catch { return { store: storeIndisponivel, persistente: false }; }
}

async function lerCorpo(request) {
  if (request.method === "GET") return {};
  const tamanho = Number(request.headers.get("content-length") || 0);
  if (tamanho > 16 * 1024) return null;
  const txt = await request.text().catch(() => "");
  if (txt.length > 16 * 1024) return null;
  if (!txt) return {};
  try { const o = JSON.parse(txt); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; }
}

/**
 * @param {Request} request
 * @param {(amb: object) => Promise<object>} handler devolve { corpo, status? }
 */
export async function atenderInteligencia(request, handler, { limitePorMinuto = 30, injecao = null } = {}) {
  const requestId = randomUUID();
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() || null;
  const unidade = request.headers.get("x-hefisto-unidade");
  // `injecao` existe só para os testes de integração da casca (banco falso).
  const deps = injecao?.deps || depsDoContexto();

  const r = await resolverContexto({ token, unidadeSolicitada: unidade, canal: "agente", requestId, deps });
  if (!r.ok) return recusar(r.status, r.codigo, r.mensagem);
  const ctx = r.contexto;

  // Porta da inteligência: a mesma chave que abre a Central (confirmada no banco).
  const porta = await authorizeAction(ctx, PERMISSAO_INTELIGENCIA, { acao: "inteligencia.usar", deps });
  if (!porta.ok) return recusar(porta.status, porta.codigo, porta.status === 403 ? "Seu perfil não tem acesso à Central de Inteligência." : porta.mensagem);

  if (!dentroDoLimite(`inteligencia:${ctx.userId}`, { maximo: limitePorMinuto, janelaMs: 60_000 })) {
    return recusar(429, "LIMITE", "Muitos pedidos em sequência. Aguarde um minuto.");
  }
  const corpo = await lerCorpo(request);
  if (corpo === null) return recusar(400, "CORPO_INVALIDO", "Pedido inválido.");

  const agora = injecao?.agora || new Date();
  let ic;
  try {
    ic = montarContextoInteligencia({ requestContext: ctx, tela: corpo.tela ?? null, agora });
  } catch (e) {
    if (e instanceof ErroDeEscopo) return recusar(400, e.codigo, e.message);
    return recusar(500, "ERRO", "Falha ao montar o contexto.");
  }

  const { store, persistente } = injecao?.store ? { store: injecao.store, persistente: true } : storeDoServidor();
  const dbUsuario = injecao?.clienteDoUsuario ? injecao.clienteDoUsuario(token) : clienteDoUsuario(token);
  const dbe = criarDbEscopado(dbUsuario, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora, fuso: ic.fuso });
  const nomeUsuario = persistente && store.nomeDoUsuario ? await store.nomeDoUsuario(ic.escopo.userId).catch(() => "") : "";
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario, verificador, nomeUsuario, canal: "web", relogio: injecao?.agora ? () => injecao.agora : undefined });
  const correlationId = `ic-${requestId}`;

  try {
    const provedor = injecao ? (injecao.provedor || null) : await provedorConfigurado();
    const out = await handler({ ctx, ic, motor, store, persistente, servicoAcoes, corpo, correlationId, nomeUsuario, provedor });
    return responder({ ...out.corpo, auditoriaPersistente: persistente }, out.status || 200);
  } catch (e) {
    if (e instanceof ErroDeIsolamento) {
      await auditar(store, ic.escopo, { correlationId, etapa: ETAPA_AUDITORIA.BLOQUEIO, erro: e.message, consultas: dbe.consultas });
      return recusar(500, "ISOLAMENTO", "Resposta bloqueada por segurança: os dados não puderam ser isolados da sua unidade.");
    }
    if (e?.codigo === "AUDITORIA_INDISPONIVEL") return recusar(503, e.codigo, e.message);
    console.error("[intelligence]", requestId, e?.name || "Erro");
    return recusar(500, "ERRO", "Não foi possível concluir agora. Tente novamente.");
  }
}
