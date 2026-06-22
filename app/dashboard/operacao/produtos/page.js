"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchFichas } from "../../../lib/operacao"; // Pra linkar o custo
import { UtensilsCrossed, Plus, Search, Edit3, X, Save, ArrowLeft, Tag } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function ProdutosPage() {
  const router = useRouter();
  
  const { unidadeAtiva } = useERP();
  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({ 
     id: null, 
     nome_produto: "", 
     categoria: "Pratos Principais", 
     departamento: "cozinha", 
     preco_venda: "", 
     ficha_id: "" 
  });

  const carregar = async () => {
    setLoading(true);
    const [resProd, resFicha] = await Promise.all([
       fetchProdutos(unidadeAtiva),
       fetchFichas(unidadeAtiva)
    ]);
    setProdutos(resProd.data || []);
    setFichas(resFicha.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const filtrados = produtos.filter(p => p.nome_produto.toLowerCase().includes(busca.toLowerCase()));

  const abrirNovo = () => {
    setForm({ id: null, nome_produto: "", categoria: "Pratos Principais", departamento: "cozinha", preco_venda: "", ficha_id: "" });
    setModalNovo(true);
  };

  const abrirEditar = (prod) => {
    setForm({ 
       id: prod.id, 
       nome_produto: prod.nome_produto, 
       categoria: prod.categoria, 
       departamento: prod.departamento, 
       preco_venda: prod.preco_venda, 
       ficha_id: prod.ficha_id || "" 
    });
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!form.nome_produto.trim()) return alert("Digite o nome do produto");
    if(!form.preco_venda) return alert("Digite o preço de venda");

    const erro = await salvarProduto({
       ...form,
       unidade_id: unidadeAtiva,
       preco_venda: Number(form.preco_venda),
       ficha_id: form.ficha_id || null // Se for string vazia, vira nulo (não abaixa estoque)
    });

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-3 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                 <Tag size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Produtos para Venda</h1>
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">O que o cliente vê no Salão e no QR Code</p>
              </div>
            </div>
            <button onClick={abrirNovo} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
               <Plus size={18} /> Novo Produto
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-400 ml-2" />
            <input type="text" placeholder="Buscar produto no cardápio..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
               <p className="font-bold text-slate-400 col-span-full">Buscando produtos...</p>
            ) : filtrados.length === 0 ? (
               <div className="col-span-full text-center p-10 bg-white border border-slate-200 rounded-3xl">
                  <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-4"/>
                  <h3 className="text-xl font-black text-slate-700">O cardápio está vazio</h3>
                  <p className="text-slate-500 mt-2 font-medium">Você precisa cadastrar produtos para que o garçom consiga lançar comandas.</p>
               </div>
            ) : (
               filtrados.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                     <div className="flex justify-between items-start mb-2">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest">
                           {p.categoria}
                        </span>
                        <button onClick={() => abrirEditar(p)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Edit3 size={18}/></button>
                     </div>
                     <h3 className="text-xl font-black text-slate-800 leading-tight mb-4">{p.nome_produto}</h3>
                     
                     <div className="flex justify-between items-end">
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preço (PDV)</p>
                           <p className="font-black text-2xl text-indigo-600">{fmtBRL(p.preco_venda)}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vinculado a</p>
                           <p className={`font-bold text-xs ${p.fichas_tecnicas ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {p.fichas_tecnicas ? p.fichas_tecnicas.nome_receita : 'Sem baixa de estoque'}
                           </p>
                        </div>
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Produto" : "Novo Produto"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Produto</label>
                     <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_produto} onChange={e=>setForm({...form, nome_produto: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-800"/>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                        <select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500">
                           <option value="Bebidas">Bebidas</option>
                           <option value="Entradas">Entradas</option>
                           <option value="Pratos Principais">Pratos Principais</option>
                           <option value="Sobremesas">Sobremesas</option>
                           <option value="Porções">Porções</option>
                           <option value="Combos">Combos</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vai pro KDS de?</label>
                        <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500">
                           <option value="cozinha">Cozinha</option>
                           <option value="bar">Bar</option>
                        </select>
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preço de Venda (Cliente)</label>
                     <input type="number" step="0.01" placeholder="0.00" value={form.preco_venda} onChange={e=>setForm({...form, preco_venda: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-indigo-600 text-xl outline-none focus:border-indigo-500"/>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Ligar à Ficha Técnica (Opcional)</label>
                     <select value={form.ficha_id} onChange={e=>setForm({...form, ficha_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-indigo-500">
                        <option value="">-- Não dar baixa no estoque --</option>
                        {fichas.map(f => <option key={f.id} value={f.id}>{f.nome_receita} ({f.departamento})</option>)}
                     </select>
                     <p className="text-[10px] text-slate-400 mt-2 font-medium">Se vinculado, ao vender este produto o sistema dará baixa nos insumos da ficha automaticamente e exibirá no KDS.</p>
                  </div>
               </div>

               <button onClick={handleSalvar} className="w-full mt-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20}/> Salvar no Cardápio
               </button>
            </div>
         </div>
      )}

    </div>
  );
}
