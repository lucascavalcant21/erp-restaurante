"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { UtensilsCrossed, ArrowDown, Info } from "lucide-react";
import { fmtBRL } from "../../components/ui";

export default function CardapioPublicoPage() {
  const { unidadeId } = useParams();
  const [produtos, setProdutos] = useState([]);
  const [unidadeNome, setUnidadeNome] = useState("Carregando...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarCardapio() {
       setLoading(true);
       
       // 1. Traz o nome da unidade para o cabeçalho
       const { data: uni } = await supabase.from("unidades").select("nome").eq("id", unidadeId).single();
       if(uni) setUnidadeNome(uni.nome);

       // 2. Traz os produtos ativos
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

  // Agrupa os produtos por categoria
  const categorias = {};
  produtos.forEach(p => {
     if(!categorias[p.categoria]) categorias[p.categoria] = [];
     categorias[p.categoria].push(p);
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      
      {/* HEADER DO RESTAURANTE (Design Clean Premium) */}
      <div className="bg-slate-900 text-white pt-16 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
         <div className="absolute -top-10 -right-10 opacity-10">
            <UtensilsCrossed size={180} />
         </div>
         <div className="relative z-10 text-center max-w-md mx-auto">
            <h1 className="text-4xl font-black tracking-tighter mb-2">{unidadeNome}</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cardápio Digital</p>
         </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-20">
         
         {/* INSTRUÇÃO */}
         <div className="bg-white p-4 rounded-2xl shadow-xl shadow-slate-200/50 mb-8 border border-slate-100 flex gap-4 items-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
               <Info size={24}/>
            </div>
            <p className="text-sm font-medium text-slate-500">Faça sua escolha navegando no cardápio e <strong className="text-slate-800">chame o garçom</strong> para realizar o seu pedido.</p>
         </div>

         {loading ? (
            <div className="text-center py-20 text-slate-400 font-bold animate-pulse">
               Carregando delícias...
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
                     {categorias[cat].map(p => (
                        <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group active:scale-95 transition-all">
                           <div className="pr-4">
                              <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{p.nome_produto}</h3>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{p.departamento === 'bar' ? 'Bebidaria' : 'Cozinha'}</p>
                           </div>
                           <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                              <p className="font-black text-indigo-600 text-lg">{fmtBRL(p.preco_venda)}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ))
         )}
      </div>

    </div>
  );
}
