import test from "node:test";
import assert from "node:assert/strict";
import { limitarEscala, rotuloEscala, quebrarLinhas, layoutNome, retanguloImagem, desenharNomeCentralizado } from "./etiqueta-centralizada.mjs";
import { gerarComandosTsplMdk022 } from "./impressaoMdk022.js";

// Canvas falso: cada letra mede 0,6 × o tamanho da fonte; guarda o que foi desenhado.
function ctxFalso() {
  const ctx = {
    font: "900 10px Arial", desenhos: [], textAlign: "", textBaseline: "", fillStyle: "",
    measureText(t) { const px = Number(/(\d+)px/.exec(this.font)?.[1] || 10); return { width: String(t).length * px * 0.6 }; },
    fillText(t, x, y) { this.desenhos.push({ t, x, y, font: this.font }); },
  };
  return ctx;
}

test("tamanho ajustável: 50% a 200%, passo de 10%", () => {
  assert.deepEqual([limitarEscala(1), limitarEscala(0.1), limitarEscala(5), limitarEscala("1.3"), limitarEscala(""), limitarEscala(1.25)], [1, 0.5, 2, 1.3, 1, 1.3]);
  assert.equal(rotuloEscala(1.5), "150%");
});

test("quebra em palavras sem passar da largura", () => {
  const ctx = ctxFalso(); ctx.font = "900 20px Arial"; // 12 por letra
  assert.deepEqual(quebrarLinhas(ctx, "FILÉ DE PIRARUCU EMPANADO", 120), ["FILÉ DE", "PIRARUCU", "EMPANADO"]);
  assert.deepEqual(quebrarLinhas(ctx, "A B C D E F G H", 40, 2), ["A B", "C D E F G H"]);
});

test("nome: começa grande, encolhe até caber; com 150% a letra é maior", () => {
  const w = 440, h = 280;
  const normal = layoutNome(ctxFalso(), w, h, { nomes: ["Feijão"] });
  const maior = layoutNome(ctxFalso(), w, h, { nomes: ["Feijão"], escala: 1.5 });
  assert.ok(normal.cabe && maior.cabe);
  assert.ok(maior.fonte > normal.fonte, `${maior.fonte} > ${normal.fonte}`);
  assert.ok(normal.fonte >= 60, `fonte grande: ${normal.fonte}`);
  const longo = layoutNome(ctxFalso(), w, h, { nomes: ["Molho de pimenta com tucupi defumado da casa"] });
  assert.ok(longo.cabe && longo.blocos[0].length > 1 && longo.fonte < normal.fonte);
  const dois = layoutNome(ctxFalso(), w, h, { nomes: ["Arroz", "Feijão"] });
  assert.equal(dois.blocos.length, 2);
});

test("nome desenhado no centro (horizontal e vertical)", () => {
  const ctx = ctxFalso();
  const lay = desenharNomeCentralizado(ctx, 400, 300, { nomes: ["Arroz"] });
  assert.equal(ctx.textAlign, "center");
  assert.equal(ctx.desenhos[0].x, 200);
  const topo = ctx.desenhos[0].y;
  const sobra = 300 - lay.altura;
  assert.ok(Math.abs(topo - sobra / 2) <= 1, `topo ${topo} ≈ ${sobra / 2}`);
});

test("imagem centralizada: 80% da área em 100%; nunca passa da área", () => {
  assert.deepEqual(retanguloImagem(200, 100, 400, 300, 1), { x: 40, y: 70, w: 320, h: 160 });
  assert.deepEqual(retanguloImagem(200, 100, 400, 300, 2), { x: 0, y: 50, w: 400, h: 200 });
  assert.equal(retanguloImagem(0, 100, 400, 300), null);
});

test("MDK-022: 'Somente nome' e 'Apenas imagem' viram um bitmap da área útil e imprimem", () => {
  const nome = gerarComandosTsplMdk022({ dados: { modeloEtiqueta: "nome", produto: "Arroz", escalaNome: 1.5 }, tamanho: "60x40", copias: 2 });
  const texto = new TextDecoder("latin1").decode(nome);
  assert.match(texto, /BITMAP \d+,\d+,\d+,\d+,0,/);
  assert.match(texto, /PRINT 2,1/);
  assert.doesNotMatch(texto, /QRCODE/);
  assert.throws(() => gerarComandosTsplMdk022({ dados: { modeloEtiqueta: "logo", produto: "Arroz" }, tamanho: "60x40" }), /imagem/);
});
