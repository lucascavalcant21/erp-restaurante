// Rode: node --test app/lib/comandas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { definirObservacao, estadoDaMesa, itensParaEnviar, limparNome, mudarQuantidade, numeroDaMesa, ordenarMesas, pessoasDaComanda, resumoPorPessoa, somarAoRascunho, tempoDaMesa, totalDaComanda } from "./comandas.mjs";

const item = (valor, qtd, pessoa = null, status = "pendente") => ({ valor_unitario: valor, quantidade: qtd, pessoa, status_kds: status });

test("total ignora item cancelado e não perde centavos", () => {
  assert.equal(totalDaComanda([item(0.1, 3), item(0.2, 1), item(50, 2, null, "cancelado")]), 0.5);
  assert.equal(totalDaComanda([]), 0);
});

test("resumo por pessoa soma a conta inteira, com a mesa por último", () => {
  const itens = [item(10, 1), item(20, 2, "Ana"), item(5, 1, "Bia"), item(7, 1, " ana "), item(9, 1, "Bia", "cancelado")];
  const r = resumoPorPessoa(itens);
  assert.deepEqual(r.map((g) => g.pessoa), ["Ana", "Bia", "Mesa"]);
  assert.equal(r[0].total, 47);
  assert.equal(r.reduce((t, g) => t + g.total, 0), totalDaComanda(itens));
});

test("pessoas não repetem, com ou sem maiúscula", () => {
  assert.deepEqual(pessoasDaComanda([item(1, 1, "Ana"), item(1, 1, "ANA"), item(1, 1)], ["Bia", "Mesa", "  "]), ["Ana", "Bia"]);
  assert.equal(limparNome("  Maria   Clara "), "Maria Clara");
  assert.equal(limparNome("x".repeat(50)).length, 40);
});

test("rascunho junta o igual e separa pessoa e observação", () => {
  const p = { id: "p1", nome_produto: "Suco", preco_venda: 12 };
  let r = somarAoRascunho([], p, "Ana");
  r = somarAoRascunho(r, p, "Ana");
  r = somarAoRascunho(r, p, "Bia");
  r = somarAoRascunho(r, p, "Bia", "sem gelo");
  assert.deepEqual(r.map((l) => [l.pessoa, l.observacao, l.quantidade]), [["Ana", "", 2], ["Bia", "", 1], ["Bia", "sem gelo", 1]]);
  r = mudarQuantidade(r, r[1].chave, -1);
  assert.equal(r.length, 2);
});

test("observação vai junto para a cozinha", () => {
  const r = definirObservacao(somarAoRascunho([], { id: "s", nome_produto: "Suco", preco_venda: 12 }), "s||", "  sem gelo ");
  assert.equal(itensParaEnviar("ped", r).linhas[0].observacao, "sem gelo");
});

test("nada sem preço vai para a cozinha", () => {
  const { erro, linhas } = itensParaEnviar("ped", [{ nome: "Água", produto_id: "a", quantidade: 1, valor_unitario: 0 }]);
  assert.match(erro, /Água está sem preço/);
  assert.deepEqual(linhas, []);
  const ok = itensParaEnviar("ped", [{ nome: "Suco", produto_id: "s", quantidade: 2, valor_unitario: 12, pessoa: "", observacao: "" }]);
  assert.deepEqual(ok.linhas, [{ pedido_id: "ped", produto_id: "s", quantidade: 2, valor_unitario: 12, observacao: null, pessoa: null, status_kds: "pendente" }]);
});

test("estado da mesa", () => {
  const agora = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(estadoDaMesa({ status: "ocupada" }, null).id, "livre");
  assert.equal(estadoDaMesa({ status: "ocupada" }, { created_at: "2026-11-06T11:00:00Z" }, agora).rotulo, "Ocupada");
  assert.equal(estadoDaMesa({ status: "fechando" }, { created_at: "2026-11-06T11:00:00Z" }, agora).id, "conta");
  const velha = estadoDaMesa({ status: "ocupada" }, { created_at: "2026-11-01T12:00:00Z" }, agora);
  assert.equal(velha.rotulo, "Aberta há 5 dias");
  assert.equal(velha.antiga, true);
});

test("tempo, número e ordem das mesas", () => {
  const agora = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(tempoDaMesa("2026-11-06T11:45:00Z", agora), "15 min");
  assert.equal(tempoDaMesa("2026-11-06T10:05:00Z", agora), "1h55");
  assert.equal(tempoDaMesa("2026-11-01T12:00:00Z", agora), "5d");
  assert.equal(numeroDaMesa({ numero: "Mesa 7" }), "7");
  assert.deepEqual(ordenarMesas([{ numero: "Mesa 10" }, { numero: "Mesa 2" }]).map(numeroDaMesa), ["2", "10"]);
});

test("balcão: itens com adicionais, totais em centavos e ajuste de centavo no último pagamento", async () => {
  const { planoDoBalcao } = await import("./comandas.mjs");
  const p = planoDoBalcao({
    itens: [
      { id: 1, preco_venda: 10, quantidade: 2, departamento: "Cozinha", modsSelecionados: [{ nome: "Queijo", preco: 2.5 }], observacao: "sem cebola" },
      { id: 2, preco: 7.9, quantidade: 1, departamento: "bar" },
    ],
    pagamentos: [{ forma: "dinheiro", valor: 20 }, { forma: "vr", valor: 9.567 }],
    desconto: 3.333, acrescimo: 0,
  });
  assert.deepEqual(p.linhas, [
    { produto_id: 1, quantidade: 2, valor_unitario: 12.5, observacao: "sem cebola (+Queijo)", status_kds: "pendente" },
    { produto_id: 2, quantidade: 1, valor_unitario: 7.9, observacao: null, status_kds: "entregue" },
  ]);
  assert.equal(p.subtotal, 32.9);
  assert.equal(p.desconto, 3.33);
  assert.equal(p.total, 29.57);
  assert.deepEqual(p.pagamentos, [{ forma: "dinheiro", valor: 20 }, { forma: "voucher", valor: 9.57 }]);
});

test("balcão: recusa venda vazia, sem pagamento ou com valor errado", async () => {
  const { planoDoBalcao } = await import("./comandas.mjs");
  assert.equal(planoDoBalcao({ itens: [] }).erro, "Adicione itens à venda.");
  assert.equal(planoDoBalcao({ itens: [{ id: 1, preco: 10, quantidade: 1 }] }).erro, "Informe o pagamento.");
  assert.equal(planoDoBalcao({ itens: [{ id: 1, preco: 10, quantidade: 1 }], pagamentos: [{ forma: "pix", valor: 9 }] }).erro, "Pagamentos somam 9.00 e a venda é 10.00.");
  // Desconto maior que a venda fica no valor da venda; aí não há o que receber.
  assert.equal(planoDoBalcao({ itens: [{ id: 1, preco: 10, quantidade: 1 }], pagamentos: [{ forma: "pix", valor: 10 }], desconto: 50 }).erro, "Pagamentos somam 10.00 e a venda é 0.00.");
});
