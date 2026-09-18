// Testes do RequestContext e de authorizeAction. Rode com:
// node --test app/lib/server/autorizacao.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { resolverContexto, contextoDeIntegracao, ehContexto, tokenDoContexto, unidadePedida } from "./contexto.mjs";
import { authorizeAction, authorizeAny, exigirAcao, paraAuditoria, chaveDoCatalogo, ErroDeAutorizacao } from "./autorizacao.mjs";
import { CODIGOS } from "./codigos.mjs";

const TOKEN = "token-do-estoquista-000000000000000000";
const BANCO = {
  cadastrado: true, valido: true, auth_user_id: "u-estoque", usuario_erp_id: "erp-1", super_admin: false,
  unidades: ["unidade-a"], permissoes: ["estoque.*", "cozinha.recipes.view"], negacoes: ["estoque.overview.delete"],
  perfil_id: "p-1", perfil_codigo: "estoquista",
};
function deps({ banco = BANCO, podeFazer } = {}) {
  const chamadas = [];
  return {
    chamadas,
    validarToken: async (t) => (t === TOKEN ? { id: "u-estoque" } : null),
    contextoDoBanco: async (_t, unidade) => ({
      ...banco,
      unidade_id: unidade && banco.unidades.includes(unidade) ? unidade : null,
      unidade_permitida: unidade === null || banco.unidades.includes(unidade),
      empresa_id: "empresa-1",
    }),
    podeFazer: podeFazer || (async (t, p, u) => { chamadas.push([t, p, u]); return true; }),
  };
}
const contexto = async (opcoes = {}) => {
  const d = opcoes.deps || deps();
  const r = await resolverContexto({ token: TOKEN, unidadeSolicitada: "unidade-a", requestId: "req-9", deps: d, ...opcoes });
  assert.ok(r.ok, r.mensagem);
  return { ctx: r.contexto, d };
};

test("contexto é congelado, marcado e não expõe o token ao serializar", async () => {
  const { ctx } = await contexto();
  assert.equal(ehContexto(ctx), true);
  assert.throws(() => { ctx.unidadeId = "unidade-b"; });
  assert.throws(() => { ctx.permissions.push("*"); });
  assert.equal(JSON.stringify(ctx).includes(TOKEN), false);
  assert.equal(tokenDoContexto(ctx), TOKEN);
  assert.equal(ehContexto({ ...ctx }), false, "cópia forjada não vale");
});

test("empresa e unidade vêm do banco; o cliente não escolhe empresa", async () => {
  const { ctx } = await contexto();
  assert.equal(ctx.empresaId, "empresa-1");
  assert.equal(ctx.unidadeId, "unidade-a");
  // A função não tem parâmetro de empresa: um campo empresaId no corpo simplesmente não entra.
  assert.equal(resolverContexto.length, 1);
  const r = await resolverContexto({ token: TOKEN, unidadeSolicitada: "unidade-b", empresaId: "empresa-2", requestId: "x", deps: deps() });
  assert.equal(r.codigo, CODIGOS.UNIDADE_FORA_DO_ESCOPO);
});

test("canal fora da lista de canais de usuário é recusado", async () => {
  const r = await resolverContexto({ token: TOKEN, canal: "root", requestId: "x", deps: deps() });
  assert.equal(r.codigo, CODIGOS.CANAL_INVALIDO);
  assert.equal((await resolverContexto({ token: TOKEN, canal: "sistema", requestId: "x", deps: deps() })).codigo, CODIGOS.CANAL_INVALIDO);
});

test("unidade pedida: curinga vira 'sem unidade'; lixo é inválido", () => {
  assert.deepEqual(unidadePedida("todas"), { valor: null, invalida: false });
  assert.deepEqual(unidadePedida(undefined), { valor: null, invalida: false });
  assert.deepEqual(unidadePedida("unidade-a"), { valor: "unidade-a", invalida: false });
  assert.equal(unidadePedida("../../etc").invalida, true);
});

test("usuário inválido no banco (bloqueado, sem perfil) não tem contexto", async () => {
  const r = await resolverContexto({ token: TOKEN, requestId: "x", deps: deps({ banco: { ...BANCO, valido: false } }) });
  assert.equal(r.codigo, CODIGOS.SEM_PERFIL);
  const r2 = await resolverContexto({ token: TOKEN, requestId: "x", deps: deps({ banco: { cadastrado: false, valido: false } }) });
  assert.equal(r2.codigo, CODIGOS.SEM_PERFIL);
});

test("banco discordando do Auth sobre quem é o usuário = sessão inválida", async () => {
  const r = await resolverContexto({ token: TOKEN, requestId: "x", deps: deps({ banco: { ...BANCO, auth_user_id: "outra-pessoa" } }) });
  assert.equal(r.codigo, CODIGOS.SESSAO_INVALIDA);
});

test("authorizeAction: chave fora do catálogo é recusada antes de tudo", async () => {
  const { ctx, d } = await contexto();
  const r = await authorizeAction(ctx, "estoque.movimentar", { deps: d });
  assert.equal(r.codigo, CODIGOS.PERMISSAO_DESCONHECIDA);
  assert.equal(d.chamadas.length, 0);
  assert.equal(chaveDoCatalogo("estoque.overview.adjust_stock"), true);
  assert.equal(chaveDoCatalogo("estoque.*"), true);
  assert.equal(chaveDoCatalogo("estoque.inexistente.*"), false);
});

