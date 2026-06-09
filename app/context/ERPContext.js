"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTEXTO GLOBAL DO ERP
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Por que este arquivo existe?
 * Sem estado global, cada módulo mantém sua própria cópia dos dados.
 * Isso causa inconsistências: uma venda no Cardápio não desconta o Estoque,
 * um alerta de estoque crítico não aparece nas Notificações.
 *
 * Com o ERPContext:
 *   - Estoque é a fonte da verdade; qualquer módulo que vende desconta aqui
 *   - Notificações são geradas automaticamente quando estoque fica crítico
 *   - Dashboard sempre exibe o resumo atualizado
 *
 * Como usar em qualquer página:
 *
 *   import { useERP } from "@/app/context/ERPContext";
 *
 *   export default function MinhaPagina() {
 *     const { estoque, notificacoes, descontarEstoque, addNotificacao } = useERP();
 *     // ...
 *   }
 *
 * Como envolver a aplicação (já está em app/layout.js se configurado):
 *
 *   import { ERPProvider } from "@/app/context/ERPContext";
 *   <ERPProvider>{children}</ERPProvider>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { fetchEstoque, ESTOQUE_SEED } from "../lib/estoque";
import { UNIDADES, CENTRAL, unidadeDaSessao, podeVerTodas, getUnidade } from "../lib/unidades";
import { lerSessao } from "../lib/auth";

const UNIDADE_KEY = "erp_unidade_ativa";

// ─── Notificações iniciais ────────────────────────────────────────────────────
// Vazio: as notificações são geradas a partir de dados reais (ex.: estoque
// crítico via useEffect abaixo) ou inseridas via addNotificacao().
const NOTIF_SEED = [];

// ─── Context ──────────────────────────────────────────────────────────────────
const ERPContext = createContext(null);

export function ERPProvider({ children }) {
  // ── Estoque ───────────────────────────────────────────────────────────────
  const [estoque,      setEstoque]      = useState([]);
  const [estoqueReady, setEstoqueReady] = useState(false);

  // ── Notificações ──────────────────────────────────────────────────────────
  const [notificacoes, setNotificacoes] = useState(NOTIF_SEED);

  // ── Unidade ativa (multiunidade: Central + restaurantes) ──────────────────
  const [unidadeAtiva, setUnidadeAtivaState] = useState(CENTRAL.id);
  const [podeTrocar,   setPodeTrocar]        = useState(true);

  // Inicializa a unidade a partir da sessão (papel) e da última escolha salva
  useEffect(() => {
    const sessao = lerSessao();
    const trocar = podeVerTodas(sessao?.papel);
    setPodeTrocar(trocar);

    const padrao = unidadeDaSessao(sessao);
    if (trocar) {
      const salva = typeof window !== "undefined" ? localStorage.getItem(UNIDADE_KEY) : null;
      const valida = salva === CENTRAL.id || UNIDADES.some(u => u.id === salva);
      setUnidadeAtivaState(valida ? salva : padrao);
    } else {
      // Usuário de unidade fica travado na própria unidade
      setUnidadeAtivaState(padrao);
    }
  }, []);

  const setUnidadeAtiva = useCallback((id) => {
    setUnidadeAtivaState(id);
    try { localStorage.setItem(UNIDADE_KEY, id); } catch (_) {}
  }, []);

  // ── Carregar estoque ao montar ────────────────────────────────────────────
  useEffect(() => {
    fetchEstoque().then(({ data }) => {
      setEstoque(data);
      setEstoqueReady(true);
      // Gera notificações automáticas para itens críticos
      const criticos = data.filter(i => i.quantidade <= i.minimo);
      criticos.forEach(item => {
        const id = `notif_est_${item.id}`;
        setNotificacoes(prev => {
          if (prev.some(n => n.id === id)) return prev;
          return [{
            id, tipo: "estoque_critico",
            titulo: `Estoque crítico: ${item.nome}`,
            corpo: `${item.quantidade} ${item.unidade} restantes (mín: ${item.minimo}).`,
            lida: false,
            data: new Date().toISOString(),
          }, ...prev];
        });
      });
    });
  }, []);

  // ── Desconta item do estoque (chamado pela venda/cardápio) ─────────────────
  const descontarEstoque = useCallback((itemId, quantidade) => {
    setEstoque(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const novaQtd = Math.max(0, item.quantidade - quantidade);
      // Gera notificação se virar crítico
      if (novaQtd <= item.minimo) {
        const id = `notif_est_${item.id}_${Date.now()}`;
        setNotificacoes(n => [{
          id, tipo: "estoque_critico",
          titulo: `Estoque crítico: ${item.nome}`,
          corpo: `${novaQtd} ${item.unidade} restantes após venda.`,
          lida: false,
          data: new Date().toISOString(),
        }, ...n]);
      }
      return { ...item, quantidade: novaQtd };
    }));
  }, []);

  // ── Adiciona notificação manualmente ──────────────────────────────────────
  const addNotificacao = useCallback((notif) => {
    setNotificacoes(prev => [{ id: `n_${Date.now()}`, lida: false, data: new Date().toISOString(), ...notif }, ...prev]);
  }, []);

  // ── Marca notificação como lida ───────────────────────────────────────────
  const marcarLida = useCallback((id) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  }, []);

  const marcarTodasLidas = useCallback(() => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  }, []);

  // ── Remove uma notificação ────────────────────────────────────────────────
  const removerNotificacao = useCallback((id) => {
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  }, []);

  // ── Remove todas as já lidas ──────────────────────────────────────────────
  const limparLidas = useCallback(() => {
    setNotificacoes(prev => prev.filter(n => !n.lida));
  }, []);

  // ── Resumo para o dashboard ───────────────────────────────────────────────
  const resumoEstoque = {
    total:    estoque.length,
    criticos: estoque.filter(i => i.quantidade <= i.minimo).length,
    baixos:   estoque.filter(i => i.quantidade > i.minimo && i.quantidade <= i.minimo * 1.5).length,
    valor:    estoque.reduce((a, i) => a + i.quantidade * (i.preco_unit ?? i.custo_unitario ?? 0), 0),
  };

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <ERPContext.Provider value={{
      // Unidade (multiunidade)
      unidades: UNIDADES, unidadeAtiva, setUnidadeAtiva, podeTrocar,
      unidadeInfo: getUnidade(unidadeAtiva), isCentral: unidadeAtiva === CENTRAL.id,
      // Estoque
      estoque, setEstoque, estoqueReady,
      descontarEstoque, resumoEstoque,
      // Notificações
      notificacoes, addNotificacao, marcarLida, marcarTodasLidas,
      removerNotificacao, limparLidas, naoLidas,
    }}>
      {children}
    </ERPContext.Provider>
  );
}

/**
 * Hook de acesso ao contexto.
 * Lança erro amigável se usado fora do ERPProvider.
 */
export function useERP() {
  const ctx = useContext(ERPContext);
  if (!ctx) {
    throw new Error("useERP deve ser usado dentro de <ERPProvider>. Verifique o app/layout.js.");
  }
  return ctx;
}
