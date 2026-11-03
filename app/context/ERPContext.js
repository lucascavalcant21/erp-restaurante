"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchEstoque } from "../lib/estoque";
import { fetchEtiquetas } from "../lib/etiquetas";
import { fetchUnidades, unidadeDaSessao, podeVerTodas, getUnidade } from "../lib/unidades";
import { lerSessao } from "../lib/auth";
import { iniciarTempoReal } from "../lib/realtime";
import { inicioDaArea } from "../lib/menu-principal.mjs";

const UNIDADE_KEY = "erp_unidade_ativa";
const MAX_NOTIFICACOES_MEMORIA = 150;
const MS_POR_DIA = 86400000;

const ERPContext = createContext(null);


/**
 * Constrói notificações de estoque e validade em passagem única O(N),
 * evitando múltiplos loops e alocações desnecessárias de objetos Date.
 */
function construirNotificacoesOperacionais(dataEstoque, dataEtiq, agoraMs, agoraIso) {
  const novasVcd = [];
  const novasVen = [];
  const novasEst = [];

  for (let i = 0; i < dataEtiq.length; i++) {
    const e = dataEtiq[i];
    if (!e || e.status !== "ativa" || !e.validade_em) continue;
    const validadeMs = Date.parse(e.validade_em);
    if (Number.isNaN(validadeMs)) continue;
    const dias = Math.floor((validadeMs - agoraMs) / MS_POR_DIA);
    if (dias < 0) {
      novasVcd.push({
        id: `notif_vcd_${e.id}`,
        tipo: "validade_vencida",
        titulo: `Produto vencido: ${e.produto}`,
        corpo: `Lote vencido! Realize a baixa de ${e.quantidade} ${e.unidade}.`,
        lida: false,
        data: agoraIso,
      });
    } else if (dias <= 7) {
      novasVen.push({
        id: `notif_ven_${e.id}`,
        tipo: "validade_vencendo",
        titulo: `Vencimento próximo: ${e.produto}`,
        corpo: `Faltam ${dias} dia(s)! Restam ${e.quantidade} ${e.unidade}.`,
        lida: false,
        data: agoraIso,
      });
    }
  }

  for (let i = 0; i < dataEstoque.length; i++) {
    const item = dataEstoque[i];
    if (!item) continue;
    if ((item.quantidade ?? 0) <= (item.minimo ?? 0)) {
      novasEst.push({
        id: `notif_est_${item.id}`,
        tipo: "estoque_critico",
        titulo: `Estoque crítico: ${item.nome}`,
        corpo: `${item.quantidade} ${item.unidade} restantes (mín: ${item.minimo}).`,
        lida: false,
        data: agoraIso,
      });
    }
  }

  return [...novasVcd, ...novasVen, ...novasEst];
}

