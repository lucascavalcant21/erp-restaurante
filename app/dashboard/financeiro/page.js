"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, TrendingDown, TrendingUp, DollarSign, Plus, Filter,
  ArrowRight, FileText, Download, Building2, BarChart3, Receipt,
  ChevronDown, AlertCircle
} from "lucide-react";
import { PageBody, Card, fmtBRL } from "../../components/ui";
import { useERP } from "../../context/ERPContext";

// ═══════════════════════════════════════════════════════════════
// MOCKS PARA EXIBIÇÃO
// ═══════════════════════════════════════════════════════════════
const MOCK_SALDO = 42500.80;
const MOCK_LUCRO_PCT = 18.5;
const MOCK_CMV_PCT = 32.4;

const MOCK_DRE = [
  { id: 1, categoria: "Receita Bruta", valor: 125000, tipo: "positivo", bold: true },
  { id: 2, categoria: "(-) Impostos e Taxas (Cartões/iFood)", valor: -15000, tipo: "negativo", bold: false },
  { id: 3, categoria: "Receita Líquida", valor: 110000, tipo: "neutro", bold: true },
  { id: 4, categoria: "(-) Custo da Mercadoria Vendida (CMV)", valor: -40500, tipo: "negativo", bold: true, alerta: true },
  { id: 5, categoria: "Lucro Bruto", valor: 69500, tipo: "neutro", bold: true },
  { id: 6, categoria: "(-) Despesas Operacionais (RH, Aluguel, Luz)", valor: -42000, tipo: "negativo", bold: false },
  { id: 7, categoria: "(-) Despesas Financeiras", valor: -4375, tipo: "negativo", bold: false },
  { id: 8, categoria: "Lucro Líquido do Exercício", valor: 23125, tipo: "positivo", bold: true, destaque: true },
];

