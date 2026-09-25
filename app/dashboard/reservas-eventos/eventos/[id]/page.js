"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, DollarSign, 
  FileText, ChefHat, GlassWater, ShoppingCart, Activity, Briefcase 
} from "lucide-react";
import Link from "next/link";
import supabase from "../../../../../lib/supabase";
import { useERP } from "../../../../../context/ERPContext";

// Abas do Hub
const TABS = [
  { id: "resumo", label: "Resumo", icon: Activity },
  { id: "proposta", label: "Proposta", icon: FileText },
  { id: "cardapio", label: "Cardápio", icon: ChefHat },
  { id: "bar", label: "Bar", icon: GlassWater },
  { id: "equipe", label: "Equipe", icon: Briefcase },
  { id: "compras", label: "Compras", icon: ShoppingCart },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
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
                <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">
                  {evento.funil_status || "NOVO CONTATO"}
                </span>
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
              className={\`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors \${
                activeTab === tab.id 
                  ? 'border-emerald-600 text-emerald-700' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }\`}
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
                  <Activity className="text-emerald-600" /> Checklist de Prontidão
                </h2>
                <div className="space-y-3">
                  {/* Mock do checklist solicitado */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
                    <span className="font-bold text-slate-700">Cardápio definido?</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
                    <span className="font-bold text-slate-700">Sinal pago?</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
                    <span className="font-bold text-slate-700">Equipe escalada?</span>
                  </label>
                </div>
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
        
        {activeTab === "cardapio" && (
          <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl">
            <ChefHat size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Engenharia de Cardápio</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Aqui entraremos com os componentes reaproveitados do legado para construir as Fichas Técnicas e Custos dos pratos exclusivos deste evento.
            </p>
          </div>
        )}

        {/* ... Outras abas (serão expandidas depois) */}
        {activeTab !== "resumo" && activeTab !== "cardapio" && (
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
