"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchProdutos, salvarProduto } from "../../../lib/vendas";
import { fetchFichas } from "../../../lib/operacao"; // Pra linkar o custo
import { UtensilsCrossed, Plus, Search, Edit3, X, Save, ArrowLeft, Tag, Barcode, Image as ImageIcon, Trash2, ListPlus } from "lucide-react";
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
     ficha_id: "",
     codigo_barras: "",
     imagem_url: "",
     modificadores: []
  });

  const [novoModNome, setNovoModNome] = useState("");
  const [novoModPreco, setNovoModPreco] = useState("");

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
    setForm({ 
       id: null, 
       nome_produto: "", 
       categoria: "Pratos Principais", 
       departamento: "cozinha", 
       preco_venda: "", 
       ficha_id: "",
       codigo_barras: "",
       imagem_url: "",
       modificadores: []
    });
    setNovoModNome("");
    setNovoModPreco("");
    setModalNovo(true);
  };

  const abrirEditar = (prod) => {
    setForm({ 
       id: prod.id, 
       nome_produto: prod.nome_produto, 
       categoria: prod.categoria, 
       departamento: prod.departamento, 
       preco_venda: prod.preco_venda, 
       ficha_id: prod.ficha_id || "",
       codigo_barras: prod.codigo_barras || "",
       imagem_url: prod.imagem_url || "",
       modificadores: prod.modificadores || []
    });
    setNovoModNome("");
    setNovoModPreco("");
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!form.nome_produto.trim()) return alert("Digite o nome do produto");
    if(!form.preco_venda) return alert("Digite o preço de venda");

    const erro = await salvarProduto({
       ...form,
       unidade_id: unidadeAtiva,
       preco_venda: Number(form.preco_venda),
       ficha_id: form.ficha_id || null
    });

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  const addModificador = () => {
     if(!novoModNome.trim()) return;
     const preco = Number(novoModPreco) || 0;
     setForm({
        ...form,
        modificadores: [...form.modificadores, { nome: novoModNome, preco }]
     });
     setNovoModNome("");
     setNovoModPreco("");
  };

  const removeModificador = (index) => {
     setForm({
        ...form,
        modificadores: form.modificadores.filter((_, i) => i !== index)
     });
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <Tag size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Produtos para Venda</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">O que o cliente vê no Salão e no QR Code</p>
              </div>
            </div>
            <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
               <Plus size={18} /> Novo Produto
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar produto no cardápio..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
               <p className="font-bold text-slate-500 col-span-full">Buscando produtos...</p>
            ) : filtrados.length === 0 ? (
               <div className="col-span-full text-center p-10 bg-white border border-slate-200 rounded-3xl">
                  <UtensilsCrossed size={40} className="mx-auto text-slate-500 mb-4"/>
                  <h3 className="text-xl font-black text-slate-700">O cardápio está vazio</h3>
                  <p className="text-slate-500 mt-2 font-medium">Você precisa cadastrar produtos para que o garçom consiga lançar comandas.</p>
               </div>
            ) : (
               filtrados.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
                     <div className="flex justify-between items-start mb-2">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest">
                           {p.categoria}
                        </span>
                        <button onClick={() => abrirEditar(p)} className="text-slate-500 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Edit3 size={18}/></button>
                     </div>
                     
                     <div className="flex gap-4 items-center mb-4 mt-2">
                        {p.imagem_url ? (
                           <img src={p.imagem_url} alt={p.nome_produto} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm" />
                        ) : (
                           <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                              <ImageIcon size={24} />
                           </div>
                        )}
                        <h3 className="text-xl font-black text-slate-800 leading-tight flex-1">{p.nome_produto}</h3>
                     </div>
                     
                     <div className="flex flex-col gap-2 mb-4 flex-1">
                        {p.codigo_barras && (
                           <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                              <Barcode size={14}/> {p.codigo_barras}
                           </div>
                        )}
                        {p.modificadores && p.modificadores.length > 0 && (
                           <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md self-start">
                              <ListPlus size={14}/> {p.modificadores.length} Opcionais
                           </div>
                        )}
                     </div>
                     
                     <div className="flex justify-between items-end mt-auto pt-4 border-t border-slate-100">
                        <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Preço (PDV)</p>
                           <p className="font-black text-2xl text-emerald-600">{fmtBRL(p.preco_venda)}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Vinculado a</p>
                           <p className={`font-bold text-[10px] uppercase ${p.fichas_tecnicas ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {p.fichas_tecnicas ? p.fichas_tecnicas.nome_receita.substring(0, 15) : 'Estoque Livre'}
                           </p>
                        </div>
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-2xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center p-8 pb-6 border-b border-slate-100 shrink-0">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Produto" : "Novo Produto"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                  {/* Básico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Produto</label>
                        <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_produto} onChange={e=>setForm({...form, nome_produto: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-800"/>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                        <select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="Bebidas">Bebidas</option>
                           <option value="Entradas">Entradas</option>
                           <option value="Pratos Principais">Pratos Principais</option>
                           <option value="Sobremesas">Sobremesas</option>
                           <option value="Porções">Porções</option>
                           <option value="Combos">Combos</option>
                           <option value="Pizzas">Pizzas</option>
                           <option value="Lanches">Lanches</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vai pro KDS de?</label>
                        <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="cozinha">Cozinha</option>
                           <option value="bar">Bar</option>
                        </select>
                     </div>
                  </div>

                  {/* Detalhes Extra */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Barcode size={14}/> Cód. Barras (Opcional)</label>
                        <input type="text" placeholder="Bipar ou digitar..." value={form.codigo_barras} onChange={e=>setForm({...form, codigo_barras: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 text-slate-800"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><ImageIcon size={14}/> Link da Imagem (Opcional)</label>
                        <input type="text" placeholder="https://..." value={form.imagem_url} onChange={e=>setForm({...form, imagem_url: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 text-slate-800"/>
                     </div>
                  </div>

                  {/* Preço e Estoque */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preço de Venda (R$)</label>
                        <input type="number" step="0.01" placeholder="0.00" value={form.preco_venda} onChange={e=>setForm({...form, preco_venda: e.target.value})} className="w-full p-4 mt-1 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-600 text-xl outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Baixa de Estoque</label>
                        <select value={form.ficha_id} onChange={e=>setForm({...form, ficha_id: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500">
                           <option value="">-- Não dar baixa no estoque --</option>
                           {fichas.map(f => <option key={f.id} value={f.id}>{f.nome_receita} ({f.departamento})</option>)}
                        </select>
                     </div>
                  </div>

                  {/* Adicionais / Modificadores */}
                  <div className="pt-6 border-t border-slate-100">
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <ListPlus size={18}/> Modificadores e Adicionais
                     </h3>
                     
                     {/* Lista Atual */}
                     {form.modificadores && form.modificadores.length > 0 && (
                        <div className="space-y-2 mb-4">
                           {form.modificadores.map((mod, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                 <div className="font-bold text-slate-700">{mod.nome}</div>
                                 <div className="flex items-center gap-4">
                                    <div className="font-black text-emerald-600">{mod.preco > 0 ? `+ ${fmtBRL(mod.preco)}` : 'Grátis'}</div>
                                    <button onClick={() => removeModificador(i)} className="text-red-400 hover:text-red-600 p-1 bg-white rounded-lg border border-slate-200 shadow-sm"><Trash2 size={16}/></button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}

                     {/* Add Novo */}
                     <div className="flex gap-2 items-end bg-slate-100 p-4 rounded-2xl border border-slate-200">
                        <div className="flex-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do Adicional</label>
                           <input type="text" placeholder="Ex: Bacon Extra, Sem Cebola..." value={novoModNome} onChange={e=>setNovoModNome(e.target.value)} className="w-full p-2.5 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 text-slate-800"/>
                        </div>
                        <div className="w-32">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preço (+R$)</label>
                           <input type="number" step="0.01" placeholder="0.00" value={novoModPreco} onChange={e=>setNovoModPreco(e.target.value)} className="w-full p-2.5 mt-1 bg-white border border-slate-200 rounded-lg font-black text-sm text-emerald-600 outline-none focus:border-emerald-500"/>
                        </div>
                        <button onClick={addModificador} className="h-10 px-4 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors">
                           Add
                        </button>
                     </div>
                  </div>
               </div>

               <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                  <button onClick={handleSalvar} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Produto
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
