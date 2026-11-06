import test from "node:test";
import assert from "node:assert/strict";
import { limparEntradaAntiga } from "./acesso.mjs";

test("solta o aparelho preso na trava antiga", () => {
  const m = new Map([["hefisto:marmitaria:dentro", "{}"]]);
  limparEntradaAntiga({ removeItem: (k) => m.delete(k) });
  assert.equal(m.size, 0);
  assert.doesNotThrow(() => limparEntradaAntiga(null));
});
