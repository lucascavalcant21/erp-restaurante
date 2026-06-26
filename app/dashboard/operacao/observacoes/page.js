"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchObservacoesPadrao, salvarObservacaoPadrao, excluirObservacaoPadrao } from "../../../lib/vendas";
import { Plus, X, Trash2, MessageSquareText } from "lucide-react";

export default function ObservacoesPage() {
  const { unidadeAtiva } = useERP();
  const [observacoes, setObservacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");

  const carregar = async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    const { data } = await fetchObservacoesPadrao(unidadeAtiva);
    setObservacoes(data);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!novoTexto.trim()) return alert("Digite o texto da observação.");
    setProcessando(true);
    await salvarObservacaoPadrao(unidadeAtiva, novoTexto.trim());
    setProcessando(false);
    setNovoTexto("");
    setModalOpen(false);
    carregar();
  };

  const handleExcluir = async (id) => {
    if (!confirm("Remover esta observação padrão?")) return;
    await excluirObservacaoPadrao(id);
    carregar();
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <MessageSquareText size={28} className="text-[#4970AF]" /> Observações Fixas
          </h1>
          <p className="text-slate-500 font-bold mt-1">Crie botões rápidos para o garçom usar no Salão (Ex: "Com gelo", "Para Viagem")</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-[#4970AF] hover:bg-[#3A5B99] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
          <Plus size={18} /> Nova Observação
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
         {observacoes.length === 0 ? (
            <p className="text-center text-slate-400 font-bold py-10">Nenhuma observação cadastrada. Crie a primeira!</p>
         ) : (
            <div className="flex flex-wrap gap-3">
               {observacoes.map(obs => (
                  <div key={obs.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-[#4970AF] transition-colors group">
                     <span className="font-bold text-slate-700 uppercase">{obs.texto}</span>
                     <button onClick={() => handleExcluir(obs.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16}/>
                     </button>
                  </div>
               ))}
            </div>
         )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">Nova Observação</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Texto da Observação</label>
                <input type="text" autoFocus required value={novoTexto} onChange={e => setNovoTexto(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 uppercase outline-none focus:border-[#4970AF]" placeholder="Ex: AO PONTO" />
              </div>
              <button type="submit" disabled={processando} className="w-full mt-6 bg-[#4970AF] hover:bg-[#3A5B99] text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {processando ? 'Salvando...' : 'Adicionar Botão'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
