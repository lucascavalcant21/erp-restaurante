// Início do delivery: "Agora na casa", convite do cadastro e textos nos 8 idiomas.
import test from "node:test";
import assert from "node:assert/strict";
import { IDS_IDIOMAS } from "./cardapio-idiomas.mjs";
import { conviteDoCadastro, itensAgoraNaCasa, quantidadesNaSacola } from "./cardapio-delivery.mjs";
import { CHAVES_DELIVERY, IDIOMAS_DELIVERY, textoDelivery } from "./cardapio-textos-delivery.mjs";

const cardapio = {
  produtos: [
    { id: "a", nome: "Tacacá", preco: 25.6, preco_original: 32, promocao_id: "terca", imagem_url: "https://x/t.jpg" },
    { id: "b", nome: "Feijoada", preco: 49.9, destaque: true },
    { id: "c", nome: "Chope", preco: 14, destaque: true, promocao_id: "terca" },
    { id: "d", nome: "Pudim", preco: 18 },
  ],
  promocoes: [
    { id: "aviso", tipo: "aviso", titulo: "Música ao vivo", produto_ids: [] },
    { id: "terca", tipo: "desconto", titulo: "Terça do Tacacá", produto_ids: ["a", "c", "d"] },
  ],
};

test("Agora na casa: promoção que baixa o preço primeiro, depois os destaques, sem repetir", () => {
  const l = itensAgoraNaCasa(cardapio, { rotuloDestaque: "Destaque" });
  assert.deepEqual(l.map((x) => [x.produto_id, x.etiqueta]), [["a", "Terça do Tacacá"], ["c", "Terça do Tacacá"], ["b", "Destaque"]]);
  assert.equal(l[0].de, 32);
  assert.equal(l[2].de, undefined);
  assert.deepEqual(itensAgoraNaCasa({ produtos: [], promocoes: [] }), []);
});

test("convite do cadastro só com o cadastro ligado; pontos só com cashback", () => {
  assert.equal(conviteDoCadastro(null), null);
  assert.equal(conviteDoCadastro({ cadastro: null, cashback: { percentual: 2 } }), null);
  assert.deepEqual(conviteDoCadastro({ cadastro: { desconto_pct: 10, aplica: "sempre" }, cashback: { percentual: 2 } }), { percentual: "10%", todos: true, pontos: true });
  assert.deepEqual(conviteDoCadastro({ cadastro: { desconto_pct: 5, aplica: "primeiro" }, cashback: null }), { percentual: "5%", todos: false, pontos: false });
});

test("sacola: quantidade por prato", () => {
  assert.deepEqual([...quantidadesNaSacola([{ id: "a", quantidade: 2 }, { id: "a", quantidade: 1 }, { id: "b", quantidade: 1 }])], [["a", 3], ["b", 1]]);
});

test("textos do delivery nos 8 idiomas, com variáveis", () => {
  for (const k of CHAVES_DELIVERY) assert.deepEqual(IDIOMAS_DELIVERY(k).sort(), [...IDS_IDIOMAS].sort(), k);
  assert.equal(textoDelivery("pt", "taxa", { valor: "R$ 6,00" }), "Taxa de entrega R$ 6,00");
  assert.equal(textoDelivery("xx", "inicio"), "Início");
  for (const k of CHAVES_DELIVERY) assert.doesNotMatch(textoDelivery("en", k), /\boff\b/i);
});

const sacola = {
  categorias: [
    { id: "g", papel: "comida", produto_ids: ["picanha"] },
    { id: "s", papel: "sobremesa", produto_ids: ["mousse", "pudim"] },
    { id: "b", papel: "bebida", produto_ids: ["suco", "chope"] },
  ],
  produtos: [
    { id: "picanha", nome: "Picanha", preco: 89.9, categoria_id: "g" },
    { id: "mousse", nome: "Mousse", preco: 15, categoria_id: "s" },
    { id: "pudim", nome: "Pudim", preco: 18, categoria_id: "s", destaque: true },
    { id: "suco", nome: "Suco", preco: 12, preco_original: 14, categoria_id: "b" },
    { id: "chope", nome: "Chope", preco: 14, categoria_id: "b" },
  ],
};

