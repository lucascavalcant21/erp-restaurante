"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchMesas, criarMesa, fetchPedidoAberto, abrirMesaEPedido, lancarItemComanda, fecharContaDaMesa, fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores } from "../../../lib/rh";
import { Utensils, Plus, Users, ShoppingCart, Send, CreditCard, ArrowLeft, Coffee, X } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function SaloesMesasPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle da Mesa Ativa / Comanda
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [pedidoAtivo, setPedidoAtivo] = useState(null);
  
  // Lançamento
  const [produtos, setProdutos] = useState([]);
  const [modalLancar, setModalLancar] = useState(false);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtdLancamento, setQtdLancamento] = useState(1);
  const [obsLancamento, setObsLancamento] = useState("");

  const carregarMesas = async () => {
    setLoading(true);
    const { data } = await fetchMesas(unidadeAtiva);
    setMesas(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregarMesas();
  }, [unidadeAtiva]);

  // Se tem menos de 1 mesa, permite adicionar (só pra setup fácil)
  const handleCriarMesa = async () => {
    const num = prompt("Número da nova mesa:");
    if(!num) return;
    await criarMesa(unidadeAtiva, Number(num));
    carregarMesas();
  };

  const abrirMesa = async (mesa) => {
    setMesaAtiva(mesa);
    if(mesa.status === 'livre') {
       if(confirm(`Deseja abrir a Mesa ${mesa.numero_mesa}?`)) {
          await abrirMesaEPedido(unidadeAtiva, mesa.id);
          carregarMesas();
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

  const fecharMesaUI = () => {
    setMesaAtiva(null);
    setPedidoAtivo(null);
  };

  // ─── COMANDA LOGIC ───────────────────────────────────────────────

  const prepararLancamento = async () => {
    // Traz o cardápio
    const { data } = await fetchProdutos(unidadeAtiva);
    setProdutos(data);
    setProdutoSel("");
    setQtdLancamento(1);
    setObsLancamento("");
    setModalLancar(true);
  };

  const confirmarLancamento = async () => {
    if(!produtoSel) return alert("Selecione um produto");
    const prodObj = produtos.find(p => p.id === produtoSel);
    
    await lancarItemComanda(pedidoAtivo.id, prodObj.id, prodObj.preco_venda, qtdLancamento, obsLancamento);
    
    setModalLancar(false);
    
    // Recarrega pedido
    const { data } = await fetchPedidoAberto(mesaAtiva.id);
    setPedidoAtivo(data);
  };

  const handlePagar = async () => {
    if(confirm(`Confirmar o pagamento da Mesa ${mesaAtiva.numero_mesa}? A mesa ficará livre e o estoque será baixado.`)) {
       await fecharContaDaMesa(mesaAtiva.id, pedidoAtivo.id, unidadeAtiva);
       fecharMesaUI();
       carregarMesas();
    }
  };

  // Cálculo da comanda em tempo real
  const totalComanda = pedidoAtivo?.pedidos_itens?.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0) || 0;

  // ─── RENDER MESA ATIVA (COMANDA) ─────────────────────────────────
  if (mesaAtiva && pedidoAtivo) {
     return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
           {/* Lado Esquerdo: Lista de Itens */}
           <div className="flex-1 flex flex-col h-screen overflow-hidden border-r border-slate-200 bg-white">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shadow-sm z-10">
                 <div className="flex items-center gap-4">
                    <button onClick={fecharMesaUI} className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                       <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mesa {mesaAtiva.numero_mesa}</h2>
                       <p className="text-emerald-500 font-bold text-xs uppercase tracking-widest mt-1">Ocupada - Comanda #{pedidoAtivo.id.split('-')[0]}</p>
                    </div>
                 </div>
                 <button onClick={prepararLancamento} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-transform active:scale-95">
                    <Plus size={20}/> Lançar Item
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                 {pedidoAtivo.pedidos_itens?.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                       <Coffee size={64} className="mb-4 opacity-20"/>
                       <p className="font-bold text-lg">Mesa sem itens</p>
                       <p className="text-sm">Comece lançando o primeiro pedido.</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {pedidoAtivo.pedidos_itens?.map((it, i) => (
                          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                             <div className="flex items-center gap-4">
                                <span className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-500">{it.quantidade}x</span>
                                <div>
                                   <p className="font-bold text-slate-800 text-lg leading-tight">{it.produtos.nome_produto}</p>
                                   {it.observacao && <p className="text-xs font-medium text-amber-600 mt-1 bg-amber-50 inline-block px-2 py-0.5 rounded">Obs: {it.observacao}</p>}
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="font-black text-emerald-600 text-lg">{fmtBRL(it.valor_unitario * it.quantidade)}</p>
                                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-md inline-block ${
                                   it.status_kds === 'entregue' ? 'bg-emerald-100 text-emerald-600' :
                                   it.status_kds === 'pronto' ? 'bg-indigo-100 text-indigo-600 animate-pulse' :
                                   'bg-amber-100 text-amber-600'
                                }`}>{it.status_kds}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>

           {/* Lado Direito: Fechamento */}
           <div className="w-[400px] bg-slate-900 text-white flex flex-col justify-between p-8 shadow-2xl z-20">
              <div>
                 <h3 className="font-black text-2xl mb-8 flex items-center gap-3"><ShoppingCart size={24}/> Resumo da Conta</h3>
                 
                 <div className="space-y-4 text-slate-400 font-medium">
                    <div className="flex justify-between"><span>Subtotal Itens</span><span className="text-white">{fmtBRL(totalComanda)}</span></div>
                    <div className="flex justify-between"><span>Taxa de Serviço (10%)</span><span className="text-white">{fmtBRL(totalComanda * 0.1)}</span></div>
                    <div className="w-full h-px bg-slate-800 my-4"></div>
                    <div className="flex justify-between items-center">
                       <span className="text-lg uppercase tracking-widest font-bold">Total a Pagar</span>
                       <span className="text-4xl font-black text-emerald-400">{fmtBRL(totalComanda * 1.1)}</span>
                    </div>
                 </div>
              </div>

              <button onClick={handlePagar} className="w-full py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-xl shadow-emerald-500/20">
                 <CreditCard size={24}/> Receber e Fechar Mesa
              </button>
           </div>

           {/* MODAL DE LANÇAMENTO */}
           {modalLancar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                 <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                       <h2 className="font-black text-2xl text-slate-800">Lançar na Mesa {mesaAtiva.numero_mesa}</h2>
                       <button onClick={() => setModalLancar(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-5">
                       <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Produto do Cardápio</label>
                          <select value={produtoSel} onChange={e=>setProdutoSel(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-lg outline-none focus:border-emerald-500">
                             <option value="">-- Buscar Produto --</option>
                             {produtos.map(p => <option key={p.id} value={p.id}>{p.nome_produto} ({fmtBRL(p.preco_venda)})</option>)}
                          </select>
                       </div>

                       <div className="grid grid-cols-3 gap-4 items-end">
                          <div className="col-span-1">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 text-center">Quantidade</label>
                             <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2">
                                <button onClick={()=>setQtdLancamento(q=>Math.max(1, q-1))} className="w-10 h-10 rounded-xl bg-white text-slate-500 font-black shadow-sm">-</button>
                                <span className="font-black text-xl text-slate-800">{qtdLancamento}</span>
                                <button onClick={()=>setQtdLancamento(q=>q+1)} className="w-10 h-10 rounded-xl bg-white text-slate-500 font-black shadow-sm">+</button>
                             </div>
                          </div>
                          <div className="col-span-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Observação p/ KDS</label>
                             <input type="text" placeholder="Ex: Sem gelo" value={obsLancamento} onChange={e=>setObsLancamento(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none focus:border-emerald-500"/>
                          </div>
                       </div>
                    </div>

                    <button onClick={confirmarLancamento} className="w-full mt-8 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                       <Send size={20}/> Confirmar e Enviar pra Cozinha
                    </button>
                 </div>
              </div>
           )}

        </div>
     );
  }

  // ─── RENDER SALÃO (MAPA DE MESAS) ────────────────────────────────
  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-100">
      
      {/* TOPBAR */}
      <div className="bg-slate-900 pt-8 pb-8 px-8 shadow-lg">
         <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 text-white">
              <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                 <Utensils size={32} />
              </div>
              <div>
                 <h1 className="text-4xl font-black tracking-tighter">Salão e Mesas</h1>
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">PDV de Garçom - Atendimento Rápido</p>
              </div>
            </div>
            <button onClick={handleCriarMesa} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-slate-700">
               + Adicionar Mesa
            </button>
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-10">
         {loading ? (
            <p className="font-bold text-slate-400">Desenhando salão...</p>
         ) : mesas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl max-w-lg mx-auto mt-20">
               <Users size={48} className="mx-auto text-slate-300 mb-6"/>
               <h3 className="text-2xl font-black text-slate-700">Seu salão está vazio</h3>
               <p className="text-slate-500 mt-2 font-medium mb-6">Crie as mesas do seu restaurante para começar a vender.</p>
               <button onClick={handleCriarMesa} className="bg-emerald-500 text-white px-8 py-4 rounded-xl font-black hover:bg-emerald-600 transition-colors">Gerar Primeira Mesa</button>
            </div>
         ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
               {mesas.map(m => (
                  <button 
                     key={m.id} 
                     onClick={() => abrirMesa(m)}
                     className={`aspect-square rounded-[32px] p-6 flex flex-col justify-between items-start transition-all duration-300 active:scale-95 shadow-md border-2
                        ${m.status === 'livre' ? 'bg-white border-transparent hover:border-emerald-300 hover:shadow-lg' : 
                          m.status === 'ocupada' ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/30' : 
                          'bg-amber-400 border-amber-500 text-amber-900'}
                     `}
                  >
                     <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${m.status === 'livre' ? 'bg-slate-100 text-slate-400' : 'bg-black/20 text-white'}`}>
                        {m.status}
                     </span>
                     <div>
                        <p className={`text-5xl font-black tracking-tighter ${m.status==='livre' ? 'text-slate-800' : 'text-white'}`}>{m.numero_mesa}</p>
                     </div>
                  </button>
               ))}
            </div>
         )}
      </div>

    </div>
  );
}
