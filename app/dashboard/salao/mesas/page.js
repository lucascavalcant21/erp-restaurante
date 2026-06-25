"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchCaixaAberto, abrirCaixa, registrarMovimentacao, fetchResumoCaixa, fecharCaixa } from "../../../lib/caixas";
import { fetchProdutos, lancarVendaBalcao, fetchMesas, criarMesa, fetchPedidoAberto, abrirMesaEPedido, lancarItemComanda, fecharContaDaMesa } from "../../../lib/vendas";
import { Lock, Unlock, LogOut, DollarSign, ArrowDownCircle, ArrowUpCircle, ShoppingBag, ShoppingCart, Maximize, Plus, Minus, Trash2, Printer, Users, Barcode, CreditCard, Receipt, SplitSquareHorizontal, Utensils, Send, X, Settings } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function SaloesMesasPage() {
  const { unidadeAtiva, usuarioLogado } = useERP();
  
  const [loading, setLoading] = useState(true);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // --- CAIXA STATE ---
  const [caixa, setCaixa] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('salao'); // 'salao' ou 'balcao'

  const [modalAbrir, setModalAbrir] = useState(false);
  const [fundoCaixa, setFundoCaixa] = useState("");
  const [modalMov, setModalMov] = useState(false);
  const [tipoMov, setTipoMov] = useState("");
  const [valorMov, setValorMov] = useState("");
  const [descMov, setDescMov] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [resumoZ, setResumoZ] = useState(null);

  // --- PRODUTOS ---
  const [produtos, setProdutos] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [buscaProd, setBuscaProd] = useState("");
  const buscaRef = useRef(null);

  // --- BALCÃO STATE ---
  const [carrinho, setCarrinho] = useState([]);
  
  // --- SALÃO STATE ---
  const [mesas, setMesas] = useState([]);
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [pedidoAtivo, setPedidoAtivo] = useState(null);
  const [modalGestaoMesas, setModalGestaoMesas] = useState(false);
  const [novaMesaNum, setNovaMesaNum] = useState("");

  const [modalLancar, setModalLancar] = useState(false);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtdLancamento, setQtdLancamento] = useState(1);
  const [obsLancamento, setObsLancamento] = useState("");

  // --- PAGAMENTO STATE ---
  const [modalPagamento, setModalPagamento] = useState(false);
  const [processando, setProcessando] = useState(false);
  
  const [pagamentos, setPagamentos] = useState([{ id: 1, forma: 'dinheiro', valor: 0 }]);
  const [descontoPerc, setDescontoPerc] = useState("");
  const [descontoRs, setDescontoRs] = useState("");
  const [taxaExtra, setTaxaExtra] = useState("");
  const [clienteCpf, setClienteCpf] = useState("");
  const [clienteNome, setClienteNome] = useState("");

  // --- RECIBO ---
  const [modalRecibo, setModalRecibo] = useState(false);
  const [dadosRecibo, setDadosRecibo] = useState(null);

  // ==========================================
  // INITIAL LOAD
  // ==========================================
  const carregarTudo = async () => {
    setLoading(true);
    if (!unidadeAtiva) return;

    const { data: cx } = await fetchCaixaAberto(unidadeAtiva);
    setCaixa(cx);
    
    if (cx) {
      const { data: prods } = await fetchProdutos(unidadeAtiva);
      setProdutos(prods || []);
      await carregarMesas();
    }
    setLoading(false);
  };

  const carregarMesas = async () => {
    const { data: m } = await fetchMesas(unidadeAtiva);
    setMesas(m || []);
  };

  useEffect(() => {
    carregarTudo();
  }, [unidadeAtiva]);

  useEffect(() => {
    if(caixa && abaAtiva === 'balcao' && buscaRef.current) {
       buscaRef.current.focus();
    }
  }, [caixa, abaAtiva]);

  // ==========================================
  // CAIXA ACTIONS
  // ==========================================
  const handleAbrirCaixa = async (e) => {
    e.preventDefault();
    setProcessando(true);
    const { error } = await abrirCaixa(unidadeAtiva, usuarioLogado?.id, fundoCaixa);
    setProcessando(false);
    if (error) return alert(error);
    setModalAbrir(false);
    carregarTudo();
  };

  const handleMovimentacao = async (e) => {
    e.preventDefault();
    if(!valorMov || !descMov) return alert("Preencha o valor e o motivo.");
    setProcessando(true);
    const { error } = await registrarMovimentacao(caixa.id, unidadeAtiva, tipoMov, valorMov, descMov);
    setProcessando(false);
    if (error) return alert(error);
    setModalMov(false);
    alert(`${tipoMov.toUpperCase()} registrada com sucesso!`);
    setValorMov(""); setDescMov("");
  };

  const abrirFechamento = async () => {
    setProcessando(true);
    const { data, error } = await fetchResumoCaixa(caixa.id);
    setProcessando(false);
    if (error) return alert(error);
    setResumoZ(data);
    setModalFechamento(true);
  };

  const confirmarFechamento = async () => {
    if(!confirm("Encerrar o turno atual? Novas vendas não serão permitidas.")) return;
    setProcessando(true);
    const { error } = await fecharCaixa(caixa.id);
    setProcessando(false);
    if (error) return alert("Erro ao fechar: " + error);
    alert("Turno Encerrado!");
    setModalFechamento(false);
    setCaixa(null);
  };

  // ==========================================
  // SALÃO ACTIONS
  // ==========================================
  const handleCriarMesa = async () => {
    const num = prompt("Número da nova mesa:");
    if(!num) return;
    await criarMesa(unidadeAtiva, Number(num));
    carregarMesas();
  };

  const clicarMesa = async (mesa) => {
    setMesaAtiva(mesa);
    if(mesa.status === 'livre') {
       if(confirm(`Deseja abrir a Mesa ${mesa.numero_mesa}?`)) {
          await abrirMesaEPedido(unidadeAtiva, mesa.id);
          await carregarMesas();
          const { data } = await fetchPedidoAberto(mesa.id);
          setPedidoAtivo(data);
       } else {
          setMesaAtiva(null);
       }
    } else {
       const { data } = await fetchPedidoAberto(mesa.id);
       setPedidoAtivo(data);
    }
  };

  const prepararLancamentoMesa = () => {
    setProdutoSel("");
    setQtdLancamento(1);
    setObsLancamento("");
    setModalLancar(true);
  };

  const confirmarLancamentoMesa = async () => {
    if(!produtoSel) return alert("Selecione um produto");
    const prodObj = produtos.find(p => p.id === produtoSel);
    setProcessando(true);
    await lancarItemComanda(pedidoAtivo.id, prodObj.id, prodObj.preco_venda || prodObj.preco || 0, qtdLancamento, obsLancamento);
    setProcessando(false);
    setModalLancar(false);
    const { data } = await fetchPedidoAberto(mesaAtiva.id);
    setPedidoAtivo(data);
  };

  // ==========================================
  // BALCÃO ACTIONS
  // ==========================================
  const produtosFiltrados = useMemo(() => {
    let p = produtos;
    if (filtroCategoria !== "Todas") p = p.filter(x => (x.categoria || "Sem Categoria") === filtroCategoria);
    if (buscaProd) p = p.filter(x => x.nome_produto.toLowerCase().includes(buscaProd.toLowerCase()) || x.codigo_barras === buscaProd);
    return p;
  }, [produtos, filtroCategoria, buscaProd]);

  const addAoCarrinho = (prod) => {
    setCarrinho(prev => {
      const existente = prev.find(i => i.id === prod.id);
      if (existente) return prev.map(i => i.id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { ...prod, quantidade: 1 }];
    });
  };

  const alterarQtd = (id, delta) => {
    setCarrinho(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const removerItem = (id) => {
    setCarrinho(prev => prev.filter(i => i.id !== id));
  };

  const checkBipeBusca = (e) => {
     if(e.key === 'Enter' && buscaProd) {
        const prodMatch = produtosFiltrados.find(p => p.codigo_barras === buscaProd || p.nome_produto.toLowerCase() === buscaProd.toLowerCase());
        if(prodMatch) {
           addAoCarrinho(prodMatch);
           setBuscaProd(""); 
        }
     }
  };

  const totalCarrinho = useMemo(() => carrinho.reduce((a, i) => a + (Number(i.preco_venda || i.preco || 0) * i.quantidade), 0), [carrinho]);

  // ==========================================
  // PAGAMENTO (MEGAZORD)
  // ==========================================
  const abrirModalPagamento = () => {
     let sub = 0;
     if(abaAtiva === 'balcao') sub = totalCarrinho;
     else if(abaAtiva === 'salao' && pedidoAtivo) {
        sub = pedidoAtivo.pedidos_itens?.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0) || 0;
     }

     if(sub <= 0) return alert("Valor zerado!");

     setDescontoPerc(""); setDescontoRs(""); setTaxaExtra(""); setClienteCpf(""); setClienteNome("");
     setPagamentos([{ id: Date.now(), forma: 'dinheiro', valor: sub }]);
     setModalPagamento(true);
  };

  const subtotalPagamento = useMemo(() => {
     let sub = 0;
     if(abaAtiva === 'balcao') sub = totalCarrinho;
     else if(abaAtiva === 'salao' && pedidoAtivo) {
        sub = pedidoAtivo.pedidos_itens?.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0) || 0;
     }
     return sub;
  }, [abaAtiva, totalCarrinho, pedidoAtivo]);

  const valorTotalFinal = useMemo(() => {
     let v = subtotalPagamento;
     const desc = Number(descontoRs) || (v * (Number(descontoPerc)/100)) || 0;
     const taxa = Number(taxaExtra) || 0;
     return v - desc + taxa;
  }, [subtotalPagamento, descontoRs, descontoPerc, taxaExtra]);

  const somaPagamentos = useMemo(() => pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0), [pagamentos]);
  const troco = Math.max(0, somaPagamentos - valorTotalFinal);
  const restante = Math.max(0, valorTotalFinal - somaPagamentos);

  const finalizarVenda = async (e) => {
     e.preventDefault();
     if(somaPagamentos < valorTotalFinal) return alert(`Falta receber ${fmtBRL(restante)}`);

     setProcessando(true);

     let recebimentosReais = [];
     let valorProcessado = 0;
     for(let i = 0; i < pagamentos.length; i++) {
        let p = pagamentos[i];
        let valPago = Number(p.valor);
        if(valPago <= 0) continue;
        if(p.forma === 'dinheiro' && troco > 0 && valorProcessado + valPago > valorTotalFinal) {
           valPago = valPago - troco; 
        }
        recebimentosReais.push({ forma: p.forma, valor: valPago });
        valorProcessado += valPago;
     }

     const pagamentoData = {
        principal: recebimentosReais[0]?.forma || 'misto',
        split: recebimentosReais,
        desconto: Number(descontoRs) || (subtotalPagamento * (Number(descontoPerc)/100)) || 0,
        taxa: Number(taxaExtra) || 0,
        cpf: clienteCpf,
        nome: clienteNome
     };

     let sucesso = false;
     let pedidoIdParaRecibo = null;

     if(abaAtiva === 'balcao') {
        const itensMapeados = carrinho.map(i => ({ ...i, preco_venda: i.preco_venda || i.preco || 0 }));
        const { error, data } = await lancarVendaBalcao(unidadeAtiva, caixa.id, itensMapeados, pagamentoData);
        if(error) alert(error);
        else { sucesso = true; pedidoIdParaRecibo = data.id; }
     } else {
        const { error } = await fecharContaDaMesa(mesaAtiva.id, pedidoAtivo.id, unidadeAtiva, caixa.id, pagamentoData);
        if(error) alert(error);
        else { sucesso = true; pedidoIdParaRecibo = pedidoAtivo.id; }
     }

     setProcessando(false);

     if(sucesso) {
        const itensRecibo = abaAtiva === 'balcao' 
          ? carrinho.map(i => ({ nome: i.nome_produto, qtd: i.quantidade, tot: i.quantidade * (i.preco_venda||0) }))
          : pedidoAtivo.pedidos_itens.map(i => ({ nome: i.produtos?.nome_produto || 'Item', qtd: i.quantidade, tot: i.quantidade * i.valor_unitario }));

        setDadosRecibo({
           id: pedidoIdParaRecibo,
           tipo: abaAtiva,
           mesa: mesaAtiva?.numero_mesa,
           itens: itensRecibo,
           subtotal: subtotalPagamento,
           desconto: pagamentoData.desconto,
           taxa: pagamentoData.taxa,
           total: valorTotalFinal,
           recebidos: recebimentosReais,
           troco: troco,
           cliente: clienteNome,
           cpf: clienteCpf,
           data: new Date()
        });

        setModalPagamento(false);
        if(abaAtiva === 'balcao') setCarrinho([]);
        if(abaAtiva === 'salao') { setMesaAtiva(null); setPedidoAtivo(null); carregarMesas(); }
        setModalRecibo(true);
     }
  };

  // ==========================================
  // RENDERS
  // ==========================================
  if (loading) return <div className="p-6 flex justify-center text-slate-500 font-bold">Carregando Frente de Loja...</div>;

  // --- BLOQUEADO SE CAIXA FECHADO ---
  if (!caixa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 min-h-[calc(100vh-72px)] p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center border border-slate-100">
           <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <Lock size={32} className="text-emerald-500" />
           </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Caixa Principal Fechado</h2>
           <p className="text-slate-500 font-medium mb-8">Para atender mesas ou vender no balcão, você precisa abrir o turno declarando o fundo de gaveta.</p>
           
           {!modalAbrir ? (
             <button onClick={() => setModalAbrir(true)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-transform shadow-lg">
               <Unlock size={20} /> ABRIR CAIXA
             </button>
           ) : (
             <form onSubmit={handleAbrirCaixa} className="text-left animate-in fade-in">
                <div className="mb-4">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fundo Inicial (Em Gaveta)</label>
                   <input type="number" step="0.01" required min="0" value={fundoCaixa} onChange={e => setFundoCaixa(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-2xl text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" autoFocus />
                </div>
                <div className="flex gap-3 mt-6">
                   <button type="button" onClick={() => setModalAbrir(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Voltar</button>
                   <button type="submit" disabled={processando} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl shadow-md">Confirmar</button>
                </div>
             </form>
           )}
        </div>
      </div>
    );
  }

  // --- CAIXA ABERTO ---
  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-slate-100 overflow-hidden font-sans">
      
      {/* HEADER DE COMANDO */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-lg z-20">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-emerald-400">
               <DollarSign size={20} />
            </div>
            <div>
               <h1 className="text-sm font-black tracking-widest uppercase">Frente de Loja</h1>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">Turno Aberto</span>
               </div>
            </div>
            
            <div className="ml-8 bg-black/20 p-1 rounded-xl flex gap-1 items-center">
               <button onClick={() => setAbaAtiva('salao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${abaAtiva === 'salao' ? 'bg-blue-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}>
                  <Users size={14} /> Salão (Mesas)
               </button>
               {abaAtiva === 'salao' && (
                  <button onClick={() => setModalGestaoMesas(true)} className="px-2 py-2 text-slate-400 hover:text-white transition-colors" title="Gerenciar Mesas Físicas">
                     <Settings size={14} />
                  </button>
               )}
               <button onClick={() => setAbaAtiva('balcao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ml-2 ${abaAtiva === 'balcao' ? 'bg-emerald-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}>
                  <ShoppingBag size={14} /> Balcão Rápido
               </button>
            </div>
         </div>

         <div className="flex gap-2">
            <button onClick={toggleFullScreen} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-white">
               <Maximize size={16} /> Tela Cheia
            </button>
            <button onClick={() => { setTipoMov('suprimento'); setModalMov(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-blue-300">
               <ArrowUpCircle size={16} /> Suprimento
            </button>
            <button onClick={() => { setTipoMov('sangria'); setModalMov(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-orange-300">
               <ArrowDownCircle size={16} /> Sangria
            </button>
            <button onClick={abrirFechamento} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 font-black text-xs rounded-lg shadow transition-colors ml-4">
               <LogOut size={16} /> Fechar Caixa
            </button>
         </div>
      </header>

      {/* BODY PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">
         
         {/* LADO ESQUERDO (AÇÃO: MESAS ou GRID PRODUTOS) */}
         <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
            
            {abaAtiva === 'salao' && (
              <div className="flex flex-col h-full overflow-hidden">
                 <div className="p-5 flex justify-between items-center border-b border-slate-200 bg-white shrink-0 shadow-sm z-10">
                    <h2 className="text-xl font-black text-slate-800">Mapa de Mesas</h2>
                    <button onClick={handleCriarMesa} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors">+ Adicionar Mesa</button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {mesas.length === 0 ? (
                       <div className="text-center py-10">
                          <p className="text-slate-500 font-bold mb-4">Nenhuma mesa cadastrada no salão.</p>
                          <button onClick={handleCriarMesa} className="px-6 py-3 bg-blue-500 text-white font-black rounded-xl">Criar Primeira Mesa</button>
                       </div>
                    ) : (
                       <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {mesas.map(m => (
                             <button key={m.id} onClick={() => clicarMesa(m)}
                               className={`bg-white rounded-2xl p-4 border-2 shadow-sm transition-all text-center flex flex-col hover:-translate-y-1 relative overflow-hidden ${
                                 mesaAtiva?.id === m.id ? 'border-slate-800 ring-4 ring-slate-800/20' 
                                 : m.status === 'ocupada' ? 'border-blue-500 shadow-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                               }`}>
                                {m.status === 'ocupada' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 font-black text-xl transition-colors ${m.status==='ocupada' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                   {m.numero_mesa}
                                </div>
                                <span className={`font-bold text-xs uppercase tracking-widest ${m.status==='ocupada' ? 'text-blue-500' : 'text-slate-400'}`}>{m.status}</span>
                             </button>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
            )}

            {abaAtiva === 'balcao' && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-white border-b border-slate-200 shrink-0 z-10 flex gap-3">
                   <div className="flex-1 relative">
                      <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" ref={buscaRef} value={buscaProd} onChange={e => setBuscaProd(e.target.value)} onKeyDown={checkBipeBusca} placeholder="Bipar código de barras ou buscar nome..." className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl font-bold outline-none" />
                   </div>
                </div>

                <div className="px-4 py-2 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0 shadow-sm z-10">
                   {["Todas", ...new Set(produtos.map(p => p.categoria || "Geral"))].map(cat => (
                      <button key={cat} onClick={() => setFiltroCategoria(cat)}
                         className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${filtroCategoria === cat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                         {cat}
                      </button>
                   ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {produtosFiltrados.map(prod => (
                         <button key={prod.id} onClick={() => addAoCarrinho(prod)} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all text-left flex flex-col group h-full">
                            <h3 className="font-bold text-slate-700 text-xs leading-tight mb-2 flex-1">{prod.nome_produto}</h3>
                            <div className="flex justify-between items-end w-full">
                               <p className="text-[10px] text-slate-400">Estoque: {prod.codigo_barras ? 'Sim' : 'N/A'}</p>
                               <p className="font-black text-emerald-600 text-sm">{fmtBRL(prod.preco_venda || prod.preco || 0)}</p>
                            </div>
                         </button>
                      ))}
                   </div>
                </div>
              </div>
            )}
         </div>

         {/* LADO DIREITO: COMANDA OU CARRINHO */}
         <div className="w-[400px] bg-white border-l border-slate-200 shadow-2xl flex flex-col shrink-0 z-20">
            
            {abaAtiva === 'balcao' && (
              <>
                <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                   <h2 className="font-black text-emerald-800 flex items-center gap-2"><ShoppingCart size={18}/> Cupom Balcão</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 bg-slate-50/30 custom-scrollbar space-y-2">
                   {carrinho.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm font-bold py-10">Carrinho Vazio</p>
                   ) : carrinho.map(item => (
                      <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                         <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-700 text-xs">{item.nome_produto}</span>
                            <span className="font-black text-slate-800 text-sm">{fmtBRL((item.preco_venda || item.preco || 0) * item.quantidade)}</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                               <button onClick={() => alterarQtd(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600"><Minus size={12}/></button>
                               <span className="w-8 text-center font-black text-xs">{item.quantidade}</span>
                               <button onClick={() => alterarQtd(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600"><Plus size={12}/></button>
                            </div>
                            <button onClick={() => removerItem(item.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                         </div>
                      </div>
                   ))}
                </div>
                <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10">
                   <div className="flex justify-between items-end mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total a Receber</span>
                      <span className="text-3xl font-black text-emerald-500 tracking-tight">{fmtBRL(totalCarrinho)}</span>
                   </div>
                   <button disabled={carrinho.length === 0} onClick={abrirModalPagamento} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg transition-transform flex items-center justify-center">
                      RECEBER AGORA
                   </button>
                </div>
              </>
            )}

            {abaAtiva === 'salao' && (
              <>
                <div className="px-5 py-4 bg-slate-800 border-b border-slate-900 flex justify-between items-center">
                   <h2 className="font-black text-white flex items-center gap-2"><Receipt size={18}/> Comanda Aberta</h2>
                   {mesaAtiva && <button onClick={()=>setMesaAtiva(null)} className="text-slate-400 hover:text-white"><X size={18}/></button>}
                </div>
                <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
                   {!mesaAtiva ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <Utensils size={40} className="mb-4 opacity-20"/>
                         <p className="font-bold text-sm">Selecione uma mesa</p>
                      </div>
                   ) : !pedidoAtivo ? (
                      <div className="p-6 text-center">
                         <p className="text-slate-500 font-bold mb-4">A Mesa {mesaAtiva.numero_mesa} está livre.</p>
                         <button onClick={()=>clicarMesa(mesaAtiva)} className="w-full py-3 bg-blue-500 text-white font-black rounded-xl">Abrir Mesa</button>
                      </div>
                   ) : (
                      <div className="flex-1 flex flex-col">
                         <div className="px-5 py-3 border-b border-slate-200 bg-white">
                            <h3 className="font-black text-slate-800 text-lg">Mesa {mesaAtiva.numero_mesa}</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Pedido #{pedidoAtivo.id.substring(0,8)}</p>
                         </div>
                         <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-1 text-sm">
                            {pedidoAtivo.pedidos_itens?.length === 0 && <p className="text-center text-slate-400 font-bold pt-4 text-xs">Comanda vazia</p>}
                            {pedidoAtivo.pedidos_itens?.map(it => (
                               <div key={it.id} className="flex justify-between py-2 border-b border-dashed border-slate-200 last:border-0 items-start">
                                  <div className="flex-1">
                                     <p className="font-bold text-slate-700">{it.quantidade}x {it.produtos?.nome_produto}</p>
                                     {it.observacao && <p className="text-[10px] text-slate-500 bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">Obs: {it.observacao}</p>}
                                  </div>
                                  <span className="font-black text-slate-800 pl-2">{fmtBRL(it.quantidade * it.valor_unitario)}</span>
                               </div>
                            ))}
                         </div>
                         <div className="p-3 bg-white border-t border-slate-200">
                            <button onClick={prepararLancamentoMesa} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-300">
                               <Plus size={16}/> LANÇAR PRODUTOS
                            </button>
                         </div>
                      </div>
                   )}
                </div>
                {mesaAtiva && pedidoAtivo && (
                  <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10">
                     <div className="flex justify-between items-end mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Conta</span>
                        <span className="text-3xl font-black text-blue-600 tracking-tight">{fmtBRL(pedidoAtivo.pedidos_itens?.reduce((a,i)=>a+(i.quantidade*i.valor_unitario),0)||0)}</span>
                     </div>
                     <button disabled={!pedidoAtivo.pedidos_itens?.length} onClick={abrirModalPagamento} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg transition-transform flex items-center justify-center">
                        RECEBER MESA
                     </button>
                  </div>
                )}
              </>
            )}
         </div>
      </div>

      {/* =======================================================
          MODAIS E SOBREPOSIÇÕES
      ======================================================== */}
      
      {/* MODAL: LANÇAR ITEM NA MESA */}
      {modalLancar && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Lançar Pedido</h2>
                  <button onClick={() => setModalLancar(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produto do Cardápio</label>
                     <select value={produtoSel} onChange={e => setProdutoSel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Selecione --</option>
                        {produtos.map(p => (
                           <option key={p.id} value={p.id}>{p.nome_produto} - {fmtBRL(p.preco_venda||p.preco||0)}</option>
                        ))}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantidade</label>
                     <input type="number" min="1" value={qtdLancamento} onChange={e => setQtdLancamento(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Observação (Ex: Sem cebola)</label>
                     <input type="text" value={obsLancamento} onChange={e => setObsLancamento(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional..." />
                  </div>
               </div>

               <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setModalLancar(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button type="button" onClick={confirmarLancamentoMesa} disabled={processando} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-black py-3 rounded-xl shadow-md flex justify-center items-center gap-2">
                     <Send size={16}/> Enviar para Produção
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MODAL DE PAGAMENTO (MEGAZORD) */}
      {modalPagamento && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl flex overflow-hidden max-h-[95vh]">
               
               {/* Lado Esquerdo: Identificação e Descontos */}
               <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto custom-scrollbar">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Users size={18}/> Cliente na Nota</h3>
                  <div className="space-y-4 mb-8">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">CPF / CNPJ</label>
                        <input type="text" value={clienteCpf} onChange={e=>setClienteCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Cliente</label>
                        <input type="text" value={clienteNome} onChange={e=>setClienteNome(e.target.value)} placeholder="Consumidor Final" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>
                  </div>

                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">Descontos e Taxas</h3>
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desc %</label>
                           <input type="number" value={descontoPerc} onChange={e=>setDescontoPerc(e.target.value)} placeholder="0%" className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"/>
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desc R$</label>
                           <input type="number" step="0.01" value={descontoRs} onChange={e=>setDescontoRs(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"/>
                        </div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Taxas Extras (Serviço, Entrega)</label>
                        <input type="number" step="0.01" value={taxaExtra} onChange={e=>setTaxaExtra(e.target.value)} placeholder="R$ 0.00" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>
                  </div>
               </div>

               {/* Lado Direito: Recebimento Split */}
               <div className="flex-1 p-8 flex flex-col bg-white">
                  
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                     <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><CreditCard className="text-blue-500"/> Fechar Pagamento</h2>
                     <button onClick={() => setModalPagamento(false)} className="text-slate-400 hover:text-slate-600 font-bold uppercase text-sm">Cancelar</button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-800 text-white rounded-2xl p-5 mb-8 shadow-md">
                     <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Líquido</p>
                        <div className="flex items-end gap-2">
                           <span className="text-4xl font-black text-emerald-400">{fmtBRL(valorTotalFinal)}</span>
                           {(Number(descontoPerc)>0 || Number(descontoRs)>0) && <span className="text-sm font-bold text-red-400 line-through pb-1">{fmtBRL(subtotalPagamento)}</span>}
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Restante</p>
                        <span className={`text-2xl font-black ${restante === 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{fmtBRL(restante)}</span>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-600 text-sm uppercase tracking-widest flex items-center gap-2"><SplitSquareHorizontal size={16}/> Formas de Pagamento</h3>
                        <button onClick={() => setPagamentos([...pagamentos, { id: Date.now(), forma: 'pix', valor: 0 }])} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">+ Forma Adicional</button>
                     </div>

                     <div className="space-y-3">
                        {pagamentos.map((p) => (
                           <div key={p.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <select value={p.forma} onChange={e => {
                                  const n = [...pagamentos];
                                  n.find(x=>x.id===p.id).forma = e.target.value;
                                  setPagamentos(n);
                              }} className="w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 outline-none">
                                 <option value="dinheiro">Dinheiro</option>
                                 <option value="pix">PIX</option>
                                 <option value="credito">Cartão Crédito</option>
                                 <option value="debito">Cartão Débito</option>
                                 <option value="vr">Vale Refeição</option>
                              </select>
                              <div className="relative w-1/2 flex items-center">
                                 <span className="absolute left-3 text-slate-400 font-bold">R$</span>
                                 <input type="number" step="0.01" value={p.valor || ''} onChange={e => {
                                      const n = [...pagamentos];
                                      n.find(x=>x.id===p.id).valor = e.target.value;
                                      setPagamentos(n);
                                 }} onFocus={() => { if(p.valor===0) { const n = [...pagamentos]; n.find(x=>x.id===p.id).valor = restante; setPagamentos(n); } }} 
                                 className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-black text-slate-800 outline-none" placeholder="0.00"/>
                                 {pagamentos.length > 1 && (
                                    <button onClick={() => setPagamentos(pagamentos.filter(x=>x.id!==p.id))} className="absolute -right-8 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>

                     {troco > 0 && (
                        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center animate-in fade-in">
                           <span className="font-bold text-orange-800 uppercase text-sm">Troco a devolver:</span>
                           <span className="text-2xl font-black text-orange-600">{fmtBRL(troco)}</span>
                        </div>
                     )}
                  </div>

                  <div className="pt-6 shrink-0 mt-4 border-t border-slate-100">
                     <button onClick={finalizarVenda} disabled={processando || restante > 0} className="w-full bg-slate-800 hover:bg-black disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg transition-transform text-lg flex items-center justify-center">
                        {processando ? "PROCESSANDO..." : "CONCLUIR RECEBIMENTO"}
                     </button>
                  </div>

               </div>
            </div>
         </div>
      )}

      {/* RECIBO FINAL */}
      {modalRecibo && dadosRecibo && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg p-6 w-[320px] shadow-2xl flex flex-col font-mono relative">
               <div className="text-center mb-4 border-b border-dashed border-slate-400 pb-4">
                  <h2 className="font-black text-xl mb-1">{unidadeAtiva === 'matriz' ? 'NOME FANTASIA' : 'FILIAL'}</h2>
                  <p className="text-xs">CUPOM NÃO FISCAL</p>
                  <p className="text-xs">{dadosRecibo.tipo === 'salao' ? `MESA ${dadosRecibo.mesa}` : 'VENDA BALCÃO'}</p>
                  <p className="text-[10px] mt-1">{dadosRecibo.data.toLocaleString()}</p>
               </div>

               <div className="text-xs mb-2">
                  <div className="flex justify-between font-bold border-b border-slate-200 pb-1 mb-1">
                     <span>DESC</span><span>QTD</span><span>TOT</span>
                  </div>
                  {dadosRecibo.itens.map((it, idx) => (
                     <div key={idx} className="flex justify-between py-0.5">
                        <span className="truncate w-3/5">{it.nome}</span>
                        <span className="w-1/5 text-center">{it.qtd}</span>
                        <span className="w-1/5 text-right">{it.tot.toFixed(2)}</span>
                     </div>
                  ))}
               </div>

               <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{fmtBRL(dadosRecibo.subtotal)}</span></div>
                  {dadosRecibo.desconto > 0 && <div className="flex justify-between text-slate-500"><span>Desconto:</span><span>- {fmtBRL(dadosRecibo.desconto)}</span></div>}
                  {dadosRecibo.taxa > 0 && <div className="flex justify-between"><span>Taxas:</span><span>+ {fmtBRL(dadosRecibo.taxa)}</span></div>}
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200 mt-1"><span>TOTAL:</span><span>{fmtBRL(dadosRecibo.total)}</span></div>
               </div>

               <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-[10px] space-y-1">
                  <p className="font-bold text-center mb-1">Pagamentos Reais:</p>
                  {dadosRecibo.recebidos.map((pg, i) => (
                     <div key={i} className="flex justify-between uppercase"><span>{pg.forma}:</span><span>{fmtBRL(pg.valor)}</span></div>
                  ))}
                  {dadosRecibo.troco > 0 && <div className="flex justify-between font-bold mt-1"><span>Troco Devolvido:</span><span>{fmtBRL(dadosRecibo.troco)}</span></div>}
               </div>

               {dadosRecibo.cpf && (
                  <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-[10px] text-center">
                     <p>CPF na Nota: {dadosRecibo.cpf}</p>
                     {dadosRecibo.cliente && <p>Consumidor: {dadosRecibo.cliente}</p>}
                  </div>
               )}

               <div className="text-center text-[10px] mt-6 pt-4 border-t border-slate-800">
                  <p>Obrigado pela preferência!</p>
               </div>

               <div className="absolute -bottom-16 left-0 right-0 flex gap-2">
                  <button onClick={() => setModalRecibo(false)} className="flex-1 bg-white text-slate-800 font-bold py-3 rounded-lg shadow-lg">Fechar</button>
                  <button onClick={() => window.print()} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2"><Printer size={16}/> Imprimir</button>
               </div>
               <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                     body * { visibility: hidden; }
                     .z-\\[80\\] * { visibility: visible; }
                     .z-\\[80\\] { position: absolute; left: 0; top: 0; background: transparent; }
                     button { display: none !important; }
                  }
               `}} />
            </div>
         </div>
      )}

      {/* MODAL: SANGRIAS E SUPRIMENTOS */}
      {modalMov && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
               <h2 className={`text-xl font-black mb-6 ${tipoMov === 'sangria' ? 'text-orange-600' : 'text-blue-600'}`}>
                  {tipoMov === 'sangria' ? 'Sangria (Saída)' : 'Suprimento (Entrada)'}
               </h2>
               <form onSubmit={handleMovimentacao}>
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor (R$)</label>
                     <input type="number" step="0.01" required value={valorMov} onChange={e => setValorMov(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" autoFocus />
                  </div>
                  <div className="mb-6">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motivo / Descrição</label>
                     <input type="text" required value={descMov} onChange={e => setDescMov(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium" />
                  </div>
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setModalMov(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                     <button type="submit" disabled={processando} className={`flex-1 text-white font-black py-3 rounded-xl ${tipoMov === 'sangria' ? 'bg-orange-500' : 'bg-blue-500'}`}>Confirmar</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* FECHAMENTO DE CAIXA (LEITURA Z) */}
      {modalFechamento && resumoZ && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
               <h2 className="text-xl font-black text-slate-800 mb-6 border-b pb-4">Leitura Z (Fim de Turno)</h2>
               <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4">
                     <p className="text-xs font-bold text-slate-500 uppercase mb-2">Gaveta Física</p>
                     <div className="flex justify-between text-sm"><span>Fundo</span><span>{fmtBRL(resumoZ.fundo_inicial)}</span></div>
                     <div className="flex justify-between text-sm text-blue-600"><span>Suprimento</span><span>{fmtBRL(resumoZ.suprimentos)}</span></div>
                     <div className="flex justify-between text-sm text-orange-600"><span>Sangria</span><span>- {fmtBRL(resumoZ.sangrias)}</span></div>
                     <div className="flex justify-between text-sm text-emerald-600"><span>Vendas em Dinheiro</span><span>{fmtBRL(resumoZ.vendas_dinheiro)}</span></div>
                     <div className="flex justify-between font-black mt-2 pt-2 border-t"><span>Total Esperado:</span><span>{fmtBRL(resumoZ.esperado_gaveta)}</span></div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                     <p className="text-xs font-bold text-slate-500 uppercase mb-2">Cartões e Outros</p>
                     <div className="flex justify-between text-sm"><span>PIX</span><span>{fmtBRL(resumoZ.vendas_pix)}</span></div>
                     <div className="flex justify-between text-sm"><span>Cartões</span><span>{fmtBRL(resumoZ.vendas_cartao)}</span></div>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setModalFechamento(false)} className="px-4 py-3 bg-slate-100 font-bold rounded-xl text-slate-500">Voltar</button>
                  <button onClick={confirmarFechamento} className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2">
                     <Lock size={18}/> TRAVAR CAIXA
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MODAL GESTÃO DE MESAS */}
      {modalGestaoMesas && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Settings size={20} className="text-blue-300" /></div>
                     <div>
                        <h2 className="font-black text-lg">Gerenciar Mesas</h2>
                        <p className="text-xs text-slate-300 font-medium">Adicione ou remova mesas físicas do seu salão</p>
                     </div>
                  </div>
                  <button onClick={() => setModalGestaoMesas(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
               </div>
               
               <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50">
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     if(!novaMesaNum.trim()) return;
                     setProcessando(true);
                     await criarMesa(unidadeAtiva, novaMesaNum.trim());
                     setNovaMesaNum("");
                     carregarMesas();
                     setProcessando(false);
                  }} className="flex gap-2 mb-6">
                     <input type="text" value={novaMesaNum} onChange={e => setNovaMesaNum(e.target.value)} placeholder="Ex: 12, VIP, Varanda 1" required className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" />
                     <button type="submit" disabled={processando} className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-black shadow-md flex items-center gap-2"><Plus size={18}/> Adicionar</button>
                  </form>

                  <div className="space-y-2">
                     <h3 className="font-black text-slate-500 text-xs uppercase tracking-widest mb-3">Mesas Cadastradas ({mesas.length})</h3>
                     {mesas.map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                           <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${m.status === 'livre' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                              <span className="font-black text-slate-700 text-lg">{m.numero_mesa}</span>
                              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{m.status.toUpperCase()}</span>
                           </div>
                           <button disabled={m.status !== 'livre' || processando} title={m.status !== 'livre' ? 'Mesa ocupada não pode ser excluída' : 'Excluir Mesa'} onClick={async () => {
                              if(confirm(`Tem certeza que deseja excluir a mesa ${m.numero_mesa}?`)) {
                                 setProcessando(true);
                                 await deletarMesa(m.id);
                                 carregarMesas();
                                 setProcessando(false);
                              }
                           }} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                              <Trash2 size={18} />
                           </button>
                        </div>
                     ))}
                     {mesas.length === 0 && <p className="text-slate-400 text-center py-4 font-medium text-sm">Nenhuma mesa cadastrada.</p>}
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
