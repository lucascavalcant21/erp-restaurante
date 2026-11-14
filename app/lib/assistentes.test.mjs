// Nico (equipe) e Jhon (dono), decisão do dono em 14/11/2026.
// Rode: node --test app/lib/assistentes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { JHON, NICO, assistenteDaSessao, assistenteDoContexto, identidadeNoPrompt } from "./assistentes.mjs";

test("dono fala com o Jhon; funcionário e tablet falam com o Nico", () => {
  assert.equal(assistenteDaSessao({ gerenciado: true, super_admin: true }).nome, "Jhon");
  assert.equal(assistenteDaSessao({ gerenciado: true, tipo_acesso: "administrador", permissions: [] }), JHON);
  assert.equal(assistenteDaSessao({ gerenciado: false, papel: "admin" }), JHON);
  assert.equal(assistenteDaSessao({ gerenciado: true, tipo_acesso: "funcionario", permissions: ["cozinha.*"] }).nome, "Nico");
  assert.equal(assistenteDaSessao({ is_app: true, papel: "admin" }), NICO);
  assert.equal(assistenteDaSessao(null), NICO);
});

test("no servidor, o papel sai do contexto do banco", () => {
  assert.equal(assistenteDoContexto({ usuario: { superAdmin: true }, permissoes: [] }), JHON);
  assert.equal(assistenteDoContexto({ usuario: { perfil: "administrador-geral" }, permissoes: [] }), JHON);
  assert.equal(assistenteDoContexto({ usuario: { perfil: "cozinheiro" }, permissoes: ["cozinha.*"] }), NICO);
  assert.equal(assistenteDoContexto(null), NICO);
});

test("o Jhon sabe o que o Nico sabe; o Nico não entra na gestão", () => {
  assert.match(identidadeNoPrompt(JHON), /Jhon.*tudo o que o Nico.*sabe/s);
  assert.match(identidadeNoPrompt(NICO), /Nico.*NÃO fala de custo, CMV, margem/s);
});
