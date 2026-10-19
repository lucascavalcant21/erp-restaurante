"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Puxar-para-atualizar: no app instalado (standalone) não existe botão de
// recarregar do navegador, então habilitamos o gesto de puxar pra baixo no
// topo da página para dar refresh. Fora do app instalado, fica inativo
// (o navegador já tem o seu próprio recarregar).
export default function PullToRefresh() {
  const [dist, setDist] = useState(0);       // deslocamento visível do indicador
  const [refreshing, setRefreshing] = useState(false);
  const distRef = useRef(0);
  const startY = useRef(null);
  const ativo = useRef(false);
  const container = useRef(null);   // quem realmente rola sob o dedo

  const THRESHOLD = 110;  // puxada mínima para disparar (firme e deliberada)
  const MAX = 150;        // deslocamento máximo (com resistência)

  // Encontra o elemento que de fato rola sob o toque. No painel, quem rola é o
  // <main> interno (a janela fica sempre em scrollY 0) — por isso não dá para
  // confiar em window.scrollY. Sobe na árvore até achar um container rolável.
  const acharContainer = (alvo) => {
    let node = alvo;
    while (node && node.nodeType === 1 && node !== document.body) {
      const st = window.getComputedStyle(node);
      const oy = st.overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentNode;
    }
    return document.scrollingElement || document.documentElement;
  };

  const noTopo = (c) => (c ? c.scrollTop <= 0 : window.scrollY <= 0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const bloquearGesto = (e) => {
      e.preventDefault();
    };

    const bloquearPinchTouch = (e) => {
      if ((e.touches && e.touches.length > 1) || (typeof e.scale === "number" && e.scale !== 1)) {
        e.preventDefault();
      }
    };

    let ultimoToque = 0;
    const bloquearDoubleTapZoom = (e) => {
      const agora = Date.now();
      if (agora - ultimoToque <= 300 && (!e.touches || e.touches.length === 0)) {
        e.preventDefault();
      }
      ultimoToque = agora;
    };

    const bloquearWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const bloquearTecladoZoom = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "_")) {
        e.preventDefault();
      }
    };

    const opts = { passive: false };
    document.addEventListener("gesturestart", bloquearGesto, opts);
    document.addEventListener("gesturechange", bloquearGesto, opts);
    document.addEventListener("gestureend", bloquearGesto, opts);
    document.addEventListener("touchmove", bloquearPinchTouch, opts);
    document.addEventListener("touchend", bloquearDoubleTapZoom, opts);
    window.addEventListener("wheel", bloquearWheelZoom, opts);
    window.addEventListener("keydown", bloquearTecladoZoom, opts);

    return () => {
      document.removeEventListener("gesturestart", bloquearGesto, opts);
      document.removeEventListener("gesturechange", bloquearGesto, opts);
      document.removeEventListener("gestureend", bloquearGesto, opts);
      document.removeEventListener("touchmove", bloquearPinchTouch, opts);
      document.removeEventListener("touchend", bloquearDoubleTapZoom, opts);
      window.removeEventListener("wheel", bloquearWheelZoom, opts);
      window.removeEventListener("keydown", bloquearTecladoZoom, opts);
    };
  }, []);

  return null;
  if (dist <= 0 && !refreshing) return null;

  const progresso = Math.min(1, dist / THRESHOLD);
  const pronto = progresso >= 1;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9999,
        transform: `translateY(${dist}px)`,
        transition: ativo.current ? "none" : "transform 200ms ease",
      }}
    >
      <div
        style={{
          marginTop: 10,
          width: 40,
          height: 40,
          borderRadius: "9999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--card, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 6px 20px rgba(15,23,42,0.15)",
          color: "var(--accent-strong, #059669)",
        }}
      >
        <RefreshCw
          size={20}
          className={refreshing ? "animate-spin" : ""}
          style={{
            transform: refreshing ? undefined : `rotate(${progresso * 270}deg)`,
            opacity: pronto || refreshing ? 1 : 0.6,
          }}
        />
      </div>
    </div>
  );
}
