import test from "node:test";
import assert from "node:assert/strict";
import { chaveDoNome, gruposRepetidos, nomeRepetido } from "./nomes-unicos.mjs";

const fichas = [
  { id: "1", nome_receita: "Farofa de alho (base)" },
  { id: "2", nome_receita: "Pudim de tapioca (base)" },
  { id: "3", nome_receita: "pudim de tapioca (base) " },
];

test("acha o mesmo nome sem acento, maiúscula ou espaço", () => {
  assert.equal(chaveDoNome("  Açúcar   Cristal "), "acucar cristal");
  assert.equal(nomeRepetido("farofa DE alho (base)", fichas, { campo: "nome_receita" })?.id, "1");
  assert.equal(nomeRepetido("Farofa de alho nova (base)", fichas, { campo: "nome_receita" }), null);
});

test("editar a própria ficha não acusa; renomear para um nome em uso acusa", () => {
  assert.equal(nomeRepetido("Farofa de alho (base)", fichas, { idAtual: "1", nomeOriginal: "Farofa de alho (base)", campo: "nome_receita" }), null);
  assert.equal(nomeRepetido("Farofa de alho (base)", fichas, { idAtual: "2", nomeOriginal: "Pudim de tapioca (base)", campo: "nome_receita" })?.id, "1");
  // repetido antigo: salvar sem mudar o nome continua possível
  assert.equal(nomeRepetido("Pudim de tapioca (base)", fichas, { idAtual: "2", nomeOriginal: "Pudim de tapioca (base)", campo: "nome_receita" }), null);
});

test("lista os grupos repetidos", () => {
  const g = gruposRepetidos(fichas, "nome_receita");
  assert.equal(g.length, 1);
  assert.equal(g[0].itens.length, 2);
  assert.equal(nomeRepetido("", fichas), null);
});
