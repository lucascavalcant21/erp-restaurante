"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../lib/unidades";
import { Settings, Store, Phone, Clock, Bike, Save, CheckCircle, AlertCircle, Beaker, Trash2, RefreshCw } from "lucide-react";
import { gerarDadosFicticios, limparAmbienteTeste } from "../../lib/mock";

export default function ConfiguracoesPage() {
  const { unidadeAtiva } = useERP();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  const [dadosLoja, setDadosLoja] = useState({
    nome: "",
    telefone_contato: "",
    horario_funcionamento: "",
    delivery_aberto: true,
    taxa_entrega_padrao: 0
  });

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      if (!unidadeAtiva) return;
      
      const { data } = await fetchUnidades();
      const minhaUnidade = data?.find(u => u.id === unidadeAtiva);
      
      if (minhaUnidade) {
        setDadosLoja({
          nome: minhaUnidade.nome || "",
          telefone_contato: minhaUnidade.telefone_contato || "",
          horario_funcionamento: minhaUnidade.horario_funcionamento || "",
          delivery_aberto: minhaUnidade.delivery_aberto !== false, // Default true se null
          taxa_entrega_padrao: parseFloat(minhaUnidade.taxa_entrega_padrao) || 0
        });
      }
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSucesso(false);
    
    const updates = {
      nome: dadosLoja.nome,
      telefone_contato: dadosLoja.telefone_contato,
      horario_funcionamento: dadosLoja.horario_funcionamento,
      delivery_aberto: dadosLoja.delivery_aberto,
      taxa_entrega_padrao: parseFloat(dadosLoja.taxa_entrega_padrao)
    };
    
    const { error } = await atualizarUnidade(unidadeAtiva, updates);
    setSaving(false);
    
    if (error) {
      alert("Erro ao salvar: " + error);
    } else {
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDadosLoja(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const [mockLoading, setMockLoading] = useState(false);

  const handleGerarMock = async () => {
    setMockLoading(true);
    const res = await gerarDadosFicticios();
    setMockLoading(false);
    if(res.error) alert("Erro: " + res.error);
    else {
      alert("Ambiente de teste criado! A página será atualizada.");
      window.location.reload();
    }
  };

  const handleLimparMock = async () => {
    if(!confirm("CUIDADO: Tem certeza que deseja apagar o ambiente de testes? Isso apagará a loja falsa e todos os pedidos gerados nela. Seus dados reais estão seguros.")) return;
    setMockLoading(true);
    const res = await limparAmbienteTeste();
    setMockLoading(false);
    if(res.error) alert("Erro: " + res.error);
    else {
      alert("Ambiente de teste apagado com sucesso.");
      window.location.reload();
    }
  };

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Carregando configurações...</div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full font-sans">
      
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-lg">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configurações da Loja</h1>
          <p className="text-sm text-slate-500 font-medium">Gerencie o funcionamento e o delivery da unidade.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* CARD 1: Info Básica */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
              <Store size={18} className="text-slate-500" />
              <h2 className="font-bold text-slate-700">Informações Públicas</h2>
           </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="col-span-1 md:col-span-2">
                 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nome da Loja</label>
                 <input 
                    type="text" name="nome" value={dadosLoja.nome} onChange={handleChange} required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="Ex: Hefisto Burger"
                 />
              </div>

              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase flex items-center gap-1"><Phone size={12}/> Telefone / WhatsApp</label>
                 <input 
                    type="text" name="telefone_contato" value={dadosLoja.telefone_contato} onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    placeholder="(00) 00000-0000"
                 />
              </div>

              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase flex items-center gap-1"><Clock size={12}/> Horário de Funcionamento</label>
                 <input 
                    type="text" name="horario_funcionamento" value={dadosLoja.horario_funcionamento} onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    placeholder="Ex: Ter a Dom das 18h às 23h"
                 />
              </div>

           </div>
        </div>

        {/* CARD 2: Delivery */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
              <Bike size={18} className="text-orange-500" />
              <h2 className="font-bold text-slate-700">Delivery & Cardápio Digital</h2>
           </div>
           
           <div className="p-6 space-y-8">
              
              {/* Toggle de Abertura */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       Status do Cardápio Digital
                       {dadosLoja.delivery_aberto ? 
                         <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Aberto</span> : 
                         <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Fechado</span>
                       }
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Se desligado, os clientes não poderão finalizar pedidos online.</p>
                 </div>
                 
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input 
                     type="checkbox" name="delivery_aberto" 
                     checked={dadosLoja.delivery_aberto} onChange={handleChange} 
                     className="sr-only peer"
                   />
                   <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                 </label>
              </div>

              {/* Taxa de Entrega */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Taxa de Entrega Padrão (R$)</label>
                 <div className="relative max-w-xs">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <input 
                       type="number" step="0.01" name="taxa_entrega_padrao" value={dadosLoja.taxa_entrega_padrao} onChange={handleChange}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                 </div>
                 <p className="text-xs text-slate-400 mt-2">Esta taxa será cobrada automaticamente nos pedidos do tipo Delivery.</p>
              </div>

           </div>
        </div>

        {/* BOTOES */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
           {sucesso ? (
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg">
                 <CheckCircle size={16} /> Configurações salvas com sucesso!
              </div>
           ) : (
              <div className="flex items-center gap-2 text-slate-400 font-medium text-xs">
                 <AlertCircle size={14} /> As alterações refletem na mesma hora no cardápio online.
              </div>
           )}

           <button 
              type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
           >
              {saving ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
           </button>
        </div>

      </form>

      {/* CARD 3: Mock Data (Sandbox) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
         <div className="bg-purple-50 border-b border-purple-100 p-4 flex items-center gap-2">
            <Beaker size={18} className="text-purple-600" />
            <h2 className="font-bold text-purple-800">Desenvolvimento e Testes (Sandbox)</h2>
         </div>
         <div className="p-6">
            <p className="text-sm text-slate-600 mb-6">
               Crie um <strong>Ambiente de Teste</strong> para visualizar o ERP funcionando sem sujar a sua loja oficial. 
               Uma nova Unidade Falsa será criada com Fichas Técnicas, Produtos, Pedidos rolando no KDS e Caixas abertos.
            </p>
            <div className="flex items-center gap-4">
               <button type="button" onClick={handleGerarMock} disabled={mockLoading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
                  <RefreshCw size={18} className={mockLoading ? "animate-spin" : ""} /> {mockLoading ? "Processando..." : "Gerar Ambiente de Teste"}
               </button>
               <button type="button" onClick={handleLimparMock} disabled={mockLoading} className="bg-red-50 text-red-600 hover:bg-red-100 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
                  <Trash2 size={18} /> Apagar Ambiente
               </button>
            </div>
         </div>
      </div>

    </div>
  );
}
