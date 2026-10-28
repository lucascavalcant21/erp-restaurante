// Ícones do cardápio sem foto: o nome decide, a seção completa, nada inventado.
import test from "node:test";
import assert from "node:assert/strict";
import { temaDoIcone, temaDoPrato, iniciais } from "./cardapio-icones.mjs";

test("seções reais do banco (19/10): cada uma com o seu ícone", () => {
  assert.equal(temaDoIcone("Pratos Principais"), "prato");
  assert.equal(temaDoIcone("Drinks", "bebida"), "drink");
  assert.equal(temaDoIcone("Sobremesas", "sobremesa"), "sobremesa");
  assert.equal(temaDoIcone("Marmitas Tradicionais"), "marmita");
  assert.equal(temaDoIcone("Entradas"), "entrada");
  assert.equal(temaDoIcone("Prato principal 1 pessoa"), "prato");
});

test("pratos: o nome manda, com acento ou sem, e a ordem resolve a dúvida", () => {
  assert.equal(temaDoIcone("Pirarucu empanado"), "peixe");
  assert.equal(temaDoIcone("Caldo de peixe"), "sopa", "caldo vem antes de peixe");
  assert.equal(temaDoIcone("Moqueca banana da terra - 2P"), "peixe");
  assert.equal(temaDoIcone("Maniçoba"), "carne");
  assert.equal(temaDoIcone("Creme de cupuaçu - 200g"), "sobremesa");
  assert.equal(temaDoIcone("Caipirinha de jambu"), "drink");
  assert.equal(temaDoIcone("Café expresso"), "cafe");
  assert.equal(temaDoIcone("Chopp Pilsen 300ml"), "cerveja");
  assert.equal(temaDoIcone("Adicional - Camarão seco"), "adicional", "adicional vem antes do ingrediente");
  assert.equal(temaDoIcone("Bolinho de banana da terra"), "entrada");
});

test("sem pista no nome: o papel da seção decide", () => {
  assert.equal(temaDoIcone("Especiais", "bebida"), "drink");
  assert.equal(temaDoIcone("Especiais", "sobremesa"), "sobremesa");
  assert.equal(temaDoIcone("Especiais"), "prato");
  assert.equal(temaDoIcone(null), "prato");
  const drinks = { nome: "Drinks", papel: "bebida" };
  assert.equal(temaDoPrato({ nome: "Jambu Tonic da casa" }, drinks), "drink");
  assert.equal(temaDoPrato({ nome: "Filhote na brasa" }, drinks), "peixe", "o nome do prato vence a seção");
  assert.equal(temaDoPrato({ nome: "Especial do chef" }, null), "prato");
});

test("iniciais da casa para o selo sem logo", () => {
  assert.equal(iniciais("Seldeestrela"), "S");
  assert.equal(iniciais("Sel de Estrela"), "SE");
  assert.equal(iniciais("casa da vó"), "CV");
  assert.equal(iniciais(""), "?");
});
