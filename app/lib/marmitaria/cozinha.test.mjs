import test from "node:test";
import assert from "node:assert/strict";
import { baixasDoPreparo, conferencia, ehLimpeza, pedidosDaMarmitaria, planilhaDaCozinha, saldoProduzido, saldosDaMarmitaria, situacaoDaChegada, somarDias } from "./cozinha.mjs";

const hoje = "2026-11-05";

test("chegada: atrasado e hoje piscam; amanhã e depois só avisam", () => {
  assert.deepEqual(["2026-11-04", hoje, "2026-11-06", "2026-11-09", null].map((d) => situacaoDaChegada(d, hoje).id), ["atrasado", "hoje", "amanha", "depois", "sem_data"]);
  assert.equal(situacaoDaChegada(hoje, hoje).urgente, true);
  assert.equal(situacaoDaChegada("2026-11-06", hoje).urgente, false);
  assert.equal(situacaoDaChegada("2026-11-09", hoje).rotulo, "Chega em 09/11");
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
});

test("pedidos: só o que tem item da marmitaria, sem cancelados", () => {
  const compras = [{ id: "a", status: "rascunho", data_recebimento: "2026-11-06" }, { id: "b", status: "rascunho", data_recebimento: hoje }, { id: "c", status: "confirmada", data_recebimento: hoje }, { id: "d", status: "cancelada" }, { id: "e", status: "rascunho" }];
  const r = pedidosDaMarmitaria({ compras, itens: [{ compra_id: "a" }, { compra_id: "b" }, { compra_id: "c" }, { compra_id: "d" }], hoje });
  assert.deepEqual([r.aguardando.map((c) => c.id), r.recebidos.map((c) => c.id)], [["b", "a"], ["c"]]);
});

test("conferência: igual, a mais e a menos", () => {
  assert.deepEqual(conferencia(10, 10), { id: "igual", diferenca: 0 });
  assert.deepEqual(conferencia(10, 12.5), { id: "mais", diferenca: 2.5 });
  assert.deepEqual(conferencia(10, 7), { id: "menos", diferenca: -3 });
  assert.equal(conferencia(10, ""), null);
});

const estoques = [{ id: "m", slug: "marmitaria", nome: "Marmitaria" }, { id: "p", slug: "producao-marmitaria", nome: "Produção" }, { id: "c", slug: "cozinha", nome: "Cozinha" }];
const tomate = { id: "t", nome: "Tomate", unidade_medida: "kg" };
const cebola = { id: "ce", nome: "Cebola", unidade_medida: "kg" };
const molho = { id: "molho", nome_receita: "Molho de tomate", rendimento_porcoes: 5, rendimento_unidade: "kg", eh_base: true,
  fichas_ingredientes: [{ insumo_id: "t", insumos: tomate, quantidade: 4, unidade: "kg" }, { insumo_id: "ce", insumos: cebola, quantidade: 1, unidade: "kg" }] };
const insumos = new Map([["t", tomate], ["ce", cebola]]);

test("exclusivo: saldo da cozinha não conta para a marmitaria", () => {
  const saldos = saldosDaMarmitaria({ estoques, itensEstoque: [{ estoque_id: "c", insumo_id: "t", quantidade_atual: 100 }, { estoque_id: "m", insumo_id: "t", quantidade_atual: 10 }] });
  assert.deepEqual(saldos.get("t").map((l) => [l.estoque_id, l.saldo]), [["m", 10]]);
});

test("produzir 10 kg de molho baixa o dobro da ficha; sem saldo não baixa", () => {
  const saldos = saldosDaMarmitaria({ estoques, itensEstoque: [{ estoque_id: "m", insumo_id: "t", quantidade_atual: 20 }, { estoque_id: "m", insumo_id: "ce", quantidade_atual: 1 }, { estoque_id: "c", insumo_id: "ce", quantidade_atual: 50 }] });
  const r = baixasDoPreparo({ ficha: molho, quantidade: 10, fichas: [molho], insumos, saldos });
  assert.deepEqual(r.baixas.map((b) => [b.nome, b.quantidade]), [["Tomate", 8]]);
  assert.equal(r.faltas.length, 1);
  assert.match(r.faltas[0], /Cebola: precisa de 2 kg e tem 1/);
});

test("preciso de 100, tenho 50: faltam 50; o pronto atende hoje antes de amanhã", () => {
  const produzido = new Map([["f", { quantidade: 50 }]]);
  assert.deepEqual(planilhaDaCozinha({ planoHoje: [{ ficha_id: "f", necessario: 100 }], produzido }).hoje.map((l) => [l.tem, l.falta, l.pronto]), [[50, 50, false]]);
  const p = planilhaDaCozinha({ planoHoje: [{ ficha_id: "f", necessario: 30 }], planoAmanha: [{ ficha_id: "f", necessario: 40 }], produzido });
  assert.deepEqual([p.hoje[0].pronto, p.amanha[0].tem, p.amanha[0].falta], [true, 20, 20]);
});

test("mostra o pronto na unidade do subproduto", () => {
  const espelhoIns = { id: "im", nome: "Molho", unidade_medida: "kg", ficha_tecnica_id: "molho" };
  const m = saldoProduzido({ estoques, itensEstoque: [{ estoque_id: "p", insumo_id: "im", quantidade_atual: 7.5 }, { estoque_id: "m", insumo_id: "im", quantidade_atual: 99 }], insumos: new Map([["im", espelhoIns]]), fichas: [molho] });
  assert.deepEqual(m.get("molho"), { fichaId: "molho", nome: "Molho de tomate", unidade: "kg", quantidade: 7.5 });
});

test("reconhece produto de limpeza", () => {
  assert.equal(ehLimpeza({ departamento: "limpeza" }), true);
  assert.equal(ehLimpeza({ categoria: "Limpeza da marmitaria" }), true);
  assert.equal(ehLimpeza({ departamento: "cozinha", categoria: "Grãos" }), false);
});
