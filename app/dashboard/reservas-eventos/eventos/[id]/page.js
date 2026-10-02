"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, DollarSign, 
  FileText, ChefHat, GlassWater, ShoppingCart, Activity, Briefcase 
, Wine, LayoutTemplate, CheckCircle2 } from "lucide-react";
import OperacaoTab from "./OperacaoTab";
import Link from "next/link";
import CardapioTab from "./CardapioTab";
import ComprasTab from "./ComprasTab";
import PropostaTab from "./PropostaTab";
import FinanceiroTab from "./FinanceiroTab";
import { supabase } from "../../../../lib/supabase";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas } from "../../../../lib/operacao";
import { fetchParams, PARAMS_PADRAO } from "../../../../lib/parametros";
import { FUNIL_ETAPAS, rotuloEtapa, normalizarEtapa, resumoDoEvento, pendenciasDoEvento } from "../../../../lib/evento-financeiro.mjs";
import { fmtReais, fmtPct, NATUREZA } from "../../../../lib/valor-percentual.mjs";

// Abas do Hub
const TABS = [
  { id: "resumo", label: "CRM & Resumo", icon: FileText },
  { id: "cozinha", label: "Cozinha", icon: ChefHat },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "salao", label: "Salão", icon: Users },
  { id: "compras", label: "Logística/Compras", icon: ShoppingCart },
  { id: "financeiro", label: "Caixa & DRE", icon: DollarSign },
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
  // Fichas e parâmetros: o custo do evento sai da mesma conta das fichas.
  const [fichas, setFichas] = useState([]);
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);

  useEffect(() => {
    async function carregarEvento() {
      if (!unidadeAtiva || !id) return;
      setCarregando(true);
      const [{ data, error }, resFichas, resParams] = await Promise.all([
        supabase.from("eventos").select("*").eq("id", id).single(),
        fetchFichas(unidadeAtiva),
        fetchParams(unidadeAtiva),
      ]);
      if (!error && data) setEvento(data);
      setFichas(resFichas.data || []);
      setParamsSis({ ...PARAMS_PADRAO, ...(resParams.data || {}) });
      setCarregando(false);
    }
    carregarEvento();
  }, [unidadeAtiva, id]);

  const resumo = useMemo(() => (evento ? resumoDoEvento(evento, fichas, paramsSis) : null), [evento, fichas, paramsSis]);
  const hoje = new Date().toISOString().slice(0, 10);
  const pendencias = useMemo(() => (evento && resumo ? pendenciasDoEvento(evento, resumo, hoje) : []), [evento, resumo, hoje]);

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-900">Selecione uma loja.</div>;
  if (carregando) return <div className="p-8 text-center text-slate-900 font-bold">Carregando Hub do Evento...</div>;
  if (!evento) return <div className="p-8 text-center text-slate-900 font-bold">Evento não encontrado.</div>;

  return (
    <main className="min-h-screen bg-white/50 flex flex-col">
      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <Link href="/dashboard/reservas-eventos" className="inline-flex items-center gap-2 text-slate-900 font-bold text-sm hover:text-slate-900 transition-colors w-max">
            <ArrowLeft size={16} /> Voltar para o Funil
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                
                <select 
                  value={normalizarEtapa(evento.funil_status)}
                  onChange={async (e) => {
                    const novoStatus = e.target.value;
                    setEvento({...evento, funil_status: novoStatus});
                    await supabase.from("eventos").update({funil_status: novoStatus}).eq("id", evento.id);
                  }}
                  className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest outline-none cursor-pointer appearance-none text-center"
                >
                  {FUNIL_ETAPAS.map((e) => <option key={e} value={e}>{rotuloEtapa(e).toUpperCase()}</option>)}
                </select>

                <span className="bg-slate-100 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-lg">
                  ID: {evento.id.split("-")[0]}
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                {evento.nome || evento.cliente_nome || "Evento sem Título"}
              </h1>
              {evento.cliente_nome && (
                <p className="text-lg font-medium text-slate-900">{evento.cliente_nome}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 md:justify-end">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs font-bold text-slate-800 uppercase">Data</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-800"/> 
                  {evento.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "A definir"}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs font-bold text-slate-800 uppercase">Convidados</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-800"/> 
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
                  : 'border-transparent text-slate-900 hover:text-slate-800 hover:border-slate-300'
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
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Status da Organização</span>
                        <span className="text-sm font-black text-emerald-600">{progresso}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                        <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progresso}%` }}></div>
                      </div>
                      
                      <div className="space-y-3">
                        {items.map(item => (
                          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${item.isDone ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-white'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-800'}`}>
                              <CheckCircle2 size={14} />
                            </div>
                            <span className={`font-bold ${item.isDone ? 'text-emerald-700' : 'text-slate-900'}`}>
                              {item.isDone ? item.done : item.empty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </section>

              {resumo && <CustoEPreco resumo={resumo} />}

            </div>
            
            <div className="space-y-6">
              <section className={`rounded-3xl border p-6 ${pendencias.length ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
                <h2 className={`text-sm font-extrabold uppercase tracking-widest mb-4 ${pendencias.length ? "text-amber-800" : "text-emerald-700"}`}>Precisa de atenção</h2>
                {pendencias.length ? (
                  <ul className="space-y-2">
                    {pendencias.map((p) => <li key={p} className="text-sm font-semibold text-amber-900">• {p}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm font-medium text-emerald-700">Nada pendente nos dados deste evento.</p>
                )}
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
            resumo={resumo}
            onUpdate={(novosDados) => setEvento({...evento, ...novosDados})} 
          />
        )}


        
        {activeTab === "compras" && (
          <ComprasTab evento={evento} fichas={fichas} />
        )}
        
        {activeTab === "proposta" && (
          <PropostaTab evento={evento} resumo={resumo} />
        )}

        {activeTab !== "resumo" && activeTab !== "cardapio" && activeTab !== "equipe" && activeTab !== "financeiro" && activeTab !== "compras" && activeTab !== "proposta" && (
           <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl">
           <h2 className="text-xl font-bold text-slate-800 mb-2">Aba {TABS.find(t=>t.id === activeTab)?.label}</h2>
           <p className="text-slate-900 max-w-md mx-auto">
             Módulo em construção (Próximas Fases).
           </p>
         </div>
        )}

      </div>
    </main>
  );
}


// Custo e preço do evento: tudo de resumoDoEvento (evento-financeiro.mjs), em
// R$ e % do valor do evento.
function Chip({ id }) {
  const n = NATUREZA[id];
  return n ? <span title={n.ajuda} className="ml-1.5 rounded border border-slate-200 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{n.rotulo}</span> : null;
}

function CustoEPreco({ resumo: r }) {
  const vp = (v, pct) => `${fmtReais(v)}${pct !== null && pct !== undefined ? ` · ${fmtPct(pct)}` : ""}`;
  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-6">
      <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest mb-4">Custo e preço</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Valor do evento", r.receita > 0 ? fmtReais(r.receita) : "—"],
          ["Por convidado", r.receitaPorConvidado ? fmtReais(r.receitaPorConvidado) : "—"],
          ["Custo por convidado", r.custoPorConvidado ? fmtReais(r.custoPorConvidado) : "—"],
          ["Resultado", r.receita > 0 ? vp(r.resultado.valor, r.resultado.pct) : "—"]].map(([rot, val]) => (
          <div key={rot} className="rounded-2xl border border-slate-200 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{rot}</p>
            <p className={`text-sm font-black tabular-nums ${rot === "Resultado" && r.resultado.prejuizo ? "text-red-600" : "text-slate-900"}`}>{val}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {r.linhas.map((l) => (
          <div key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
            <span className="text-sm font-semibold text-slate-700">{l.rotulo}<Chip id={l.natureza} /></span>
            <span className="ml-auto whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">{vp(l.valor, l.pct)}</span>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 pt-2">
          <span className="text-sm font-black uppercase text-slate-900">Resultado estimado<Chip id="estimado" /></span>
          <span className={`ml-auto whitespace-nowrap text-base font-black tabular-nums ${r.resultado.prejuizo ? "text-red-600" : "text-emerald-700"}`}>{r.receita > 0 ? vp(r.resultado.valor, r.resultado.pct) : "Defina o valor do evento"}</span>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preço sugerido {r.meta.pct ? `(meta de lucro ${fmtPct(r.meta.pct)})` : "(sem meta de lucro configurada)"}</p>
        <p className="text-lg font-black text-slate-900">
          {r.precoSugerido ? fmtReais(r.precoSugerido) : "—"}
          {r.precoSugeridoPorConvidado ? <span className="ml-2 text-sm font-bold text-slate-600">{fmtReais(r.precoSugeridoPorConvidado)} por convidado</span> : null}
        </p>
        <p className="text-xs font-medium text-slate-600">Cobre CMV, equipe, espaço e extras, imposto e maquininha, e ainda sobra a meta. A meta é a mesma da Pizza do Lucro.</p>
      </div>
    </section>
  );
}
