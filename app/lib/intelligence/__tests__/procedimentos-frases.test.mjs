// Frases da equipe para os procedimentos da casa (14/11/2026). TESTADO EM MOCK.
import test from "node:test";
import assert from "node:assert/strict";
import { interpretarPorRegras } from "../commands/interpretador-regras.mjs";

const intencao = (t) => {
  const r = interpretarPorRegras(t);
  return r.ok ? r.valor.intencao : null;
};

test("rotina, limpeza e equipamento vão para o procedimento da casa", () => {
  for (const f of [
    "Nico, agora chegou o fechamento, o que eu tenho que fazer?",
    "Cheguei na cozinha, o que eu faço agora?",
    "Como limpo a chapa?",
    "como higienizar o liquidificador",
    "Como usa o liquidificador?",
    "o liquidificador é 110 ou 220?",
    "Procedimento da casa: Limpeza do fogão",
  ]) assert.equal(intencao(f), "salao.orientacao", f);
});

test("fechamento do caixa e do mês continuam fora", () => {
  assert.notEqual(intencao("como fazer o fechamento do caixa"), "salao.orientacao");
  assert.notEqual(intencao("fechamento do mês"), "salao.orientacao");
});
