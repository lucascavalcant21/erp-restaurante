import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { GRUPOS_CONFIG, SECOES_CONFIG, gruposVisiveis, pendenciasConfig, resumoDoItem, cepCompleto, mascaraCep, pinFraco } from "./configuracoes-hub.mjs";
import { canAccessRoute } from "./permissions-catalog.mjs";

test("toda linha tem destino: seção da tela ou página que existe", () => {
  for (const g of GRUPOS_CONFIG) for (const i of g.itens) {
    assert.ok(i.secao || i.href, i.id);
    if (i.href) assert.ok(existsSync(`app${i.href}/page.js`), `${i.href} não existe`);
  }
  assert.deepEqual(new Set(SECOES_CONFIG).size, SECOES_CONFIG.length);
});

test("sem permissão a linha some; grupo vazio some", () => {
  const sessao = { gerenciado: true, permissions: ["configuracoes.store.view"] };
  const g = gruposVisiveis((r) => canAccessRoute(sessao, r, ""));
  const ids = g.flatMap((x) => x.itens.map((i) => i.id));
  assert.ok(ids.includes("empresa"));
  assert.ok(!ids.includes("usuarios"));
  assert.equal(gruposVisiveis(() => false).length, 0);
});

test("falta ajustar: PIN de fábrica primeiro, CEP com 7 números, CNPJ ausente", () => {
  const p = pendenciasConfig({ unidade: { cep: "8584820", cnpj: "" }, pins: { pin_gerente: "1234" } });
  assert.deepEqual(p.map((x) => x.secao), ["pin", "empresa", "empresa"]);
  assert.match(p[0].texto, /fábrica/);
  assert.match(p[1].texto, /7 de 8/);
  assert.deepEqual(pendenciasConfig({ unidade: { cep: "85848-200", cnpj: "42.021.920/0001-36" }, pins: { pin_gerente: "8361" } }), []);
});

test("resumo de cada linha e máscaras", () => {
  assert.equal(resumoDoItem("empresa", { unidade: { nome: "Seldeestrela", cidade: "Foz do Iguaçu", uf: "PR" } }), "Seldeestrela · Foz do Iguaçu/PR");
  assert.equal(resumoDoItem("cargos", { cargos: [{ eh_supervisor: true }, {}] }), "2 funções · 1 de supervisão");
  assert.equal(resumoDoItem("pin", { pins: { pin_gerente: "1234" } }), "Troque: PIN fácil");
  assert.equal(resumoDoItem("ponto", {}), "…");
  assert.equal(mascaraCep("85848200"), "85848-200");
  assert.equal(cepCompleto("8584820"), false);
  assert.equal(pinFraco("0000"), true);
});
