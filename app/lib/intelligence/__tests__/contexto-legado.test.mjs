// Banco SEM a Fase 1B (como o Supabase real em 08/10/2026): o contexto da
// requisição vem de hefisto_session_context + hefisto_user_in_unit, e a
// decisão continua no banco (hefisto_user_can). Usa resolverContexto REAL.
import test from "node:test";
import assert from "node:assert/strict";
import { resolverContexto } from "../../server/contexto.mjs";
import { authorizeAction } from "../../server/autorizacao.mjs";
import { contextoLegado, funcaoAusente } from "../context/contexto-legado.mjs";
import { bancoFalso } from "./apoio.mjs";

const UID = "11111111-1111-4111-8111-111111111111";
const OUTRO = "33333333-3333-4333-8333-333333333333";

// session_context como o de produção (docs/controle-acesso-rbac.sql)
const sessoes = {
  [UID]: { erp_user_id: "erp-1", status: "ativo", super_admin: false, tipo_acesso: "gerente", perfil_id: "p1", unidade: "loja-a", permissions: ["dashboard.*", "estoque.*"], scopes: [] },
  [OUTRO]: { erp_user_id: "erp-3", status: "ativo", super_admin: false, tipo_acesso: "funcionario", perfil_id: "p2", unidade: "loja-a", permissions: ["dashboard.overview.view"], scopes: [] },
};

function banco(uid, { inUnit = (u) => u === "loja-a", sessao = sessoes[uid] } = {}) {
  return bancoFalso({ unidades: [{ id: "loja-a", empresa_id: "emp-a" }, { id: "loja-b", empresa_id: "emp-b" }] }, {
    rpcs: {
      hefisto_session_context: async () => sessao ?? null,
      hefisto_user_in_unit: async (a) => a.p_auth_user_id === uid && inUnit(a.p_unidade_id),
    },
  });
}

function deps(uid, opcoes) {
  const db = banco(uid, opcoes);
  return {
    db,
    async validarToken(token) { return token === `tok-${uid}` ? { id: uid } : null; },
    async contextoDoBanco(_token, unidade) {
      const r = await db.rpc("hefisto_contexto_requisicao", { p_unidade_id: unidade });
      if (!r.error) return r.data;
      if (!funcaoAusente(r.error)) throw new Error("contexto indisponível");
      return contextoLegado(db, uid, unidade);
    },
    async podeFazer(_t, permissao, unidade) {
      const s = sessoes[uid];
      return !!s && (unidade == null || unidade === "loja-a") && (s.permissions.includes("*") || s.permissions.some((k) => k === permissao || (k.endsWith(".*") && permissao.startsWith(k.slice(0, -1)))));
    },
  };
}

test("sem a 1B: contexto montado com as funções que existem; empresa vem do banco", async () => {
  const d = deps(UID);
  const r = await resolverContexto({ token: `tok-${UID}`, unidadeSolicitada: "loja-a", canal: "agente", requestId: "req-legado-1", deps: d });
  assert.equal(r.ok, true);
  assert.deepEqual([r.contexto.unidadeId, r.contexto.empresaId, r.contexto.userId, r.contexto.fonte.startsWith("hefisto_session_context")], ["loja-a", "emp-a", UID, true]);
  assert.ok(d.db.chamadas.some((c) => c.rpc === "hefisto_contexto_requisicao"), "tenta o caminho principal antes");
  const porta = await authorizeAction(r.contexto, "dashboard.intelligence.view", { deps: d });
  assert.equal(porta.ok, true);
});

test("sem a 1B: unidade fora do escopo → 403; a decisão é do banco (hefisto_user_in_unit)", async () => {
  const r = await resolverContexto({ token: `tok-${UID}`, unidadeSolicitada: "loja-b", canal: "agente", requestId: "req-legado-2", deps: deps(UID) });
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(r.codigo, "UNIDADE_FORA_DO_ESCOPO");
});

test("sem a 1B: unidade inexistente não passa nem com escopo amplo", async () => {
  const r = await resolverContexto({ token: `tok-${UID}`, unidadeSolicitada: "loja-forjada", canal: "agente", requestId: "req-legado-3", deps: deps(UID, { inUnit: () => true }) });
  assert.equal(r.status, 403);
});

test("sem a 1B: usuário sem cadastro no ERP ou inativo → 403", async () => {
  const semCadastro = await resolverContexto({ token: `tok-${UID}`, unidadeSolicitada: "loja-a", canal: "agente", requestId: "req-legado-4", deps: deps(UID, { sessao: null }) });
  assert.equal(semCadastro.status, 403);
  const inativo = await resolverContexto({ token: `tok-${UID}`, unidadeSolicitada: "loja-a", canal: "agente", requestId: "req-legado-5", deps: deps(UID, { sessao: { ...sessoes[UID], status: "bloqueado" } }) });
  assert.equal(inativo.status, 403);
});

test("sem a 1B: quem só vê o painel geral não abre a inteligência (403 na porta)", async () => {
  const d = deps(OUTRO);
  const r = await resolverContexto({ token: `tok-${OUTRO}`, unidadeSolicitada: "loja-a", canal: "agente", requestId: "req-legado-6", deps: d });
  assert.equal(r.ok, true);
  const porta = await authorizeAction(r.contexto, "dashboard.intelligence.view", { deps: d });
  assert.equal(porta.ok, false);
  assert.equal(porta.status, 403);
});

test("super admin e escopo amplo: todas as unidades, como hefisto_user_in_unit em produção", async () => {
  const db = banco(UID, { sessao: { ...sessoes[UID], super_admin: true, permissions: "*" } });
  const c = await contextoLegado(db, UID, "loja-a");
  assert.deepEqual([c.unidades, c.permissoes, c.super_admin], [["*"], ["*"], true]);
  const db2 = banco(UID, { sessao: { ...sessoes[UID], scopes: [{ data_scope: "empresa", unidade_id: null }] } });
  assert.deepEqual((await contextoLegado(db2, UID, null)).unidades, ["*"]);
});

test("erro que não é 'função ausente' não cai no caminho legado (falha fechada)", () => {
  assert.equal(funcaoAusente({ code: "PGRST202", message: "Could not find the function public.hefisto_contexto_requisicao" }), true);
  assert.equal(funcaoAusente({ code: "42883", message: "function does not exist" }), true);
  assert.equal(funcaoAusente({ code: "42501", message: "permission denied" }), false);
  assert.equal(funcaoAusente({ message: "timeout" }), false);
});
