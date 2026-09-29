// Hook de carregamento para testar os módulos de app/lib em Node puro:
//   1. import relativo sem extensão ("./supabase") resolve para ".js", como o
//      bundler do Next faz;
//   2. app/lib/supabase(.js) vira um cliente FALSO, lido de
//      globalThis.__supabaseFalso — o teste monta o banco que quiser.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(especificador, contexto, proximo) {
  if (/^\.\.?\//.test(especificador) && !/\.[cm]?js$/.test(especificador) && contexto.parentURL) {
    const alvo = new URL(`${especificador}.js`, contexto.parentURL);
    if (existsSync(fileURLToPath(alvo))) return resolve(alvo.href, contexto, proximo);
  }
  const r = await proximo(especificador, contexto);
  if (/\/app\/lib\/supabase\.js$/.test(r.url)) return { url: "stub:supabase-cliente", shortCircuit: true };
  return r;
}

export function load(url, contexto, proximo) {
  if (url === "stub:supabase-cliente") {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export const supabase = new Proxy({}, { get: (_, k) => globalThis.__supabaseFalso[k] });
        export const isSupabaseReady = () => true;
        export const supabaseInitError = null;
        export default supabase;
      `,
    };
  }
  if (url.startsWith("file:") && /\/app\/.*\.js$/.test(url)) {
    // Os .js de app/ são ESM sem "type": "module" no package.json.
    return proximo(url, { ...contexto, format: "module" });
  }
  return proximo(url, contexto);
}
