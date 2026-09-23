"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../../lib/unidades";
import { SkeletonList } from "../../../components/ui";
import { Store, Link2, Link2Off, RefreshCw, Settings, CheckCircle, AlertCircle, ShieldCheck, DollarSign, ListFilter } from "lucide-react";

export default function IFoodConfigPage() {
  const { unidadeAtiva } = useERP();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [conectado, setConectado] = useState(false);
  const [merchantId, setMerchantId] = useState("");
  const [testResult, setTestResult] = useState(null);

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
      
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  const toggleConexao = async () => {
    if (!merchantId && !conectado) {
       return alert("Informe o Merchant ID (ID da Loja no iFood) antes de conectar.");
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
      setTestResult(null);
    }
  };

  const testarConexaoReal = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/ifood/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, message: `Erro ao testar: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-6"><SkeletonList /></div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-[#EA1D2C] text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
             <Store size={24} />
           </div>
           <div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tight">Integração iFood Merchant API</h1>
             <p className="text-sm text-muted font-medium">Conexão oficial com a API de Vendas, Pedidos e Finanças do iFood.</p>
           </div>
         </div>
         
         <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-black uppercase w-fit ${conectado ? 'bg-emerald-100 text-emerald-700' : 'bg-elevated text-muted'}`}>
            {conectado ? <><CheckCircle size={16}/> Conectado</> : <><AlertCircle size={16}/> Desconectado</>}
         </div>
      </div>

      {/* BANNER REGRA ANTI-DUPLICIDADE */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 text-white flex items-start gap-4">
        <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h3 className="font-bold text-sm text-white">Arquitetura de Vendas com Proteção Anti-Duplicidade</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Sua unidade está configurada com <strong>Saipos como fonte operacional</strong>. As vendas chegam ao Héfisto via Saipos e vinculam o <code>upstream_external_id</code> do iFood. A API de Finanças do iFood importará comissões, taxas e repasses reais sem duplicar os pedidos operacionais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         
         {/* CARD CONFIGURAÇÕES */}
         <div className="md:col-span-2 bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="bg-slate-50 border-b border-line-soft p-4 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Settings size={18} className="text-muted" />
                 <h2 className="font-bold text-fg-soft">Configuração da Unidade</h2>
               </div>
               <span className="text-xs font-mono font-bold text-slate-500">API BASE: merchant-api.ifood.com.br</span>
            </div>
            <div className="p-6 space-y-6">
               
               <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Merchant ID (ID da Loja no iFood)</label>
                  <input 
                     type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} disabled={conectado}
                     className="w-full bg-slate-50 border border-line rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-[#EA1D2C] outline-none disabled:opacity-60 font-mono text-sm"
                     placeholder="Ex: 12345678-abcd-1234-abcd-123456789abc"
                  />
                  <p className="text-xs text-subtle mt-2">Identificador único do merchant obtido no Portal do Parceiro iFood.</p>
               </div>

               {/* RESULTADO DO TESTE DE CONEXÃO */}
               {testResult && (
                 <div className={`p-4 rounded-xl text-xs font-medium border ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                   <p className="font-bold">{testResult.ok ? "✅ Conexão Validada" : "❌ Falha na Conexão"}</p>
                   <p className="mt-1">{testResult.message}</p>
                   {testResult.merchantDetails && (
                     <div className="mt-2 pt-2 border-t border-emerald-200">
                       <p className="font-bold">Merchants Vinculados:</p>
                       <ul className="list-disc list-inside mt-1 font-mono">
                         {testResult.merchantDetails.map((m, idx) => (
                           <li key={idx}>{m.name} (ID: {m.id})</li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
               )}

               <div className="pt-4 border-t border-line-soft flex flex-wrap gap-3 justify-end">
                  <button 
                     onClick={testarConexaoReal} disabled={testing}
                     className="px-6 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-2 text-sm"
                  >
                     {testing ? <RefreshCw size={16} className="animate-spin" /> : <><RefreshCw size={16} /> Testar Conexão Server-Side</>}
                  </button>

                  <button 
                     onClick={toggleConexao} disabled={saving}
                     className={`px-8 py-3 rounded-xl font-black text-white shadow-lg transition-all flex items-center gap-2 text-sm ${conectado ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/20' : 'bg-[#EA1D2C] hover:bg-red-700 shadow-red-500/30'}`}
                  >
                     {saving ? <RefreshCw size={18} className="animate-spin" /> : 
                      conectado ? <><Link2Off size={18} /> Desconectar Loja</> : <><Link2 size={18} /> Salvar & Conectar ao iFood</>}
                  </button>
               </div>
            </div>
         </div>

         {/* CARD MATRIZ DE CAPACIDADES */}
         <div className="col-span-1 bg-card rounded-2xl shadow-sm border border-line p-6 flex flex-col justify-between">
            <div>
               <div className="flex items-center gap-2 mb-4 pb-3 border-b border-line-soft">
                  <ListFilter size={18} className="text-[#EA1D2C]" />
                  <h3 className="font-bold text-slate-800">Capacidades Oficiais</h3>
               </div>
               
               <ul className="space-y-3 text-xs">
                  <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                     <span className="font-bold text-slate-700">Merchant API</span>
                     <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">Disponível</span>
                  </li>
                  <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                     <span className="font-bold text-slate-700">Inbox & Webhook</span>
                     <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">Disponível</span>
                  </li>
                  <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                     <span className="font-bold text-slate-700">Financial API (Taxas/Repasses)</span>
                     <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">Disponível</span>
                  </li>
                  <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                     <span className="font-bold text-slate-700">Pedidos (Matching/Audit)</span>
                     <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">Disponível</span>
                  </li>
                  <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                     <span className="font-bold text-slate-700">Mapeamento De/Para Cardápio</span>
                     <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase text-3xs">Disponível</span>
                  </li>
               </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-line-soft text-center">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted font-bold">
                  <DollarSign size={14} className="text-emerald-600" />
                  <span>Conciliação Financeira Habilitada</span>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}
