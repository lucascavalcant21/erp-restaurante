"use client";

import { useEffect } from "react";

// Registra o service worker (habilita "Instalar app" no celular) e busca
// atualizações quando o app volta ao foco, para pegar novos deploys.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reg = null;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").then((r) => { reg = r; }).catch(() => {});
      // Armazenamento PERSISTENTE: pede ao Android/Chrome para nunca apagar os
      // dados do app (é o que guarda o login). Sem isso, sob pressão de espaço
      // o sistema pode limpar o site e o usuário "desloga sozinho".
      try { navigator.storage?.persist?.().catch(() => {}); } catch (_) {}
    };
    const onFocus = () => { if (reg) reg.update().catch(() => {}); };

    window.addEventListener("load", onLoad);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
