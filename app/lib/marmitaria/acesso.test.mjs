import test from "node:test";
import assert from "node:assert/strict";
import { destinoDaSaida, unidadeForaDaMarmitaria, ehRotaDaMarmitaria, gravarEntrada, lerEntrada, limparEntrada, rotaBloqueada, senhaValida, textoDaSenha } from "./acesso.mjs";

const armazem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test("senha de 4 a 8 números", () => {
  assert.deepEqual(["123", "1234", "12345678", "123456789", "12a4", null].map(senhaValida), [false, true, true, false, false, false]);
});

test("dentro, só as telas da marmitaria", () => {
  assert.equal(ehRotaDaMarmitaria("/dashboard/marmitaria"), true);
  assert.equal(ehRotaDaMarmitaria("/dashboard/marmitaria/estoque"), true);
  assert.equal(ehRotaDaMarmitaria("/dashboard/marmitariax"), false);
  assert.equal(rotaBloqueada(true, "/dashboard/financeiro"), true);
  assert.equal(rotaBloqueada(true, "/dashboard/marmitaria/marmitas"), false);
  assert.equal(rotaBloqueada(false, "/dashboard/financeiro"), false);
});

test("lembra de onde veio e aguenta armazenamento quebrado", () => {
  const a = armazem();
  assert.equal(lerEntrada(a), null);
  gravarEntrada(a, "seldeestrela");
  assert.deepEqual(lerEntrada(a), { unidadeAnterior: "seldeestrela" });
  limparEntrada(a);
  assert.equal(lerEntrada(a), null);
  assert.equal(lerEntrada({ getItem: () => { throw new Error("x"); } }), null);
  assert.equal(lerEntrada({ getItem: () => "{quebrado" }), null);
});

test("mensagem da senha em bom português", () => {
  assert.equal(textoDaSenha("Senha incorreto. Restam 4 tentativa(s)."), "Senha incorreta. Restam 4 tentativa(s).");
  assert.equal(textoDaSenha("Senha incorreto. O Senha ficou bloqueado por 15 minutos."), "Senha incorreta. A senha ficou bloqueada por 15 minutos.");
  assert.equal(textoDaSenha("Senha bloqueado por excesso de tentativas."), "Senha bloqueada por excesso de tentativas.");
});

test("a porta da marmitaria abre para qualquer sessão; o resto segue a permissão", async () => {
  const { canAccessRoute } = await import("../permissions-catalog.mjs");
  const sessao = { papel: "funcionario", permissions: [] };
  assert.equal(canAccessRoute(sessao, "/dashboard/marmitaria"), true);
  assert.equal(canAccessRoute(sessao, "/dashboard/marmitaria/estoque/cozinha"), true);
  assert.equal(canAccessRoute(sessao, "/dashboard/marmitariax"), false);
  assert.equal(canAccessRoute(sessao, "/dashboard/financeiro"), false);
  assert.equal(canAccessRoute(null, "/dashboard/marmitaria"), false);
});

test("depois da senha, segue só para tela interna", () => {
  assert.equal(destinoDaSaida("/dashboard/rh"), "/dashboard/rh");
  assert.equal(destinoDaSaida("/dashboard/rh/extra?mes=11"), "/dashboard/rh/extra?mes=11");
  assert.equal(destinoDaSaida("/dashboard/marmitaria"), "/dashboard");
  assert.equal(destinoDaSaida("/dashboard/marmitaria/equipe"), "/dashboard");
  for (const ruim of ["", null, "https://fora.com", "//fora.com", "/dashboard//fora.com", "/login", "/dashboardx"]) assert.equal(destinoDaSaida(ruim), "/dashboard");
});

test("fora da senha, nunca fica na marmitaria", () => {
  const unidades = [{ id: "marmitaria" }, { id: "seldeestrela" }];
  assert.equal(unidadeForaDaMarmitaria(unidades, "marmitaria", "marmitaria"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, null, "marmitaria"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, "seldeestrela"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, "apagada", "seldeestrela"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria([...unidades, { id: "outra" }], "outra"), "outra");
  assert.equal(unidadeForaDaMarmitaria([{ id: "marmitaria" }], "marmitaria"), "marmitaria");
  assert.equal(unidadeForaDaMarmitaria([]), "");
});
