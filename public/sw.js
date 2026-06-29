/* Hefisto — Service Worker (PWA installability + offline shell)
 * Conservador de propósito: NÃO intercepta chamadas ao Supabase nem requisições
 * que não sejam GET, para nunca servir dado de operação desatualizado.
 * Para navegações/estáticos same-origin usa network-first com fallback ao cache.
 */
const CACHE = "hefisto-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só lidamos com GET same-origin. Tudo mais (POST, Supabase, APIs) passa direto.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first: tenta a rede; se cair, usa o cache (modo offline).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});