test("authorizeAction: permitido só com o SIM do banco, na unidade do contexto", async () => {
  const { ctx, d } = await contexto();
  const r = await authorizeAction(ctx, "estoque.overview.adjust_stock", { acao: "estoque.ajustar_saldo", deps: d });
  assert.equal(r.ok, true);
  assert.equal(r.verificadoNoBanco, true);
  assert.equal(r.unidadeId, "unidade-a");
  assert.equal(r.empresaId, "empresa-1");
  assert.deepEqual(d.chamadas, [[TOKEN, "estoque.overview.adjust_stock", "unidade-a"]]);
});

test("authorizeAction: negação explícita e falta de permissão recusam sem ir ao banco", async () => {
  const { ctx, d } = await contexto();
  assert.equal((await authorizeAction(ctx, "estoque.overview.delete", { deps: d })).codigo, CODIGOS.SEM_PERMISSAO);
  assert.equal((await authorizeAction(ctx, "financeiro.cashflow.view", { deps: d })).codigo, CODIGOS.SEM_PERMISSAO);
  assert.equal((await authorizeAction(ctx, "rh.employees.view", { deps: d })).codigo, CODIGOS.SEM_PERMISSAO);
  assert.equal(d.chamadas.length, 0);
});

test("authorizeAction: unidade do RECURSO fora do escopo é recusada", async () => {
  const { ctx, d } = await contexto();
  const r = await authorizeAction(ctx, "estoque.overview.view", { unidadeId: "unidade-b", deps: d });
  assert.equal(r.codigo, CODIGOS.UNIDADE_FORA_DO_ESCOPO);
  assert.equal((await authorizeAction(ctx, "estoque.overview.view", { unidadeId: "x' or 1=1", deps: d })).codigo, CODIGOS.UNIDADE_INVALIDA);
});

test("authorizeAction: banco fora do ar fecha (503); banco dizendo não fecha (403)", async () => {
  const falha = deps({ podeFazer: async () => { throw new Error("rede"); } });
  const { ctx } = await contexto({ deps: falha });
  assert.equal((await authorizeAction(ctx, "estoque.overview.view", { deps: falha })).status, 503);
  const nao = deps({ podeFazer: async () => false });
  const { ctx: ctx2 } = await contexto({ deps: nao });
  const r = await authorizeAction(ctx2, "estoque.overview.view", { deps: nao });
  assert.equal(r.status, 403);
  assert.equal(r.divergencia, true);
});

test("authorizeAction: sem verificação no banco configurada, não autoriza", async () => {
  const { ctx } = await contexto();
  assert.equal((await authorizeAction(ctx, "estoque.overview.view", { deps: {} })).ok, false);
});

test("authorizeAction recusa objeto que não é RequestContext (forjado)", async () => {
  const falso = Object.freeze({ superAdmin: true, permissions: ["*"], unidades: ["*"], actor: { tipo: "usuario", id: "x" } });
  const r = await authorizeAction(falso, "financeiro.cashflow.view", { deps: { podeFazer: async () => true } });
  assert.equal(r.codigo, CODIGOS.CONTEXTO_INVALIDO);
});

test("integração: só as permissões do registro e só com unidade explícita", async () => {
  const ctx = contextoDeIntegracao({ integracao: "cron", canal: "sistema", permissoes: ["vendas.ifood.edit"], requestId: "r" });
  assert.equal(ctx.actor.tipo, "integracao");
  assert.equal((await authorizeAction(ctx, "vendas.ifood.edit")).codigo, CODIGOS.UNIDADE_INVALIDA);
  const ok = await authorizeAction(ctx, "vendas.ifood.edit", { unidadeId: "unidade-a" });
  assert.equal(ok.ok, true);
  assert.equal(ok.verificadoNoBanco, false);
  assert.equal((await authorizeAction(ctx, "financeiro.cashflow.view", { unidadeId: "unidade-a" })).codigo, CODIGOS.SEM_PERMISSAO);
  assert.throws(() => contextoDeIntegracao({ integracao: "x", canal: "web" }));
});

test("authorizeAny e exigirAcao", async () => {
  const { ctx, d } = await contexto();
  assert.equal((await authorizeAny(ctx, ["financeiro.cashflow.view", "cozinha.recipes.view"], { deps: d })).ok, true);
  assert.equal((await authorizeAny(ctx, [], { deps: d })).ok, false);
  await assert.rejects(exigirAcao(ctx, "financeiro.cashflow.view", { deps: d }), (e) => e instanceof ErroDeAutorizacao && e.status === 403);
});

test("paraAuditoria leva o contexto mínimo da ação, sem token nem permissões", async () => {
  const { ctx, d } = await contexto();
  const decisao = await authorizeAction(ctx, "estoque.overview.adjust_stock", { acao: "estoque.ajustar_saldo", deps: d });
  const a = paraAuditoria(ctx, decisao);
  assert.deepEqual({ ...a }, {
    requestId: "req-9", actorTipo: "usuario", actorUserId: "u-estoque", integracao: null, empresaId: "empresa-1",
    unidadeId: "unidade-a", channel: "web", action: "estoque.ajustar_saldo", permission: "estoque.overview.adjust_stock",
    permitido: true, codigo: null,
  });
  assert.equal(JSON.stringify(a).includes(TOKEN), false);
});
