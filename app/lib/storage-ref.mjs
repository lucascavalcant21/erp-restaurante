// REFERÊNCIA DE ARQUIVO NO STORAGE — o que o banco guarda no lugar de URL.
//
// Até a SEC-RH-1.3A, documentos, atestados e fotos de RH eram gravados como a
// URL devolvida por getPublicUrl(): um link permanente, sem expiração, que
// qualquer pessoa com ele abre. O modelo agora é:
//
//   banco guarda   storage://<bucket>/<caminho>        (nunca URL assinada)
//   servidor gera  URL assinada curta, só depois de autorizar quem pede
//
// Este módulo é puro (sem Supabase, sem Next): converte os formatos antigos e
// o novo para { bucket, path } e recusa caminho que tente sair da pasta.

export const PREFIXO_REF = "storage://";

const ROTA_STORAGE = /^\/storage\/v1\/object\/(public|sign|authenticated)\/([^/]+)\/(.+)$/;

/** Caminho aceitável: relativo, sem "..", sem barra invertida, sem vazio. */
export function caminhoSeguro(path) {
  const p = String(path ?? "");
  if (!p || p.length > 512) return false;
  if (p.startsWith("/") || p.includes("\\") || /[\u0000-\u001f]/.test(p)) return false;
  return p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

const bucketValido = (b) => /^[a-z0-9][a-z0-9_-]{0,62}$/.test(String(b ?? ""));

export function montarRef(bucket, path) {
  if (!bucketValido(bucket) || !caminhoSeguro(path)) throw new Error("Referência de arquivo inválida.");
  return `${PREFIXO_REF}${bucket}/${path}`;
}

/**
 * Lê o que estiver gravado na coluna e devolve { bucket, path, formato } ou
 * null quando não é arquivo do nosso Storage.
 *
 * formato: "ref"         — storage://bucket/caminho (modelo novo)
 *          "url_publica" — URL antiga de getPublicUrl()
 *          "url_assinada"/"url_autenticada" — raras, mas tratadas igual
 *
 * @param {string} valor
 * @param {{ hostEsperado?: string }} [opcoes]  host do projeto Supabase; URL de
 *        outro host não é arquivo nosso e volta null.
 */
export function lerRef(valor, { hostEsperado } = {}) {
  const v = String(valor ?? "").trim();
  if (!v) return null;

  if (v.startsWith(PREFIXO_REF)) {
    const resto = v.slice(PREFIXO_REF.length);
    const i = resto.indexOf("/");
    if (i <= 0) return null;
    const bucket = resto.slice(0, i);
    const path = resto.slice(i + 1);
    // Referência é gerada pelo servidor (uuid) ou pela conversão da FASE 2,
    // que pula URL com "%": caractere codificado aqui não tem uso legítimo.
    if (!bucketValido(bucket) || !caminhoSeguro(path) || path.includes("%")) return null;
    return { bucket, path, formato: "ref" };
  }

  // new URL() resolve "..", "." e "%2e%2e" antes de a gente ver o caminho.
  // Em vez de confiar na normalização, URL com isso é recusada na entrada.
  if (/%2e/i.test(v) || /\/\.{1,2}(\/|$|\?|#)/.test(v)) return null;

  let url;
  try { url = new URL(v); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (hostEsperado && url.host !== hostEsperado) return null;

  const m = url.pathname.match(ROTA_STORAGE);
  if (!m) return null;
  let bucket;
  let path;
  try {
    bucket = decodeURIComponent(m[2]);
    path = m[3].split("/").map(decodeURIComponent).join("/");
  } catch { return null; }
  if (!bucketValido(bucket) || !caminhoSeguro(path)) return null;
  const formato = m[1] === "public" ? "url_publica" : m[1] === "sign" ? "url_assinada" : "url_autenticada";
  return { bucket, path, formato };
}

/** É um link http(s) comum, que não aponta para o nosso Storage? */
export function ehLinkExterno(valor, opcoes) {
  const v = String(valor ?? "").trim();
  if (!/^https?:\/\//i.test(v)) return false;
  return lerRef(v, opcoes) === null && !/\/storage\/v1\/object\//.test(v);
}
