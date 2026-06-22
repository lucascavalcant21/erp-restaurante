"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, Trash2, Search as SearchIcon, ArrowLeft, Image as ImageIcon, ChevronRight, X, CreditCard, Banknote, QrCode } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchMesasEComandas, abrirComanda, adicionarItemComanda, removerItemComanda, fecharComanda } from "../../lib/mesas";
import { fetchCaixaAberto } from "../../lib/caixas";
import { registrarVenda } from "../../lib/vendas";

function fmtBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function VendasPDVContent() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const comandaIdQuery = searchParams.get("comanda");
  const novaMesaIdQuery = searchParams.get("novaMesa");

  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");
  
  // Se houver comandaId, estamos editando uma comanda de mesa. Senão, é venda balcão/delivery.
  const [comandaAberta, setComandaAberta] = useState(null);
  const [mesaDaComanda, setMesaDaComanda] = useState(null);
  const [carrinhoBalcao, setCarrinhoBalcao] = useState([]);

  // Modais e Estados UI
  const [caixaAtual, setCaixaAtual] = useState(null);
  const [toast, setToast] = useState("");
  const [modalNovaComanda, setModalNovaComanda] = useState(!!novaMesaIdQuery);
  const [nomeNovoCliente, setNomeNovoCliente] = useState("");
  
  // Checkout
  const [modalCheckout, setModalCheckout] = useState(false);
  const [formaPgto, setFormaPgto] = useState("dinheiro");
  const [salvando, setSalvando] = useState(false);

  const showToast = useCallback((msg, dur = 3000) => {
    setToast(msg); setTimeout(() => setToast(""), dur);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [pRes, cxRes, mRes] = await Promise.all([
      fetchCardapio(unidadeAtiva),
      fetchCaixaAberto(unidadeAtiva),
      fetchMesasEComandas(unidadeAtiva)
    ]);
    
    setProdutos((pRes.data || []).filter(p => p.ativo));
    setCaixaAtual(cxRes.data || null);

    if (comandaIdQuery && mRes.data) {
      let achouComanda = null;
      let achouMesa = null;
      for (const m of mRes.data) {
        const c = m.comandas?.find(x => x.id === comandaIdQuery);
        if (c) { achouComanda = c; achouMesa = m; break; }
      }
      setComandaAberta(achouComanda);
      setMesaDaComanda(achouMesa);
    }
    setLoading(false);
  }, [unidadeAtiva, comandaIdQuery]);

  useEffect(() => { carregar(); }, [carregar]);

  // CATEGORIAS (Top Carousel)
  const categorias = useMemo(() => {
    const set = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
    return ["Todas", ...set];
  }, [produtos]);

  const filtrados = useMemo(() => produtos.filter(p => {
    const mb = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = categoriaSelecionada === "Todas" || p.categoria === categoriaSelecionada;
    return mb && mc;
  }), [produtos, busca, categoriaSelecionada]);

  // AÇÕES
  async function handleAbrirComanda() {
    if (!nomeNovoCliente.trim() || !novaMesaIdQuery) return;
    setSalvando(true);
    const { data, error } = await abrirComanda(novaMesaIdQuery, nomeNovoCliente, unidadeAtiva);
    setSalvando(false);
    if (!error && data) {
       router.replace(`/dashboard/vendas?comanda=${data[0].id}`);
       setModalNovaComanda(false);
    }
  }

  async function handleAddItem(p) {
    if (comandaAberta) {
       // Otimista
       const itens = comandaAberta.itens || [];
       const idx = itens.findIndex(x => x.id === p.id);
       const novo = [...itens];
       if(idx >= 0) novo[idx].quantidade += 1;
       else novo.push({ id: p.id, nome: p.nome, preco: Number(p.preco)||0, quantidade: 1 });
       
       setComandaAberta(prev => ({ ...prev, itens: novo }));
       await adicionarItemComanda(comandaAberta, p);
       showToast(`+1 ${p.nome} adicionado`);
    } else {
       // Balcão
       setCarrinhoBalcao(prev => {
         const ex = prev.find(x => x.id === p.id);
         if (ex) return prev.map(x => x.id === p.id ? { ...x, quantidade: x.quantidade + 1 } : x);
         return [...prev, { id: p.id, nome: p.nome, preco: Number(p.preco)||0, quantidade: 1 }];
       });
    }
  }

  async function handleMinusItem(p) {
    if (comandaAberta) {
       const itens = comandaAberta.itens || [];
       const novo = itens.map(x => x.id === p.id ? { ...x, quantidade: x.quantidade - 1 } : x).filter(x => x.quantidade > 0);
       setComandaAberta(prev => ({ ...prev, itens: novo }));
       await removerItemComanda(comandaAberta, p.id);
    } else {
       setCarrinhoBalcao(prev => prev.map(x => x.id === p.id ? { ...x, quantidade: x.quantidade - 1 } : x).filter(x => x.quantidade > 0));
    }
  }

  // CARRINHO VIEW
  const isMesa = !!comandaAberta;
  const itensCarrinho = isMesa ? (comandaAberta.itens || []) : carrinhoBalcao;
  const subtotal = itensCarrinho.reduce((a, x) => a + x.preco * x.quantidade, 0);
  const totalItens = itensCarrinho.reduce((a, x) => a + x.quantidade, 0);
  const taxaServicoVal = isMesa ? subtotal * 0.1 : 0;
  const totalFinal = subtotal + taxaServicoVal;

  async function handleConfirmarPagamento() {
    setSalvando(true);
    const opts = {
      itens: itensCarrinho,
      desconto: 0, acrescimo: 0,
      taxa_servico: taxaServicoVal,
      forma_pagamento: formaPgto,
      cliente: isMesa ? comandaAberta.nome_cliente : "Balcão",
      caixa_id: caixaAtual?.id
    };

    if (isMesa) {
      const { error } = await fecharComanda(comandaAberta, opts, unidadeAtiva);
      if (!error) {
         showToast("Comanda fechada com sucesso!");
         setTimeout(() => router.push("/dashboard/mesas"), 1500);
      }
    } else {
      const { error } = await registrarVenda(opts, unidadeAtiva);
      if (!error) {
         showToast("Venda balcão registrada!");
         setCarrinhoBalcao([]);
         setModalCheckout(false);
      }
    }
    setSalvando(false);
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-black text-2xl text-slate-400 bg-slate-50">Iniciando PDV...</div>;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl font-black text-sm transition-all animate-bounce">
          {toast}
        </div>
      )}

      {/* COLUNA ESQUERDA: PRODUTOS (CARDÁPIO) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-xl z-10">
         {/* HEADER ESQUERDO */}
         <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 bg-white z-20">
            {isMesa && (
               <button onClick={() => router.push("/dashboard/mesas")} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-500 transition-colors shadow-sm">
                 <ArrowLeft size={24} />
               </button>
            )}
            <div className="relative flex-1">
               <SearchIcon size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Buscar produto..." 
                 value={busca} 
                 onChange={e => setBusca(e.target.value)} 
                 className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-medium" 
               />
            </div>
            {isMesa && (
               <div className="px-6 py-4 bg-blue-50 text-blue-700 font-black text-lg rounded-2xl flex items-center gap-2 shadow-sm">
                 MESA {mesaDaComanda?.numero}
               </div>
            )}
         </div>

         {/* CARROSSEL DE CATEGORIAS */}
         <div className="border-b border-slate-100 bg-white px-6 py-4 overflow-x-auto custom-scrollbar flex gap-3">
            {categorias.map(c => (
               <button 
                 key={c} 
                 onClick={() => setCategoriaSelecionada(c)} 
                 className={`flex-shrink-0 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-200 ${
                   categoriaSelecionada === c 
                     ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 transform scale-105' 
                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 {c}
               </button>
            ))}
         </div>

         {/* GRID DE PRODUTOS */}
         <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
               {filtrados.map(p => {
                 const qtdNoCarrinho = itensCarrinho.find(x => x.id === p.id)?.quantidade || 0;
                 return (
                   <button 
                     key={p.id} 
                     onClick={() => handleAddItem(p)}
                     className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-200 flex flex-col relative group text-left active:scale-95"
                   >
                      {qtdNoCarrinho > 0 && (
                        <div className="absolute top-3 right-3 w-10 h-10 bg-blue-600 text-white font-black text-lg flex items-center justify-center rounded-full shadow-lg z-10">
                          {qtdNoCarrinho}
                        </div>
                      )}
                      
                      <div className="h-40 bg-slate-100 flex items-center justify-center text-slate-300 relative overflow-hidden group-hover:bg-slate-200 transition-colors">
                         <ImageIcon size={48} className="opacity-50" />
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col justify-between">
                         <h3 className="font-bold text-slate-800 text-base leading-tight mb-2 line-clamp-2">{p.nome}</h3>
                         <span className="font-black text-blue-600 text-xl">{fmtBRL(p.preco)}</span>
                      </div>
                   </button>
                 )
               })}
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA: CUPOM FISCAL / CARRINHO */}
      <div className="w-[420px] bg-slate-50 flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-20 border-l border-slate-200">
         
         {/* Cabeçalho Cupom */}
         <div className="p-6 bg-white border-b border-slate-200 shadow-sm">
            <h2 className="font-black text-2xl text-slate-800 tracking-tight">
              {isMesa ? `Comanda: ${comandaAberta.nome_cliente}` : "Venda Balcão"}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">{totalItens} Itens</p>
         </div>

         {/* Lista de Itens do Cupom */}
         <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {itensCarrinho.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                 <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                   <Plus size={32} className="text-slate-500" />
                 </div>
                 <p className="font-black text-lg">Cupom Vazio</p>
                 <p className="text-sm font-medium text-slate-500 mt-1">Toque nos produtos para adicionar</p>
               </div>
            ) : (
               itensCarrinho.map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                       <p className="font-bold text-slate-800 text-[15px] leading-tight flex-1 pr-2">{item.nome}</p>
                       <p className="font-black text-blue-600 text-[15px]">{fmtBRL(item.preco * item.quantidade)}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold text-slate-400">{fmtBRL(item.preco)} un</span>
                       
                       <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => handleMinusItem(item)} className="w-10 h-10 flex items-center justify-center bg-white shadow-sm text-slate-600 hover:text-red-500 rounded-lg active:scale-95 transition-all">
                             {item.quantidade === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                          </button>
                          <span className="font-black text-lg w-10 text-center text-slate-800">{item.quantidade}</span>
                          <button onClick={() => handleAddItem(item)} className="w-10 h-10 flex items-center justify-center bg-white shadow-sm text-slate-600 hover:text-blue-600 rounded-lg active:scale-95 transition-all">
                             <Plus size={18} />
                          </button>
                       </div>
                    </div>
                 </div>
               ))
            )}
         </div>

         {/* Rodapé Totais e Botão Cobrar */}
         <div className="bg-white border-t border-slate-200 p-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-2">
               <span className="text-sm font-bold text-slate-500">Subtotal</span>
               <span className="text-base font-black text-slate-800">{fmtBRL(subtotal)}</span>
            </div>
            {isMesa && (
              <div className="flex justify-between items-center mb-4">
                 <span className="text-sm font-bold text-slate-500">Taxa de Serviço (10%)</span>
                 <span className="text-base font-black text-slate-800">+{fmtBRL(taxaServicoVal)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-4 mt-2 border-t-2 border-dashed border-slate-200 mb-6">
               <span className="font-black text-2xl text-slate-800 uppercase tracking-tight">Total</span>
               <span className="font-black text-4xl text-blue-600">{fmtBRL(totalFinal)}</span>
            </div>

            <button 
              disabled={totalItens === 0} 
              onClick={() => setModalCheckout(true)} 
              className="w-full py-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xl uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/30 transition-all duration-200 active:scale-95 flex items-center justify-center gap-3"
            >
               Cobrar {totalItens > 0 ? fmtBRL(totalFinal) : ""}
            </button>
         </div>
      </div>

      {/* MODAL NOVA COMANDA */}
      {modalNovaComanda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-black text-3xl text-slate-800 tracking-tight">Nova Mesa</h2>
              <button onClick={() => router.push("/dashboard/mesas")} className="text-slate-400 hover:text-slate-800 bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center transition-colors"><X size={24}/></button>
            </div>
            
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Nome do Cliente</label>
            <input 
              type="text" 
              autoFocus 
              value={nomeNovoCliente} 
              onChange={e => setNomeNovoCliente(e.target.value)} 
              placeholder="Ex: João da Silva" 
              className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white mb-8 font-black text-xl text-slate-800 transition-colors" 
            />
            
            <button 
              onClick={handleAbrirComanda} 
              disabled={!nomeNovoCliente.trim() || salvando} 
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black text-lg uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-600/20"
            >
              Abrir Comanda
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT / PAGAMENTO */}
      {modalCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h2 className="font-black text-3xl text-slate-800 tracking-tight">Pagamento</h2>
                <p className="text-sm font-bold text-slate-400 uppercase mt-2 tracking-widest">{isMesa ? comandaAberta.nome_cliente : "Venda Balcão"}</p>
              </div>
              <button onClick={() => setModalCheckout(false)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"><X size={24}/></button>
            </div>

            <div className="p-8 bg-slate-50 flex-1">
               {/* Resumo Total Gigante */}
               <div className="flex justify-between items-center p-8 bg-blue-600 text-white rounded-[28px] mb-8 shadow-xl shadow-blue-600/20">
                 <div>
                   <p className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-2">Total a Pagar</p>
                   <p className="font-black text-6xl tracking-tight">{fmtBRL(totalFinal)}</p>
                 </div>
                 <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-inner">
                   <CreditCard size={32} className="text-white" />
                 </div>
               </div>

               {/* Métodos de Pagamento */}
               <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Escolha a Forma</label>
               <div className="grid grid-cols-2 gap-4 mb-10">
                 {[
                   { id: 'dinheiro', icon: Banknote, label: 'Dinheiro' },
                   { id: 'credito', icon: CreditCard, label: 'Cartão Crédito' },
                   { id: 'debito', icon: CreditCard, label: 'Cartão Débito' },
                   { id: 'pix', icon: QrCode, label: 'PIX Instantâneo' }
                 ].map(m => (
                   <button 
                     key={m.id} 
                     onClick={() => setFormaPgto(m.id)} 
                     className={`flex items-center gap-4 p-6 rounded-[24px] border-4 transition-all duration-200 active:scale-95 ${
                       formaPgto === m.id 
                         ? 'border-blue-600 bg-white text-blue-600 font-black shadow-lg shadow-blue-600/10' 
                         : 'border-transparent bg-white text-slate-500 font-bold hover:border-slate-200'
                     }`}
                   >
                     <m.icon size={28} className={formaPgto === m.id ? 'text-blue-600' : 'text-slate-400'} />
                     <span className="text-lg">{m.label}</span>
                   </button>
                 ))}
               </div>

               <button 
                 onClick={handleConfirmarPagamento} 
                 disabled={salvando || !caixaAtual} 
                 className="w-full py-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-2xl uppercase tracking-widest rounded-3xl shadow-xl shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
               >
                 {salvando ? "Processando..." : (caixaAtual ? "Confirmar R$" : "Caixa Fechado")}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VendasPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-black text-2xl text-slate-400 bg-slate-50">Iniciando PDV...</div>}>
      <VendasPDVContent />
    </Suspense>
  )
}
