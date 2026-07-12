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

// Hook: chama onMudou quando alguma das tabelas mudar (debounce de 700ms para
// rajadas — ex.: salvar a escala grava várias linhas de uma vez).
// tabelas = null/[] escuta TUDO.
export function useTempoReal(tabelas, onMudou) {
  const cb = useRef(onMudou);
  cb.current = onMudou;
  const timer = useRef(null);

  useEffect(() => {
    const h = (e) => {
      const t = e.detail && e.detail.tabela;
      if (tabelas && tabelas.length && !tabelas.includes(t)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (cb.current) cb.current(t); }, 700);
    };
    window.addEventListener("hefisto:mudou", h);
    return () => { clearTimeout(timer.current); window.removeEventListener("hefisto:mudou", h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tabelas || [])]);
}
