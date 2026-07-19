"use client";

// ─── TEMPO REAL ──────────────────────────────────────────────────────────────
// O Supabase avisa quando qualquer tabela muda; a gente dispara um evento
// global e cada tela recarrega sozinha — sem o usuário atualizar a página.
// Requer a publication de realtime no banco (SQL passado no chat).

import { useEffect, useRef } from "react";
import { supabase, isSupabaseReady } from "./supabase";

let canal = null;

export function iniciarTempoReal() {
  if (typeof window === "undefined" || !isSupabaseReady() || canal) return;
  try {
    canal = supabase
      .channel("hefisto-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        try {
          window.dispatchEvent(new CustomEvent("hefisto:mudou", { detail: { tabela: payload.table } }));
        } catch { /* segue */ }
      })
      .subscribe();
  } catch {
    canal = null; // sem realtime habilitado no projeto, o app segue normal
  }
}

// Hook: chama onMudou quando alguma das tabelas mudar (debounce de 300ms para
// rajadas — ex.: salvar a escala grava várias linhas de uma vez).
// tabelas = null/[] escuta TUDO.
// Além do aviso do Supabase, recarrega sozinho a cada 15s com a aba visível e
// na hora em que o usuário volta para o app — assim uma batida de ponto aparece
// no RH mesmo se o realtime do banco não estiver habilitado.
export function useTempoReal(tabelas, onMudou) {
  const cb = useRef(onMudou);
  cb.current = onMudou;
  const timer = useRef(null);

  useEffect(() => {
    const disparar = (t) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (cb.current) cb.current(t); }, 300);
    };
    const h = (e) => {
      const t = e.detail && e.detail.tabela;
      if (tabelas && tabelas.length && !tabelas.includes(t)) return;
      disparar(t);
    };
    const aoVoltar = () => { if (document.visibilityState === "visible") disparar(null); };
    const intervalo = setInterval(() => { if (document.visibilityState === "visible") disparar(null); }, 15000);
    window.addEventListener("hefisto:mudou", h);
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(timer.current);
      clearInterval(intervalo);
      window.removeEventListener("hefisto:mudou", h);
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tabelas || [])]);
}
