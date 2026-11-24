// Simulador de vendas por app e comparativo (17/11/2026). TESTADO LOCAL.
import test from "node:test";
import assert from "node:assert/strict";
import { compararApps, mixIgual } from "./comparar-apps.mjs";

// linha do Cardápio já calculada num app: receita, custo, impostos+taxas e sobra por pedido
const linha = (id, nome, receita, custo, taxas) => ({ id, nome, lucro: receita - custo - taxas, sim: { com: { valido: true, receita, custo, tributos: 0, variaveis: taxas, margemContribuicao: receita - custo - taxas } } });
const semPreco = (id, nome) => ({ id, nome, lucro: null, sim: { com: { valido: false } } });
const porCanal = [
  { canal: { id: "ifood", nome: "iFood" }, linhas: [linha("frango", "Frango", 30, 12, 8), linha("parm", "Parmegiana", 35, 14, 9)] },
  { canal: { id: "99food", nome: "99Food" }, linhas: [linha("frango", "Frango", 28, 12, 4), linha("parm", "Parmegiana", 33, 14, 4.5)] },
  { canal: { id: "balcao", nome: "Balcão" }, linhas: [linha("frango", "Frango", 25, 12, 1), semPreco("parm", "Parmegiana")] },
];
const quantidades = { frango: 10, parm: 5 };
const embutidos = { cmoMes: 3000, fixosMes: 2000 };

test("as mesmas vendas em cada app: sobra, taxas e melhor app só entre os completos", () => {
  const c = compararApps({ porCanal, quantidades, diasMes: 25, embutidos });
  const ifood = c.apps.find((a) => a.id === "ifood");
  const nove = c.apps.find((a) => a.id === "99food");
  // iFood: (10×10 + 5×12) = 160/dia × 25 = 4000; 99Food: (10×12 + 5×14,5) = 192,5 × 25 = 4812,5
  assert.equal(ifood.sobraMes, 4000);
  assert.equal(nove.sobraMes, 4812.5);
  assert.equal(ifood.lucroMes, -1000);
  assert.equal(nove.lucroMes, -187.5);
  assert.equal(ifood.faturamentoMes, 11875);
  assert.equal(ifood.pedidosDia, 15);
  assert.equal(c.melhor.id, "99food");
  assert.equal(ifood.diferencaParaMelhor, -812.5);
  const balcao = c.apps.find((a) => a.id === "balcao");
  assert.deepEqual(balcao.semPreco, ["Parmegiana"]);
  assert.equal(balcao.completo, false);
  assert.equal(balcao.diferencaParaMelhor, null, "sem preço de tudo não entra no ranking");
});

test("mistura: 60% iFood, 40% 99Food, fixos uma vez só", () => {
  const c = compararApps({ porCanal, quantidades, diasMes: 25, embutidos, mix: { ifood: 60, "99food": 40 } });
  assert.equal(c.mistura.sobraMes, 4325); // 4000×0,6 + 4812,5×0,4
  assert.equal(c.mistura.lucroMes, -675);
  assert.equal(c.mistura.fechaEm100, true);
  assert.equal(c.mistura.ganhoNoMelhor, 487.5);
  assert.deepEqual(c.mistura.semPreco, []);
});

test("mistura com app sem preço avisa; sem fixos, lucro nulo (nunca zero)", () => {
  const c = compararApps({ porCanal, quantidades, diasMes: 25, embutidos: null, mix: { ifood: 50, balcao: 50 } });
  assert.deepEqual(c.mistura.semPreco, ["Parmegiana"]);
  assert.equal(c.mistura.lucroMes, null);
  assert.equal(c.faltandoFixos, true);
  assert.equal(c.apps[0].lucroMes, null);
});

test("mistura inicial em partes iguais somando 100", () => {
  assert.deepEqual(mixIgual([{ id: "a" }, { id: "b" }, { id: "c" }]), { a: 34, b: 33, c: 33 });
});
