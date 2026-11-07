"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchObservacoesPadrao, salvarObservacaoPadrao, excluirObservacaoPadrao } from "../../../lib/vendas";
import { Plus, X, Trash2, MessageSquareText } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

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
    const { error } = await excluirObservacaoPadrao(id);
    if (error) return alert(`Não consegui excluir esta observação: ${error}`);
    carregar();
  };

  if (loading) return <div className="p-10 text-center font-bold text-fg">Carregando...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto animate-in fade-in">
      <CabecalhoTela embutido titulo="Observações fixas" subtitulo='Botões rápidos para o garçom usar no salão (ex.: "Com gelo", "Para viagem")' className="mb-4">
        <button onClick={() => setModalOpen(true)} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-hf-accent px-5 text-sm font-semibold text-hf-accent-fg shadow-none active:scale-95 sm:w-auto">
          <Plus size={18} /> Nova observação
        </button>
      </CabecalhoTela>

      <div className="bg-card rounded-3xl shadow-sm border border-line p-4 sm:p-6">
         {observacoes.length === 0 ? (
            <p className="text-center text-subtle font-bold py-10">Nenhuma observação cadastrada. Crie a primeira!</p>
         ) : (
            <div className="flex flex-wrap gap-3">
               {observacoes.map(obs => (
                  <div key={obs.id} className="max-w-full bg-white border border-line rounded-xl px-4 py-3 flex items-center gap-3 hover:border-[#4970AF] transition-colors group">
                     <span className="font-bold text-fg-soft uppercase break-words min-w-0">{obs.texto}</span>
                     <button onClick={() => handleExcluir(obs.id)} className="text-subtle hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100 shrink-0">
                        <Trash2 size={16}/>
                     </button>
                  </div>
               ))}
            </div>
         )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-[32px] p-5 sm:p-8 w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">Nova Observação</h2>
              <button onClick={() => setModalOpen(false)} className="text-subtle hover:text-slate-900"><X size={24}/></button>
            </div>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-fg uppercase mb-2">Texto da Observação</label>
                <input type="text" autoFocus required value={novoTexto} onChange={e => setNovoTexto(e.target.value)} className="w-full bg-white border border-line rounded-xl px-4 py-3 font-black text-fg-soft uppercase outline-none focus:border-[#4970AF]" placeholder="Ex: AO PONTO" />
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
