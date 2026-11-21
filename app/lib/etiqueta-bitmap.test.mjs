import test from "node:test";
import assert from "node:assert/strict";
import { lerBitmapTspl, pintarBitmap } from "./etiqueta-bitmap.mjs";

test("lê o cabeçalho do BITMAP e pinta só os pontos pretos", () => {
  const cab = new TextEncoder().encode("SIZE 60 mm,40 mm\r\nBITMAP 2,1,1,2,0,");
  const dados = Uint8Array.from([0b01111111, 0b11111110]); // linha 0: 1º ponto preto; linha 1: último ponto preto
  const bytes = new Uint8Array([...cab, ...dados, 13, 10]);
  const bmp = lerBitmapTspl(bytes);
  assert.deepEqual({ ...bmp, inicio: undefined }, { x: 2, y: 1, larguraBytes: 1, altura: 2, inicio: undefined });
  const rgba = new Uint8ClampedArray(12 * 4 * 4).fill(255);
  pintarBitmap(bytes, bmp, rgba, 12, 4);
  const preto = (x, y) => rgba[(y * 12 + x) * 4] === 0;
  assert.equal(preto(2, 1), true);
  assert.equal(preto(3, 1), false);
  assert.equal(preto(9, 2), true);
  assert.equal(lerBitmapTspl(new TextEncoder().encode("PRINT 1,1")), null);
});
