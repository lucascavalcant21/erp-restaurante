// Promoções da Etapa 7: tipos novos, conta do pedido (tela = servidor) e a conta do painel.
import test from "node:test";
import assert from "node:assert/strict";
import { cardapioDoCanal, errosDaPromocao, normalizarPromocao, precoEfetivo, rotuloDaPromocao, totalDoCarrinho } from "./cardapio-digital.mjs";
import { contaDaPromocao, custoDoPrato, linhasDaLista, resumoDaLista } from "./cardapio-promocoes-painel.mjs";

test("tipos novos: desconto em R$, pegue e leve mais, frete grátis", () => {
  const v = normalizarPromocao({ titulo: "Menos 5", tipo: "desconto_valor", desconto_valor: "5,00", produto_ids: ["a"] });
  assert.equal(v.desconto_valor, 5);
  assert.equal(precoEfetivo({ id: "a", preco_venda: 30 }, [v]).preco, 25);
  const l = normalizarPromocao({ titulo: "Dobro", tipo: "leve_mais", pague: 5, leve: 3, produto_ids: ["a"] });
  assert.deepEqual([l.pague, l.leve], [2, 3], "pague sempre menor que leve");
  assert.equal(rotuloDaPromocao(l), "pegue 2, leve 3");
  const f = normalizarPromocao({ titulo: "Frete", tipo: "frete_gratis", frete_minimo: "80" });
  assert.equal(f.frete_minimo, 80);
  assert.deepEqual(errosDaPromocao(f), [], "frete grátis não precisa de prato");
  assert.equal(f.mostrar_agora, true);
  assert.equal(f.acumula_cadastro, false);
  assert.deepEqual(normalizarPromocao({ titulo: "x", canais: ["tablet", "qr", "delivery"] }).canais, [], "todos os canais = vazio");
});

test("conta do pedido: pegue 1 leve 2, frete grátis e o que entra no cadastro", () => {
  const cardapio = {
    unidade: { taxa_entrega: 6 }, entrega: { pedido_minimo: 0 },
    produtos: [{ id: "chope", preco: 14 }, { id: "prato", preco: 50, promocao_id: "pd" }, { id: "doce", preco: 10 }],
    promocoes: [
      { id: "hh", tipo: "leve_mais", pague: 1, leve: 2, produto_ids: ["chope"], acumula_cadastro: false },
      { id: "pd", tipo: "preco", produto_ids: ["prato"], acumula_cadastro: true },
      { id: "fr", tipo: "frete_gratis", frete_minimo: 60 },
    ],
  };
  const t = totalDoCarrinho([{ id: "chope", quantidade: 3 }, { id: "prato", quantidade: 1 }, { id: "doce", quantidade: 1 }], cardapio, { tipo: "delivery" });
  assert.equal(t.subtotal, 102);
  assert.equal(t.desconto_promocoes, 14, "3 chopes: 1 de graça");
  assert.equal(t.taxa, 0, "acima de R$ 60 o frete é grátis");
  assert.equal(t.total, 88);
  assert.equal(t.base_cadastro, 60, "chope não acumula; prato acumula; doce sem promoção");
  const pouco = totalDoCarrinho([{ id: "doce", quantidade: 1 }], cardapio, { tipo: "delivery" });
  assert.equal(pouco.taxa, 6);
});

test("canal: promoção de outro canal sai e o prato volta ao preço normal", () => {
  const cardapio = {
    produtos: [{ id: "a", preco: 8, preco_original: 10, promocao_id: "so-qr", selos: [] }],
    categorias: [{ id: "c", produto_ids: ["a"] }],
    promocoes: [{ id: "so-qr", tipo: "desconto", produto_ids: ["a"], canais: ["qr"] }],
  };
  const d = cardapioDoCanal(cardapio, "delivery");
  assert.equal(d.produtos[0].preco, 10);
  assert.equal(d.produtos[0].promocao_id, null);
  assert.equal(d.promocoes.length, 0);
  assert.equal(cardapioDoCanal(cardapio, "qr").produtos[0].preco, 8);
});

test("conta do painel: números do protótipo (Tacacá R$ 50, custo R$ 14, 3%)", () => {
  const produto = { id: "t", nome: "Tacacá", preco: 50 };
  const custo = { cmv: 14, variaveisPct: 3 };
  const r = contaDaPromocao({ tipo: "leve_mais", pague: 1, leve: 2 }, { produto, custo, metaPct: 30 });
  assert.equal(r.lucro, 20.5);
  assert.equal(r.veredito.nivel, "ok");
  assert.equal(r.cliente.etiqueta, "PEGUE 1, LEVE 2");
  assert.equal(contaDaPromocao({ tipo: "leve_mais", pague: 1, leve: 3 }, { produto, custo, metaPct: 30 }).veredito.nivel, "baixa", "R$ 6,50 de lucro em R$ 50");
  assert.equal(contaDaPromocao({ tipo: "leve_mais", pague: 1, leve: 3 }, { produto, custo: { cmv: 20, variaveisPct: 3 } }).veredito.nivel, "prejuizo");
  assert.equal(contaDaPromocao({ tipo: "desconto", desconto_pct: 50 }, { produto, custo, metaPct: 60 }).veredito.nivel, "baixa");
  assert.equal(contaDaPromocao({ tipo: "desconto", desconto_pct: 10 }, { produto, custo: null }).veredito.nivel, "sem_custo", "sem ficha não inventa lucro");
});

test("custo do prato pela ficha e o resumo da lista", () => {
  assert.equal(custoDoPrato({ cmvValor: 0 }), null);
  assert.deepEqual(custoDoPrato({ cmvValor: 12.345, impostoPct: 4, taxaMaquininhaPct: 2.5 }, { comissao_pct: 1 }), { cmv: 12.35, variaveisPct: 7.5 });
  const porId = new Map([["a", { id: "a", nome: "A", preco: 20 }]]);
  const linhas = linhasDaLista([
    { id: "x", titulo: "Ruim", tipo: "desconto", desconto_pct: 90, produto_ids: ["a"] },
    { id: "y", titulo: "Pausada", tipo: "desconto", desconto_pct: 10, produto_ids: ["a"], ativa: false },
  ], { produtosPorId: porId, custos: { a: { cmv: 8, variaveisPct: 0 } }, metaPct: 20 });
  assert.equal(linhas[0].nivel, "prejuizo");
  assert.equal(linhas[1].status, "Pausada");
  const resumo = resumoDaLista(linhas);
  assert.equal(resumo.find((r) => r.rotulo === "Ativas").valor, "1");
  assert.equal(resumo.find((r) => r.rotulo === "Abaixo da meta").valor, "1");
});
