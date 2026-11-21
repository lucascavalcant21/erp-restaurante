// Rode com: node --test app/lib/marmitaria/treinamento.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { MODELO_TREINAMENTO, normalizarManual, temposDoManual, htmlDoManual } from "./treinamento.mjs";

test("sem nada salvo, abre o modelo com as posições e nenhum tempo inventado", () => {
  const m = normalizarManual(null);
  assert.equal(m.modelo, true);
  assert.deepEqual(m.estacoes.map((e) => e.id), ["comanda", "fogao", "fritadeira", "bancada", "fechamento", "expedicao"]);
  assert.ok(m.estacoes.every((e) => e.misePlace.length > 0));
  assert.ok(m.estacoes.every((e) => e.processos.every((p) => p.tempoMin === "" && p.padroes.every((q) => q.valor === ""))));
  assert.equal(temposDoManual(m).total, 0);
});

test("tempos: soma por posição e do pedido; limpa entrada ruim", () => {
  const m = normalizarManual({ estacoes: [
    { id: "a", nome: "Fritadeira", processos: [{ nome: "Fritar", tempoMin: "4,5", passos: ["Baixar o cesto", " "] }, { nome: "Enviar", tempoMin: "1" }] },
    { id: "b", nome: "Fechamento", processos: [{ nome: "Vedar", tempoMin: "abc" }] },
  ] });
  assert.equal(m.modelo, false);
  assert.deepEqual(m.estacoes[0].processos[0].passos, ["Baixar o cesto"]);
  const t = temposDoManual(m);
  assert.equal(t.estacoes[0].minutos, 5.5);
  assert.equal(t.estacoes[1].semTempo, 1);
  assert.equal(t.total, 5.5);
});

test("impressão: capa com tempos, uma página por posição, assinatura e escape", () => {
  const m = normalizarManual({ titulo: "POP <Delivery>", estacoes: MODELO_TREINAMENTO });
  m.estacoes[2].processos[0].tempoMin = 4;
  m.estacoes[4].processos[1].padroes[0].valor = "1";
  const h = htmlDoManual(m, { empresa: "Sel de Estrela", embalagens: ["Marmitex 3 divisórias"] });
  assert.match(h, /POP &lt;Delivery&gt;/);
  assert.equal((h.match(/class="estacao"/g) || []).length, 6);
  assert.match(h, /Meta: 4 min/);
  assert.match(h, /Etiquetas por marmita<\/td><td>1</);
  assert.match(h, /Embalagens cadastradas:<\/b> Marmitex 3 divisórias/);
  assert.match(h, /Treinador:/);
  const so = htmlDoManual(m, { so: "fritadeira" });
  assert.equal((so.match(/class="estacao"/g) || []).length, 1);
  assert.doesNotMatch(so, /class="capa"/);
});
