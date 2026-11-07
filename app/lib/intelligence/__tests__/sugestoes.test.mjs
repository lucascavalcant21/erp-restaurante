// Próximos passos do Assistente Héfisto: toda sugestão é algo que o Héfisto entende.
import test from "node:test";
import assert from "node:assert/strict";
import { sugestoesDaResposta, MAX_SUGESTOES } from "../commands/sugestoes.mjs";
import { interpretarPorRegras } from "../commands/interpretador-regras.mjs";
import { INTENCOES } from "../commands/catalogo.mjs";

const ref = { produto: { id: "x", nome: "Sal Fino" }, ficha: { id: "y", nome: "Molho de tomate" } };

test("cada sugestão de cada assunto é entendida pelo interpretador", () => {
  const vistas = new Set();
  for (const i of INTENCOES) {
    for (const s of sugestoesDaResposta({ intencao: i.id, resposta: { tipo: "resposta" }, referencia: ref, interpretacao: { quantidade: 50 } })) vistas.add(s);
  }
  for (const s of sugestoesDaResposta({ intencao: null, resposta: { tipo: "erro_acao" } })) vistas.add(s);
  vistas.add("Vamos montar um prato com essa base");
  for (const s of vistas) {
    const r = interpretarPorRegras(s);
    assert.ok(r.ok && r.valor.intencao !== "desconhecido", `não entendida: "${s}"`);
  }
});

test("saldo: próximos passos com o produto citado, no máximo 3, sem repetir o pedido", () => {
  const s = sugestoesDaResposta({ intencao: "estoque.saldo_produto", resposta: { tipo: "resposta" }, referencia: ref, texto: "Quais produtos estão abaixo do mínimo?" });
  assert.deepEqual(s, ["Recebi Sal Fino", "Quanto paguei em Sal Fino da última vez?"]);
  assert.ok(sugestoesDaResposta({ intencao: "empresa.resumo_dia", resposta: {} }).length <= MAX_SUGESTOES);
});

test("lucro: sugestão com valor usa o preço já citado (+10%), nada inventado", () => {
  assert.equal(sugestoesDaResposta({ intencao: "fichas.lucro_preco", resposta: {}, interpretacao: { quantidade: 50 } })[0], "E se eu vender esse prato por 55 reais?");
  assert.ok(!sugestoesDaResposta({ intencao: "fichas.lucro_preco", resposta: {}, interpretacao: {} }).some((s) => /reais/.test(s)));
});

test("pergunta, confirmação e lote mantêm os próprios botões; erro ganha as gerais", () => {
  assert.deepEqual(sugestoesDaResposta({ intencao: "estoque.saldo_produto", resposta: { pergunta: { opcoes: [{ id: 1 }] } } }), []);
  assert.deepEqual(sugestoesDaResposta({ intencao: "estoque.registrar_entrada", resposta: { confirmacao: {} } }), []);
  assert.deepEqual(sugestoesDaResposta({ intencao: null, resposta: { tipo: "lote" } }), []);
  assert.equal(sugestoesDaResposta({ intencao: null, resposta: { tipo: "erro_acao" } }).length, 3);
  assert.deepEqual(sugestoesDaResposta({ resposta: { sugestoes: ["a"] } }), ["a"]);
});
