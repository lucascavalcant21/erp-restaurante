// Etiqueta pelo Bluetooth do celular: linguagem certa e os MESMOS bytes TSPL
// do cabo USB. node --test app/lib/etiqueta-bluetooth.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { escolherLinguagemBluetooth, ehAppleMovel } from "./bluetooth-linguagem.mjs";
import { gerarComandosTsplMdk022, imprimirFilaMdk022Usb } from "./impressaoMdk022.js";

test("linguagem: MDK-022 e etiquetadoras recebem TSPL; cupom recebe ESC/POS; escolha manual vence", () => {
  assert.equal(escolherLinguagemBluetooth({ printerType: "mdk022" }), "tspl", "perfil padrão do Héfisto");
  assert.equal(escolherLinguagemBluetooth({ printerType: "bluetooth", nome: "MDK-022_BLE" }), "tspl");
  assert.equal(escolherLinguagemBluetooth({ printerType: "bluetooth", nome: "XP-420B" }), "tspl");
  assert.equal(escolherLinguagemBluetooth({ printerType: "bluetooth", nome: "MPT-II" }), "escpos");
  assert.equal(escolherLinguagemBluetooth({ printerType: "tp20", nome: "" }), "escpos");
  assert.equal(escolherLinguagemBluetooth({ escolha: "escpos", printerType: "mdk022" }), "escpos", "manual vence o perfil");
  assert.equal(escolherLinguagemBluetooth({ escolha: "tspl", printerType: "tp20" }), "tspl");
  assert.equal(escolherLinguagemBluetooth(), "escpos");
});

test("iPhone/iPad detectados (inclusive iPad que se apresenta como Mac)", () => {
  assert.equal(ehAppleMovel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), true);
  assert.equal(ehAppleMovel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
  assert.equal(ehAppleMovel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);
  assert.equal(ehAppleMovel("Mozilla/5.0 (Linux; Android 14)"), false);
});

test("fila da MDK-022 pelo Bluetooth: mesmos bytes TSPL do cabo, sem tocar no USB", async () => {
  const momento = new Date("2026-10-15T12:00:00Z");
  const fila = [{ nome: "Arroz", modeloEtiqueta: "nome", copias: 2, dias: 3 }, { nome: "Feijão", modeloEtiqueta: "nome", copias: 1, dias: 2 }];
  const enviados = [];
  const antes = globalThis.navigator;
  const r = await imprimirFilaMdk022Usb({ fila, tamanho: "60x40", responsavel: { nome: "Ana" }, unidadeInfo: { nome: "Loja" }, setor: "cozinha", momento,
    enviar: async (bytes) => { enviados.push(bytes); } });
  assert.equal(globalThis.navigator, antes, "não mexeu no navegador");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(enviados.length, 2, "um envio por produto");
  const esperado = gerarComandosTsplMdk022({ dados: { ...fila[0], produto: "Arroz", unidadeNome: "LOJA", momento,
    validade: new Date(momento.getTime() + 3 * 86400000), responsavel: "ANA", lote: "COZINHA" }, tamanho: "60x40", copias: 2 });
  assert.deepEqual(Buffer.from(enviados[0]), Buffer.from(esperado), "bytes idênticos aos do cabo");
  assert.match(Buffer.from(enviados[0]).toString("latin1"), /SIZE|PRINT/, "é TSPL, não ESC/POS");
});

test("fila pelo Bluetooth: falha no envio para a fila e diz onde parou", async () => {
  const fila = [{ nome: "A", modeloEtiqueta: "nome", copias: 1 }, { nome: "B", modeloEtiqueta: "nome", copias: 1 }];
  let n = 0;
  const r = await imprimirFilaMdk022Usb({ fila, responsavel: "x", unidadeInfo: {}, momento: new Date(),
    enviar: async () => { if (++n === 2) throw new Error("Impressora Bluetooth desconectada"); } });
  assert.equal(r.ok, false);
  assert.equal(r.processadas, 1);
  assert.match(r.erro, /etiqueta 2 de 2.*desconectada/);
});
