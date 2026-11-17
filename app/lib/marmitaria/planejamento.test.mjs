// Produção do dia pelo Jhon (HDEV-015). TESTADO LOCAL (funções puras).
import test from "node:test";
import assert from "node:assert/strict";
import { lerPedidoDeProducao, contaDaProducao, fichaDaFrase, estoqueDasCoisas, lucroDoPronto, dataDoPedido, singular } from "./planejamento.mjs";

const ins = (id, nome, un, extra = {}) => [id, { id, nome, unidade_medida: un, custo_unitario: extra.custo ?? 10, ...extra }];
const insumos = new Map([
  ins("frango", "Filé de frango", "kg", { custo: 20 }), ins("farinha", "Farinha de rosca", "kg", { custo: 8 }), ins("leite", "Leite", "L", { custo: 5 }),
  ins("pote", "Molho de tomate (pote)", "un", { custo: 3 }), ins("alho", "Alho", "kg"), ins("sal", "Sal", "kg", { custo: 2 }), ins("acucar", "Açúcar", "kg", { custo: 4 }),
  ins("queijo", "Queijo muçarela", "kg", { custo: 35 }), ins("oleo", "Óleo de soja", "L", { custo: 8 }), ins("agua", "Água", "L", { custo: 0.01 }),
  ins("emp-est", "Frango empanado", "un", { ficha_tecnica_id: "emp" }), ins("molho-est", "Molho de tomate da casa", "kg", { ficha_tecnica_id: "molho" }),
  ins("bat80", "Batata porcionada 80 g", "un", { ficha_tecnica_id: "bat" }), ins("batata", "Batata inglesa", "kg"),
]);
const fi = (insumo_id, quantidade) => ({ insumo_id, quantidade });
const sub = (subficha_id, quantidade) => ({ subficha_id, quantidade });
const fichas = [
  { id: "emp", nome_receita: "Frango empanado", eh_base: true, rendimento_porcoes: 10, rendimento_unidade: "un", fichas_ingredientes: [fi("frango", 0.64), fi("farinha", 0.3), fi("leite", 0.2)] },
  { id: "molho", nome_receita: "Molho de tomate da casa", eh_base: true, rendimento_porcoes: 5, rendimento_unidade: "kg", fichas_ingredientes: [fi("pote", 10), fi("alho", 0.1), fi("sal", 0.05), fi("acucar", 0.05)] },
  { id: "parm", nome_receita: "Parmegiana", eh_base: true, rendimento_porcoes: 1, rendimento_unidade: "un", fichas_ingredientes: [sub("emp", 1), sub("molho", 0.1), fi("queijo", 0.03)] },
  { id: "limp", nome_receita: "Limpeza das fritadeiras", departamento: "limpeza", rendimento_porcoes: 1, rendimento_unidade: "vez", fichas_ingredientes: [fi("oleo", 18), fi("sal", 0.5), fi("agua", 10)] },
  { id: "bat", nome_receita: "Batata porcionada 80 g", eh_base: true, rendimento_porcoes: 10, rendimento_unidade: "un", fichas_ingredientes: [fi("batata", 0.8)] },
  { id: "m1", nome_receita: "Marmita parmegiana com fritas", departamento: "marmitaria", rendimento_porcoes: 1, fichas_ingredientes: [sub("emp", 1), sub("molho", 0.1)] },
];
const espelho = new Map([["emp", "emp-est"], ["molho", "molho-est"], ["bat", "bat80"]]);
const saldo = new Map([["molho-est", 2], ["frango", 5], ["emp-est", 120], ["bat80", 300], ["batata", 12]]);
const PEDIDO = "Jhon, amanhã precisamos produzir 300 filés de frango empanado. Com esses 300, 150 vão ser parmegianas. Amanhã é dia de limpar as fritadeiras.";

test("palavras: plural e ficha citada", () => {
  assert.equal(singular("filés"), "file");
  assert.equal(singular("parmegianas"), "parmegiana");
  assert.equal(fichaDaFrase(fichas, "filés de frango empanado")?.id, "emp");
  assert.equal(fichaDaFrase(fichas, "parmegianas")?.id, "parm");
  assert.equal(dataDoPedido("amanhã", "2026-11-17").data, "2026-11-18");
  assert.equal(dataDoPedido("hoje vamos", "2026-11-17").data, "2026-11-17");
});

test("lê o pedido do dono: dois alvos, limpeza e a data", () => {
  const p = lerPedidoDeProducao(PEDIDO, { fichas, hoje: "2026-11-17" });
  assert.equal(p.data, "2026-11-18");
  assert.deepEqual(p.alvos.map((a) => [a.ficha.id, a.quantidade]), [["emp", 300], ["parm", 150]]);
  assert.equal(p.limpezas.length, 1);
  assert.equal(p.limpezas[0].titulo, "Limpar as fritadeiras");
  assert.equal(p.limpezas[0].ficha?.id, "limp");
  assert.deepEqual(p.semFicha, []);
});

