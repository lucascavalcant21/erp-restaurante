"use client";

import { useEffect, useRef, useState } from "react";
import LogoHefisto from "./layout/LogoHefisto";

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
  const startX = useRef(0);
  const refreshingRef = useRef(false);
  const mostrar = (v) => { distRef.current = v; setDist(v); };

  const THRESHOLD = 80;   // puxada mínima para disparar (já com a resistência)
  const MAX = 130;        // deslocamento máximo

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

  // Puxar para atualizar (dono, 17/11/2026: "quando eu puxar para baixo a tela
  // carrega e atualiza, e enquanto carrega aparece o H saltitando dizendo
  // carregando, bem rápido"). Só com um dedo, começando no topo do que rola e
  // puxando para baixo de verdade; fora de campos, mapas e janelas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // só no app instalado: no navegador, o próprio navegador já recarrega ao puxar
    const instalado = window.matchMedia?.("(display-mode: standalone)")?.matches || window.matchMedia?.("(display-mode: fullscreen)")?.matches || window.navigator.standalone === true;
    if (!instalado) return;
    const ignorar = (alvo) => !!alvo?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog'], [data-sem-puxar], canvas, .leaflet-container");
    const inicio = (e) => {
      if (refreshingRef.current || !e.touches || e.touches.length !== 1 || ignorar(e.target)) { startY.current = null; return; }
      const c = acharContainer(e.target);
      container.current = c;
      if (!noTopo(c)) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      ativo.current = false;
    };
    const mover = (e) => {
      if (startY.current == null || refreshingRef.current) return;
      if (e.touches.length !== 1) { startY.current = null; mostrar(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      const dx = Math.abs(e.touches[0].clientX - startX.current);
      if (!ativo.current) {
        // só vira "puxar" se for para baixo, mais vertical que lateral, e ainda no topo
        if (dy < 8) return;
        if (dx > dy || !noTopo(container.current)) { startY.current = null; return; }
        ativo.current = true;
      }
      if (e.cancelable) e.preventDefault(); // segura o quique do iPhone enquanto puxa
      mostrar(Math.min(MAX, dy * 0.55)); // resistência
    };
    const fim = () => {
      if (startY.current == null) return;
      startY.current = null;
      const puxou = ativo.current && distRef.current >= THRESHOLD;
      ativo.current = false;
      if (!puxou) { mostrar(0); return; }
      refreshingRef.current = true;
      setRefreshing(true);
      mostrar(56);
      // recarrega a página inteira: unidade, sessão e números vêm do banco de novo
      setTimeout(() => window.location.reload(), 120);
    };
    const opts = { passive: false };
    document.addEventListener("touchstart", inicio, { passive: true });
    document.addEventListener("touchmove", mover, opts);
    document.addEventListener("touchend", fim, { passive: true });
    document.addEventListener("touchcancel", fim, { passive: true });
    return () => {
      document.removeEventListener("touchstart", inicio, { passive: true });
      document.removeEventListener("touchmove", mover, opts);
      document.removeEventListener("touchend", fim, { passive: true });
      document.removeEventListener("touchcancel", fim, { passive: true });
    };
  }, []);

  if (dist <= 0 && !refreshing) return null;

  const progresso = Math.min(1, dist / THRESHOLD);
  const pronto = progresso >= 1;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center",
        pointerEvents: "none", zIndex: 9999,
        transform: `translateY(${Math.max(0, dist - 48)}px)`,
        transition: ativo.current ? "none" : "transform 160ms ease",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div
        style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 10px",
          borderRadius: 9999, background: "var(--card, #ffffff)", border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 6px 20px rgba(15,23,42,0.15)", opacity: refreshing ? 1 : 0.4 + progresso * 0.6,
        }}
      >
        <span className={refreshing ? "hf-saltitando" : ""} style={{ display: "inline-flex", transform: refreshing ? undefined : `scale(${0.7 + progresso * 0.3})` }}>
          <LogoHefisto className="w-7 h-7" />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg, #0f172a)" }}>
          {refreshing ? "Carregando…" : pronto ? "Solte para atualizar" : "Puxe para atualizar"}
        </span>
      </div>
    </div>
  );
}
