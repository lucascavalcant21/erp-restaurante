"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../../lib/unidades";
import { Save, AlertCircle, Building2, FileText, CheckCircle, Shield } from "lucide-react";

export default function ConfiguracoesFiscaisPage() {
  const { unidadeAtiva } = useERP();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  const [dadosLoja, setDadosLoja] = useState({
    cnpj: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    regime_tributario: "Simples Nacional",
    endereco_fiscal: "",
    codigo_ibge: "",
    token_nfe: "",
    ambiente_nfe: "Homologacao"
  });

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      if (!unidadeAtiva) return;
      
      const { data } = await fetchUnidades();
      const minhaUnidade = data?.find(u => u.id === unidadeAtiva);
      
      if (minhaUnidade) {
        setDadosLoja({
          cnpj: minhaUnidade.cnpj || "",
          inscricao_estadual: minhaUnidade.inscricao_estadual || "",
          inscricao_municipal: minhaUnidade.inscricao_municipal || "",
          regime_tributario: minhaUnidade.regime_tributario || "Simples Nacional",
          endereco_fiscal: minhaUnidade.endereco_fiscal || "",
          codigo_ibge: minhaUnidade.codigo_ibge || "",
          token_nfe: minhaUnidade.token_nfe || "",
          ambiente_nfe: minhaUnidade.ambiente_nfe || "Homologacao"
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
      cnpj: dadosLoja.cnpj,
      inscricao_estadual: dadosLoja.inscricao_estadual,
      inscricao_municipal: dadosLoja.inscricao_municipal,
      regime_tributario: dadosLoja.regime_tributario,
      endereco_fiscal: dadosLoja.endereco_fiscal,
      codigo_ibge: dadosLoja.codigo_ibge,
      token_nfe: dadosLoja.token_nfe,
      ambiente_nfe: dadosLoja.ambiente_nfe
    };
    
    const { error } = await atualizarUnidade(unidadeAtiva, updates);
    setSaving(false);
    
    if (!error) {
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } else {
      alert("Erro ao salvar: " + error);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500 animate-pulse flex items-center gap-3">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      Carregando dados fiscais...
    </div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="text-emerald-500" size={32} />
            Configurações Fiscais
          </h1>
          <p className="text-slate-500 mt-2">Dados obrigatórios para emissão de NFC-e e SAT</p>
        </div>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-8 flex gap-3 text-amber-800">
        <AlertCircle size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold mb-1">Módulo Fiscal em Sandbox</p>
          <p>O sistema está operando com um simulador de emissão para testes e validação do ERP. Para emissão real em produção, é necessário plugar o certificado digital A1 na API de integração.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Bloco Empresa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Building2 className="text-slate-400" size={20} />
            Dados da Empresa
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">CNPJ</label>
              <input 
                type="text" 
                value={dadosLoja.cnpj}
                onChange={e => setDadosLoja({...dadosLoja, cnpj: e.target.value})}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Regime Tributário</label>
              <select 
                value={dadosLoja.regime_tributario}
                onChange={e => setDadosLoja({...dadosLoja, regime_tributario: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              >
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Inscrição Estadual (IE)</label>
              <input 
                type="text" 
                value={dadosLoja.inscricao_estadual}
                onChange={e => setDadosLoja({...dadosLoja, inscricao_estadual: e.target.value})}
                placeholder="Isento ou Número"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Inscrição Municipal (IM)</label>
              <input 
                type="text" 
                value={dadosLoja.inscricao_municipal}
                onChange={e => setDadosLoja({...dadosLoja, inscricao_municipal: e.target.value})}
                placeholder="Opcional"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Bloco Endereço */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
            <FileText className="text-slate-400" size={20} />
            Endereço Fiscal
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Logradouro Completo</label>
              <input 
                type="text" 
                value={dadosLoja.endereco_fiscal}
                onChange={e => setDadosLoja({...dadosLoja, endereco_fiscal: e.target.value})}
                placeholder="Rua Exemplo, 123, Bairro - Cidade/UF - CEP"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Código IBGE da Cidade</label>
              <input 
                type="text" 
                value={dadosLoja.codigo_ibge}
                onChange={e => setDadosLoja({...dadosLoja, codigo_ibge: e.target.value})}
                placeholder="Ex: 3550308 (São Paulo)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Bloco API SEFAZ */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-200">
            <Shield className="text-emerald-400" size={20} />
            Integração API (Motor Fiscal)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Token de Integração</label>
              <input 
                type="password" 
                value={dadosLoja.token_nfe}
                onChange={e => setDadosLoja({...dadosLoja, token_nfe: e.target.value})}
                placeholder="************************"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Ambiente</label>
              <select 
                value={dadosLoja.ambiente_nfe}
                onChange={e => setDadosLoja({...dadosLoja, ambiente_nfe: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-white"
              >
                <option value="Homologacao">Homologação (Testes Sem Valor Fiscal)</option>
                <option value="Producao">Produção (Com Valor Fiscal)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Botoes */}
        <div className="flex items-center gap-4 pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={20} />
            )}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          
          {sucesso && (
            <span className="text-emerald-600 font-bold flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
              <CheckCircle size={20} />
              Dados fiscais atualizados!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
