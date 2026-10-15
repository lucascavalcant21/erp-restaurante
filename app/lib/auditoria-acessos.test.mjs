// Histórico legível das alterações de acesso. node --test app/lib/auditoria-acessos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { resumirAlteracao, historicoDoUsuario } from "./auditoria-acessos.mjs";

const ctx = { users: [{ id: "u1", auth_user_id: "a-dono", nome: "Dono", perfil_id: "p1" }], profiles: [{ id: "p1", nome: "Gerente" }, { id: "p2", nome: "Caixa" }] };

test("alteração de usuário: só os campos que mudaram, com nomes legíveis", () => {
  const r = resumirAlteracao({ id: 1, alvo_tipo: "usuario", alvo_id: "u1", evento: "atualizado", ator_auth_user_id: "a-dono",
    antes: { nome: "Ana", perfil_id: "p2", valid_until: null, updated_at: "x", allowed_days: [0,1,2,3,4,5,6], failed_attempts: 1 },
    depois: { nome: "Ana", perfil_id: "p1", valid_until: "2026-11-01", updated_at: "y", allowed_days: [1,2,3,4,5], failed_attempts: 3 } }, ctx);
  assert.equal(r.evento, "Alterado");
  assert.equal(r.ator, "Dono");
  assert.deepEqual(r.mudancas, [
    { campo: "Perfil", antes: "Caixa", depois: "Gerente" },
    { campo: "Acesso até", antes: "—", depois: "2026-11-01" },
    { campo: "Dias permitidos", antes: "todos", depois: "seg, ter, qua, qui, sex" },
  ]);
});

test("permissões individuais: concedidas, negadas e removidas", () => {
  const r = resumirAlteracao({ id: 2, alvo_tipo: "usuario", evento: "permissoes_atualizadas",
    antes: [{ permission_key: "financeiro.cashflow.view", effect: "allow" }, { permission_key: "rh.payroll.view", effect: "deny" }],
    depois: [{ permission_key: "financeiro.cashflow.view", effect: "allow" }, { permission_key: "estoque.items.edit", effect: "allow" }] }, ctx);
  assert.deepEqual(r.mudancas, [
    { campo: "Concedida", antes: "—", depois: "estoque.items.edit" },
    { campo: "Negação removida", antes: "rh.payroll.view", depois: "—" },
  ]);
  assert.equal(r.ator, "sistema");
});

test("perfil: permissões incluídas e retiradas; ator fora do escopo não é identificado", () => {
  const r = resumirAlteracao({ id: 3, alvo_tipo: "perfil", evento: "atualizado", ator_auth_user_id: "a-outro",
    antes: { permissions: ["a.b.view", "c.d.view"] }, depois: { permissions: ["a.b.view", "e.f.edit"] } }, ctx);
  assert.deepEqual(r.mudancas, [{ campo: "Permissão incluída", antes: "—", depois: "e.f.edit" }, { campo: "Permissão retirada", antes: "c.d.view", depois: "—" }]);
  assert.match(r.ator, /fora do seu escopo/);
});

test("histórico do usuário: o dele e o do perfil que ele usa, mais recente primeiro", () => {
  const logs = [
    { id: 1, alvo_tipo: "usuario", alvo_id: "u1", evento: "criado", created_at: "2026-10-01" },
    { id: 2, alvo_tipo: "perfil", alvo_id: "p1", evento: "atualizado", created_at: "2026-10-05", antes: { permissions: [] }, depois: { permissions: ["x.y.view"] } },
    { id: 3, alvo_tipo: "perfil", alvo_id: "p2", evento: "atualizado", created_at: "2026-10-06" },
    { id: 4, alvo_tipo: "usuario", alvo_id: "u9", evento: "atualizado", created_at: "2026-10-07" },
  ];
  const h = historicoDoUsuario(logs, ctx.users[0], ctx);
  assert.deepEqual(h.map((x) => [x.id, x.doPerfil]), [[2, true], [1, false]]);
  assert.deepEqual(historicoDoUsuario(undefined, ctx.users[0], ctx), []);
});
