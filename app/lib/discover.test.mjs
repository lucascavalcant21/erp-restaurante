import test from "node:test";
import assert from "node:assert/strict";
import { gerarExperienciaPrato, INGREDIENTES_CULTURAIS } from "./server/discover.mjs";

test("gerarExperienciaPrato - detecção cultural e botânica de Pirarucu", () => {
  const pratoPirarucu = {
    id: "prato-1",
    nome_produto: "Pirarucu de Casaca com Banana-da-Terra e Farofa de Castanha",
    categoria: "Peixes Amazônicos",
    preco_venda: 98.0,
    descricao: "Lombo de pirarucu grelhado com molho de tucupi e castanha-do-pará."
  };

  const exp = gerarExperienciaPrato({ prato: pratoPirarucu });
  assert.equal(exp.ok, true);
  assert.ok(exp.componentes.length >= 2);

  // Deve conter Pirarucu e Castanha ou Tucupi
  const nomes = exp.componentes.map(c => c.ingrediente);
  assert.ok(nomes.some(n => n.includes("Pirarucu")));
  assert.ok(nomes.some(n => n.includes("Castanha") || n.includes("Tucupi")));

  // Verifica metadados científicos e botânicos
  const compPirarucu = exp.componentes.find(c => c.ingrediente.includes("Pirarucu"));
  assert.equal(compPirarucu.nomeCientifico, "Arapaima gigas");
  assert.ok(compPirarucu.hotspot.x > 0);
  assert.ok(compPirarucu.hotspot.y > 0);
  assert.match(compPirarucu.historia, /gigante das águas doces/i);
});

test("gerarExperienciaPrato - detecção de cortes nobres Angus", () => {
  const pratoCarne = {
    id: "prato-2",
    nome_produto: "Ancho Angus Grelhado na Brasa com Chimichurri",
    categoria: "Carnes Nobres",
    preco_venda: 110.0,
    descricao: "Corte nobre angus de alta maciez e marmoreio."
  };

  const exp = gerarExperienciaPrato({ prato: pratoCarne });
  assert.equal(exp.ok, true);
  assert.ok(exp.componentes.length >= 1);

  const compCarne = exp.componentes.find(c => c.ingrediente.includes("Angus") || c.ingrediente.includes("Nobre"));
  assert.ok(compCarne);
  assert.match(compCarne.nomeCientifico, /Bos taurus/i);
});

test("gerarExperienciaPrato - fallback gracioso para pratos autorais gerais", () => {
  const pratoGeral = {
    id: "prato-3",
    nome_produto: "Sobremesa Especial de Frutas da Estação",
    categoria: "Sobremesas",
    preco_venda: 32.0,
    descricao: "Seleção de frutas frescas com calda artesanal."
  };

  const exp = gerarExperienciaPrato({ prato: pratoGeral });
  assert.equal(exp.ok, true);
  assert.ok(exp.componentes.length >= 1);
  assert.equal(exp.componentes[0].ingrediente, "Sobremesa Especial de Frutas da Estação");
});
