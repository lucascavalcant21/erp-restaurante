"use client";

import { useEffect } from "react";

// Registra o service worker (habilita "Instalar app" no celular) e busca
// atualizações quando o app volta ao foco, para pegar novos deploys.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
