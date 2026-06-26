"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { fetchEstoque } from "../lib/estoque";
import { fetchEtiquetas } from "../lib/etiquetas";
import { fetchUnidades, unidadeDaSessao, podeVerTodas, getUnidade } from "../lib/unidades";
import { lerSessao } from "../lib/auth";

const UNIDADE_KEY = "erp_unidade_ativa";

const ERPContext = createContext(null);

export function ERPProvider({ children }) {
  const [estoque,      setEstoque]      = useState([]);
  const [estoqueReady, setEstoqueReady] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);

  const [unidades, setUnidades] = useState([]);
  const [unidadeAtiva, setUnidadeAtivaState] = useState(null);
  const [departamento, setDepartamentoState] = useState(null);
  const [podeTrocar,   setPodeTrocar]        = useState(true);
  const [sessao,       setSessao]            = useState(null);
  const [megaMenuOpen, setMegaMenuOpen]      = useState(false);

  const abrirMenu = useCallback(() => setMegaMenuOpen(true), []);
  const fecharMenu = useCallback(() => setMegaMenuOpen(false), []);

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
        const valida = unids.some(u => u.id === salva);
        setUnidadeAtivaState(valida ? salva : padrao);
      } else {
        setUnidadeAtivaState(padrao);
      }
    });
    return () => { vivo = false; };
  }, []);

  const setUnidadeAtiva = useCallback((id) => {
    setUnidadeAtivaState(id);
    setDepartamentoState(null);
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

  useEffect(() => {
    if (!unidadeAtiva) return;
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
      const vencendo = dataEtiq.filter(e => {
        if (e.status !== "ativa") return false;
        const dias = Math.floor((new Date(e.validade_em).getTime() - Date.now()) / 86400000);
        return dias <= 7 && dias >= 0;
      });
      
      const vencidos = dataEtiq.filter(e => {
        if (e.status !== "ativa") return false;
        const dias = Math.floor((new Date(e.validade_em).getTime() - Date.now()) / 86400000);
        return dias < 0; 
      });

      setNotificacoes(prev => {
        const filtradas = prev.filter(n => !["estoque_critico", "validade_vencendo", "validade_vencida"].includes(n.tipo));
        
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
          corpo: `Lote vencido! Realize a baixa de ${item.quantidade} ${item.unidade}.`,
          lida: false,
          data: new Date().toISOString(),
        }));

        return [...novasVcd, ...novasVen, ...novasEst, ...filtradas];
      });
    });
  }, [unidadeAtiva]);

  const descontarEstoque = useCallback((itemId, quantidade) => {
    setEstoque(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const novaQtd = Math.max(0, item.quantidade - quantidade);
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

  const addNotificacao = useCallback((notif) => setNotificacoes(prev => [{ id: `n_${Date.now()}`, lida: false, data: new Date().toISOString(), ...notif }, ...prev]), []);
  const marcarLida = useCallback((id) => setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n)), []);
  const marcarTodasLidas = useCallback(() => setNotificacoes(prev => prev.map(n => ({ ...n, lida: true }))), []);
  const removerNotificacao = useCallback((id) => setNotificacoes(prev => prev.filter(n => n.id !== id)), []);
  const limparLidas = useCallback(() => setNotificacoes(prev => prev.filter(n => !n.lida)), []);

  const resumoEstoque = {
    total:    estoque.length,
    criticos: estoque.filter(i => i.quantidade <= i.minimo).length,
    baixos:   estoque.filter(i => i.quantidade > i.minimo && i.quantidade <= i.minimo * 1.5).length,
    valor:    estoque.reduce((a, i) => a + i.quantidade * (i.preco_unit ?? i.custo_unitario ?? 0), 0),
  };

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <ERPContext.Provider value={{
      sessao,
      unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar,
      unidadeInfo: getUnidade(unidades, unidadeAtiva),
      departamento, setDepartamento,
      estoque, setEstoque, estoqueReady,
      descontarEstoque, resumoEstoque,
      notificacoes, addNotificacao, marcarLida, marcarTodasLidas,
      removerNotificacao, limparLidas, naoLidas,
      megaMenuOpen, abrirMenu, fecharMenu,
    }}>
      {children}
    </ERPContext.Provider>
  );
}

export function useERP() {
  const ctx = useContext(ERPContext);
  if (!ctx) throw new Error("useERP deve ser usado dentro de <ERPProvider>.");
  return ctx;
}
