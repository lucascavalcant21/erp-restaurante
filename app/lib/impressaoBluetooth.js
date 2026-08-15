"use client";

// IMPRESSÃO BLUETOOTH DIRETA (Web Bluetooth)
// O tablet/celular Android fala direto com a impressora térmica, sem PC, sem
// driver e sem AirPrint. O iPhone NÃO suporta Web Bluetooth — nele a impressão
// continua pelo computador.
//
// Impressoras térmicas de bolso expõem um "serial sobre BLE". Os serviços
// abaixo cobrem os controladores mais comuns no mercado brasileiro.

const SERVICOS_CONHECIDOS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // padrão da maioria das térmicas BLE
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb", // módulos HM-10 / JDY
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip / ISSC (BM70)
];

// Pedaço enviado por vez. BLE tem MTU pequeno; blocos grandes travam a fila.
const TAMANHO_BLOCO = 180;
const PAUSA_MS = 22;

export function bluetoothDisponivel() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// Explica por que não dá, em vez de só sumir com o botão.
export function motivoBluetoothIndisponivel() {
  if (typeof navigator === "undefined") return "";
  if (navigator.bluetooth) return "";
  const ua = String(navigator.userAgent || "");
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "O iPhone e o iPad não deixam sites usarem Bluetooth. Use o tablet Android ou imprima pelo computador.";
  }
  return "Este navegador não suporta Bluetooth. Use o Google Chrome no Android.";
}

let dispositivo = null;
let caracteristica = null;

// Pede o pareamento e guarda a conexão. Precisa partir de um toque do usuário.
export async function conectarImpressoraBluetooth() {
  if (!bluetoothDisponivel()) throw new Error(motivoBluetoothIndisponivel());

  dispositivo = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICOS_CONHECIDOS,
  });

  dispositivo.addEventListener("gattserverdisconnected", () => { caracteristica = null; });

  const servidor = await dispositivo.gatt.connect();
  const servicos = await servidor.getPrimaryServices();

  // Procura a característica que aceita escrita — é por onde os comandos vão.
  for (const servico of servicos) {
    let chars = [];
    try { chars = await servico.getCharacteristics(); } catch { continue; }
    const escrevivel = chars.find(c => c.properties?.write || c.properties?.writeWithoutResponse);
    if (escrevivel) { caracteristica = escrevivel; break; }
  }
  if (!caracteristica) {
    throw new Error("Conectei na impressora, mas ela não aceitou receber dados. Confira se é o modelo certo.");
  }
  return { nome: dispositivo.name || "Impressora Bluetooth" };
}

export function impressoraBluetoothConectada() {
  return !!(caracteristica && dispositivo?.gatt?.connected);
}

export function nomeImpressoraBluetooth() {
  return dispositivo?.name || "";
}

export async function desconectarImpressoraBluetooth() {
  try { if (dispositivo?.gatt?.connected) dispositivo.gatt.disconnect(); } catch { /* já caiu */ }
  caracteristica = null;
}

// Envia os bytes em blocos pequenos, com pausa — impressora térmica engasga
// quando recebe tudo de uma vez.
export async function enviarBytesBluetooth(bytes) {
  if (!impressoraBluetoothConectada()) {
    // A conexão pode ter caído sozinha; tenta reabrir sem novo pareamento.
    if (dispositivo?.gatt && !dispositivo.gatt.connected) {
      await dispositivo.gatt.connect().catch(() => {});
    }
    if (!impressoraBluetoothConectada()) throw new Error("Impressora Bluetooth desconectada. Toque em conectar de novo.");
  }
  const semResposta = !!caracteristica.properties?.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += TAMANHO_BLOCO) {
    const bloco = bytes.slice(i, i + TAMANHO_BLOCO);
    if (semResposta && caracteristica.writeValueWithoutResponse) {
      await caracteristica.writeValueWithoutResponse(bloco);
    } else {
      await caracteristica.writeValue(bloco);
    }
    await new Promise(r => setTimeout(r, PAUSA_MS));
  }
}
