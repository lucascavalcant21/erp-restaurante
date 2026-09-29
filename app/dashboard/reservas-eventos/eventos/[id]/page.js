"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, DollarSign, 
  FileText, ChefHat, GlassWater, ShoppingCart, Activity, Briefcase 
, Wine, LayoutTemplate } from "lucide-react";
import OperacaoTab from "./OperacaoTab";
import Link from "next/link";
import CardapioTab from "./CardapioTab";
import ComprasTab from "./ComprasTab";
import PropostaTab from "./PropostaTab";
import FinanceiroTab from "./FinanceiroTab";
import { supabase } from "../../../../lib/supabase";
import { useERP } from "../../../../context/ERPContext";

// Abas do Hub
const TABS = [
  { id: "resumo", label: "CRM & Resumo", icon: FileText },
  { id: "financeiro", label: "Caixa & DRE", icon: DollarSign },
  { id: "cozinha", label: "Cozinha", icon: ChefHat },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "salao", label: "Salão", icon: Users },
  { id: "compras", label: "Logística/Compras", icon: ShoppingCart },
  { id: "proposta", label: "Proposta", icon: LayoutTemplate }
];

export default function EventoHubPage() {
  const params = useParams();
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const { id } = params;
  
  const [evento, setEvento] = useState(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarEvento() {
      if (!unidadeAtiva || !id) return;
      setCarregando(true);
      const { data, error } = await supabase
        .from("eventos")
        .select("*")
        .eq("id", id)
        .single();
        
      if (!error && data) setEvento(data);
      setCarregando(false);
    }
    carregarEvento();
  }, [unidadeAtiva, id]);

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-500">Selecione uma loja.</div>;
  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold">Carregando Hub do Evento...</div>;
  if (!evento) return <div className="p-8 text-center text-slate-500 font-bold">Evento não encontrado.</div>;

  return (
    <main className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <Link href="/dashboard/reservas-eventos/eventos" className="inline-flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-900 transition-colors w-max">
            <ArrowLeft size={16} /> Voltar para o Funil
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                
                <select 
                  value={evento.funil_status || "NOVO CONTATO"}
                  onChange={async (e) => {
                    const novoStatus = e.target.value;
                    setEvento({...evento, funil_status: novoStatus});
                    await supabase.from("eventos").update({funil_status: novoStatus}).eq("id", evento.id);
                  }}
                  className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest outline-none cursor-pointer appearance-none text-center"
                >
                  <option value="NOVO CONTATO">NOVO CONTATO</option>
                  <option value="PROPOSTA ENVIADA">PROPOSTA ENVIADA</option>
                  <option value="NEGOCIAÇÃO">NEGOCIAÇÃO</option>
                  <option value="APROVADO">APROVADO</option>
                  <option value="AGUARDANDO SINAL">AGUARDANDO SINAL</option>
                  <option value="CONFIRMADO">CONFIRMADO</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>

                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                  ID: {evento.id.split("-")[0]}
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                {evento.nome || evento.cliente_nome || "Evento sem Título"}
              </h1>
              {evento.cliente_nome && (
                <p className="text-lg font-medium text-slate-500">{evento.cliente_nome}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 md:justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs font-bold text-slate-400 uppercase">Data</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400"/> 
                  {evento.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "A definir"}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs font-bold text-slate-400 uppercase">Convidados</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400"/> 
                  {evento.capacidade || 0}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[140px]">
                <span className="text-xs font-bold text-emerald-600 uppercase">Valor Fechado</span>
                <span className="text-lg font-black text-emerald-900 flex items-center gap-1">
                  R$ {(evento.valor_contratado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO DE ABAS */}
      <nav className="bg-white border-b border-slate-200 px-8 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id 
                  ? 'border-emerald-600 text-emerald-700' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* CONTEÚDO DAS ABAS */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-8">
        {activeTab === "resumo" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-white border border-slate-200 rounded-3xl p-6">
                <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity className="text-emerald-600" /> Indicadores de Prontidão
                </h2>
                
                {(() => {
                  const items = [
                    { id: 'cardapio', empty: 'Cardápio não definido', done: 'Cardápio montado', isDone: (evento.cardapio_itens && evento.cardapio_itens.length > 0) },
                    { id: 'equipe', empty: 'Equipe não escalada', done: 'Equipe escalada', isDone: Number(evento.total_custo_equipe) > 0 },
                    { id: 'sinal', empty: 'Aguardando financeiro', done: 'Sinal/Pagam. recebido', isDone: (evento.historico_pagamentos && evento.historico_pagamentos.length > 0) }
                  ];
                  const progresso = Math.round((items.filter(i => i.isDone).length / items.length) * 100);
                  
                  return (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status da Organização</span>
                        <span className="text-sm font-black text-emerald-600">{progresso}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                        <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progresso}%` }}></div>
                      </div>
                      
                      <div className="space-y-3">
                        {items.map(item => (
                          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${item.isDone ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                              <CheckCircle2 size={14} />
                            </div>
                            <span className={`font-bold ${item.isDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {item.isDone ? item.done : item.empty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </section>

            </div>
            
            <div className="space-y-6">
              <section className="bg-red-50 border border-red-100 rounded-3xl p-6">
                <h2 className="text-sm font-extrabold text-red-700 uppercase tracking-widest mb-4">Precisa de Atenção</h2>
                <p className="text-sm text-red-600 font-medium">Nenhum alerta crítico para este evento no momento.</p>
              </section>
            </div>
          </div>
        )}
        
        {activeTab === "cozinha" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="cozinha" onUpdate={(n) => setEvento({...evento, ...n})} />}
        {activeTab === "bar" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="bar" onUpdate={(n) => setEvento({...evento, ...n})} />}
        {activeTab === "salao" && <OperacaoTab evento={evento} unidadeAtiva={unidadeAtiva} departamento="salao" onUpdate={(n) => setEvento({...evento, ...n})} />}



        
                {activeTab === "financeiro" && (
          <FinanceiroTab 
            evento={evento} 
            onUpdate={(novosDados) => setEvento({...evento, ...novosDados})} 
          />
        )}


        
        {activeTab === "compras" && (
          <ComprasTab evento={evento} unidadeAtiva={unidadeAtiva} />
        )}
        
        {activeTab === "proposta" && (
          <PropostaTab evento={evento} />
        )}

        {activeTab !== "resumo" && activeTab !== "cardapio" && activeTab !== "equipe" && activeTab !== "financeiro" && activeTab !== "compras" && activeTab !== "proposta" && (
           <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl">
           <h2 className="text-xl font-bold text-slate-800 mb-2">Aba {TABS.find(t=>t.id === activeTab)?.label}</h2>
           <p className="text-slate-500 max-w-md mx-auto">
             Módulo em construção (Próximas Fases).
           </p>
         </div>
        )}

      </div>
    </main>
  );
}
