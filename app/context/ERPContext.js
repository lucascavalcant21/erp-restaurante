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
import { fetchEtiquetas } from "../lib/etiquetas";
import { fetchUnidades, CENTRAL, unidadeDaSessao, podeVerTodas, getUnidade } from "../lib/unidades";
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
  const [unidades, setUnidades] = useState([]);
  const [unidadeAtiva, setUnidadeAtivaState] = useState(CENTRAL.id);
  const [departamento, setDepartamentoState] = useState(null); // bar, cozinha, cervejas
  const [podeTrocar,   setPodeTrocar]        = useState(true);
  const [sessao,       setSessao]            = useState(null);

  // Inicializa a unidade a partir da sessão (papel) e da última escolha salva
  useEffect(() => {
    let vivo = true;
    Promise.all([fetchUnidades(), lerSessao()]).then(([resUnidades, sessaoObj]) => {
      if (!vivo) return;
      const unids = resUnidades.data || [];
      setUnidades(unids);
      setSessao(sessaoObj);
      const trocar = podeVerTodas(sessaoObj?.papel);
      setPodeTrocar(trocar);

      const padrao = unidadeDaSessao(sessaoObj, unids);
      if (trocar && sessaoObj?.id) {
        const chaveUsuario = `${UNIDADE_KEY}_${sessaoObj.id}`;
        const salva = typeof window !== "undefined" ? localStorage.getItem(chaveUsuario) : null;
        const valida = salva === CENTRAL.id || unids.some(u => u.id === salva);
        setUnidadeAtivaState(valida ? salva : padrao);
      } else {
        // Usuário de unidade fica travado na própria unidade
        setUnidadeAtivaState(padrao);
      }
    });
    return () => { vivo = false; };
  }, []);

  const setUnidadeAtiva = useCallback((id) => {
    setUnidadeAtivaState(id);
    setDepartamentoState(null); // reseta departamento ao trocar unidade
    try {
      if (sessao?.id) {
        localStorage.setItem(`${UNIDADE_KEY}_${sessao.id}`, id);
      }
    } catch (_) {}
  }, [sessao]);

  const setDepartamento = useCallback((dept) => {
    setDepartamentoState(dept);
    try { localStorage.setItem("erp_departamento_ativo", dept); } catch (_) {}
  }, []);

  // ── Carregar estoque e validade por unidade ──────────────────────────────────────────
  useEffect(() => {
    setEstoqueReady(false);
    Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchEtiquetas(unidadeAtiva, 1000)
    ]).then(([resEst, resEtiq]) => {
      const dataEstoque = resEst.data || [];
      const dataEtiq = resEtiq || [];

      setEstoque(dataEstoque);
      setEstoqueReady(true);
      
      const criticos = dataEstoque.filter(i => (i.quantidade ?? 0) <= (i.minimo ?? 0));
      
      // Checar validades
      const vencendo = dataEtiq.filter(e => {
        if (e.status !== "ativa") return false;
        const dias = Math.floor((new Date(e.validade_em).getTime() - Date.now()) / 86400000);
        return dias <= 7 && dias >= 0; // Vencendo nos proximos 7 dias
      });
      
      const vencidos = dataEtiq.filter(e => {
        if (e.status !== "ativa") return false;
        const dias = Math.floor((new Date(e.validade_em).getTime() - Date.now()) / 86400000);
        return dias < 0; 
      });

      setNotificacoes(prev => {
        const filtradas = prev.filter(n => !["estoque_critico", "validade_vencendo", "validade_vencida"].includes(n.tipo));
        
        // O Cérebro tem sua própria central de Insights, então não deve receber notificações unitárias
        if (unidadeAtiva === "todas") return filtradas;

        const novasEst = criticos.map(item => ({
          id: `notif_est_${item.id}`, 
          tipo: "estoque_critico",
          titulo: `Estoque crítico: ${item.nome}`,
          corpo: `${item.quantidade} ${item.unidade} restantes (mín: ${item.minimo}).`,
          lida: false,
          data: new Date().toISOString(),
        }));

        const novasVen = vencendo.map(item => ({
          id: `notif_ven_${item.id}`, 
          tipo: "validade_vencendo",
          titulo: `Vencimento próximo: ${item.produto}`,
          corpo: `Faltam dias! Restam ${item.quantidade} ${item.unidade}.`,
          lida: false,
          data: new Date().toISOString(),
        }));

        const novasVcd = vencidos.map(item => ({
          id: `notif_vcd_${item.id}`, 
          tipo: "validade_vencida",
          titulo: `Produto vencido: ${item.produto}`,
          corpo: `Lote vencido! Realize a baixa ou registre perda de ${item.quantidade} ${item.unidade}.`,
          lida: false,
          data: new Date().toISOString(),
        }));

        return [...novasVcd, ...novasVen, ...novasEst, ...filtradas];
      });
    });
  }, [unidadeAtiva]);

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
      // Sessão e Permissões
      sessao,
      // Unidade (multiunidade)
      unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar,
      unidadeInfo: getUnidade(unidades, unidadeAtiva), isCentral: unidadeAtiva === CENTRAL.id,
      // Departamento (bar, cozinha, cervejas)
      departamento, setDepartamento,
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
