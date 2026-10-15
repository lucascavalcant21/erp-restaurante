// Ponte com o app Android "Héfisto Etiquetas" (android-bluetooth/).
// Dentro do app, o Bluetooth é nativo: fala com impressora CLÁSSICA (SPP),
// que o navegador não alcança, e com BLE. Fora do app, nada disto existe e o
// Héfisto continua com o Web Bluetooth do navegador.

const ESPERA_MS = 60000;

function ponte(janela = globalThis.window) {
  const p = janela?.HefistoBluetoothNativo;
  return p && typeof p.enviar === "function" ? p : null;
}

export function nativoDisponivel(janela) {
  return !!ponte(janela);
}

export function estadoNativo(janela) {
  const p = ponte(janela);
  if (!p) return null;
  try { return JSON.parse(p.estado() || "{}"); } catch { return {}; }
}

let seq = 0;
const pendentes = new Map();

function instalarRetorno(janela) {
  if (janela.__hefistoBtRetorno) return;
  janela.__hefistoBtRetorno = (id, ok, mensagem) => {
    const p = pendentes.get(id);
    if (!p) return;
    pendentes.delete(id);
    clearTimeout(p.timer);
    if (ok) p.resolver(mensagem); else p.rejeitar(new Error(mensagem || "Falha no Bluetooth"));
  };
}

// Chama um método assíncrono da ponte; o app responde por __hefistoBtRetorno.
function chamar(metodo, args = [], janela = globalThis.window) {
  const p = ponte(janela);
  if (!p) return Promise.reject(new Error("App Héfisto Etiquetas não detectado."));
  instalarRetorno(janela);
  const id = `bt${Date.now()}_${++seq}`;
  return new Promise((resolver, rejeitar) => {
    const timer = setTimeout(() => {
      pendentes.delete(id);
      rejeitar(new Error("A impressora não respondeu a tempo. Ela está ligada e perto?"));
    }, ESPERA_MS);
    pendentes.set(id, { resolver, rejeitar, timer });
    try { p[metodo](...args, id); } catch (e) { pendentes.delete(id); clearTimeout(timer); rejeitar(e); }
  });
}

export function bytesParaBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Abre a lista de impressoras pareadas e conecta; devolve o nome. */
export const escolherNativo = (janela) => chamar("escolher", [], janela);
/** Reconecta na impressora salva, sem perguntar. */
export const reconectarNativo = (janela) => chamar("reconectar", [], janela);
/** Envia os bytes (TSPL ou ESC/POS) já montados pelo Héfisto. */
export const enviarNativo = (bytes, janela) => chamar("enviar", [bytesParaBase64(bytes)], janela);
/** Etiqueta de teste 60×40 com QR, montada pelo app. */
export const imprimirTesteNativo = (janela) => chamar("imprimirTeste", [], janela);

export function abrirDiagnosticoNativo(janela = globalThis.window) {
  try { ponte(janela)?.abrirDiagnostico(); } catch { /* fora do app */ }
}
