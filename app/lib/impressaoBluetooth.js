"use client";

import { nativoDisponivel, estadoNativo, escolherNativo, enviarNativo, imprimirTesteNativo } from "./bluetooth-nativo.mjs";

// IMPRESSÃO BLUETOOTH DIRETA (Web Bluetooth)
// O tablet/celular Android fala direto com a impressora térmica, sem PC, sem
// driver e sem AirPrint. No iPhone/iPad os navegadores comuns (Safari, Chrome
// do iOS) bloqueiam Bluetooth para sites; o navegador Bluefy (App Store) libera,
// e este mesmo código funciona nele. Só impressoras BLE: o iOS não fala o
// Bluetooth "clássico" (SPP) com apps comuns.
//
// Impressoras térmicas de bolso expõem um "serial sobre BLE". Os serviços
// abaixo cobrem os controladores mais comuns no mercado brasileiro.

const SERVICOS_CONHECIDOS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // padrão da maioria das térmicas BLE
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb", // módulos HM-10 / JDY
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip / ISSC (BM70)
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // etiquetadoras TSPL chinesas (Xprinter/Gprinter e similares)
  "0000fff0-0000-1000-8000-00805f9b34fb", // módulos genéricos (fff1/fff2)
  "0000ae30-0000-1000-8000-00805f9b34fb", // térmicas de bolso (ae01/ae02)
  "0000ffb0-0000-1000-8000-00805f9b34fb",
];

// Pedaço enviado por vez. BLE tem MTU pequeno; blocos grandes travam a fila.
const TAMANHO_BLOCO = 180;
const PAUSA_MS = 22;

// Dentro do app Android "Héfisto Etiquetas" o Bluetooth é nativo (clássico
// SPP + BLE). É o caminho da MDK-022, que o navegador não alcança.
export function bluetoothDisponivel() {
  return nativoDisponivel() || (typeof navigator !== "undefined" && !!navigator.bluetooth);
}

export function bluetoothNativo() {
  return nativoDisponivel();
}

// Impressora já salva no app: o funcionário só escolhe o produto e imprime.
export function impressoraSalvaNativa() {
  const e = estadoNativo();
  return e && e.salva ? (e.nome || "Impressora Bluetooth") : "";
}

// Explica por que não dá, em vez de só sumir com o botão.
export function motivoBluetoothIndisponivel() {
  if (typeof navigator === "undefined") return "";
  if (nativoDisponivel() || navigator.bluetooth) return "";

  // Sem https o navegador esconde o Bluetooth mesmo no aparelho certo.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "O Bluetooth só funciona em conexão segura. Abra o ERP pelo endereço https.";
  }

  const ua = String(navigator.userAgent || "");
  const plataforma = String(navigator.userAgentData?.platform || "");

  // Android vem primeiro: o aparelho é Android e o problema é o navegador.
  // Antes o texto de iPhone aparecia em tablet Android quando o navegador
  // (Samsung Internet, Firefox, navegador dentro de outro app) não tem a API.
  if (/Android/i.test(ua) || plataforma === "Android") {
    return "Este navegador do Android não abre Bluetooth. Abra o ERP no Google Chrome (não use o navegador de dentro de outro app).";
  }

  // iPadOS moderno se apresenta como "Macintosh" — só a tela de toque entrega.
  const ehApple = /iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints) > 1);
  if (ehApple) {
    return "No iPhone e no iPad, o Safari não deixa sites usarem Bluetooth. Instale o navegador gratuito \"Bluefy\" na App Store, abra o ERP por ele e toque em Conectar.";
  }
  return "Este navegador não suporta Bluetooth. Use o Google Chrome no Android.";
}

let dispositivo = null;
let caracteristica = null;

// Pede o pareamento e guarda a conexão. Precisa partir de um toque do usuário.
let nomeNativo = "";

export async function conectarImpressoraBluetooth() {
  if (nativoDisponivel()) {
    nomeNativo = await escolherNativo();
    return { nome: nomeNativo || "Impressora Bluetooth" };
  }
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
    // Lista o que a impressora ofereceu: com isso dá para incluir o serviço dela.
    const achados = servicos.map((s) => s.uuid).join(", ") || "nenhum serviço liberado";
    console.warn("[BLUETOOTH] sem característica de escrita. Serviços:", achados);
    throw new Error(`Conectei na impressora, mas ela não aceitou receber dados (serviços: ${achados}). Mande este texto para o suporte.`);
  }
  return { nome: dispositivo.name || "Impressora Bluetooth" };
}

export function impressoraBluetoothConectada() {
  // No app a impressora salva reconecta sozinha a cada impressão.
  if (nativoDisponivel()) return !!(nomeNativo || impressoraSalvaNativa());
  return !!(caracteristica && dispositivo?.gatt?.connected);
}

export function nomeImpressoraBluetooth() {
  if (nativoDisponivel()) return nomeNativo || impressoraSalvaNativa();
  return dispositivo?.name || "";
}

// Etiqueta de teste TSPL (60×40, GAP 2, QR). Mesmos comandos do teste USB.
export function etiquetaTesteTspl() {
  return new TextEncoder().encode([
    "SIZE 60 mm,40 mm",
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "CLS",
    "TEXT 24,24,\"3\",0,1,1,\"HEFISTO\"",
    "TEXT 24,80,\"3\",0,1,1,\"TESTE BLUETOOTH\"",
    "TEXT 24,136,\"2\",0,1,1,\"MDK-022 60x40 GAP 2\"",
    "QRCODE 330,40,L,5,A,0,\"HEFISTO BLUETOOTH OK\"",
    "PRINT 1,1",
  ].map((l) => l + "\r\n").join(""));
}

export async function imprimirTesteBluetooth() {
  if (nativoDisponivel()) return imprimirTesteNativo();
  return enviarBytesBluetooth(etiquetaTesteTspl());
}

export async function desconectarImpressoraBluetooth() {
  try { if (dispositivo?.gatt?.connected) dispositivo.gatt.disconnect(); } catch { /* já caiu */ }
  caracteristica = null;
}

// Envia os bytes em blocos pequenos, com pausa — impressora térmica engasga
// quando recebe tudo de uma vez.
export async function enviarBytesBluetooth(bytes) {
  if (nativoDisponivel()) { await enviarNativo(bytes); return; }
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