export function ERPProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // Tempo real: o banco avisa e as telas recarregam sozinhas
  useEffect(() => { iniciarTempoReal(); }, []);

  const [estoque,      setEstoque]      = useState([]);
  const [estoqueReady, setEstoqueReady] = useState(false);
  const [erroEstoque,  setErroEstoque]  = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);

  const [unidades, setUnidades] = useState([]);
  const [unidadeAtiva, setUnidadeAtivaState] = useState(null);
  // Por que não há unidade. Sem isso a tela fica sem loja e sem explicação,
  // e o usuário só descobre o problema quando um save é recusado.
  const [erroUnidades, setErroUnidades] = useState(null);
  const [departamento, setDepartamentoState] = useState(null);
  const [podeTrocar,   setPodeTrocar]        = useState(true);
  const [sessao,       setSessao]            = useState(null);
  const [megaMenuOpen, setMegaMenuOpen]      = useState(false);

  const abrirMenu = useCallback(() => {
    setMegaMenuOpen(false);
    // volta para a página da área no menu principal (a mesma lista do topo)
    router.push(inicioDaArea(pathname));
  }, [pathname, router]);

  const fecharMenu = useCallback(() => setMegaMenuOpen(false), []);

  const recarregarUnidades = useCallback(async () => {
    try {
      const { data, error } = await fetchUnidades();
      const lista = data || [];
      setUnidades(lista);
      setErroUnidades(error || null);
      return lista;
    } catch (err) {
      setErroUnidades(err?.message || "Falha de conexão ao carregar unidades.");
      return [];
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    // Sem sessão (páginas públicas — cardápio, vagas, rastreio…) não há o que
    // carregar: o anon não lê unidades, estoque nem etiquetas (SEC-DADOS-2), e
    // antes este provider buscava estoque e 1000 etiquetas em toda página aberta.
    (async () => {
      try {
        const sessaoObj = await lerSessao();
        const resUnidades = sessaoObj ? await fetchUnidades() : { data: [], error: null };
        if (!vivo) return;
        const unids = resUnidades.data || [];
        setUnidades(unids);
        setErroUnidades(resUnidades.error || null);
        setSessao(sessaoObj);
        const trocar = podeVerTodas(sessaoObj?.papel);
        setPodeTrocar(trocar);

        const padrao = unidadeDaSessao(sessaoObj, unids);
        if (trocar && sessaoObj?.id) {
          const chaveUsuario = `${UNIDADE_KEY}_${sessaoObj.id}`;
          let salva = null;
          try {
            salva = typeof window !== "undefined" ? localStorage.getItem(chaveUsuario) : null;
          } catch (_) {}
          const valida = unids.some(u => u.id === salva);
          setUnidadeAtivaState(valida ? salva : padrao);
        } else {
          setUnidadeAtivaState(padrao);
        }
      } catch (err) {
        if (!vivo) return;
        setErroUnidades(err?.message || "Não foi possível carregar sua sessão agora.");
      }
    })();
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
  }, [sessao?.id]);

  const setDepartamento = useCallback((dept) => {
    setDepartamentoState(dept);
    try { localStorage.setItem("erp_departamento_ativo", dept); } catch (_) {}
  }, []);

  useEffect(() => {
    if (!unidadeAtiva) return;
    let vivo = true;
    setEstoqueReady(false);
    setErroEstoque(null);

    Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchEtiquetas(unidadeAtiva, 1000),
    ])
      .then(([resEst, resEtiq]) => {
        if (!vivo) return;
        const dataEstoque = resEst?.data || [];
        const dataEtiq = Array.isArray(resEtiq) ? resEtiq : [];

        setEstoque(dataEstoque);
        setErroEstoque(resEst?.error || null);
        setEstoqueReady(true);

        const agoraMs = Date.now();
        const agoraIso = new Date(agoraMs).toISOString();
        const geradas = construirNotificacoesOperacionais(dataEstoque, dataEtiq, agoraMs, agoraIso);

        setNotificacoes(prev => {
          const manuais = prev.filter(n => !["estoque_critico", "validade_vencendo", "validade_vencida"].includes(n.tipo));
          return [...geradas, ...manuais].slice(0, MAX_NOTIFICACOES_MEMORIA);
        });
      })
      .catch((err) => {
        if (!vivo) return;
        setErroEstoque(err?.message || "Falha de conexão ao sincronizar estoque e etiquetas.");
        setEstoqueReady(true);
      });

    return () => { vivo = false; };
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
        }, ...n].slice(0, MAX_NOTIFICACOES_MEMORIA));
      }
      return { ...item, quantidade: novaQtd };
    }));
  }, []);

  const addNotificacao = useCallback((notif) => setNotificacoes(prev => [{ id: `n_${Date.now()}`, lida: false, data: new Date().toISOString(), ...notif }, ...prev].slice(0, MAX_NOTIFICACOES_MEMORIA)), []);
  const marcarLida = useCallback((id) => setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n)), []);
  const marcarTodasLidas = useCallback(() => setNotificacoes(prev => prev.map(n => (n.lida ? n : { ...n, lida: true }))), []);
  const removerNotificacao = useCallback((id) => setNotificacoes(prev => prev.filter(n => n.id !== id)), []);
  const limparLidas = useCallback(() => setNotificacoes(prev => prev.filter(n => !n.lida)), []);

  // Memoização em passagem única O(N) para evitar múltiplos .filter() e .reduce() a cada render
  const resumoEstoque = useMemo(() => {
    let criticos = 0;
    let baixos = 0;
    let valor = 0;
    for (let i = 0; i < estoque.length; i++) {
      const it = estoque[i];
      const qtd = Number(it.quantidade) || 0;
      const min = Number(it.minimo) || 0;
      const preco = Number(it.preco_unit ?? it.custo_unitario ?? 0) || 0;
      if (qtd <= min) criticos++;
      else if (qtd <= min * 1.5) baixos++;
      valor += qtd * preco;
    }
    return { total: estoque.length, criticos, baixos, valor };
  }, [estoque]);

  const naoLidas = useMemo(() => {
    let count = 0;
    for (let i = 0; i < notificacoes.length; i++) {
      if (!notificacoes[i].lida) count++;
    }
    return count;
  }, [notificacoes]);

  const unidadeInfo = useMemo(() => getUnidade(unidades, unidadeAtiva), [unidades, unidadeAtiva]);

  const contextValue = useMemo(() => ({
    sessao,
    unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, recarregarUnidades, erroUnidades,
    unidadeInfo,
    departamento, setDepartamento,
    estoque, setEstoque, estoqueReady, erroEstoque,
    descontarEstoque, resumoEstoque,
    notificacoes, addNotificacao, marcarLida, marcarTodasLidas,
    removerNotificacao, limparLidas, naoLidas,
    megaMenuOpen, abrirMenu, fecharMenu,
  }), [
    sessao,
    unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, recarregarUnidades, erroUnidades,
    unidadeInfo,
    departamento, setDepartamento,
    estoque, estoqueReady, erroEstoque,
    descontarEstoque, resumoEstoque,
    notificacoes, addNotificacao, marcarLida, marcarTodasLidas,
    removerNotificacao, limparLidas, naoLidas,
    megaMenuOpen, abrirMenu, fecharMenu,
  ]);

  return (
    <ERPContext.Provider value={contextValue}>
      {children}
    </ERPContext.Provider>
  );
}

export function useERP() {
  const ctx = useContext(ERPContext);
  if (!ctx) throw new Error("useERP deve ser usado dentro de <ERPProvider>.");
  return ctx;
}
