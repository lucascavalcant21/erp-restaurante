"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, DollarSign, 
  FileText, ChefHat, GlassWater, ShoppingCart, Activity, Briefcase 
} from "lucide-react";
import Link from "next/link";
import CardapioTab from "./CardapioTab";
import supabase from "../../../../lib/supabase";
import { useERP } from "../../../../context/ERPContext";

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
          <CardapioTab 
            evento={evento} 
            unidadeAtiva={unidadeAtiva} 
            onUpdate={(novo) => setEvento({ ...evento, ...novo })} 
          />
        )}

        
        {activeTab === "equipe" && (
          <div className="space-y-6">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Escala da Equipe</h2>
                <p className="text-slate-500 font-medium">Controle de funcionários e freelancers (diárias)</p>
              </div>
              <button className="h-10 px-4 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-slate-800">
                Escalar Pessoa
              </button>
            </header>
            
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Nome</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Setor</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Função</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Custo (Diária)</th>
                    <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Placeholder estático por enquanto */}
                  <tr className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">Carlos Silva (Fixo)</strong>
                      <span className="text-sm text-slate-500">Funcionário CLT</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">Cozinha</td>
                    <td className="py-4 px-6 font-bold text-slate-700">Chef de Praça</td>
                    <td className="py-4 px-6 font-black text-red-600">R$ 180,00</td>
                    <td className="py-4 px-6"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 font-bold text-xs rounded-lg uppercase">Pendente</span></td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <strong className="block text-slate-900 font-bold">Amanda Souza (Freelancer)</strong>
                      <span className="text-sm text-slate-500">(11) 90000-0000</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">Salão</td>
                    <td className="py-4 px-6 font-bold text-slate-700">Garçom</td>
                    <td className="py-4 px-6 font-black text-red-600">R$ 150,00</td>
                    <td className="py-4 px-6"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg uppercase">Pago</span></td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-50 border-t border-slate-200 p-4 text-right">
                <span className="text-slate-500 font-bold mr-4">Total de Diárias:</span>
                <span className="text-xl font-black text-red-700">R$ 330,00</span>
              </div>
            </div>
          </div>
        )}


        
        {activeTab === "financeiro" && (() => {
          const custoInsumos = evento.total_custo_insumos || 0;
          const custoEquipe = evento.total_custo_equipe || 0;
          const custoAluguel = Number(evento.custo_aluguel_espaco || 0);
          const taxaImpostoPct = Number(evento.taxa_imposto_pct || 6);
          const taxaMaquininhaPct = Number(evento.taxa_maquininha_pct || 2.5);
          
          const totalCustosFisicos = custoInsumos + custoEquipe + custoAluguel;
          
          // O valor cobrado poderia ser input livre, mas vou usar o valor_contratado
          const valorCobrado = Number(evento.valor_contratado || 0);
          
          const deducoesFiscais = valorCobrado * (taxaImpostoPct / 100);
          const deducoesMaquininha = valorCobrado * (taxaMaquininhaPct / 100);
          const totalDeducoes = deducoesFiscais + deducoesMaquininha;
          
          const lucroLiquido = valorCobrado - totalCustosFisicos - totalDeducoes;
          const margemLiquida = valorCobrado > 0 ? (lucroLiquido / valorCobrado) * 100 : 0;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white border border-slate-200 rounded-3xl p-6">
                  <header className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-900">Precificação e Orçamento</h2>
                    <span className="text-slate-500 font-bold text-sm">Atualizado ao vivo</span>
                  </header>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Custo de Insumos (Cardápio e Bar)</strong>
                        <span className="text-sm text-slate-500">Calculado automaticamente das fichas técnicas</span>
                      </div>
                      <span className="text-lg font-black text-red-600">- R$ {custoInsumos.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Custo de Equipe (Diárias)</strong>
                        <span className="text-sm text-slate-500">Soma da aba Equipe</span>
                      </div>
                      <span className="text-lg font-black text-red-600">- R$ {custoEquipe.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Aluguel do Espaço / Custos Fixos</strong>
                        <span className="text-sm text-slate-500">Locação, fretes, limpeza extra</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400">R$</span>
                        <input type="number" value={custoAluguel} onChange={e => {
                          // atualiza o evento no state, e precisaria chamar o banco
                        }} disabled className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Impostos (Ex: Simples Nacional)</strong>
                        <span className="text-sm text-slate-500">Deduzido do valor total bruto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={taxaImpostoPct} disabled className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                      <div>
                        <strong className="block text-slate-800">Taxa de Maquininha</strong>
                        <span className="text-sm text-slate-500">Custo financeiro de recebimento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={taxaMaquininhaPct} disabled className="w-20 bg-white border border-slate-300 rounded-xl px-3 py-1 font-bold text-right text-slate-700 outline-none focus:border-emerald-600" />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              
              <div className="space-y-6">
                <section className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg sticky top-24">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Resumo de Lucratividade</h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Total de Custos (Físicos)</span>
                      <strong className="text-red-400">R$ {totalCustosFisicos.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Impostos e Taxas</span>
                      <strong className="text-red-400">R$ {totalDeducoes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div className="h-px bg-slate-800 w-full my-4"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Valor Cobrado (Bruto)</span>
                      <strong className="text-white text-xl">R$ {valorCobrado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                  </div>

                  <div className={`border rounded-2xl p-4 mt-8 ${margemLiquida >= 20 ? 'bg-emerald-500/20 border-emerald-500/30' : margemLiquida >= 0 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                    <span className={`block text-sm font-bold mb-1 ${margemLiquida >= 20 ? 'text-emerald-400' : margemLiquida >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>Lucro Líquido Real</span>
                    <div className="flex justify-between items-end">
                      <strong className={`text-3xl font-black ${margemLiquida >= 20 ? 'text-emerald-400' : margemLiquida >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>R$ {lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                      <span className={`font-bold px-2 py-1 rounded-lg text-sm ${margemLiquida >= 20 ? 'text-emerald-400 bg-emerald-900' : margemLiquida >= 0 ? 'text-yellow-400 bg-yellow-900' : 'text-red-400 bg-red-900'}`}>{margemLiquida.toFixed(1)}%</span>
                    </div>
                  </div>

                  <button className="w-full mt-6 h-12 rounded-xl bg-white text-slate-900 font-black hover:bg-slate-100 transition-colors">
                    Gerar PDF de Proposta
                  </button>
                </section>
              </div>
            </div>
          );
        })()}


        {activeTab !== "resumo" && activeTab !== "cardapio" && activeTab !== "equipe" && activeTab !== "financeiro" && (
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
