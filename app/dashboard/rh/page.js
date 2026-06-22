"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserPlus, Clock, CalendarCheck, ShieldCheck, 
  Briefcase, Mail, Phone, MoreVertical, BadgeAlert, Wallet,
  Download, Filter, CircleDot, AlertTriangle, ArrowRight, BarChart3
} from "lucide-react";
import { PageBody, Card, fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";

// ═══════════════════════════════════════════════════════════════
// MOCKS PARA EXIBIÇÃO DA TORRE DE RH
// ═══════════════════════════════════════════════════════════════
const MOCK_EQUIPE = [
  { id: 1, nome: "Carlos Almeida", cargo: "Chefe de Cozinha", turno: "10:00 - 18:00", status: "trabalhando", entrada: "09:55", foto: "CA" },
  { id: 2, nome: "Juliana Silva", cargo: "Garçom (Praça A)", turno: "10:00 - 18:00", status: "trabalhando", entrada: "10:02", foto: "JS" },
  { id: 3, nome: "Marcos Souza", cargo: "Atendente de Caixa", turno: "10:00 - 18:00", status: "atrasado", entrada: null, foto: "MS" },
  { id: 4, nome: "Amanda Costa", cargo: "Auxiliar de Limpeza", turno: "08:00 - 16:00", status: "trabalhando", entrada: "07:50", foto: "AC" },
  { id: 5, nome: "Roberto Silva", cargo: "Bartender", turno: "16:00 - 00:00", status: "descanso", entrada: null, foto: "RS" },
];

const MOCK_TALENTOS = [
  { id: 1, nome: "Fernanda Lima", vaga: "Garçom", exp: "3 anos", match: "95%" },
  { id: 2, nome: "Thiago Mendes", vaga: "Cozinheiro", exp: "5 anos", match: "88%" },
  { id: 3, nome: "Beatriz Nogueira", vaga: "Aux. Limpeza", exp: "1 ano", match: "70%" },
];

export default function GestaoEquipePage() {
  const router = useRouter();
  const { unidadeInfo } = useERP();
  const [activeTab, setActiveTab] = useState("visao"); // visao | quadro | talentos

  // Renderização da Aba de Visão Geral
  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* KPIs Principais de RH */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Colaboradores</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">24</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={20}/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">22 CLT · 2 Freelancers</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">No Turno Agora</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">08</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><CircleDot size={20} className="animate-pulse"/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Bateram ponto hoje</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Atrasos / Faltas</p>
              <p className="text-3xl font-black tracking-tighter text-slate-800">1</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600"><BadgeAlert size={20}/></div>
          </div>
          <p className="text-xs font-bold text-red-500 mt-3">Marcos Souza (Caixa)</p>
        </Card>

        <Card className="p-5 flex flex-col justify-between group hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Wallet size={120} /></div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Custo Folha (Est.)</p>
            <p className="text-3xl font-black tracking-tighter">R$ 58k</p>
            <p className="text-xs font-bold text-slate-400 mt-3">18% do faturamento</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Quem está no Salão */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Pulso da Equipe (Hoje)</h3>
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {MOCK_EQUIPE.slice(0, 4).map((membro) => (
                <div key={membro.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${membro.status === 'atrasado' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                      {membro.foto}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{membro.nome}</p>
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">{membro.cargo} • {membro.turno}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {membro.status === "trabalhando" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Trabalhando
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest">
                        Atraso / Falta
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 mt-1">
                      {membro.entrada ? `Entrou às ${membro.entrada}` : 'Sem registro'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 border-t border-slate-100 p-3 text-center">
              <button onClick={() => setActiveTab("quadro")} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest">Ver quadro completo</button>
            </div>
          </Card>
        </div>

        {/* Lembretes e Rotinas de RH */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Lembretes de RH</h3>
          
          <Card className="p-4 border-l-4 border-l-orange-500 hover:-translate-y-0.5 transition-transform cursor-pointer">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-bold text-slate-800">Férias Próximas</p>
                <p className="text-[11px] text-slate-500 mt-1">Juliana Silva sairá de férias em 10 dias. O substituto já foi definido?</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 border-l-4 border-l-blue-500 hover:-translate-y-0.5 transition-transform cursor-pointer">
            <div className="flex gap-3">
              <CalendarCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-bold text-slate-800">Fechamento de Folha</p>
                <p className="text-[11px] text-slate-500 mt-1">A folha de pagamento fecha dia 25. Verifique as horas extras no relatório.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  // Renderização da Aba Quadro de Colaboradores
  const renderQuadro = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Quadro Oficial da Equipe</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Funcionários ativos na unidade</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:text-slate-900 shadow-sm transition-colors">
            <Filter size={16}/> Filtrar
          </button>
          <button className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:text-slate-900 shadow-sm transition-colors">
            <Download size={16}/> Exportar Lista
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-100">
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Colaborador</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Cargo / Setor</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Contato</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
              <th className="p-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_EQUIPE.map((func) => (
              <tr key={func.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-black text-xs text-slate-600">
                      {func.foto}
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{func.nome}</span>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-xs font-bold text-slate-700">{func.cargo}</p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-0.5">{func.turno}</p>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone size={14}/>
                    <Mail size={14}/>
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-100">
                    Ativo CLT
                  </span>
                </td>
                <td className="p-4">
                  <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreVertical size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Renderização da Aba Talentos
  const renderTalentos = () => (
    <Card className="p-0 overflow-hidden bg-slate-50">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Banco de Talentos</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Currículos que deram Match</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_TALENTOS.map((cand) => (
          <div key={cand.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-blue-100">
                Vaga: {cand.vaga}
              </span>
              <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                <ShieldCheck size={12}/> Match {cand.match}
              </span>
            </div>
            <h4 className="font-bold text-slate-800 text-lg">{cand.nome}</h4>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1">
              <Briefcase size={14}/> {cand.exp} de experiência
            </p>
            <button className="w-full mt-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Ver Currículo
            </button>
          </div>
        ))}
        <div className="bg-transparent border-2 border-dashed border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition-all">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mb-2"><UserPlus size={18} className="text-slate-500"/></div>
          <p className="text-sm font-bold text-slate-600">Abrir Nova Vaga</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Gerar link público</p>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* HEADER DA TORRE DE RH */}
      <div className="px-4 pt-8 md:pt-12 pb-6 bg-[var(--surface)] sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Administração</p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter text-slate-800">Gestão de Equipe.</h1>
            <p className="text-sm font-semibold text-slate-500 mt-2">Visão gerencial da unidade <span className="text-slate-800 font-bold">{unidadeInfo.nome}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 shadow-orange-500/20 shadow-xl">
              <UserPlus size={18} /> Novo Colaborador
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="max-w-6xl mx-auto mt-8 flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: "visao", label: "Visão Geral", icon: BarChart3 },
            { id: "quadro", label: "Quadro de Colaboradores", icon: Users },
            { id: "talentos", label: "Banco de Talentos", icon: Briefcase },
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
          {activeTab === "quadro" && renderQuadro()}
          {activeTab === "talentos" && renderTalentos()}
        </div>
      </PageBody>
    </div>
  );
}
