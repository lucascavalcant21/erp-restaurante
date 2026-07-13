"use client";

import { useEffect, useRef } from "react";

// ─── RASCUNHO DE FORMULÁRIO ──────────────────────────────────────────────────
// Mantém o que foi digitado enquanto a página fica aberta:
//  - Ao ATUALIZAR (F5 / recarregar) a página, o conteúdo é restaurado.
//  - Ao SAIR da página (navegar para outra) e voltar, começa em branco.
//
// Funciona porque o sessionStorage sobrevive ao reload, mas a limpeza (feita no
// desmonte do componente) só roda quando você navega para FORA — no reload o
// navegador descarta o JS sem rodar o cleanup do React, então o rascunho fica.
//
// Uso: useRascunho("rascunho_etiqueta", form, (salvo) => setForm(f => ({ ...f, ...salvo })));
export function useRascunho(chave, valor, aplicar, { ativo = true } = {}) {
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const primeiroSave = useRef(true);

  // Restaura uma vez ao montar; limpa ao sair da página (navegação).
  useEffect(() => {
    if (!ativo || typeof window === "undefined") return;
    try {
      const bruto = sessionStorage.getItem(chave);
      if (bruto) aplicarRef.current(JSON.parse(bruto));
    } catch (_) {}
    return () => {
      try { sessionStorage.removeItem(chave); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ativo]);

  // Salva a cada mudança. Pula a primeira execução (montagem) para não
  // sobrescrever o rascunho restaurado com o estado inicial vazio.
  useEffect(() => {
    if (!ativo || typeof window === "undefined") return;
    if (primeiroSave.current) { primeiroSave.current = false; return; }
    try { sessionStorage.setItem(chave, JSON.stringify(valor)); } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ativo, valor]);
}
