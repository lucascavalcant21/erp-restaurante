"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, TrendingUp, Check, AlertCircle, Edit3, Trash2, Search as SearchIcon, Image as ImageIcon, Plus, X } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchCardapio, inserirPrato, atualizarPrato, removerPrato } from "../../../lib/cardapio";
import { podeEditarGlobal } from "../../../lib/auth";
import { Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtPct } from "../../../components/ui";

const CATEGORIAS = ["Marmita", "Salada", "Prato Principal", "Lanche", "Sobremesa", "Combo", "Bebida", "Drink", "Coquetel", "Dose"];
const SETORES = ["Cozinha", "Bar"];
const VAZIO = { nome: "", categoria: "Marmita", preco: "", custo: "", ativo: true, setor: "Cozinha" };

function metricas(p) {
  const preco = Number(p.preco) || 0;
  const custo = Number(p.custo) || 0;
  const cmv = preco > 0 ? (custo / preco) * 100 : 0;
  const mc  = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
  return { preco, custo, cmv, mc, ok: mc >= 30 };
}

// Componente de Toggle switch estilo iOS/Takeat (Vermelho quando ativo)
function RedToggle({ label, active, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer" onClick={!disabled ? onChange : undefined}>
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <button 
        disabled={disabled}
        className={`w-10 h-[22px] rounded-full flex items-center px-0.5 transition-colors duration-300 ease-in-out pointer-events-none ${active ? 'bg-red-500' : 'bg-slate-300'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function FormPrato({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, preco: String(inicial.preco ?? ""), custo: String(inicial.custo ?? "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  const m = metricas({ preco: f.preco, custo: f.custo });

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do prato.");
    if (m.preco <= 0) return setErro("Informe um preço de venda válido.");
    onSalvar({ nome: f.nome.trim(), categoria: f.categoria, preco: m.preco, custo: Number(f.custo) || 0, ativo: f.ativo, setor: f.setor || "Cozinha" });
  }

  return (
    <div className="space-y-4">
      <Field label="Nome do prato"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Marmitex Executiva" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Setor"><Select value={f.setor} onChange={(e) => set("setor", e.target.value)}>{SETORES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Preço de venda (R$)"><NumberInput value={f.preco} onChange={(e) => set("preco", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Custo / CMV (R$)"><NumberInput value={f.custo} onChange={(e) => set("custo", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {m.preco > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Margem de contribuição</span>
          <span className={`text-sm font-black ${m.ok ? "text-emerald-600" : "text-red-500"}`}>MC {fmtPct(m.mc)} · CMV {fmtPct(m.cmv)}</span>
        </div>
      )}
      <Field label="Situação Global">
        <Select value={f.ativo ? "1" : "0"} onChange={(e) => set("ativo", e.target.value === "1")}>
          <option value="1">Ativo</option><option value="0">Pausado</option>
        </Select>
      </Field>
      {erro && <p className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm text-center">{erro}</p>}
      <div className="flex gap-3 pt-2">
        <button className="flex-1 py-3.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={onCancelar}>Cancelar</button>
        <button className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors" onClick={salvar}>{inicial ? "Salvar Alterações" : "Adicionar Prato"}</button>
      </div>
    </div>
  );
}

export default function CardapioPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const podeEditar = sessao ? podeEditarGlobal(sessao.papel) : false;
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busca, setBusca]     = useState("");
  const [catSelecionada, setCatSelecionada] = useState("Todas");
  
  // Modais e Estados
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [toast, setToast]     = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  async function carregar() {
    setLoading(true);
    const { data } = await fetchCardapio(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  
  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const categorias = useMemo(() => {
    const set = [...new Set(lista.map(p => p.categoria).filter(Boolean))];
    return ["Todas", ...set];
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((p) => {
    const mb = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = catSelecionada === "Todas" || p.categoria === catSelecionada;
    return mb && mc;
  }), [lista, busca, catSelecionada]);

  async function salvar(dados) {
    if (editar) { await atualizarPrato(editar.id, dados); }
    else { await inserirPrato(dados, unidadeAtiva); }
    setModal(false); setEditar(null);
    showToast("Cardápio atualizado!");
    carregar();
  }

  async function toggleStatus(p, tipo) {
    // Como a tabela pode não ter pdv/delivery separados no DB base, vamos usar ativo para PDV por enquanto, ou usar a mesma variável visualmente se não houver coluna.
    // Para efeito de UI, vamos assumir que atualizamos o DB com um flag. Aqui faremos otimista na prop `ativo`.
    if(tipo === 'pdv') {
      setLista(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
      await atualizarPrato(p.id, { ativo: !p.ativo });
    } else {
      // Fake toggle for delivery just for the UI showcase (if db doesn't have it)
      setLista(prev => prev.map(x => x.id === p.id ? { ...x, delivery: !(x.delivery ?? true) } : x));
      // Se houver suporte real no DB, envia aqui.
    }
  }

  async function remover(id) {
    await removerPrato(id);
    setLista((prev) => prev.filter((p) => p.id !== id));
    showToast("Prato removido.");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 gap-4 overflow-hidden relative p-4">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl font-bold text-sm">
          {toast}
        </div>
      )}

      {/* HEADER E FILTROS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5 flex-shrink-0">
         <div className="flex justify-between items-center">
            <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">Cardápio</h1>
               <p className="text-sm font-semibold text-slate-500 mt-1">Gerencie pratos, preços e disponibilidade</p>
            </div>
            {podeEditar && (
               <button onClick={() => { setEditar(null); setModal(true); }} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm">
                 <Plus size={18} /> Novo Prato
               </button>
            )}
         </div>

         <div className="flex items-center gap-4">
            <div className="relative w-72">
               <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Buscar prato..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[14px] text-sm font-semibold outline-none focus:border-red-500 focus:bg-white shadow-sm transition-colors" />
            </div>
            
            <div className="flex-1 overflow-x-auto hide-scrollbar flex gap-2">
               {categorias.map(c => (
                  <button key={c} onClick={() => setCatSelecionada(c)} className={`whitespace-nowrap px-4 py-2.5 rounded-[12px] font-bold text-[13px] transition-all ${catSelecionada === c ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                     {c}
                  </button>
               ))}
            </div>
         </div>
      </div>

      {/* LISTA DE PRODUTOS */}
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">
         {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold">Carregando cardápio...</div>
         ) : filtrados.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
               <ChefHat size={64} className="mb-4 text-slate-300" />
               <p className="font-bold text-lg">Nenhum prato encontrado</p>
               <p className="text-sm mt-1">Adicione novos itens ou altere a busca.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {filtrados.map(p => {
                  const isPdvActive = p.ativo;
                  const isDeliveryActive = p.delivery ?? true; // fallback
                  const m = metricas(p);

                  return (
                     <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex gap-5 hover:shadow-md transition-shadow group relative">
                        {/* Imagem */}
                        <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-200 flex-shrink-0">
                           <ImageIcon size={32} opacity={0.4} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                           <div>
                              <div className="flex justify-between items-start">
                                 <div className="pr-10">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.categoria}</span>
                                    <h3 className="font-bold text-slate-800 text-[16px] leading-tight mt-0.5 truncate">{p.nome}</h3>
                                 </div>
                                 <span className="font-black text-emerald-600 text-lg flex-shrink-0">{fmtBRL(m.preco)}</span>
                              </div>
                              <p className="text-[12px] font-semibold text-slate-500 mt-1 truncate">Em estoque: {p.estoque_producao || 0}</p>
                           </div>

                           {/* Toggles */}
                           <div className="flex items-center gap-6 mt-3">
                              <RedToggle label="PDV" active={isPdvActive} onChange={() => toggleStatus(p, 'pdv')} disabled={!podeEditar} />
                              <RedToggle label="Delivery" active={isDeliveryActive} onChange={() => toggleStatus(p, 'delivery')} disabled={!podeEditar} />
                           </div>
                        </div>

                        {/* Ações Hover */}
                        {podeEditar && (
                           <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditar(p); setModal(true); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shadow-sm">
                                 <Edit3 size={14} />
                              </button>
                              <button onClick={() => remover(p.id)} className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors shadow-sm">
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        )}
                     </div>
                  )
               })}
            </div>
         )}
      </div>

      {/* MODAL NOVO/EDITAR */}
      {modal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                  <h2 className="font-black text-xl text-slate-800 tracking-tight">{editar ? "Editar Prato" : "Novo Prato"}</h2>
                  <button onClick={() => { setModal(false); setEditar(null); }} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={16}/></button>
               </div>
               <div className="p-6">
                  <FormPrato inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
