"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Search, Package, ArrowRightLeft, PackagePlus, PackageMinus, X, Plus, Minus,
  LayoutDashboard, History, ClipboardCheck, Settings, Check, ChefHat, GlassWater, Sparkles, AlertCircle
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoques, fetchItensEstoque, registrarLoteMovimentosMulti } from "../../../lib/estoques-multiplos";
import { rotuloMotivo, MOTIVOS, novaChave } from "../../../lib/estoque-movimento.mjs";

const rotuloUnidade = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));
const fmtQtd = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default function EstoquePrincipal() {
  const router = useRouter();
  const { unidadeAtiva, sessao, unidadeInfo } = useERP();

  const [tipoOperacao, setTipoOperacao] = useState("entrada"); // 'entrada' | 'saida'
  const [estoques, setEstoques] = useState([]);
  const [estoqueAtivo, setEstoqueAtivo] = useState(null);
  
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Modal de Operação
  const [itemAberto, setItemAberto] = useState(null);
  const [qtd, setQtd] = useState("");
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("estoque"); // 'compra' | 'estoque'
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    async function load() {
      setCarregando(true);
      const res = await fetchEstoques(unidadeAtiva);
      const ativos = (res.data || []).filter(e => e.status !== "inativo");
      setEstoques(ativos);
      if (ativos.length > 0 && !estoqueAtivo) {
        setEstoqueAtivo(ativos[0].id);
      }
      setCarregando(false);
    }
    load();
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!estoqueAtivo) return;
    async function loadItens() {
      setCarregando(true);
      const res = await fetchItensEstoque(estoqueAtivo, unidadeAtiva);
      setItens(res.data || []);
      setCarregando(false);
    }
    loadItens();
  }, [estoqueAtivo, unidadeAtiva]);

  const getIconeEstoque = (slug) => {
    const s = String(slug).toLowerCase();
    if (s.includes("cozinha")) return <ChefHat size={18} />;
    if (s.includes("bar")) return <GlassWater size={18} />;
    if (s.includes("limpeza")) return <Sparkles size={18} />;
    return <Package size={18} />;
  };

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itens;
    const term = busca.toLowerCase().normalize("NFD").replace(/[u0300-u036f]/g, "");
    return itens.filter(i => {
      const nome = String(i.nome || "").toLowerCase().normalize("NFD").replace(/[u0300-u036f]/g, "");
      return nome.includes(term);
    });
  }, [itens, busca]);

  // Define as unidades disponíveis para o modal
  const infoConversao = useMemo(() => {
    if (!itemAberto) return null;
    const tamEmb = Number(itemAberto.tamanho_embalagem) || 1;
    const unComercial = String(itemAberto.unidade_comercial || "Caixa");
    const unEstoque = rotuloUnidade(itemAberto.unidade_medida);
    
    // Se o tamanho da embalagem for 1, não há diferença prática.
    const temConversao = tamEmb > 1;

    return {
      temConversao,
      tamEmb,
      unComercial,
      unEstoque,
      nomeEstoque: temConversao ? `${unEstoque}s` : unEstoque,
      nomeCompra: temConversao ? `${unComercial} (x${tamEmb} ${unEstoque}s)` : unEstoque,
    };
  }, [itemAberto]);

  // Calcula quanto será registrado
  const qtdCalculada = useMemo(() => {
    if (!infoConversao || !qtd) return 0;
    const n = Number(String(qtd).replace(",", "."));
    if (isNaN(n) || n <= 0) return 0;
    if (unidadeSelecionada === "compra" && infoConversao.temConversao) {
      return n * infoConversao.tamEmb;
    }
    return n;
  }, [qtd, unidadeSelecionada, infoConversao]);

  const saldoFuturo = useMemo(() => {
    if (!itemAberto) return 0;
    const atual = Number(itemAberto.quantidade_atual) || 0;
    return tipoOperacao === "entrada" ? atual + qtdCalculada : atual - qtdCalculada;
  }, [itemAberto, tipoOperacao, qtdCalculada]);

  const confirmarMovimento = async () => {
    if (!qtdCalculada || qtdCalculada <= 0) return alert("Informe uma quantidade válida.");
    if (!motivo) return alert("Selecione um motivo.");
    if (tipoOperacao === "saida" && saldoFuturo < 0) {
      const conf = confirm(`Atenção: A retirada (${qtdCalculada}) é maior que o saldo atual (${Number(itemAberto.quantidade_atual || 0)}). Isso deixará o estoque negativo. Deseja continuar?`);
      if (!conf) return;
    }

    setSalvando(true);
    
    const n = Number(String(qtd).replace(",", "."));
    
    const mov = {
      id: itemAberto.id,
      estoqueId: estoqueAtivo,
      insumoId: itemAberto.insumo_id || itemAberto.id,
      nome: itemAberto.nome,
      quantidade: qtdCalculada,
      quantidadeInformada: n,
      unidadeInformada: unidadeSelecionada === "compra" ? infoConversao.unComercial : infoConversao.unEstoque,
      detalhe: {
        embalagens: unidadeSelecionada === "compra" ? n : 0,
        tamanho_embalagem: infoConversao.tamEmb,
        unidade_embalagem: infoConversao.unComercial,
        fracao: unidadeSelecionada === "estoque" ? n : 0
      }
    };

    const res = await registrarLoteMovimentosMulti({
      unidadeId: unidadeAtiva,
      tipo: tipoOperacao,
      itens: [mov],
      motivo: motivo,
      usuarioNome: sessao?.user?.user_metadata?.full_name || sessao?.nome || "Sistema",
      observacao: `Lançamento via painel rápido`
    });

    setSalvando(false);
    if (res.success) {
      // Atualiza o item localmente
      setItens(itens.map(i => {
        if (i.id === itemAberto.id) {
          return { ...i, quantidade_atual: saldoFuturo };
        }
        return i;
      }));
      fecharModal();
    } else {
      alert("Erro ao salvar: " + (res.erros[0]?.error || "Erro desconhecido"));
    }
  };

  const fecharModal = () => {
    setItemAberto(null);
    setQtd("");
    setMotivo("");
    setUnidadeSelecionada("estoque");
  };

  if (!unidadeAtiva) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* HEADER COMPACTO */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="text-emerald-600" /> Estoque
          </h1>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button onClick={() => router.push("/dashboard/operacao/estoque?gestao=1")} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              <LayoutDashboard size={16} /> <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button onClick={() => router.push("/dashboard/operacao/estoque/movimentar?tipo=historico")} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              <History size={16} /> <span className="hidden sm:inline">Histórico</span>
            </button>
            <button onClick={() => router.push("/dashboard/operacao/estoque/contagens")} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              <ClipboardCheck size={16} /> <span className="hidden sm:inline">Inventário</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-4">
        
        {/* BOTÕES PRINCIPAIS (ENTRADA / RETIRADA) */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => { setTipoOperacao("entrada"); setItemAberto(null); }}
            className={`relative overflow-hidden flex flex-col items-center justify-center gap-1.5 h-20 rounded-2xl border-2 transition-all ${tipoOperacao === "entrada" ? "bg-emerald-50 border-emerald-500 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tipoOperacao === "entrada" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
              <PackagePlus size={18} />
            </div>
            <span className={`font-black text-sm ${tipoOperacao === "entrada" ? "text-emerald-700" : "text-slate-500"}`}>Entrada</span>
          </button>
          <button 
            onClick={() => { setTipoOperacao("saida"); setItemAberto(null); }}
            className={`relative overflow-hidden flex flex-col items-center justify-center gap-1.5 h-20 rounded-2xl border-2 transition-all ${tipoOperacao === "saida" ? "bg-red-50 border-red-500 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tipoOperacao === "saida" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400"}`}>
              <PackageMinus size={18} />
            </div>
            <span className={`font-black text-sm ${tipoOperacao === "saida" ? "text-red-700" : "text-slate-500"}`}>Retirada</span>
          </button>
        </div>

        {/* SELETOR DE ÁREA */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {estoques.map(est => (
            <button
              key={est.id}
              onClick={() => setEstoqueAtivo(est.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${estoqueAtivo === est.id ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {getIconeEstoque(est.slug || est.nome)} {est.nome}
            </button>
          ))}
        </div>

        {/* BUSCA */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar produto por nome..." 
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-shadow shadow-sm"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full">
              <X size={14} />
            </button>
          )}
        </div>

        {/* LISTA */}
        {carregando ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <Loader2 className="animate-spin" size={24} />
            <span className="font-bold text-sm">Carregando itens...</span>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3 bg-white rounded-2xl border border-slate-200 border-dashed">
            <Package size={40} className="text-slate-200" />
            <span className="font-bold text-sm">Nenhum produto encontrado.</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {itensFiltrados.map((item, idx) => {
              const saldo = Number(item.quantidade_atual) || 0;
              const min = Number(item.estoque_minimo);
              const isLow = !isNaN(min) && min > 0 && saldo < min;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => setItemAberto(item)}
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors ${idx !== itensFiltrados.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <div>
                    <h3 className="font-bold text-slate-900">{item.nome}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded uppercase tracking-wider">
                        {item.categoria || "Sem Categoria"}
                      </span>
                      {Number(item.tamanho_embalagem) > 1 && (
                        <span className="text-xs font-semibold text-slate-400">
                          {item.tamanho_embalagem} {rotuloUnidade(item.unidade_medida)}s / {item.unidade_comercial || "Cx"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-black ${isLow && saldo > 0 ? "text-amber-600" : saldo === 0 ? "text-red-500" : "text-slate-900"}`}>
                      {fmtQtd(saldo)} <span className="text-sm font-bold opacity-70">{rotuloUnidade(item.unidade_medida)}</span>
                    </div>
                    {isLow && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Baixo</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* MODAL DE OPERAÇÃO */}
      {itemAberto && infoConversao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <header className={`px-5 py-4 border-b flex items-center justify-between ${tipoOperacao === "entrada" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <div>
                <h2 className={`text-sm font-black uppercase tracking-wider ${tipoOperacao === "entrada" ? "text-emerald-700" : "text-red-700"}`}>
                  {tipoOperacao === "entrada" ? "Registrar Entrada" : "Registrar Retirada"}
                </h2>
                <p className="font-bold text-slate-900 mt-1">{itemAberto.nome}</p>
              </div>
              <button onClick={fecharModal} className="p-2 text-slate-500 hover:bg-white rounded-full transition-colors">
                <X size={20} />
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-6">
              
              {/* UNIDADE DE LANÇAMENTO */}
              {infoConversao.temConversao && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Formato do Lançamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setUnidadeSelecionada("compra")}
                      className={`px-3 py-3 border-2 rounded-xl text-sm font-bold transition-all ${unidadeSelecionada === "compra" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      {infoConversao.nomeCompra}
                    </button>
                    <button 
                      onClick={() => setUnidadeSelecionada("estoque")}
                      className={`px-3 py-3 border-2 rounded-xl text-sm font-bold transition-all ${unidadeSelecionada === "estoque" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      {infoConversao.nomeEstoque}
                    </button>
                  </div>
                  {unidadeSelecionada === "compra" && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 p-2 rounded-lg">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>O sistema vai multiplicar por {infoConversao.tamEmb} para guardar no saldo.</span>
                    </div>
                  )}
                </div>
              )}

              {/* QUANTIDADE */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Quantidade a {tipoOperacao === "entrada" ? "adicionar" : "retirar"}</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={qtd}
                    onChange={e => setQtd(e.target.value)}
                    placeholder="0"
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {unidadeSelecionada === "compra" ? infoConversao.unComercial : infoConversao.unEstoque}
                  </div>
                </div>
              </div>

              {/* MOTIVO */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Motivo da {tipoOperacao}</label>
                <select 
                  value={motivo} 
                  onChange={e => setMotivo(e.target.value)}
                  className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  {(tipoOperacao === "entrada" ? MOTIVOS.entrada : MOTIVOS.saida).filter(m => !m.admin).map(m => (
                    <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>
                  ))}
                </select>
              </div>

              {/* SIMULAÇÃO DO SALDO */}
              <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Atual</p>
                  <p className="font-bold text-slate-700">{fmtQtd(Number(itemAberto.quantidade_atual) || 0)} <span className="text-xs">{infoConversao.unEstoque}</span></p>
                </div>
                <ArrowRightLeft size={16} className="text-slate-300" />
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Novo Saldo</p>
                  <p className={`font-black text-lg ${saldoFuturo < 0 ? "text-red-600" : "text-slate-900"}`}>
                    {fmtQtd(saldoFuturo)} <span className="text-xs">{infoConversao.unEstoque}</span>
                  </p>
                </div>
              </div>
              
              {saldoFuturo < 0 && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-xl border border-red-100">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-bold leading-relaxed">O saldo ficará negativo. Só confirme se tiver certeza de que o produto saiu fisicamente e a contagem será ajustada depois.</p>
                </div>
              )}

            </div>

            <footer className="p-5 border-t border-slate-100">
              <button 
                onClick={confirmarMovimento}
                disabled={salvando || !qtdCalculada || !motivo}
                className={`w-full h-14 rounded-xl flex items-center justify-center gap-2 font-black text-white transition-all ${salvando || !qtdCalculada || !motivo ? "opacity-50 cursor-not-allowed bg-slate-400" : tipoOperacao === "entrada" ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]" : "bg-red-600 hover:bg-red-700 active:scale-[0.98]"}`}
              >
                {salvando ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {salvando ? "Salvando..." : `Confirmar ${tipoOperacao === "entrada" ? "Entrada" : "Retirada"}`}
              </button>
            </footer>

          </div>
        </div>
      )}

    </div>
  );
}
