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
// Usa Set O(1) via ref para evitar JSON.stringify a cada render e re-subscrições.
export function useTempoReal(tabelas, onMudou) {
  const cb = useRef(onMudou);
  cb.current = onMudou;

  const tabelasSetRef = useRef(null);
  tabelasSetRef.current = Array.isArray(tabelas) && tabelas.length > 0 ? new Set(tabelas) : null;

  const timer = useRef(null);

  useEffect(() => {
    const disparar = (t) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (cb.current) cb.current(t); }, 300);
    };
    const h = (e) => {
      const t = e.detail && e.detail.tabela;
      const filtro = tabelasSetRef.current;
      if (filtro && !filtro.has(t)) return;
      disparar(t);
    };
    window.addEventListener("hefisto:mudou", h);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("hefisto:mudou", h);
    };
  }, []);
}