test("a conta: frango, farinha e leite dos 300; molho a fabricar descontando o estoque; parmegiana não pede empanado a mais", () => {
  const p = lerPedidoDeProducao(PEDIDO, { fichas, hoje: "2026-11-17" });
  const alvos = [...p.alvos, ...p.limpezas.filter((l) => l.ficha).map((l) => ({ ficha: l.ficha, quantidade: 1, vezes: 1, limpeza: true }))];
  const c = contaDaProducao({ alvos, fichas, marmitas: new Map(), insumos, saldo, espelho });
  const emp = c.porAlvo.find((a) => a.fichaId === "emp");
  assert.deepEqual(emp.itens.map((i) => [i.nome, i.quantidade, i.unidade]), [["Filé de frango", 19.2, "kg"], ["Farinha de rosca", 9, "kg"], ["Leite", 6, "L"]]);
  const parm = c.porAlvo.find((a) => a.fichaId === "parm");
  assert.deepEqual(parm.itens.map((i) => [i.nome, i.quantidade]), [["Frango empanado", 150], ["Molho de tomate da casa", 15], ["Queijo muçarela", 4.5]]);
  // molho: precisa 15 kg, tem 2, fabricar 13 kg (2,6 receitas)
  assert.deepEqual(c.fabricar.map((f) => [f.nome, f.necessario, f.temNoEstoque, f.produzir, f.lotes]), [["Molho de tomate da casa", 15, 2, 13, 2.6]]);
  const item = (id) => c.itens.find((i) => i.insumo_id === id);
  assert.equal(item("frango").necessario, 19.2);
  assert.equal(item("frango").comprar, 14.2, "tem 5 kg de frango");
  assert.equal(item("pote").necessario, 26);
  assert.equal(item("alho").necessario, 0.26);
  assert.equal(item("acucar").necessario, 0.13);
  assert.equal(item("oleo").necessario, 18, "limpeza das fritadeiras");
  assert.equal(r(item("sal").necessario), 0.63, "sal do molho + da limpeza");
  assert.ok(!c.itens.some((i) => i.insumo_id === "emp-est"), "o empanado da parmegiana sai dos 300 planejados");
  assert.equal(c.porAlvo.find((a) => a.fichaId === "limp").limpeza, true);
});
const r = (v) => Math.round(v * 100) / 100;

test("ficha sem rendimento: aviso, sem conta inventada", () => {
  const sem = fichas.map((f) => (f.id === "emp" ? { ...f, rendimento_porcoes: null } : f));
  const c = contaDaProducao({ alvos: [{ ficha: sem[0], quantidade: 300 }], fichas: sem, insumos, saldo, espelho });
  assert.match(c.avisos.join(" "), /sem rendimento/);
  assert.equal(c.itens.length, 0);
});

test("pedido sem ficha cadastrada volta em semFicha", () => {
  const p = lerPedidoDeProducao("amanhã produzir 50 coxinhas", { fichas, hoje: "2026-11-17" });
  assert.deepEqual(p.semFicha.map((s) => s.quantidade), [50]);
});

test("estoque das coisas citadas: empanado, molho, batata porcionada e não porcionada", () => {
  const e = estoqueDasCoisas({ texto: "quanto eu tenho de frango empanado no estoque, de molho, de batata porcionada em 80 g e de batata não porcionada", insumos, saldo, fichas });
  const nomes = e.map((x) => `${x.nome}=${x.quantidade}`);
  assert.ok(nomes.includes("Frango empanado=120"));
  assert.ok(nomes.includes("Batata porcionada 80 g=300"));
  assert.ok(nomes.includes("Batata inglesa=12"));
  assert.ok(nomes.includes("Molho de tomate da casa=2"));
  assert.equal(e.find((x) => x.nome === "Frango empanado").preparo, true);
});

test("lucro do pronto: quantas marmitas dá e quanto ganha (ESTIMATIVA)", () => {
  const marmitas = [{ id: "m1", nome_receita: "Marmita parmegiana com fritas", itens: [sub("emp", 1), sub("molho", 0.1)] }, { id: "m2", nome_receita: "Marmita de bife", itens: [fi("frango", 0.2)] }];
  const u = lucroDoPronto({ fichaId: "emp", quantidade: 120, marmitas, raioX: () => ({ valido: true, lucro: 6.5, canal: "iFood", preco: 29.9, faltando: [] }) });
  assert.deepEqual(u.map((x) => [x.marmita, x.possiveis, x.lucroTotal]), [["Marmita parmegiana com fritas", 120, 780]]);
  const sem = lucroDoPronto({ fichaId: "emp", quantidade: 120, marmitas, raioX: () => ({ valido: false, motivo: "sem preço" }) });
  assert.equal(sem[0].lucroTotal, null);
});
