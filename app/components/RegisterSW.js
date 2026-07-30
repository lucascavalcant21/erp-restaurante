"use client";

import { useEffect } from "react";

// Registra o service worker (habilita "Instalar app" no celular) e busca
// atualizações quando o app volta ao foco, para pegar novos deploys.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Recuperação automática de "Loading chunk failed" quando sai nova atualização no servidor
    const autoRecarregarNoChunkError = (e) => {
      const msg = String(e?.message || e?.error?.message || e?.reason?.message || e?.reason || "");
      if (msg.includes("Loading chunk") || msg.includes("ChunkLoadError") || msg.includes("failed to fetch")) {
        console.warn("[Hefisto] Nova versão detectada após implantação. Recarregando...");
        const key = "hefisto_last_chunk_reload";
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last > 3000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", autoRecarregarNoChunkError);
    window.addEventListener("unhandledrejection", autoRecarregarNoChunkError);

    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => {});

      try { navigator.storage?.persist?.().catch(() => {}); } catch (_) {}
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }
  }, []);
  return null;
}
