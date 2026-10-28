"use client";

import { useEffect, useState } from "react";

// "Reduzir movimento" do aparelho. O CSS já desliga as animações sozinho; isto
// é para o que o CSS não alcança (vídeo que toca sozinho, carrossel por tempo).
export default function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setReduzido(mq.matches);
    ler();
    mq.addEventListener?.("change", ler);
    return () => mq.removeEventListener?.("change", ler);
  }, []);
  return reduzido;
}
