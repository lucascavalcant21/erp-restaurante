// Testes da regra de concessão da administração de acessos. Rode com:
// node --test app/lib/server/concessao.test.mjs
//
// O banco é simulado: gerente da unidade A com "configuracoes.users.*" e
// "rh.*"; perfis "garcom" (salão) e "administrador-geral" ("*").

import test from "node:test";
import assert from "node:assert/strict";
import { verificarConcessao, filtrarListagem } from "./concessao.mjs";
import { CODIGOS } from "./codigos.mjs";

const GERENTE = "auth-gerente-a";
const CHAVES_DO_GERENTE = ["configuracoes.users.*", "rh.*", "salao.tables.view", "salao.tables.edit"];
const combina = (c, p) => c === "*" || c === p || c === `${p.split(".")[0]}.*` || c === `${p.split(".").slice(0, 2).join(".")}.*`;
const USUARIOS = {
  "u-garcom-a": { unidades: ["unidade-a"] },
  "u-gerente-b": { unidades: ["unidade-b"] },
  "u-super": { super: true },
  "u-gerente-a": { auth: GERENTE, unidades: ["unidade-a"] },
};
const PERFIS = {
  "p-garcom": { sistema: false, chaves: ["salao.tables.view"], usuarios: ["u-garcom-a"] },
  "p-admin": { sistema: true, chaves: ["*"], usuarios: ["u-super"] },
  "p-do-gerente": { sistema: false, chaves: CHAVES_DO_GERENTE, usuarios: ["u-gerente-a"] },
  "p-misto": { sistema: false, chaves: ["salao.tables.view"], usuarios: ["u-garcom-a", "u-gerente-b"] },
};
const deps = {
  chavesNaoConcediveis: async (_a, chaves) => chaves.filter((k) => !CHAVES_DO_GERENTE.some((c) => combina(c, k))),
  podeGerenciarUsuario: async (_a, id) => {
    const u = USUARIOS[id];
    return Boolean(u && !u.super && u.auth !== GERENTE && u.unidades.every((x) => x === "unidade-a"));
  },
  escoposNaoConcediveis: async (_a, escopos) => escopos.filter((e) => e.data_scope === "todos" || e.empresa_id || (e.unidade_id && e.unidade_id !== "unidade-a")),
  chavesDoPerfil: async (id) => PERFIS[id]?.chaves || [],
  perfil: async (id) => (PERFIS[id] ? { id, sistema: PERFIS[id].sistema } : null),
  usuariosDoPerfil: async (id) => PERFIS[id]?.usuarios || [],
};
const verificar = (acao, corpo, atorSuper = false) => verificarConcessao({ acao, ator: GERENTE, atorSuper, corpo, deps });

test("gerente NÃO se dá '*' nem dá '*' a um garçom (o furo que existia)", async () => {
  const r = await verificar("save-user-permissions", { id: "u-garcom-a", allowPermissions: ["*"] });
  assert.equal(r.codigo, CODIGOS.CONCESSAO_NEGADA);
  assert.deepEqual(r.detalhe.chaves, ["*"]);
  assert.equal((await verificar("save-user-permissions", { id: "u-gerente-a", allowPermissions: ["rh.employees.view"] })).codigo, CODIGOS.CONCESSAO_NEGADA, "nem a si mesmo, mesmo com chave que tem");
});

test("gerente concede o que tem, a quem gerencia", async () => {
  assert.equal(await verificar("save-user-permissions", { id: "u-garcom-a", allowPermissions: ["salao.tables.edit"], denyPermissions: ["*"] }), null);
});

test("criar usuário: perfil de administrador, escopo 'todos' ou outra unidade são recusados", async () => {
  assert.ok(await verificar("create-user", { user: { perfil_id: "p-admin", unidade_principal_id: "unidade-a" } }));
  assert.ok(await verificar("create-user", { user: { perfil_id: "p-garcom", unidade_principal_id: "unidade-a" }, scopes: [{ data_scope: "todos" }] }));
  assert.ok(await verificar("create-user", { user: { perfil_id: "p-garcom", unidade_principal_id: "unidade-b" } }));
  assert.ok(await verificar("create-user", { user: { perfil_id: "p-garcom" } }), "sem unidade não cria");
  assert.ok(await verificar("create-user", { user: { super_admin: true, unidade_principal_id: "unidade-a" } }));
  assert.equal(await verificar("create-user", { user: { perfil_id: "p-garcom", unidade_principal_id: "unidade-a" }, scopes: [{ data_scope: "unidade", unidade_id: "unidade-a" }] }), null);
});

