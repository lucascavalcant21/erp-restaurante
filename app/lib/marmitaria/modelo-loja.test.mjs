import test from "node:test";
import assert from "node:assert/strict";
import { maisPedidos, modeloDaLoja, precoParaColar, textoDoModelo } from "./modelo-loja.mjs";

const ficha = (id, extra = {}) => ({ id, ...extra });
const linhas = [
  { id: "p1", secao: "promocoes", ficha: ficha("f"), oferta: { tipo: "desconto_pct" }, rotulo: "10% off", precoCheio: 30, precoPago: 27 },
  { id: "p2", secao: "promocoes", ficha: ficha("c"), oferta: { tipo: "leve_pague" }, rotulo: "2 por 1", precoCheio: 80, precoPago: 40 },
  { id: "k1", secao: "combos", nome: "Frango + suco", descricao: "Frango + Suco", precoCheio: 38, precoPago: 34 },
  { id: "m-s", secao: "marmitas", nome: "Pudim", categoria: "Sobremesas", ficha: ficha("s"), semPreco: true, precoPago: null },
  { id: "m-c", secao: "marmitas", nome: "Bife", categoria: "Marmitas de carne", ficha: ficha("c", { descricao: "Bife acebolado", imagem: "c.jpg" }), precoPago: 40 },
  { id: "m-f", secao: "marmitas", nome: "Frango", categoria: "Marmitas de frango", ficha: ficha("f", { descricao_comercial: "Frango grelhado", descricao: "antiga" }), precoPago: 30 },
];

test("mais pedidos soma as vendas e ignora o que não tem ficha", () => {
  const v = [{ ficha_id: "a", quantidade: 2 }, { ficha_id: "b", quantidade: 5 }, { ficha_id: "a", quantidade: 1 }, { ficha_id: null, quantidade: 9 }, { ficha_id: "z", quantidade: 0 }];
  assert.deepEqual(maisPedidos(v), [{ fichaId: "b", quantidade: 5 }, { fichaId: "a", quantidade: 3 }]);
  assert.equal(maisPedidos(Array.from({ length: 8 }, (_, i) => ({ ficha_id: `x${i}`, quantidade: 1 }))).length, 5);
});

test("seções na ordem da loja: combos, frango, carne, sobremesa", () => {
  const m = modeloDaLoja({ linhas });
  assert.deepEqual(m.secoes.map((s) => s.titulo), ["Combos", "Marmitas de frango", "Marmitas de carne", "Sobremesas"]);
  assert.deepEqual(m.maisPedidos, []);
});

test("desconto aparece de/por; leve e pague só como selo", () => {
  const m = modeloDaLoja({ linhas });
  const [frango] = m.secoes[1].itens;
  assert.deepEqual([frango.preco, frango.precoDe, frango.descricao], [27, 30, "Frango grelhado"]);
  const [bife] = m.secoes[2].itens;
  assert.deepEqual([bife.preco, bife.precoDe, bife.selo], [40, null, "2 por 1"]);
});

test("mostra o que falta para passar para a plataforma, sem repetir item de Mais pedidos", () => {
  const m = modeloDaLoja({ linhas, vendas: [{ ficha_id: "c", quantidade: 3 }, { ficha_id: "fora", quantidade: 9 }] });
  assert.deepEqual(m.maisPedidos.map((i) => i.nome), ["Bife"]);
  assert.deepEqual(m.faltando, { foto: 2, descricao: 1, preco: 1 });
});

test("texto para copiar sai sem Mais pedidos e preço pronto para colar", () => {
  const texto = textoDoModelo(modeloDaLoja({ linhas, vendas: [{ ficha_id: "c", quantidade: 3 }] }));
  assert.ok(texto.startsWith("COMBOS\n\nFrango + suco\nFrango + Suco\nR$ 34,00"));
  assert.ok(texto.includes("MARMITAS DE FRANGO\n\nFrango\nFrango grelhado\nR$ 27,00"));
  assert.ok(texto.includes("SOBREMESAS\n\nPudim\nSem preço"));
  assert.equal(texto.includes("MAIS PEDIDOS"), false);
  assert.equal(precoParaColar(27.5), "27,50");
  assert.equal(precoParaColar(null), "");
});
