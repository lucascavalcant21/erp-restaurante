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
    const ehStandalone =
      (typeof window !== "undefined" &&
        (window.matchMedia?.("(display-mode: standalone)").matches ||
          window.navigator.standalone === true));
    if (!ehStandalone) return; // só dentro do app instalado

    const onStart = (e) => {
      // Um dedo só; se estiver recarregando, ignora
      if (refreshing || e.touches.length !== 1) { ativo.current = false; return; }
      const c = acharContainer(e.target);
      container.current = c;
      // Só arma o gesto se o conteúdo já está encostado no topo
      if (!noTopo(c)) { ativo.current = false; return; }
      startY.current = e.touches[0].clientY;
      ativo.current = true;
    };
    const onMove = (e) => {
      if (!ativo.current || startY.current == null) return;
      // Se durante o movimento o conteúdo saiu do topo (o usuário está rolando
      // a página, não puxando), cancela na hora — nada de recarregar.
      if (!noTopo(container.current)) { ativo.current = false; distRef.current = 0; setDist(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { distRef.current = 0; setDist(0); return; }
      const d = Math.min(MAX, dy * 0.5); // resistência
      distRef.current = d;
      setDist(d);
    };
    const onEnd = () => {
      if (!ativo.current) return;
      ativo.current = false;
      startY.current = null;
      if (distRef.current >= THRESHOLD) {
        setRefreshing(true);
        setDist(THRESHOLD);
        setTimeout(() => window.location.reload(), 150);
      } else {
        distRef.current = 0;
        setDist(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

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
