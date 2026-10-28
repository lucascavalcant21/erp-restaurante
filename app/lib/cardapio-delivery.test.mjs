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
