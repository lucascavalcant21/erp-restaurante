"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useERP } from "../../../context/ERPContext";
import { fetchUnidades } from "../../../lib/unidades";
import { SkeletonList } from "../../../components/ui";
import { Layers, Store, Monitor, ShieldCheck, ArrowRight, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function IntegracoesCentralPage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [ifoodStatus, setIfoodStatus] = useState("NOT_CONFIGURED");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      if (!unidadeAtiva) return;

      const { data } = await fetchUnidades();
      const minhaUnidade = data?.find(u => u.id === unidadeAtiva);
      if (minhaUnidade?.ifood_conectado) {
        setIfoodStatus("CONNECTED");
      } else {
        setIfoodStatus("NOT_CONFIGURED");
      }
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  if (loading) return <div className="p-6"><SkeletonList /></div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full font-sans">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Central de Integrações Canônicas</h1>
          <p className="text-sm text-muted font-medium">Gerencie conexões de PDVs operacionais e canais de venda externos sem duplicidade de dados.</p>
        </div>
      </div>

      {/* REGRAS ARQUITETURAIS */}
      <div className="mb-8 p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-white">Fluxo Operacional Anti-Duplicidade Ativo</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Arquitetura Operacional: <code>iFood</code> ➔ <code>Saipos</code> ➔ <code>Héfisto ERP</code> | Arquitetura Financeira: <code>iFood Merchant Financial API</code> ➔ <code>Héfisto Recebíveis</code>.
            </p>
          </div>
        </div>
      </div>

      {/* CARDS DAS INTEGRAÇÕES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD IFOOD */}
        <div className="bg-card rounded-2xl border border-line p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EA1D2C] text-white rounded-lg flex items-center justify-center font-bold">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800">iFood Merchant API</h3>
                  <p className="text-xs text-muted">Canal de Delivery / Marketplaces</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 ${ifoodStatus === 'CONNECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {ifoodStatus === 'CONNECTED' ? <><CheckCircle size={14}/> Conectado</> : <><AlertCircle size={14}/> Desconectado</>}
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Integração oficial via API Merchant do iFood (<code>merchant-api.ifood.com.br</code>). Permite importação de comissões, taxas reais, repasses e reconciliação de recebíveis sem duplicar vendas.
            </p>

            <div className="space-y-2 mb-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Capacidades:</span>
              <div className="flex flex-wrap gap-2 text-3xs font-bold uppercase">
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">Merchant API</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">Financial API</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">Inbox Webhook</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">Matching Pedidos</span>
              </div>
            </div>
          </div>

          <Link href="/dashboard/canais/ifood" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all">
            <span>Configurar iFood</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* CARD SAIPOS */}
        <div className="bg-card rounded-2xl border border-line p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800">Saipos PDV</h3>
                  <p className="text-xs text-muted">PDV Operacional de Frente de Loja</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 bg-amber-100 text-amber-800">
                <Clock size={14}/> Aguardando Credenciais
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Adaptador canônico para a Saipos API. As vendas operacionais importadas registram a chave do iFood (<code>upstream_external_id</code>), garantindo que a mesma venda não entre duplicada no ERP.
            </p>

            <div className="space-y-2 mb-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Capacidades:</span>
              <div className="flex flex-wrap gap-2 text-3xs font-bold uppercase">
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800">Vendas (Disponível)</span>
                <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800">Pedidos (Aguardando Chave)</span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-500">Financeiro (Via Canal)</span>
              </div>
            </div>
          </div>

          <div className="w-full py-3 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
            <span>Aguardando Chave de API da Saipos</span>
          </div>
        </div>

      </div>

    </div>
  );
}
