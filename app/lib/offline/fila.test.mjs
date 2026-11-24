import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.window = { localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } };
let online = true;
Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return online; } }, configurable: true });
const { comFila, enviarFila, erroDeRede, lerFila, guardarCopia, lerCopia } = await import("./fila.mjs");

test("sem internet guarda na fila; com internet envia na ordem e esvazia", async () => {
  const gravados = [];
  const salvar = comFila("teste.salvar", async (x) => { gravados.push(x); return { error: null }; }, (x) => `Salvar ${x}`);
  online = false;
  assert.deepEqual(await salvar("a"), { error: null, offline: true });
  await salvar("b");
  assert.deepEqual(lerFila().map((i) => [i.tipo, i.args[0], i.rotulo]), [["teste.salvar", "a", "Salvar a"], ["teste.salvar", "b", "Salvar b"]]);
  assert.deepEqual(gravados, []);
  online = true;
  const r = await enviarFila();
  assert.deepEqual([r.enviados, r.pendentes, gravados], [2, 0, ["a", "b"]]);
});

test("erro de rede no meio para a fila; erro de regra tira o item e avisa", async () => {
  let rede = true;
  const salvar = comFila("teste.rede", async (x) => (x === "ruim" ? { error: "Nome inválido" } : rede ? { error: "Sem conexão com o banco." } : { error: null }));
  online = true;
  const r1 = await salvar("x"); // rede caiu na hora: vai para a fila
  assert.equal(r1.offline, true);
  await salvar("ruim"); // regra: devolve o erro na hora, não entra na fila
  assert.equal(lerFila().length, 1);
  const parcial = await enviarFila();
  assert.deepEqual([parcial.enviados, parcial.pendentes], [0, 1]);
  assert.equal(lerFila()[0].tentativas, 1);
  rede = false;
  const fim = await enviarFila();
  assert.deepEqual([fim.enviados, fim.pendentes, fim.recusados.length], [1, 0, 0]);
});

test("repetição recusada por 'já existe' conta como enviada; cópia da leitura volta igual", async () => {
  const salvar = comFila("teste.dup", async () => ({ error: "Já existe um ingrediente com esse nome" }));
  online = false; await salvar(1); online = true;
  const r = await enviarFila();
  assert.deepEqual([r.enviados, r.recusados.length], [1, 0]);
  assert.equal(erroDeRede(new TypeError("Failed to fetch")), true);
  assert.equal(erroDeRede("Informe o nome"), false);
  guardarCopia("base", { a: 1 });
  assert.deepEqual(lerCopia("base").dados, { a: 1 });
});
