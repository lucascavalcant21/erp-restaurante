// Ponte com o app Android "Héfisto Etiquetas": um app falso no lugar do Android.
// node --test app/lib/bluetooth-nativo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { nativoDisponivel, estadoNativo, escolherNativo, enviarNativo, imprimirTesteNativo, bytesParaBase64 } from "./bluetooth-nativo.mjs";

// App falso: responde como o MainActivity (window.__hefistoBtRetorno(id, ok, msg)).
function appFalso({ salva = false, falhar = null, mudo = false } = {}) {
  const chamadas = [];
  const janela = {};
  const responder = (id, ok, msg) => setTimeout(() => janela.__hefistoBtRetorno(id, ok, msg), 1);
  janela.HefistoBluetoothNativo = {
    estado: () => JSON.stringify({ bluetooth: true, ligado: true, permissoes: true, salva, nome: salva ? "MDK-022" : "", conectada: false }),
    escolher: (id) => { chamadas.push(["escolher"]); if (!mudo) responder(id, falhar !== "escolher", falhar === "escolher" ? "cancelado" : "MDK-022"); },
    reconectar: (id) => responder(id, true, "MDK-022"),
    enviar: (b64, id) => { chamadas.push(["enviar", b64]); if (!mudo) responder(id, falhar !== "enviar", falhar === "enviar" ? "Impressora Bluetooth não conectada." : "10"); },
    imprimirTeste: (id) => { chamadas.push(["teste"]); responder(id, true, "ok"); },
    abrirDiagnostico: () => chamadas.push(["diagnostico"]),
  };
  return { janela, chamadas };
}

test("fora do app: nada de ponte", () => {
  assert.equal(nativoDisponivel({}), false);
  assert.equal(estadoNativo({}), null);
});

test("dentro do app: estado, escolher impressora e enviar os bytes exatos", async () => {
  const { janela, chamadas } = appFalso({ salva: true });
  assert.equal(nativoDisponivel(janela), true);
  assert.deepEqual(estadoNativo(janela).nome, "MDK-022");
  assert.equal(await escolherNativo(janela), "MDK-022");
  const bytes = new TextEncoder().encode("SIZE 60 mm,40 mm\r\nPRINT 1,1\r\n");
  await enviarNativo(bytes, janela);
  const enviado = chamadas.find((c) => c[0] === "enviar")[1];
  assert.deepEqual(Buffer.from(enviado, "base64"), Buffer.from(bytes), "app recebe exatamente os bytes TSPL");
  assert.equal(await imprimirTesteNativo(janela), "ok");
});

test("erro do app chega como erro com a mensagem dele", async () => {
  const { janela } = appFalso({ falhar: "enviar" });
  await assert.rejects(enviarNativo(new Uint8Array([1, 2, 3]), janela), /não conectada/);
  const b = appFalso({ falhar: "escolher" });
  await assert.rejects(escolherNativo(b.janela), /cancelado/);
});

test("base64 de etiqueta grande (bitmap) sem estourar a pilha", () => {
  const grande = new Uint8Array(300000).map((_, i) => i % 256);
  assert.deepEqual(Buffer.from(bytesParaBase64(grande), "base64"), Buffer.from(grande));
});

test("app que não responde: erro claro depois do tempo limite", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { janela } = appFalso({ mudo: true });
  const p = enviarNativo(new Uint8Array([1]), janela);
  t.mock.timers.tick(60001);
  await assert.rejects(p, /não respondeu a tempo/);
});

test("tela de etiquetas: dentro do app usa a ponte (TSPL de teste 60x40 GAP 2 com QR)", async () => {
  const { janela, chamadas } = appFalso({ salva: true });
  globalThis.window = janela;
  try {
    const m = await import("./impressaoBluetooth.js");
    assert.equal(m.bluetoothDisponivel(), true);
    assert.equal(m.motivoBluetoothIndisponivel(), "");
    assert.equal(m.impressoraBluetoothConectada(), true, "impressora salva no app já conta como pronta");
    assert.equal(m.nomeImpressoraBluetooth(), "MDK-022");
    const tspl = new TextDecoder().decode(m.etiquetaTesteTspl());
    assert.match(tspl, /^SIZE 60 mm,40 mm\r\nGAP 2 mm,0 mm\r\n/);
    assert.match(tspl, /\r\nQRCODE [^\r]+\r\nPRINT 1,1\r\n$/);
    await m.enviarBytesBluetooth(new Uint8Array([65, 66]));
    assert.deepEqual(Buffer.from(chamadas.find((c) => c[0] === "enviar")[1], "base64"), Buffer.from([65, 66]));
    await m.imprimirTesteBluetooth();
    assert.ok(chamadas.some((c) => c[0] === "teste"));
  } finally {
    delete globalThis.window;
  }
});
