import test from "node:test";
import assert from "node:assert/strict";
import { conferirPorcoes, dividirIgual, normalizarPorcoes, retirarPorcoes, tamanhoLegivel, textoPorcoes, totalPorcoes } from "./estoque-porcoes.mjs";

test("100 frangos empanados em 5 pacotes de 20", () => {
  const { linhas } = dividirIgual(100, 20);
  assert.deepEqual(linhas.map((l) => [l.qtd, l.tamanho]), [[5, 20]]);
  const reg = { linhas };
  assert.equal(totalPorcoes(reg), 100);
  assert.equal(conferirPorcoes(reg, 100).confere, true);
  assert.equal(textoPorcoes(reg, "un"), "5 pacotes de 20 un");
});

test("1 kg de lemon pepper em 10 pacotes de 100 g", () => {
  const { linhas } = dividirIgual(1, 0.1);
  assert.deepEqual(linhas.map((l) => [l.qtd, l.tamanho]), [[10, 0.1]]);
  assert.equal(textoPorcoes({ linhas }, "kg"), "10 pacotes de 100 g");
  assert.equal(tamanhoLegivel(0.25, "L"), "250 ml");
});

test("sobra vira um pacote menor", () => {
  const { linhas } = dividirIgual(95, 20);
  assert.deepEqual(linhas.map((l) => [l.qtd, l.tamanho]), [[4, 20], [1, 15]]);
});

test("divisão que não fecha com o saldo é avisada (4 × 75 + 1 × 15 = 315)", () => {
  const reg = { linhas: [{ qtd: 4, tamanho: 75 }, { qtd: 1, tamanho: 15 }] };
  const c = conferirPorcoes(reg, 100);
  assert.equal(c.total, 315);
  assert.equal(c.confere, false);
  assert.equal(c.diferenca, -215);
});

test("retirar porções inteiras desconta da divisão", () => {
  const reg = { linhas: [{ id: "a", qtd: 5, tamanho: 20 }] };
  const r = retirarPorcoes(reg, 40);
  assert.equal(r.k, 2);
  assert.equal(totalPorcoes(r.reg), 60);
  assert.equal(retirarPorcoes(reg, 30), null); // não é porção inteira
  assert.equal(retirarPorcoes(reg, 120), null); // mais do que tem
  const ultimo = retirarPorcoes({ linhas: [{ id: "b", qtd: 1, tamanho: 0.1 }] }, 0.1);
  assert.equal(ultimo.reg.linhas.length, 0);
});

test("normaliza: junta tamanhos iguais e descarta linha vazia", () => {
  const r = normalizarPorcoes({ linhas: [{ qtd: 2, tamanho: 20 }, { qtd: "3", tamanho: "20" }, { qtd: 0, tamanho: 5 }, { qtd: 1, tamanho: "0,5" }] });
  assert.deepEqual(r.linhas.map((l) => [l.qtd, l.tamanho]), [[5, 20], [1, 0.5]]);
});
