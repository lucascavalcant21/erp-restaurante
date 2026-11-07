"use client";

// USB DIRETO (WebUSB, 07/11/2026): o Chrome do computador ou do Android (com
// cabo OTG) fala direto com a térmica, sem driver e sem assistente. Mesma
// lógica da página de diagnóstico (Configurações → Impressoras USB). Não
// funciona no iPhone nem no Safari. No Windows, a impressora que já tem driver
// instalado costuma ficar presa a ele: use o assistente de impressão.

let dispositivo = null;
let endpoint = null;

export function usbDisponivel() {
  return typeof navigator !== "undefined" && !!navigator.usb?.requestDevice;
}

async function preparar(dev) {
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  for (const intf of dev.configuration.interfaces) {
    for (const alt of intf.alternates) {
      const out = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
      if (out) {
        await dev.claimInterface(intf.interfaceNumber);
        dispositivo = dev;
        endpoint = out.endpointNumber;
        return { nome: dev.productName || "Impressora USB" };
      }
    }
  }
  throw new Error("Este aparelho USB não aceita impressão.");
}

/** Pede ao navegador a impressora (precisa de um toque na tela). */
export async function conectarImpressoraUsb() {
  if (!usbDisponivel()) throw new Error("Este navegador não tem USB direto. Use o Chrome no computador ou no Android.");
  const dev = await navigator.usb.requestDevice({ filters: [] });
  return preparar(dev);
}

/** Reabre a impressora já autorizada antes, sem perguntar de novo. */
export async function reconectarImpressoraUsb() {
  if (!usbDisponivel()) return null;
  if (dispositivo?.opened && endpoint !== null) return { nome: dispositivo.productName || "Impressora USB" };
  const autorizados = await navigator.usb.getDevices().catch(() => []);
  if (!autorizados.length) return null;
  try { return await preparar(autorizados[0]); } catch { return null; }
}

export function impressoraUsbConectada() {
  return !!(dispositivo?.opened && endpoint !== null);
}

export async function enviarBytesUsb(bytes) {
  if (!impressoraUsbConectada()) await reconectarImpressoraUsb();
  if (!impressoraUsbConectada()) throw new Error("Impressora USB desconectada. Toque em conectar.");
  for (let i = 0; i < bytes.length; i += 4096) {
    const r = await dispositivo.transferOut(endpoint, bytes.slice(i, i + 4096));
    if (r.status !== "ok") throw new Error("A impressora USB recusou os dados.");
  }
}
