"use client";

// Manter o que está sendo feito ao recarregar a página (dono, 24/11/2026:
// "se eu atualizar a página, não tem que voltar para o início da ficha técnica,
// tem que manter na ficha que eu estou… isso serve para qualquer coisa que eu
// estiver fazendo"). Usa o rascunho do aparelho + banco (rascunho-aparelho.js).
//
//   const { recuperado, descartar } = useRascunho({
//     chave: `ficha:${unidade}`, pronto: !!unidade, ativo: editando,
//     estado: { form, itens }, aplicar: (d) => { setForm(d.form); setItens(d.itens); setEditando(true); },
//   });
//
// - pronto: só lê depois que a tela tem o que precisa (unidade, listas).
// - ativo: grava enquanto há algo em andamento (editor aberto, mudança não salva).
// - descartar(): chamar ao salvar ou cancelar.

import { useCallback, useEffect, useRef, useState } from "react";
import { apagarRascunhoNoBanco, guardarRascunhoNoBanco, lerRascunhoDoBanco } from "./rascunho-aparelho";

export function useRascunho({ chave, pronto = true, ativo, estado, aplicar, unidadeId = null }) {
  const [recuperado, setRecuperado] = useState(false);
  const lido = useRef("");
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  // 1. Ao abrir a tela: se havia algo em andamento, volta nele.
  useEffect(() => {
    if (!pronto || !chave || lido.current === chave) return;
    lido.current = chave;
    let vivo = true;
    lerRascunhoDoBanco(chave).then((dados) => {
      if (!vivo || !dados) return;
      try { aplicarRef.current?.(dados); setRecuperado(true); } catch { /* rascunho de outra versão: ignora */ }
    });
    return () => { vivo = false; };
  }, [chave, pronto]);

  // 2. Enquanto está em andamento, guarda a cada mudança.
  const serial = ativo ? JSON.stringify(estado ?? null) : "";
  useEffect(() => {
    if (!chave || !ativo || lido.current !== chave) return;
    guardarRascunhoNoBanco(chave, estado, unidadeId);
  }, [chave, ativo, serial]); // eslint-disable-line react-hooks/exhaustive-deps

  const descartar = useCallback(() => { if (chave) apagarRascunhoNoBanco(chave); setRecuperado(false); }, [chave]);
  return { recuperado, descartar, esconderAviso: () => setRecuperado(false) };
}

/** Aviso "Voltei para onde você estava" (some ao tocar). */
export function textoRecuperado(oque = "o que você estava fazendo") {
  return `Voltei para ${oque}. Nada foi perdido.`;
}