const MOCK_FLUXO = [
  { id: 101, data: "Hoje, 10:30", desc: "Venda Salão (PDV 1)", cat: "Receita Operacional", valor: 450.00, tipo: "entrada" },
  { id: 102, data: "Hoje, 09:15", desc: "Pagamento Fornecedor (Ambev)", cat: "Insumos (Bar)", valor: -1250.00, tipo: "saida" },
  { id: 103, data: "Ontem", desc: "Venda iFood", cat: "Delivery", valor: 890.50, tipo: "entrada" },
  { id: 104, data: "Ontem", desc: "Conta de Luz (Enel)", cat: "Despesas Fixas", valor: -850.00, tipo: "saida" },
  { id: 105, data: "18 Jun", desc: "Venda Salão (PDV 2)", cat: "Receita Operacional", valor: 3200.00, tipo: "entrada" },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function CentroFinanceiroPage() {
  const router = useRouter();
  const { unidadeInfo, isCentral } = useERP();
  const [activeTab, setActiveTab] = useState("visao"); // visao | dre | fluxo | margens

  // Renderização da Aba de Visão Geral
  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-10"><Wallet size={120} /></div>
          <div className="relative z-10">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Saldo em Contas</p>
            <p className="text-3xl md:text-4xl font-black tracking-tighter">{fmtBRL(MOCK_SALDO)}</p>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-400">
              <TrendingUp size={14}/> +R$ 2.450 hoje
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Lucratividade Mês</p>
              <p className="text-3xl md:text-4xl font-black tracking-tighter text-slate-800">{MOCK_LUCRO_PCT}%</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><BarChart3 size={20}/></div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Alvo da rede: 15%</p>
        </Card>

        <Card className={`p-6 border-l-4 ${MOCK_CMV_PCT > 30 ? "border-l-orange-500" : "border-l-emerald-500"}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">CMV Atual</p>
              <p className="text-3xl md:text-4xl font-black tracking-tighter text-slate-800">{MOCK_CMV_PCT}%</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${MOCK_CMV_PCT > 30 ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"}`}>
              {MOCK_CMV_PCT > 30 ? <AlertCircle size={20}/> : <TrendingDown size={20}/>}
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-3">Limite saudável: 30%</p>
        </Card>
      </div>

      {/* Alertas Financeiros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">A Pagar (Próx 7 dias)</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><TrendingDown size={16}/></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Folha de Pagamento</p>
                  <p className="text-xs font-medium text-slate-500">Vence em 2 dias</p>
                </div>
              </div>
              <p className="text-sm font-black text-slate-800">R$ 18.500,00</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><TrendingDown size={16}/></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Aluguel do Ponto</p>
                  <p className="text-xs font-medium text-slate-500">Vence em 5 dias</p>
                </div>
              </div>
              <p className="text-sm font-black text-slate-800">R$ 12.000,00</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">A Receber (Próx 7 dias)</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><TrendingUp size={16}/></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Repasse iFood</p>
                  <p className="text-xs font-medium text-slate-500">Entra amanhã</p>
                </div>
              </div>
              <p className="text-sm font-black text-slate-800">R$ 4.250,00</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><TrendingUp size={16}/></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Adquirente (Stone)</p>
                  <p className="text-xs font-medium text-slate-500">Entra em 3 dias</p>
                </div>
              </div>
              <p className="text-sm font-black text-slate-800">R$ 8.900,00</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  // Renderização da Aba de DRE
  const renderDRE = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Demonstrativo de Resultado (DRE)</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Mês atual consolidado</p>
        </div>
        <button className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-colors">
          <Download size={16}/> Exportar PDF
        </button>
      </div>
      <div className="p-2">
        {MOCK_DRE.map((linha, idx) => (
          <div key={linha.id} className={`flex items-center justify-between p-3 px-4 rounded-lg ${linha.destaque ? 'bg-slate-800 text-white mt-2' : 'hover:bg-slate-50'} transition-colors`}>
            <div className="flex items-center gap-3">
              {linha.alerta && !linha.destaque && <AlertCircle size={16} className="text-orange-500"/>}
              <span className={`text-sm ${linha.bold ? 'font-black' : 'font-medium pl-6'} ${linha.destaque ? 'text-white' : 'text-slate-700'}`}>
                {linha.categoria}
              </span>
            </div>
            <span className={`text-sm font-black tracking-tight ${linha.destaque ? 'text-emerald-400' : linha.tipo === 'negativo' ? 'text-red-500' : 'text-slate-800'}`}>
              {fmtBRL(linha.valor)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );

  // Renderização da Aba de Fluxo de Caixa
  const renderFluxo = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="text-lg font-black text-slate-800 tracking-tighter">Extrato Diário</h3>
        <button className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-colors">
          <Filter size={16}/> Filtrar
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {MOCK_FLUXO.map((item) => (
          <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {item.tipo === 'entrada' ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{item.desc}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.data}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.cat}</span>
                </div>
              </div>
            </div>
            <span className={`text-base font-black tracking-tight ${item.tipo === 'entrada' ? 'text-emerald-600' : 'text-slate-800'}`}>
              {item.tipo === 'entrada' ? '+' : ''}{fmtBRL(item.valor)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* HEADER DA TORRE FINANCEIRA */}
      <div className="px-4 pt-8 md:pt-12 pb-6 bg-[var(--surface)] sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Administração</p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter text-slate-800">Centro Financeiro.</h1>
            <p className="text-sm font-semibold text-slate-500 mt-2">Visão gerencial da unidade <span className="text-slate-800 font-bold">{unidadeInfo.nome}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
              <Plus size={18} /> Novo Lançamento
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="max-w-6xl mx-auto mt-8 flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {[
            { id: "visao", label: "Visão Geral", icon: BarChart3 },
            { id: "dre", label: "DRE", icon: FileText },
            { id: "fluxo", label: "Fluxo de Caixa", icon: Receipt },
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
          {activeTab === "dre" && renderDRE()}
          {activeTab === "fluxo" && renderFluxo()}
        </div>
      </PageBody>
    </div>
  );
}
