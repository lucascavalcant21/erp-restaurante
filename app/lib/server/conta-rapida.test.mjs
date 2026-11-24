import test from "node:test";
import assert from "node:assert/strict";
import { perfilDaContaRapida, unidadeDaContaRapida } from "./conta-rapida.mjs";
import { contaRapidaPorId } from "../contas-rapidas.mjs";

function bancoFalso({ unidades = [], perfil = null } = {}) {
  const inseridos = [];
  const consulta = (tabela) => {
    const q = {
      filtro: {},
      select: () => q,
      eq: (c, v) => { q.filtro[c] = v; return q; },
      limit: () => Promise.resolve({ data: unidades }),
      maybeSingle: async () => (tabela === "unidades"
        ? { data: unidades.find((u) => u.id === q.filtro.id) || null }
        : { data: perfil }),
      insert: (linha) => { inseridos.push(linha); return { select: () => ({ single: async () => ({ data: { id: "novo", ...linha } }) }) }; },
    };
    return q;
  };
  return { from: consulta, inseridos };
}

test("unidade vem do cadastro de quem cria", async () => {
  const db = bancoFalso({ unidades: [{ id: "a" }, { id: "b" }] });
  assert.equal((await unidadeDaContaRapida(db, { unidade_principal_id: "b" })).id, "b");
});

test("sem unidade no cadastro, só super admin de casa com uma unidade", async () => {
  assert.equal(await unidadeDaContaRapida(bancoFalso({ unidades: [{ id: "a" }] }), {}), null);
  assert.equal((await unidadeDaContaRapida(bancoFalso({ unidades: [{ id: "a" }] }), { super_admin: true })).id, "a");
  assert.equal(await unidadeDaContaRapida(bancoFalso({ unidades: [{ id: "a" }, { id: "b" }] }), { super_admin: true }), null);
});

test("unidade aberta na tela vale se quem cria tem acesso", async () => {
  const db = bancoFalso({ unidades: [{ id: "a" }, { id: "b" }] });
  // super admin com várias unidades e sem unidade no cadastro (o erro do dono)
  assert.equal((await unidadeDaContaRapida(db, { super_admin: true }, "b")).id, "b");
  // sem acesso à pedida: cai na unidade do cadastro
  db.from = ((orig) => (t) => { const q = orig(t); if (t === "usuario_escopos") { q.eq = () => Promise.resolve({ data: [{ unidade_id: "a", data_scope: "setor" }] }); } return q; })(db.from);
  assert.equal((await unidadeDaContaRapida(db, { id: "u1", unidade_principal_id: "a" }, "b")).id, "a");
  assert.equal((await unidadeDaContaRapida(db, { id: "u1", unidade_principal_id: "a" }, "a")).id, "a");
});

test("perfil já existente não é alterado", async () => {
  const db = bancoFalso({ perfil: { id: "p1" } });
  let gravou = false;
  const r = await perfilDaContaRapida(db, contaRapidaPorId("chefe-bar"), { autorId: "u", gravarPermissoes: async () => { gravou = true; }, auditar: async () => {} });
  assert.equal(r.id, "p1");
  assert.equal(gravou, false);
  assert.equal(db.inseridos.length, 0);
});

test("perfil novo nasce com as permissões do catálogo e fica auditado", async () => {
  const db = bancoFalso();
  const chamadas = [];
  const modelo = contaRapidaPorId("chefe-bar");
  await perfilDaContaRapida(db, modelo, { autorId: "u", gravarPermissoes: async (id) => chamadas.push(["perm", id]), auditar: async (id) => chamadas.push(["audit", id]) });
  assert.equal(db.inseridos[0].codigo, "conta-chefe-bar");
  assert.deepEqual(chamadas, [["perm", "novo"], ["audit", "novo"]]);
});
