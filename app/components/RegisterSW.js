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

    // Bloqueia cópia e seleção de textos e números fora de campos editáveis (inputs/textareas)
    const ehElementoEditavel = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      if (typeof el.closest === "function" && el.closest("input, textarea, select, [contenteditable='true']")) return true;
      return false;
    };

    const bloquearCopia = (e) => {
      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (!ehElementoEditavel(e.target) && !ehElementoEditavel(active)) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.clearData();
        }
      }
    };

    const bloquearAtalhoCopia = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")) {
        const active = typeof document !== "undefined" ? document.activeElement : null;
        if (!ehElementoEditavel(e.target) && !ehElementoEditavel(active)) {
          e.preventDefault();
        }
      }
    };

    const bloquearDrag = (e) => {
      if (!ehElementoEditavel(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener("copy", bloquearCopia, true);
    document.addEventListener("cut", bloquearCopia, true);
    document.addEventListener("keydown", bloquearAtalhoCopia, true);
    document.addEventListener("dragstart", bloquearDrag, true);

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

    return () => {
      window.removeEventListener("error", autoRecarregarNoChunkError);
      window.removeEventListener("unhandledrejection", autoRecarregarNoChunkError);
      document.removeEventListener("copy", bloquearCopia, true);
      document.removeEventListener("cut", bloquearCopia, true);
      document.removeEventListener("keydown", bloquearAtalhoCopia, true);
      document.removeEventListener("dragstart", bloquearDrag, true);
      window.removeEventListener("load", onLoad);
    };
  }, []);
  return null;
}
