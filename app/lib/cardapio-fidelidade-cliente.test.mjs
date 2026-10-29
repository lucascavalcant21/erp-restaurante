// Minha fidelidade e Minha área: números do protótipo, só com dado real do servidor.
import test from "node:test";
import assert from "node:assert/strict";
import { areaDoClienteVista, resumoDaFidelidade } from "./cardapio-fidelidade-cliente.mjs";

const cardapio = {
  produtos: [{ id: "tacaca", nome: "Tacacá", preco: 32 }, { id: "picanha", nome: "Picanha na brasa", preco: 89.9 }, { id: "chope", nome: "Chope", preco: 14 }],
};
const fid = {
  cartoes: [{ id: "tacaca", nome: "Cartão Tacacá", selos: 6, por: "unidade", recompensa: "1 Tacacá", produto_ids: ["tacaca"] }],
  cashback: { pontos_por_real: 1, valor_100: 2 },
  cadastro: { desconto_pct: 10, aplica: "sempre" },
};
const status = {
  identificado: true, disponivel: true, nome: "Manuela", cartoes: { tacaca: { selos: 4 } }, cashback: { saldo: 22.4 },
  totais: { pedidos: 14, pago: 1163.2, desconto: 134.9, cashback_usado: 51.5 }, premios: {},
  pedidos: [{ id: "p", em: "2026-10-27T22:42:00Z", tipo: "salao", total: 141, economizou: 15.67, cashback: 2.82, selos: 1, itens: [{ id: "picanha", quantidade: 2 }, { id: "sumiu", quantidade: 1 }] }],
};

test("minha fidelidade: pontos, selos e 'pedir 2 e ganhar'", () => {
  const r = resumoDaFidelidade(fid, status, cardapio);
  assert.equal(r.cashback.pontos, 1120);
  const c = r.cartoes[0];
  assert.deepEqual([c.tem, c.faltam, c.completo], [4, 2, false]);
  assert.deepEqual(c.completar, { n: 2, valor: 64 });
  assert.equal(c.prato.nome, "Tacacá");
  const visitante = resumoDaFidelidade(fid, { identificado: false }, cardapio);
  assert.equal(visitante.identificado, false);
  assert.equal(visitante.cashback.pontos, 0, "sem telefone provado não mostra saldo");
  const pronto = resumoDaFidelidade(fid, { ...status, cartoes: { tacaca: { selos: 6 } }, premios: { tacaca: { codigo: "ABC234", valido_ate: "2026-11-19T00:00:00Z" } } }, cardapio);
  assert.equal(pronto.cartoes[0].completo, true);
  assert.equal(pronto.cartoes[0].codigo, "ABC234");
});

test("minha área: economia, falta pouco e pedidos (prato que saiu do cardápio não volta no 'pedir de novo')", () => {
  const a = areaDoClienteVista(fid, status, cardapio);
  assert.deepEqual(a.economia, { total: 186.4, comApp: 1163.2, semApp: 1349.6, desconto: 134.9, cashback: 51.5 });
  assert.equal(a.perto.id, "tacaca");
  assert.equal(a.pontos.faltam, 80);
  assert.equal(a.pontos.pratos[0].nome, "Picanha na brasa", "primeiro o que completa sozinho");
  assert.equal(a.pedidos[0].tipo, "qrcode", "salão aparece como mesa");
  assert.equal(a.pedidos[0].pontos, 141);
  assert.deepEqual(a.pedidos[0].itens, [{ id: "picanha", quantidade: 2 }]);
  assert.equal(a.pedidos[0].texto, "2 Picanha na brasa");
});
