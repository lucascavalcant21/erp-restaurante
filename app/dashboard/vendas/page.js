"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, Trash2, Search as SearchIcon, ArrowLeft, Image as ImageIcon, ChevronRight, X, CreditCard, Banknote, QrCode } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchMesasEComandas, abrirComanda, adicionarItemComanda, removerItemComanda, fecharComanda } from "../../lib/mesas";
import { fetchCaixaAberto } from "../../lib/caixas";
import { registrarVenda } from "../../lib/vendas";
import { fmtBRL } from "../../components/ui";

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

  if (loading) return <div className="flex h-full items-center justify-center font-bold text-slate-400">Carregando PDV...</div>;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-50 gap-4 overflow-hidden relative">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl font-bold text-sm transition-all">
          {toast}
        </div>
      )}

      {/* COLUNA ESQUERDA: PRODUTOS */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-[32px] shadow-[0_4px_32px_rgba(9,9,11,0.06)] border border-slate-200/50 overflow-hidden relative">
         {/* HEADER ESQUERDO: Busca e Title */}
         <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-white/90 backdrop-blur-md z-10 sticky top-0">
            {isMesa && (
               <button onClick={() => router.push("/dashboard/mesas")} className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shadow-sm">
                 <ArrowLeft size={18} />
               </button>
            )}
            <div className="relative flex-1">
               <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[14px] text-sm outline-none focus:border-orange-500 focus:bg-white shadow-sm transition-colors" />
            </div>
            {isMesa && (
               <div className="px-4 py-2.5 bg-teal-50 text-teal-700 font-bold text-sm rounded-[14px] border border-teal-100 uppercase tracking-wider flex items-center gap-2 shadow-sm">
                 <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div> {mesaDaComanda?.numero}
               </div>
            )}
         </div>

         {/* CARROSSEL DE CATEGORIAS (Estilo Takeat) */}
         <div className="border-b border-slate-100 bg-white/50 backdrop-blur-sm px-4 py-5 overflow-x-auto hide-scrollbar flex gap-4">
            {categorias.map(c => (
               <button key={c} onClick={() => setCategoriaSelecionada(c)} className={`flex flex-col items-center justify-center min-w-[90px] p-4 rounded-[20px] border-2 transition-all duration-300 ${categoriaSelecionada === c ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 shadow-[0_8px_16px_rgba(249,115,22,0.15)] transform -translate-y-1' : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 hover:-translate-y-0.5'}`}>
                  <div className={`w-14 h-14 rounded-[16px] mb-3 flex items-center justify-center font-black text-xl shadow-inner transition-colors ${categoriaSelecionada === c ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {c.substring(0,2).toUpperCase()}
                  </div>
                  <span className={`text-[12px] font-black uppercase tracking-widest text-center ${categoriaSelecionada === c ? 'text-orange-700' : 'text-slate-500'}`}>{c}</span>
               </button>
            ))}
         </div>

         {/* GRID DE PRODUTOS */}
         <div className="flex-1 overflow-y-auto p-5 hide-scrollbar bg-slate-50/50">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
               {filtrados.map(p => {
                 const qtdNoCarrinho = itensCarrinho.find(x => x.id === p.id)?.quantidade || 0;
                 return (
                   <div key={p.id} className="bg-white border border-slate-200/60 rounded-[24px] overflow-hidden shadow-sm hover:shadow-[0_20px_40px_rgba(9,9,11,0.08)] transition-all duration-300 hover:-translate-y-1.5 flex flex-col relative group">
                      {qtdNoCarrinho > 0 && (
                        <div className="absolute top-3 right-3 w-8 h-8 bg-orange-500 text-white font-black text-sm flex items-center justify-center rounded-full shadow-[0_4px_12px_rgba(249,115,22,0.4)] z-10">{qtdNoCarrinho}</div>
                      )}
                      {/* Imagem Placeholder */}
                      <div className="h-36 bg-slate-50 flex items-center justify-center text-slate-300 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                         <ImageIcon size={48} className="opacity-20 transition-transform duration-500 group-hover:scale-110" />
                         {/* Efeito overlay gradiente para ficar mais premium */}
                         <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                         <h3 className="font-bold text-slate-800 text-[15px] leading-tight mb-2 flex-1 group-hover:text-orange-600 transition-colors">{p.nome}</h3>
                         <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                           <span className="font-black text-teal-600 text-[16px]">{fmtBRL(p.preco)}</span>
                           <button onClick={() => handleAddItem(p)} className="w-10 h-10 rounded-[14px] bg-slate-100 text-slate-500 hover:bg-orange-500 hover:text-white hover:shadow-[0_4px_12px_rgba(249,115,22,0.3)] flex items-center justify-center transition-all transform active:scale-95">
                             <Plus size={18} />
                           </button>
                         </div>
                      </div>
                   </div>
                 )
               })}
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA: CARRINHO (Sidebar fixa) */}
      <div className="w-[400px] bg-white rounded-[32px] shadow-[0_4px_32px_rgba(9,9,11,0.06)] border border-slate-200/50 flex flex-col flex-shrink-0 relative overflow-hidden">
         {/* Carrinho Header */}
         <div className="p-6 border-b border-slate-100 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
            <h2 className="font-black text-2xl tracking-tighter relative z-10">{isMesa ? `Comanda de ${comandaAberta.nome_cliente}` : "Pedido Balcão"}</h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest relative z-10">{totalItens} itens selecionados</p>
         </div>

         {/* Lista de Itens */}
         <div className="flex-1 overflow-y-auto p-5 hide-scrollbar flex flex-col gap-4 bg-slate-50/50">
            {itensCarrinho.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                 <ShoppingCart size={56} className="mb-5 text-slate-300" />
                 <p className="font-bold text-[15px]">Carrinho vazio</p>
                 <p className="text-xs font-medium mt-1">Adicione itens para começar</p>
               </div>
            ) : (
               itensCarrinho.map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:shadow-md hover:border-slate-300 group">
                    <div className="flex-1 min-w-0">
                       <p className="font-bold text-slate-800 text-[14px] leading-tight line-clamp-2">{item.nome}</p>
                       <p className="font-bold text-teal-600 text-[13px] mt-1.5">{fmtBRL(item.preco)}</p>
                    </div>
                    {/* Controles */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-[12px] p-1 shadow-inner">
                       <button onClick={() => handleMinusItem(item)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-white hover:shadow-sm rounded-[8px] transition-all">
                          {item.quantidade === 1 ? <Trash2 size={15} className="text-red-500" /> : <Minus size={15} />}
                       </button>
                       <span className="font-bold text-[14px] w-5 text-center">{item.quantidade}</span>
                       <button onClick={() => handleAddItem(item)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:bg-white hover:shadow-sm rounded-[8px] transition-all">
                          <Plus size={15} />
                       </button>
                    </div>
                 </div>
               ))
            )}
         </div>

         {/* Carrinho Footer (Totais e Botão Pagar) */}
         <div className="p-6 border-t border-slate-100 bg-white">
            <div className="flex justify-between items-center mb-3">
               <span className="text-[14px] font-bold text-slate-500">Subtotal</span>
               <span className="text-[15px] font-black text-slate-800">{fmtBRL(subtotal)}</span>
            </div>
            {isMesa && (
              <div className="flex justify-between items-center mb-4">
                 <span className="text-[14px] font-bold text-slate-500">Taxa Serv. (10%)</span>
                 <span className="text-[14px] font-bold text-slate-800">+{fmtBRL(taxaServicoVal)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
               <span className="font-black text-xl text-slate-800 uppercase tracking-tighter">Total</span>
               <span className="font-black text-3xl text-teal-600 tracking-tight">{fmtBRL(totalFinal)}</span>
            </div>

            <button disabled={totalItens === 0} onClick={() => setModalCheckout(true)} className="w-full py-5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none text-white font-black text-[16px] uppercase tracking-wider rounded-[20px] shadow-[0_12px_24px_rgba(20,184,166,0.3)] transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-[0.98]">
               Avançar p/ Caixa <ChevronRight size={22} className="ml-1" />
            </button>
         </div>
      </div>

      {/* MODAL NOVA COMANDA */}
      {modalNovaComanda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h2 className="font-black text-xl text-slate-800 tracking-tight">Nova Comanda</h2>
              <button onClick={() => router.push("/dashboard/mesas")} className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><X size={16}/></button>
            </div>
            <div className="p-6">
               <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Nome do Cliente</label>
               <input type="text" autoFocus value={nomeNovoCliente} onChange={e => setNomeNovoCliente(e.target.value)} placeholder="Ex: João Silva" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[14px] outline-none focus:border-teal-500 focus:bg-white mb-6 font-bold text-[15px] transition-colors shadow-sm" />
               <button onClick={handleAbrirComanda} disabled={!nomeNovoCliente.trim() || salvando} className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:opacity-50 text-white font-black text-[15px] uppercase tracking-wide rounded-[14px] transition-all transform active:scale-95 shadow-[0_4px_14px_rgba(20,184,166,0.3)]">
                 Abrir Comanda
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT / PAGAMENTO */}
      {modalCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col border border-slate-200/50">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h2 className="font-black text-xl text-slate-800 tracking-tight">Pagamento</h2>
                <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{isMesa ? comandaAberta.nome_cliente : "Balcão"}</p>
              </div>
              <button onClick={() => setModalCheckout(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={16}/></button>
            </div>

            <div className="p-6 flex-1 flex flex-col">
               {/* Resumo Total */}
               <div className="flex justify-between items-center p-5 bg-teal-50 border border-teal-100 rounded-[20px] mb-8 shadow-sm">
                 <div>
                   <p className="text-[11px] font-bold text-teal-600 uppercase tracking-widest mb-1.5">Total a Pagar</p>
                   <p className="font-black text-4xl text-teal-700 tracking-tight">{fmtBRL(totalFinal)}</p>
                 </div>
                 <div className="text-right opacity-60">
                   <p className="text-[11px] font-bold text-teal-600 uppercase tracking-widest mb-1.5">Restante</p>
                   <p className="font-black text-xl text-teal-700">{fmtBRL(totalFinal)}</p>
                 </div>
               </div>

               {/* Métodos de Pagamento */}
               <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Método de Pagamento</label>
               <div className="grid grid-cols-2 gap-3 mb-8">
                 {[
                   { id: 'dinheiro', icon: Banknote, label: 'Dinheiro' },
                   { id: 'credito', icon: CreditCard, label: 'Crédito' },
                   { id: 'debito', icon: CreditCard, label: 'Débito' },
                   { id: 'pix', icon: QrCode, label: 'PIX' }
                 ].map(m => (
                   <button key={m.id} onClick={() => setFormaPgto(m.id)} className={`flex items-center gap-3 p-4 rounded-[16px] border-[2.5px] transition-all ${formaPgto === m.id ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold shadow-md transform -translate-y-0.5' : 'border-slate-100 bg-white text-slate-600 font-semibold hover:border-slate-200 hover:bg-slate-50'}`}>
                     <m.icon size={20} className={formaPgto === m.id ? 'text-teal-500' : 'text-slate-400'} />
                     <span className="text-[14px]">{m.label}</span>
                   </button>
                 ))}
               </div>

               <div className="mt-auto pt-6">
                 <button onClick={handleConfirmarPagamento} disabled={salvando || !caixaAtual} className="w-full py-5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-[16px] tracking-wider uppercase rounded-[20px] shadow-[0_12px_32px_rgba(16,185,129,0.3)] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
                   {salvando ? "Processando..." : (caixaAtual ? "Finalizar Pagamento" : "CAIXA FECHADO - Abra o caixa")}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VendasPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-slate-400">Iniciando PDV...</div>}>
      <VendasPDVContent />
    </Suspense>
  )
}
