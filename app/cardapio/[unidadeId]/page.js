"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { enviarPedidoOnline } from "../../lib/vendas";
import { UtensilsCrossed, ArrowDown, ShoppingBag, X, CheckCircle, Info, Plus, Minus, Send } from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function CardapioPublicoPage() {
  const { unidadeId } = useParams();
  const [produtos, setProdutos] = useState([]);
  const [unidadeNome, setUnidadeNome] = useState("Carregando...");
  const [loading, setLoading] = useState(true);

  // CARRINHO
  const [carrinho, setCarrinho] = useState([]);
  const [modalCart, setModalCart] = useState(false);
  const [telaCheckout, setTelaCheckout] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  // FORM CHECKOUT
  const [form, setForm] = useState({ tipo: "delivery", nome: "", telefone: "", endereco: "", troco: "" });

  useEffect(() => {
    async function carregarCardapio() {
       setLoading(true);
       const { data: uni } = await supabase.from("unidades").select("nome").eq("id", unidadeId).single();
       if(uni) setUnidadeNome(uni.nome);

       const { data: prod } = await supabase.from("produtos")
          .select("*")
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .order("categoria")
          .order("nome_produto");
          
       if(prod) setProdutos(prod);
       setLoading(false);
    }
    carregarCardapio();
  }, [unidadeId]);

  // LOGICA DO CARRINHO
  const addAoCarrinho = (produto) => {
     setCarrinho(atual => {
        const index = atual.findIndex(i => i.id === produto.id);
        if(index >= 0) {
           const novo = [...atual];
           novo[index].quantidade += 1;
           return novo;
        } else {
           return [...atual, { ...produto, quantidade: 1, observacao: "" }];
        }
     });
  };

  const alterarQtd = (id, delta) => {
     setCarrinho(atual => atual.map(i => {
        if(i.id === id) return { ...i, quantidade: Math.max(0, i.quantidade + delta) };
        return i;
     }).filter(i => i.quantidade > 0));
  };

  const alterarObs = (id, obs) => {
     setCarrinho(atual => atual.map(i => i.id === id ? { ...i, observacao: obs } : i));
  };

  const totalCarrinho = carrinho.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);

  const finalizarPedido = async () => {
     if(!form.nome) return alert("Digite seu nome!");
     if(!form.telefone) return alert("Digite seu WhatsApp!");
     if(form.tipo === 'delivery' && !form.endereco) return alert("Digite seu endereço!");

     const erro = await enviarPedidoOnline(unidadeId, form, carrinho);
     if(erro.error) return alert("Erro ao enviar: " + erro.error);

     setPedidoEnviado(true);
     setCarrinho([]);
  };

  // Agrupa os produtos
  const categorias = {};
  produtos.forEach(p => {
     if(!categorias[p.categoria]) categorias[p.categoria] = [];
     categorias[p.categoria].push(p);
  });

  if(pedidoEnviado) {
     return (
        <div className="min-h-screen bg-emerald-500 flex flex-col items-center justify-center p-6 text-white text-center">
           <CheckCircle size={80} className="mb-6 animate-bounce"/>
           <h1 className="text-4xl font-black mb-4 tracking-tighter">Pedido Recebido!</h1>
           <p className="text-emerald-100 font-medium mb-8">Nossa equipe já recebeu o seu pedido. Caso precise de algo, acione o garçom ou aguarde a entrega.</p>
           <button onClick={() => { setPedidoEnviado(false); setModalCart(false); setTelaCheckout(false); }} className="px-8 py-4 bg-white text-emerald-600 font-black rounded-2xl active:scale-95 transition-transform shadow-xl shadow-emerald-900/20">
              Fazer novo pedido
           </button>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-32">
      
      {/* HEADER DO RESTAURANTE */}
      <div className="bg-slate-900 text-white pt-16 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
         <div className="absolute -top-10 -right-10 opacity-10">
            <UtensilsCrossed size={180} />
         </div>
         <div className="relative z-10 text-center max-w-md mx-auto">
            <h1 className="text-4xl font-black tracking-tighter mb-2">{unidadeNome}</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Menu Digital & Delivery</p>
         </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-20">
         
         {loading ? (
            <div className="text-center py-20 text-slate-400 font-bold animate-pulse">
               Carregando cardápio...
            </div>
         ) : produtos.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
               <UtensilsCrossed size={48} className="mx-auto mb-4 opacity-20"/>
               <p className="font-bold">Cardápio indisponível no momento.</p>
            </div>
         ) : (
            Object.keys(categorias).map(cat => (
               <div key={cat} className="mb-10">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-4 sticky top-4 bg-slate-50/90 backdrop-blur-md py-2 z-10 flex items-center gap-2">
                     {cat} <ArrowDown size={16} className="text-slate-300"/>
                  </h2>
                  <div className="space-y-4">
                     {categorias[cat].map(p => {
                        const qtdNoCart = carrinho.find(i => i.id === p.id)?.quantidade || 0;
                        return (
                           <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
                              <div className="pr-4 z-10">
                                 <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{p.nome_produto}</h3>
                                 <p className="font-black text-indigo-600 text-lg">{fmtBRL(p.preco_venda)}</p>
                              </div>
                              <div className="z-10">
                                 {qtdNoCart > 0 ? (
                                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-1">
                                       <button onClick={()=>alterarQtd(p.id, -1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-indigo-600 shadow-sm"><Minus size={18}/></button>
                                       <span className="font-black text-indigo-900">{qtdNoCart}</span>
                                       <button onClick={()=>alterarQtd(p.id, 1)} className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-xl text-white shadow-sm shadow-indigo-600/30"><Plus size={18}/></button>
                                    </div>
                                 ) : (
                                    <button onClick={()=>addAoCarrinho(p)} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors text-sm flex items-center gap-2">
                                       <Plus size={16}/> Adicionar
                                    </button>
                                 )}
                              </div>
                           </div>
                        )
                     })}
                  </div>
               </div>
            ))
         )}
      </div>

      {/* FLOAT BAR CARRINHO */}
      {carrinho.length > 0 && !modalCart && (
         <div className="fixed bottom-6 left-4 right-4 z-30 flex justify-center animate-in slide-in-from-bottom-10">
            <button onClick={()=>setModalCart(true)} className="w-full max-w-md bg-indigo-600 text-white p-4 rounded-[24px] shadow-2xl shadow-indigo-600/30 flex items-center justify-between active:scale-95 transition-transform">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center relative">
                     <ShoppingBag size={24} />
                     <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-black">{carrinho.length}</span>
                  </div>
                  <div className="text-left">
                     <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest">Seu Pedido</p>
                     <p className="font-black text-xl">{fmtBRL(totalCarrinho)}</p>
                  </div>
               </div>
               <div className="font-bold mr-2">Ver Carrinho &rarr;</div>
            </button>
         </div>
      )}

      {/* MODAL CARRINHO E CHECKOUT */}
      {modalCart && (
         <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
               <h2 className="font-black text-2xl text-slate-800">{telaCheckout ? 'Finalizar Pedido' : 'Meu Carrinho'}</h2>
               <button onClick={() => { telaCheckout ? setTelaCheckout(false) : setModalCart(false) }} className="p-3 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
               {!telaCheckout ? (
                  // TELA 1: ITENS DO CARRINHO
                  <div className="space-y-4">
                     {carrinho.map(it => (
                        <div key={it.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-start mb-3">
                              <p className="font-bold text-slate-800">{it.nome_produto}</p>
                              <p className="font-black text-indigo-600">{fmtBRL(it.preco_venda * it.quantidade)}</p>
                           </div>
                           <input type="text" placeholder="Alguma observação? (Ex: Sem gelo)" value={it.observacao} onChange={e=>alterarObs(it.id, e.target.value)} className="w-full text-sm p-3 bg-slate-50 rounded-xl outline-none focus:bg-indigo-50 border border-transparent focus:border-indigo-100 transition-colors mb-4"/>
                           <div className="flex items-center justify-end gap-3 bg-slate-50 rounded-xl w-max ml-auto p-1 border border-slate-100">
                              <button onClick={()=>alterarQtd(it.id, -1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-lg text-slate-500 font-black shadow-sm">-</button>
                              <span className="font-black text-slate-800 w-6 text-center">{it.quantidade}</span>
                              <button onClick={()=>alterarQtd(it.id, 1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-lg text-slate-500 font-black shadow-sm">+</button>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  // TELA 2: DADOS DO CHECKOUT
                  <div className="space-y-6">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Como você quer receber?</label>
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={()=>setForm({...form, tipo: 'delivery'})} className={`p-4 rounded-2xl font-black border-2 transition-all ${form.tipo === 'delivery' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>Delivery</button>
                           <button onClick={()=>setForm({...form, tipo: 'qrcode'})} className={`p-4 rounded-2xl font-black border-2 transition-all ${form.tipo === 'qrcode' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>Estou na Mesa</button>
                        </div>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Seu Nome</label>
                        <input type="text" placeholder="Como devemos te chamar?" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500"/>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">WhatsApp</label>
                        <input type="text" placeholder="(DD) 99999-9999" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500"/>
                     </div>

                     {form.tipo === 'delivery' && (
                        <>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Endereço de Entrega</label>
                              <textarea placeholder="Rua, Número, Bairro, Ponto de Referência" value={form.endereco} onChange={e=>setForm({...form, endereco: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500 h-24 custom-scrollbar"></textarea>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Troco para (Opcional)</label>
                              <input type="text" placeholder="Ex: 50 reais" value={form.troco} onChange={e=>setForm({...form, troco: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500"/>
                           </div>
                        </>
                     )}
                  </div>
               )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100 pb-10">
               <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-slate-500">Total do Pedido</span>
                  <span className="text-3xl font-black text-indigo-600">{fmtBRL(totalCarrinho)}</span>
               </div>
               {!telaCheckout ? (
                  <button onClick={() => setTelaCheckout(true)} className="w-full py-5 bg-indigo-600 text-white font-black text-xl rounded-2xl active:scale-95 transition-transform shadow-xl shadow-indigo-600/30">
                     Avançar
                  </button>
               ) : (
                  <button onClick={finalizarPedido} className="w-full py-5 bg-emerald-500 text-white font-black text-xl rounded-2xl active:scale-95 transition-transform shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2">
                     <Send size={24}/> Enviar Pedido
                  </button>
               )}
            </div>
         </div>
      )}

    </div>
  );
}
