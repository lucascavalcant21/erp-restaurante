"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../../../lib/unidades";
import { enviarPedidoOnline } from "../../../../lib/vendas";
import { supabase } from "../../../../lib/supabase";
import { Store, Link2, Link2Off, RefreshCw, ShoppingBag, CheckCircle, AlertCircle, PlayCircle } from "lucide-react";

export default function IFoodConfigPage() {
  const { unidadeAtiva } = useERP();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulando, setSimulando] = useState(false);
  
  const [conectado, setConectado] = useState(false);
  const [merchantId, setMerchantId] = useState("");
  
  // Para simulador
  const [produtos, setProdutos] = useState([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      if (!unidadeAtiva) return;
      
      const { data } = await fetchUnidades();
      const minhaUnidade = data?.find(u => u.id === unidadeAtiva);
      
      if (minhaUnidade) {
        setConectado(minhaUnidade.ifood_conectado || false);
        setMerchantId(minhaUnidade.ifood_merchant_id || "");
      }

      // Carregar alguns produtos da loja para o simulador
      const { data: prod } = await supabase.from("produtos")
         .select("*")
         .eq("unidade_id", unidadeAtiva)
         .eq("ativo", true)
         .limit(5);
      
      if (prod) setProdutos(prod);
      
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  const toggleConexao = async () => {
    if (!merchantId && !conectado) {
       return alert("Informe o ID da Loja (Merchant ID) antes de conectar!");
    }
    
    setSaving(true);
    const novoStatus = !conectado;
    
    const { error } = await atualizarUnidade(unidadeAtiva, { 
       ifood_conectado: novoStatus,
       ifood_merchant_id: merchantId
    });
    
    setSaving(false);
    
    if (error) {
      alert("Erro ao salvar: " + error);
    } else {
      setConectado(novoStatus);
    }
  };

  const simularPedido = async () => {
     if (produtos.length === 0) return alert("Sua loja precisa de produtos cadastrados para simular.");
     
     setSimulando(true);
     
     // Pegar 1 a 3 itens aleatórios
     const numItens = Math.floor(Math.random() * 3) + 1;
     const carrinho = [];
     for(let i=0; i<numItens; i++) {
        const p = produtos[Math.floor(Math.random() * produtos.length)];
        carrinho.push({ ...p, quantidade: Math.floor(Math.random() * 2) + 1, observacao: "" });
     }

     const dadosCliente = {
        tipo: 'ifood', // Isso fará a flag no PDV aparecer como iFood
        nome: "Cliente Simulação iFood",
        telefone: "11999999999",
        endereco: "Rua do Teste iFood, 123",
        taxa_entrega: 7.50
     };

     const { error } = await enviarPedidoOnline(unidadeAtiva, dadosCliente, carrinho, true);
     setSimulando(false);

     if(error) {
        alert("Erro ao simular: " + error);
     } else {
        alert("Pedido iFood injetado diretamente na Cozinha (KDS)!");
     }
  };

  const simularCancelamento = async () => {
     setSimulando(true);
     const { data } = await supabase.from("pedidos").select("id").eq("unidade_id", unidadeAtiva).eq("tipo_pedido", "ifood").order("created_at", { ascending: false }).limit(1).single();
     if (data) {
        await supabase.from("pedidos").update({ status: 'cancelado' }).eq("id", data.id);
        await supabase.from("pedidos_itens").update({ status_kds: 'cancelado' }).eq("pedido_id", data.id);
        alert("Último pedido iFood cancelado!");
     } else {
        alert("Nenhum pedido do iFood encontrado para cancelar.");
     }
     setSimulando(false);
  };

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Carregando integrações...</div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full font-sans">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-[#EA1D2C] text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
             <Store size={24} />
           </div>
           <div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tight">Integração iFood</h1>
             <p className="text-sm text-slate-500 font-medium">Conecte sua loja do iFood ao nosso PDV.</p>
           </div>
         </div>
         
         <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-black uppercase ${conectado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {conectado ? <><CheckCircle size={16}/> Conectado</> : <><AlertCircle size={16}/> Desconectado</>}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         
         {/* CARD CONFIGURAÇÕES */}
         <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
               <Settings size={18} className="text-slate-500" />
               <h2 className="font-bold text-slate-700">Configuração de Conexão</h2>
            </div>
            <div className="p-6 space-y-6">
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Merchant ID (ID da Loja no iFood)</label>
                  <input 
                     type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} disabled={conectado}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-[#EA1D2C] outline-none disabled:opacity-60"
                     placeholder="Ex: 12345678-abcd-1234-abcd-123456789abc"
                  />
                  <p className="text-xs text-slate-400 mt-2">Você encontra seu Merchant ID no Portal do Parceiro iFood.</p>
               </div>

               <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button 
                     onClick={toggleConexao} disabled={saving}
                     className={`px-8 py-3 rounded-xl font-black text-white shadow-lg transition-all flex items-center gap-2 ${conectado ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/20' : 'bg-[#EA1D2C] hover:bg-red-700 shadow-red-500/30'}`}
                  >
                     {saving ? <RefreshCw size={18} className="animate-spin" /> : 
                      conectado ? <><Link2Off size={18} /> Desconectar Loja</> : <><Link2 size={18} /> Conectar ao iFood</>}
                  </button>
               </div>
            </div>
         </div>

         {/* CARD SIMULADOR */}
         <div className="col-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-xl border border-indigo-800 overflow-hidden text-white flex flex-col">
            <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4 relative">
               <div className="absolute top-0 right-0 p-3 opacity-20">
                  <ShoppingBag size={80} />
               </div>
               
               <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                  <PlayCircle size={32} className="text-indigo-300" />
               </div>
               
               <div>
                  <h3 className="font-black text-lg mb-1">Simulador de Pedidos</h3>
                  <p className="text-xs text-indigo-200 leading-relaxed font-medium">Envie um pedido de teste como se viesse do iFood diretamente para o seu PDV.</p>
               </div>
               
               <button 
                  onClick={simularPedido} disabled={!conectado || simulando}
                  className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:bg-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
               >
                  {simulando ? 'Processando...' : 'Injetar Pedido (KDS)'}
               </button>
               
               <button 
                  onClick={simularCancelamento} disabled={!conectado || simulando}
                  className="w-full mt-2 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:bg-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
               >
                  Simular Cancelamento
               </button>
               
               {!conectado && <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest mt-2">Conecte primeiro</p>}
            </div>
         </div>

      </div>
    </div>
  );
}