test("editar usuário: fora do escopo, administrador geral ou a si mesmo são recusados", async () => {
  assert.ok(await verificar("update-user", { id: "u-gerente-b", user: {} }));
  assert.ok(await verificar("update-user", { id: "u-super", user: {} }));
  assert.ok(await verificar("update-user", { id: "u-gerente-a", user: { perfil_id: "p-admin" } }));
  assert.ok(await verificar("update-user", { id: "u-garcom-a", user: { perfil_id: "p-admin" } }), "promover o garçom a admin");
  assert.equal(await verificar("update-user", { id: "u-garcom-a", user: { perfil_id: "p-garcom", unidade_principal_id: "unidade-a" } }), null);
});

test("bloquear, redefinir senha e excluir exigem usuário gerenciável", async () => {
  for (const acao of ["set-user-status", "reset-password", "delete-user"]) {
    assert.ok(await verificar(acao, { id: "u-gerente-b" }), `${acao} fora do escopo`);
    assert.ok(await verificar(acao, { id: "u-super" }), `${acao} no administrador geral`);
    assert.equal(await verificar(acao, { id: "u-garcom-a" }), null);
  }
});

test("perfis: não cria com chave que não tem; não edita perfil do sistema, o próprio nem o de outra unidade", async () => {
  assert.ok(await verificar("save-profile", { profile: { nome: "Novo" }, permissions: ["financeiro.cashflow.view"] }));
  assert.equal(await verificar("save-profile", { profile: { nome: "Novo" }, permissions: ["salao.tables.view"] }), null);
  assert.ok(await verificar("save-profile", { profile: { id: "p-admin", nome: "x" }, permissions: [] }));
  assert.ok(await verificar("save-profile", { profile: { id: "p-do-gerente", nome: "x" }, permissions: ["rh.*"] }), "editar o próprio perfil");
  assert.ok(await verificar("save-profile", { profile: { id: "p-misto", nome: "x" }, permissions: [] }));
  assert.equal(await verificar("save-profile", { profile: { id: "p-misto", nome: "x" }, permissions: [], applyMode: "new_only" }), null, "nova versão não atinge quem já usa");
  assert.ok(await verificar("set-profile-status", { id: "p-admin", ativo: false }));
  assert.ok(await verificar("delete-profile", { id: "p-misto" }));
  assert.ok(await verificar("duplicate-profile", { id: "p-admin" }));
});

test("aplicar perfil: chaves concedíveis e todos os usuários gerenciáveis", async () => {
  assert.ok(await verificar("apply-profile", { profileId: "p-admin", userIds: ["u-garcom-a"] }));
  assert.ok(await verificar("apply-profile", { profileId: "p-garcom", userIds: ["u-garcom-a", "u-gerente-b"] }));
  assert.equal(await verificar("apply-profile", { profileId: "p-garcom", userIds: ["u-garcom-a"] }), null);
});

test("migração de legados só para administrador geral; administrador geral passa em tudo", async () => {
  assert.ok(await verificar("migrate-legacy", {}));
  assert.equal(await verificar("migrate-legacy", {}, true), null);
  assert.equal(await verificar("save-user-permissions", { id: "u-super", allowPermissions: ["*"] }, true), null);
});

test("listagem para não administrador: só quem ele gerencia, ele mesmo e dados ligados", async () => {
  const dados = {
    users: [{ id: "u-garcom-a", auth_user_id: "g" }, { id: "u-gerente-b", auth_user_id: "b" }, { id: "u-super", auth_user_id: "s" }, { id: "u-gerente-a", auth_user_id: GERENTE }],
    userPermissions: [{ usuario_id: "u-gerente-b", permission_key: "*" }, { usuario_id: "u-garcom-a", permission_key: "salao.*" }],
    scopes: [{ usuario_id: "u-gerente-b", unidade_id: "unidade-b" }],
    units: [{ id: "unidade-a" }, { id: "unidade-b" }],
    sectors: [{ id: "s1", unidade_id: "unidade-b" }], employees: [{ id: "f1", unidade_id: "unidade-b" }, { id: "f2", unidade_id: "unidade-a" }],
    accessLogs: [{ usuario_id: "u-super" }, { usuario_id: "u-garcom-a" }], legacyCount: 3,
  };
  const r = await filtrarListagem({ ator: GERENTE, atorSuper: false, atorUsuarioId: "u-gerente-a", dados, unidadesDoAtor: ["unidade-a"], deps });
  assert.deepEqual(r.users.map((u) => u.id), ["u-garcom-a", "u-gerente-a"]);
  assert.deepEqual(r.userPermissions.map((p) => p.usuario_id), ["u-garcom-a"]);
  assert.equal(r.scopes.length, 0);
  assert.deepEqual(r.units.map((u) => u.id), ["unidade-a"]);
  assert.deepEqual(r.employees.map((e) => e.id), ["f2"]);
  assert.deepEqual(r.accessLogs.map((l) => l.usuario_id), ["u-garcom-a"]);
  assert.equal((await filtrarListagem({ ator: "x", atorSuper: true, dados, unidadesDoAtor: ["*"], deps })).users.length, 4);
});
