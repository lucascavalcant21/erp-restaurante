// Etiqueta 60x40 da MDK-022: a área do desenho segue a calibração da impressora.
import test from "node:test";
import assert from "node:assert/strict";
import { areaNativa60x40, gerarComandosTsplMdk022 } from "./impressaoMdk022.js";

const texto = (bytes) => new TextDecoder("latin1").decode(bytes);
const dados = { produto: "Frutos do mar", codigo: "ABC123", responsavel: "Ana", validade: "2027-01-20T17:10:00", momento: "2026-11-21T17:10:00" };

test("sem perfil: o desenho de sempre (margens de 1,5 mm)", () => {
  assert.deepEqual(areaNativa60x40(null), { x: 12, y: 12, cW: 456, cH: 296 });
  const cmd = texto(gerarComandosTsplMdk022({ dados, tamanho: "60x40" }));
  assert.match(cmd, /BITMAP 12,12,57,296,0,/);
  assert.match(cmd, /QRCODE 368,12,/);
});

test("deslocamento X da calibração move o desenho inteiro (texto e QR)", () => {
  const perfil = { widthMm: 60, heightMm: 40, marginLeftMm: 1.5, marginRightMm: 1.5, marginTopMm: 1.5, marginBottomMm: 1.5, offsetXmm: 10, offsetYmm: 0, dpi: 203 };
  const a = areaNativa60x40(perfil);
  assert.equal(a.x, 12 + 80);
  const cmd = texto(gerarComandosTsplMdk022({ dados, tamanho: "60x40", perfilFisico: perfil }));
  assert.match(cmd, new RegExp(`BITMAP ${a.x},12,`));
  assert.match(cmd, new RegExp(`QRCODE ${a.x + a.cW - 100},12,`));
});

test("margens e deslocamento negativo nunca saem do papel", () => {
  const a = areaNativa60x40({ marginLeftMm: 1, offsetXmm: -5, marginTopMm: 1, offsetYmm: -3 });
  assert.equal(a.x, 0);
  assert.equal(a.y, 0);
});

test("perfil com campos vazios usa o padrão", () => {
  assert.deepEqual(areaNativa60x40({ widthMm: "", marginLeftMm: null, offsetXmm: undefined }), { x: 12, y: 12, cW: 456, cH: 296 });
});
