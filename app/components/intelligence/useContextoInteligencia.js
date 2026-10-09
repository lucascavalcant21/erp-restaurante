"use client";

// CONTEXTO DE TELA para o Héfisto — padrão único para qualquer tela dizer
// "estou olhando ESTE registro":
//
//   useContextoInteligencia(produto ? { modulo: "estoque", tipo: "produto", id: produto.id, nome: produto.nome } : null);
//
// Com isso, "Por que aumentou?", "Quanto tenho?" ou "Perdi 2 kg." no painel
// "Pergunte ao Héfisto" entendem que é deste registro. É só uma DICA: o
// servidor reconfere o id no banco da unidade antes de usar, e o nome nunca é
// tratado como dado. Ao fechar o registro (ou sair da tela) o contexto é limpo.
// Sem registro aberto → null → o Héfisto pergunta, não inventa.

import { useEffect } from "react";
import { useHefistoPageContext } from "../../context/HefistoPageContext";

/** Tipos que o servidor entende (app/lib/intelligence/context/context-engine.mjs → TIPOS_ENTIDADE). */
export const TIPO_CONTEXTO = Object.freeze({
  PRODUTO: "produto",
  COMPRA: "compra",
  COLABORADOR: "colaborador",
  CONTA_PAGAR: "conta_pagar",
  FICHA: "ficha",
  FORNECEDOR: "fornecedor",
  EVENTO: "evento",
});

const TIPOS = new Set(Object.values(TIPO_CONTEXTO));

/**
 * @param {{ modulo?: string, tipo: string, id?: string|number, nome?: string } | null} entidade
 */
export function useContextoInteligencia(entidade) {
  const { setSelectedEntity, clearSelectedEntity } = useHefistoPageContext();
  const valida = entidade && TIPOS.has(entidade.tipo) && (entidade.id != null || entidade.nome);
  const id = valida && entidade.id != null ? String(entidade.id).slice(0, 64) : null;
  const nome = valida && entidade.nome ? String(entidade.nome).slice(0, 80) : null;
  const tipo = valida ? entidade.tipo : null;
  const modulo = valida ? entidade.modulo || null : null;

  useEffect(() => {
    if (!tipo) return undefined;
    setSelectedEntity({ type: tipo, id, name: nome, module: modulo });
    return () => clearSelectedEntity();
  }, [tipo, id, nome, modulo, setSelectedEntity, clearSelectedEntity]);
}
