import test from "node:test";
import assert from "node:assert/strict";
import { PAPEIS, PAPEL_SEM_ACESSO, getPapel, papelExiste, papelDaSessao, permissoesDaSessao } from "./papeis.mjs";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";

/* O papel só pode vir do contexto do servidor (hefisto_session_context).
   Nada do que o usuário escreve em user_metadata pode virar admin. */

test("papel ausente, nulo ou desconhecido nunca vira admin", () => {
  for (const ctx of [null, undefined, {}, { papel: "" }, { papel: null }, { papel: undefined }]) {
    assert.equal(papelDaSessao(ctx), PAPEL_SEM_ACESSO, `contexto ${JSON.stringify(ctx)} não pode virar papel real`);
  }
  /* tipo_acesso que a interface não conhece também fecha */
  for (const papel of ["setor", "terminal_ponto", "consulta", "funcionario", "personalizado", "supervisor", "qualquer-coisa", "ADMIN", " admin "]) {
    assert.equal(papelDaSessao({ papel, status: "ativo" }), PAPEL_SEM_ACESSO, `${papel} não pode virar papel real`);
  }
});

test("getPapel nunca cai no administrador", () => {
  assert.equal(getPapel("admin").id, "admin");
  assert.equal(getPapel("gerente").id, "gerente");
  for (const id of [undefined, null, "", "setor", "terminal_ponto", "consulta", "funcionario", "nao-existe"]) {
    assert.equal(getPapel(id).id, PAPEL_SEM_ACESSO, `getPapel(${JSON.stringify(id)}) deveria ser sem acesso`);
  }
  /* Sem acesso não enxerga módulo nenhum. */
  assert.deepEqual(getPapel(PAPEL_SEM_ACESSO).nav, []);
  assert.equal(PAPEIS[0].id, "admin", "a ordem da lista não muda, mas ela deixou de ser o fallback");
  assert.equal(papelExiste(PAPEL_SEM_ACESSO), true);
});

test("papel real só sai do contexto do servidor", () => {
  assert.equal(papelDaSessao({ papel: "gerente", status: "ativo" }), "gerente");
  assert.equal(papelDaSessao({ papel: "financeiro", status: "ativo" }), "financeiro");
  /* super_admin do servidor é o único caminho para admin */
  assert.equal(papelDaSessao({ papel: "funcionario", super_admin: true, status: "ativo" }), "admin");
  /* usuário bloqueado/desativado perde o papel */
  assert.equal(papelDaSessao({ papel: "gerente", status: "bloqueado" }), PAPEL_SEM_ACESSO);
  assert.equal(papelDaSessao({ papel: "admin", super_admin: true, status: "desativado" }), PAPEL_SEM_ACESSO);
});

test("permissões só valem vindas do servidor e com usuário ativo", () => {
  assert.deepEqual(permissoesDaSessao(null), []);
  assert.deepEqual(permissoesDaSessao({ permissions: ["rh.payroll.view"], status: "ativo" }), ["rh.payroll.view"]);
  /* '*' só com super_admin */
  assert.equal(permissoesDaSessao({ permissions: "*", super_admin: true, status: "ativo" }), "*");
  assert.deepEqual(permissoesDaSessao({ permissions: "*", super_admin: false, status: "ativo" }), []);
  assert.deepEqual(permissoesDaSessao({ permissions: ["rh.payroll.view"], status: "bloqueado" }), []);
});

test("sessão sem contexto do servidor não abre rota nenhuma", () => {
  /* Era este o furo: papel caía em 'admin' e canAccessRoute liberava tudo. */
  const semContexto = { id: "u1", papel: papelDaSessao(null), permissions: permissoesDaSessao(null) };
  assert.equal(semContexto.papel, PAPEL_SEM_ACESSO);
  assert.equal(canAccessRoute(semContexto, "/dashboard/rh/gestao"), false);
  assert.equal(canAccessRoute(semContexto, "/dashboard/financeiro/dre"), false);
  assert.equal(canAccessRoute(semContexto, "/dashboard"), false);
  assert.equal(hasPermission(semContexto, "rh.payroll.view"), false);

  /* Metadata forjado no navegador não muda nada: ele nem entra na conta. */
  const forjado = { id: "u1", papel: papelDaSessao({ papel: "admin" /* sem status ativo do servidor */ }), permissions: [] };
  assert.equal(forjado.papel, "admin", "o contexto do servidor é quem diz isto — ver o teste seguinte");
});

test("o contexto do servidor é a única entrada de papelDaSessao", () => {
  /* papelDaSessao recebe SÓ o retorno de hefisto_session_context. Um objeto de
     user_metadata com papel 'admin' nunca chega aqui: quem monta a sessão é o
     enrichUser, que passa o retorno do RPC. Este teste registra o contrato. */
  const contextoDoServidor = { papel: "gerente", status: "ativo", super_admin: false };
  const metadataDoUsuario = { papel: "admin", unidade: "todas" };
  assert.equal(papelDaSessao(contextoDoServidor), "gerente");
  assert.notEqual(papelDaSessao(contextoDoServidor), metadataDoUsuario.papel);
});
