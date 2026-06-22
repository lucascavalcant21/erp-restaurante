"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Star, MessageSquare, Megaphone, TrendingUp,
  Mail, Phone, MoreVertical, Search, Filter, Download,
  Heart, HeartCrack, Award, Gift, Send
} from "lucide-react";
import { PageBody, Card, fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";

// ═══════════════════════════════════════════════════════════════
// MOCKS PARA EXIBIÇÃO DO CRM
// ═══════════════════════════════════════════════════════════════
const MOCK_CLIENTES = [
  { id: 1, nome: "Fernando Costa", telefone: "(11) 9988-7766", ltv: 3450.00, visitas: 14, ult_visita: "Ontem", nps: 10, status: "Vip" },
  { id: 2, nome: "Mariana Souza", telefone: "(11) 9777-6655", ltv: 1280.50, visitas: 5, ult_visita: "Há 3 dias", nps: 9, status: "Frequente" },
  { id: 3, nome: "Roberto Almeida", telefone: "(11) 9666-5544", ltv: 150.00, visitas: 1, ult_visita: "Há 1 semana", nps: 6, status: "Risco" },
  { id: 4, nome: "Camila Dias", telefone: "(11) 9555-4433", ltv: 890.00, visitas: 3, ult_visita: "Há 15 dias", nps: 8, status: "Frequente" },
  { id: 5, nome: "Thiago Mendes", telefone: "(11) 9444-3322", ltv: 4500.00, visitas: 22, ult_visita: "Hoje", nps: 10, status: "Vip" },
];

const MOCK_AVALIACOES = [
  { id: 1, cliente: "Mariana Souza", nota: 5, origem: "Google", data: "Ontem", comentario: "Comida excelente, mas o garçom demorou um pouco para trazer a conta." },
  { id: 2, cliente: "Roberto Almeida", nota: 2, origem: "iFood", data: "Há 1 semana", comentario: "O prato chegou frio e revirado na embalagem. Decepcionante." },
  { id: 3, cliente: "Thiago Mendes", nota: 5, origem: "Tablet Mesa", data: "Hoje", comentario: "O melhor restaurante da cidade! Ambiente incrível." },
];

export default function CRMPage() {
  const router = useRouter();
  const { unidadeInfo } = useERP();
  const [activeTab, setActiveTab] = useState("visao"); // visao | base | nps | campanhas

  // Renderização da Aba Visão Geral
  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* KPIs Principais de CRM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Clientes na Base</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">1.458</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={20}/></div>
          </div>
          <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-3">
            <TrendingUp size={12}/> +42 este mês
          </p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">NPS Atual</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">86</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Star size={20} className="fill-emerald-600"/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Zona de Excelência</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Taxa de Retorno</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">62%</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Heart size={20}/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Clientes fidelizados</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Award size={120} /></div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ticket Médio Geral</p>
            <p className="text-3xl font-black tracking-tighter">R$ 145</p>
            <p className="text-xs font-bold text-slate-400 mt-3">Calculado em 30 dias</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Top Clientes */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">🏆 Top Clientes (LTV)</h3>
              <p className="text-[10px] font-medium text-slate-500 mt-1">Os que mais gastaram historicamente</p>
            </div>
            <button onClick={() => setActiveTab("base")} className="text-xs font-bold text-blue-600 hover:text-blue-800">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-100">
            {MOCK_CLIENTES.filter(c => c.status === 'Vip').sort((a,b) => b.ltv - a.ltv).map((cliente, idx) => (
              <div key={cliente.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">
                    {idx + 1}º
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{cliente.nome}</p>
                    <p className="text-[11px] font-medium text-slate-500">{cliente.visitas} visitas • Última: {cliente.ult_visita}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-600">{fmtBRL(cliente.ltv)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Alertas de Avaliações */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">⚠️ Atenção: Avaliações</h3>
              <p className="text-[10px] font-medium text-slate-500 mt-1">Reviews que precisam de resposta</p>
            </div>
            <button onClick={() => setActiveTab("nps")} className="text-xs font-bold text-blue-600 hover:text-blue-800">Abrir NPS</button>
          </div>
          <div className="p-4 space-y-4">
            {MOCK_AVALIACOES.filter(a => a.nota <= 3).map((av) => (
              <div key={av.id} className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HeartCrack size={16} className="text-red-500"/>
                    <span className="text-xs font-bold text-slate-800">{av.cliente}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{av.origem}</span>
                </div>
                <p className="text-sm text-slate-700 italic">"{av.comentario}"</p>
                <div className="mt-3 flex gap-2">
                  <button className="text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    Oferecer Cupom
                  </button>
                  <button className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                    Responder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // Renderização da Aba Base de Clientes
  const renderBase = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:text-slate-900 shadow-sm transition-colors">
            <Filter size={16}/> Filtros
          </button>
          <button className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:text-slate-900 shadow-sm transition-colors">
            <Download size={16}/> Exportar
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-100">
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Cliente</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Contato</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">LTV (Gasto Total)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_CLIENTES.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-slate-800 text-sm">{cliente.nome}</p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mt-0.5">{cliente.visitas} visitas • Última: {cliente.ult_visita}</p>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600 font-medium">{cliente.telefone}</span>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md border 
                    ${cliente.status === 'Vip' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                      cliente.status === 'Risco' ? 'bg-red-50 text-red-600 border-red-100' : 
                      'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                    {cliente.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-black text-slate-800">{fmtBRL(cliente.ltv)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Renderização da Aba Avaliações (NPS)
  const renderNPS = () => (
    <Card className="p-0 overflow-hidden bg-slate-50">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Feedbacks e Avaliações</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Resumo de satisfação</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_AVALIACOES.map((av) => (
          <div key={av.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < av.nota ? "fill-yellow-400" : "text-slate-200"} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{av.origem}</span>
              </div>
              <p className="text-sm font-medium text-slate-700 italic">"{av.comentario}"</p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{av.cliente}</p>
                <p className="text-[10px] text-slate-400">{av.data}</p>
              </div>
              <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                <MessageSquare size={14}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* HEADER DA TORRE DE CRM */}
      <div className="px-4 pt-8 md:pt-12 pb-6 bg-[var(--surface)] sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Marketing</p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter text-slate-800">Relacionamento.</h1>
            <p className="text-sm font-semibold text-slate-500 mt-2">Gestão de clientes e fidelização em <span className="text-slate-800 font-bold">{unidadeInfo.nome}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 shadow-blue-600/20 shadow-xl">
              <Megaphone size={18} /> Nova Campanha
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="max-w-6xl mx-auto mt-8 flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: "visao", label: "Visão Geral", icon: TrendingUp },
            { id: "base", label: "Base de Clientes", icon: Users },
            { id: "nps", label: "Avaliações (NPS)", icon: Star },
            { id: "campanhas", label: "Campanhas SMS", icon: Send },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id 
                  ? "bg-slate-800 text-white shadow-md" 
                  : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CORPO DA PÁGINA */}
      <PageBody>
        <div className="max-w-6xl mx-auto">
          {activeTab === "visao" && renderVisaoGeral()}
          {activeTab === "base" && renderBase()}
          {activeTab === "nps" && renderNPS()}
          {activeTab === "campanhas" && (
             <div className="text-center py-20">
               <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4"><Gift size={32}/></div>
               <h3 className="text-xl font-black text-slate-800 mb-2">Campanhas e Cashback</h3>
               <p className="text-slate-500 max-w-md mx-auto">Crie campanhas de SMS com cupons de desconto para trazer de volta clientes que não visitam o restaurante há mais de 30 dias.</p>
             </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
