// Hook de carregamento que troca o adapter do WhatsApp por um FALSO: em vez de
// resolver identidade e executar intenções do Héfisto, só anota o payload em
// globalThis.__eventosWhatsApp. O teste confere se algum evento foi processado.
export async function resolve(especificador, contexto, proximo) {
  const r = await proximo(especificador, contexto);
  if (/\/app\/lib\/server\/channels\/whatsapp\/adapter\.mjs$/.test(r.url)) {
    return { url: "stub:whatsapp-adapter", shortCircuit: true };
  }
  return r;
}

export function load(url, contexto, proximo) {
  if (url === "stub:whatsapp-adapter") {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export async function processWhatsAppIncomingEvent(payload) {
          (globalThis.__eventosWhatsApp ||= []).push(payload);
          return { success: true };
        }
      `,
    };
  }
  if (url.startsWith("file:") && /\/app\/.*\.js$/.test(url)) {
    // Os .js de app/ são ESM sem "type": "module" no package.json.
    return proximo(url, { ...contexto, format: "module" });
  }
  return proximo(url, contexto);
}
