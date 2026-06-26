"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchCupons, salvarCupom, excluirCupom } from "../../../lib/vendas";
import { Plus, X, Edit, Trash2, Tag, CheckCircle, AlertCircle } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function CuponsPage() {
  const { unidadeAtiva } = useERP();
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [cupomEdit, setCupomEdit] = useState(null);

  const [formCodigo, setFormCodigo] = useState("");
  const [formTipo, setFormTipo] = useState("percentual");
  const [formValor, setFormValor] = useState("");
  const [formValidade, setFormValidade] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);

  const [processando, setProcessando] = useState(false);

  const carregar = async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    const { data } = await fetchCupons(unidadeAtiva);
    setCupons(data);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  const abrirModal = (cup = null) => {
    if (cup) {
      setCupomEdit(cup);
      setFormCodigo(cup.codigo);
      setFormTipo(cup.tipo);
      setFormValor(cup.valor);
      setFormValidade(cup.data_validade || "");
      setFormAtivo(cup.ativo);
    } else {
      setCupomEdit(null);
      setFormCodigo("");
      setFormTipo("percentual");
      setFormValor("");
      setFormValidade("");
      setFormAtivo(true);
    }
    setModalOpen(true);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!formCodigo || !formValor) return alert("Preencha o código e o valor.");

    setProcessando(true);
    const cupomObj = {
      id: cupomEdit?.id,
      codigo: formCodigo,
      tipo: formTipo,
      valor: Number(formValor),
      data_validade: formValidade || null,
      ativo: formAtivo
    };

    const { error } = await salvarCupom(unidadeAtiva, cupomObj);
    setProcessando(false);

    if (error) {
      if (error.includes("unique")) {
        alert("Já existe um cupom com este código nesta unidade!");
      } else {
        alert("Erro ao salvar cupom: " + error);
      }
      return;
    }

    setModalOpen(false);
    carregar();
  };

  const handleExcluir = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este cupom permanentemente?")) return;
    await excluirCupom(id);
    carregar();
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Carregando cupons...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Tag size={28} className="text-[#4970AF]" /> Cupons de Desconto
          </h1>
          <p className="text-slate-500 font-bold mt-1">Crie promoções e atraia mais clientes</p>
        </div>
        <button onClick={() => abrirModal()} className="bg-[#4970AF] hover:bg-[#3A5B99] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
          <Plus size={18} /> Novo Cupom
        </button>
      </div>

      {cupons.length === 0 ? (
        <div className="bg-white rounded-[32px] p-16 text-center shadow-sm border border-slate-200 flex flex-col items-center justify-center">
          <Tag size={48} className="text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-700">Nenhum cupom cadastrado</h3>
          <p className="text-slate-500 mt-2">Crie seu primeiro cupom para começar a dar descontos aos clientes.</p>
          <button onClick={() => abrirModal()} className="mt-6 text-[#4970AF] font-bold hover:underline">Criar agora</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cupons.map(cupom => {
            const expirado = cupom.data_validade && new Date().toISOString().split('T')[0] > cupom.data_validade;
            
            return (
              <div key={cupom.id} className={`bg-white rounded-2xl p-6 border-2 transition-all shadow-sm ${!cupom.ativo || expirado ? 'border-slate-200 opacity-60' : 'border-emerald-100 hover:border-emerald-300'} relative group`}>
                
                {/* Ações Hover */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => abrirModal(cupom)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100"><Edit size={14}/></button>
                   <button onClick={() => handleExcluir(cupom.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"><Trash2 size={14}/></button>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${!cupom.ativo ? 'bg-slate-100 text-slate-500' : expirado ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {cupom.ativo ? (expirado ? 'Expirado' : 'Ativo') : 'Inativo'}
                  </div>
                </div>
                
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-1">{cupom.codigo}</h2>
                
                <div className="flex items-end gap-2 mb-4">
                   <span className="text-3xl font-black text-[#4970AF]">
                     {cupom.tipo === 'percentual' ? `${cupom.valor}%` : fmtBRL(cupom.valor)}
                   </span>
                   <span className="text-slate-500 font-bold mb-1">OFF</span>
                </div>

                {cupom.data_validade && (
                   <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <AlertCircle size={12}/> Válido até {cupom.data_validade.split('-').reverse().join('/')}
                   </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">{cupomEdit ? 'Editar Cupom' : 'Novo Cupom'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Código (Ex: BLACK10)</label>
                <input type="text" required value={formCodigo} onChange={e => setFormCodigo(e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 uppercase outline-none focus:border-[#4970AF]" placeholder="CÓDIGO" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Desconto</label>
                   <select value={formTipo} onChange={e => setFormTipo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-[#4970AF]">
                      <option value="percentual">Porcentagem (%)</option>
                      <option value="fixo">Valor Fixo (R$)</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor ({formTipo === 'percentual' ? '%' : 'R$'})</label>
                   <input type="number" step="0.01" required value={formValor} onChange={e => setFormValor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-[#4970AF]" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Validade (Opcional)</label>
                <input type="date" value={formValidade} onChange={e => setFormValidade(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-[#4970AF]" />
              </div>

              <div className="flex items-center gap-3 pt-2">
                 <input type="checkbox" id="ativoCupom" checked={formAtivo} onChange={e => setFormAtivo(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-[#4970AF] focus:ring-[#4970AF]" />
                 <label htmlFor="ativoCupom" className="font-bold text-slate-700 cursor-pointer">Cupom Ativo</label>
              </div>

              <button type="submit" disabled={processando} className="w-full mt-6 bg-[#4970AF] hover:bg-[#3A5B99] text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {processando ? 'Salvando...' : 'Salvar Cupom'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