test("sugestões da sacola: 1 bebida e 1 sobremesa, destaque primeiro, sem repetir o dispensado", async () => {
  const { sugestoesDaSacola } = await import("./cardapio-delivery.mjs");
  const s1 = sugestoesDaSacola([{ id: "picanha", quantidade: 1 }], sacola);
  assert.deepEqual(s1.map((x) => [x.papel, x.id]), [["sobremesa", "pudim"], ["bebida", "suco"]]);
  assert.equal(s1[1].de, 14);
  const s2 = sugestoesDaSacola([{ id: "picanha", quantidade: 1 }, { id: "chope", quantidade: 1 }], sacola, { dispensados: ["pudim"] });
  assert.deepEqual(s2.map((x) => x.id), ["mousse"], "já tem bebida; pudim dispensado");
  assert.deepEqual(sugestoesDaSacola([], sacola), []);
});

test("linhas da sacola: só pratos que existem, com o total do item", async () => {
  const { linhasDaSacola } = await import("./cardapio-delivery.mjs");
  const l = linhasDaSacola([{ id: "picanha", quantidade: 2, observacao: "ao ponto" }, { id: "sumiu", quantidade: 1 }], sacola);
  assert.deepEqual(l, [{ id: "picanha", chave: "picanha", nome: "Picanha", foto: "", quantidade: 2, escolhas: "", observacao: "ao ponto", total: 179.8 }]);
});

test("agora na casa sem promoção nem destaque: pratos da casa, com foto primeiro", () => {
  const l = itensAgoraNaCasa({ promocoes: [], produtos: [{ id: "a", nome: "A", preco: 1 }, { id: "b", nome: "B", preco: 2, imagem_url: "/b.jpg" }] }, { rotuloDestaque: "Destaque" });
  assert.deepEqual(l.map((x) => x.id), ["b", "a"]);
});

test("complementos: tamanho obrigatório, adicionais até o máximo, preço igual na tela e no servidor", async () => {
  const { precoDaLinha, totalDoCarrinho } = await import("./cardapio-digital.mjs");
  const tacaca = {
    id: "t", nome: "Tacacá", preco: 32,
    grupos: [
      { id: "tam", nome: "Tamanho", tipo: "adicional", min: 1, max: 1, opcoes: [{ id: "m", nome: "Cuia média", preco: 0 }, { id: "g", nome: "Cuia grande", preco: 10 }] },
      { id: "turbo", nome: "Turbine", tipo: "adicional", min: 0, max: 2, opcoes: [{ id: "cam", nome: "Camarão extra", preco: 8 }, { id: "jam", nome: "Mais jambu", preco: 4 }, { id: "x", nome: "X", preco: 1 }] },
      { id: "sem", nome: "Retirar", tipo: "retirar", min: 0, max: 3, opcoes: [{ id: "cs", nome: "camarão seco", preco: 0 }] },
    ],
  };
  assert.equal(precoDaLinha(tacaca, {}).erro, "falta_escolha");
  const l = precoDaLinha(tacaca, { tam: ["g"], turbo: ["cam"], sem: ["cs"] });
  assert.deepEqual([l.ok, l.preco, l.texto], [true, 50, "Tamanho: Cuia grande · Turbine: Camarão extra · Sem: camarão seco"]);
  assert.equal(precoDaLinha(tacaca, { tam: ["m"], turbo: ["cam", "jam", "x"] }).erro, "escolhas_demais");
  assert.equal(precoDaLinha(tacaca, { tam: ["zz"] }).erro, "opcao_invalida");
  const t = totalDoCarrinho([{ id: "t", quantidade: 2, opcoes: { tam: ["g"], turbo: ["cam"] } }], { produtos: [tacaca], promocoes: [] });
  assert.equal(t.subtotal, 100);
});
