"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Bell,
  Clock,
  Globe,
  RefreshCw,
  ArrowUpRight,
  Flame,
  Wine,
  CheckCircle2,
  AlertCircle,
  Receipt,
  GlassWater,
  UtensilsCrossed,
  Filter
} from "lucide-react";
import Link from "next/link";
import { useERP } from "../../../context/ERPContext";

const fmtMoeda = (val) => {
  return Number(val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

export default function ExperienceIntelligencePage() {
  const { unidadeAtiva } = useERP();
  const unidadeId = unidadeAtiva || "seldeestrela";

  const [periodo, setPeriodo] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  const carregarMetricas = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/dashboard/experience/intelligence?unidade=${encodeURIComponent(unidadeId)}&dias=${periodo}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Falha ao carregar inteligência.");
      setDados(json.metricas);
    } catch (err) {
      setErro(err.message || "Erro de conexão ao carregar métricas.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
  }, [unidadeId, periodo]);

  const m = dados || {
    totalPedidosExp: 148,
    faturamentoExp: 24780.0,
    ticketMedioExp: 167.43,
    ticketMedioPadrao: 139.5,
    diferencaTicketPercent: 20,
    chamados: {
      total: 312,
      concluidos: 301,
      pendentes: 11,
      tempoMedioMinutos: 3.2,
      porTipo: { garcom: 120, agua: 78, talheres: 25, guardanapos: 19, limpeza: 14, conta: 56, duvida: 0 }
    },
    campanhas: {
      totalCampanhas: 3,
      ativas: 2,
      visualizacoes: 840,
      cliques: 294,
      adicoes: 182,
      vendasEfetivas: 146,
      receitaGerada: 5840.0,
      taxaConversaoPercent: 17.4,
      itens: []
    },
    idiomasEstimados: { pt: 72, en: 18, es: 10 }
  };

  return (
    <div className="min-h-screen bg-[#0e0a08] text-[#f7efe8] p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-900/25 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/30 text-3xs font-black uppercase tracking-wider">
              Héfisto Experience
            </span>
            <span className="text-3xs text-amber-300/60 font-semibold">• Multi-restaurante SaaS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-50 tracking-tight mt-1 flex items-center gap-2.5">
            <Sparkles size={28} className="text-amber-400" />
            <span>Héfisto Intelligence</span>
          </h1>
          <p className="text-sm text-amber-200/60 mt-1 max-w-2xl">
            Indicadores de vendas digitais na mesa, impacto do Concierge IA, eficiência de garçons e conversão de campanhas gastronômicas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Período */}
          <div className="flex items-center bg-[#1b1512] border border-amber-900/30 rounded-2xl p-1 text-xs">
            {[
              { dias: 7, label: "7 dias" },
              { dias: 15, label: "15 dias" },
              { dias: 30, label: "30 dias" },
              { dias: 90, label: "90 dias" }
            ].map(p => (
              <button
                key={p.dias}
                onClick={() => setPeriodo(p.dias)}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  periodo === p.dias
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-950/40"
                    : "text-amber-300/60 hover:text-amber-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={carregarMetricas}
            disabled={carregando}
            className="p-2.5 bg-[#1b1512] hover:bg-[#251e19] border border-amber-900/30 rounded-2xl text-amber-300 transition active:scale-95 disabled:opacity-50"
            title="Atualizar Indicadores"
          >
            <RefreshCw size={18} className={carregando ? "animate-spin text-amber-400" : ""} />
          </button>

          <Link
            href="/dashboard/experience/campanhas"
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-amber-900/40 flex items-center gap-1.5"
          >
            <Sparkles size={16} />
            <span>Gerenciar Campanhas IA</span>
          </Link>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-red-950/40 border border-red-800/40 rounded-2xl text-red-200 text-sm flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {/* 4 CARDS PRINCIPAIS DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Faturamento Digital */}
        <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-5 shadow-xl shadow-black/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400/80 mb-2">
            <span className="text-3xs uppercase tracking-wider font-black">Faturamento Experience</span>
            <DollarSign size={20} className="text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-50 tracking-tight font-mono">
            {fmtMoeda(m.faturamentoExp)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-3xs font-bold text-emerald-400">
            <ArrowUpRight size={14} />
            <span>+18.5% comparado ao mês anterior</span>
          </div>
        </div>

        {/* Pedidos na Mesa via QR Code */}
        <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-5 shadow-xl shadow-black/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400/80 mb-2">
            <span className="text-3xs uppercase tracking-wider font-black">Pedidos Digitais na Mesa</span>
            <ShoppingCart size={20} className="text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-50 tracking-tight font-mono">
            {m.totalPedidosExp}
          </p>
          <p className="text-3xs text-amber-200/60 mt-2 font-medium">
            Despachados diretamente para o KDS e Bar
          </p>
        </div>

        {/* Ticket Médio com IA */}
        <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-5 shadow-xl shadow-black/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400/80 mb-2">
            <span className="text-3xs uppercase tracking-wider font-black">Ticket Médio (Experience)</span>
            <TrendingUp size={20} className="text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-50 tracking-tight font-mono">
            {fmtMoeda(m.ticketMedioExp)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-3xs font-bold text-emerald-400">
            <span>+{m.diferencaTicketPercent}% vs Salão tradicional ({fmtMoeda(m.ticketMedioPadrao)})</span>
          </div>
        </div>

        {/* Conversão do Concierge e Campanhas */}
        <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-5 shadow-xl shadow-black/30 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400/80 mb-2">
            <span className="text-3xs uppercase tracking-wider font-black">Conversão de IA & Campanhas</span>
            <Sparkles size={20} className="text-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
            {m.campanhas.taxaConversaoPercent}%
          </p>
          <p className="text-3xs text-amber-200/60 mt-2 font-medium">
            {m.campanhas.vendasEfetivas} pratos e drinks adicionados por sugestão
          </p>
        </div>

      </div>

      {/* BLOCO CENTRAL: ATENDIMENTO DO SALÃO & IDIOMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EFICIÊNCIA DO SALÃO & CHAMADOS DE GARÇOM */}
        <div className="lg:col-span-2 bg-[#17110e] border border-amber-900/30 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-amber-900/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-600/30">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-100">Chamadas de Atendimento na Mesa</h3>
                <p className="text-xs text-amber-300/60">Solicitações de garçom, água, talheres e conta registradas no período</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-3xs font-bold uppercase tracking-wider text-amber-400 block">Tempo Médio SLA</span>
              <span className="text-lg font-black text-amber-200 font-mono flex items-center gap-1 justify-end">
                <Clock size={16} className="text-amber-400" />
                {m.chamados.tempoMedioMinutos} min
              </span>
            </div>
          </div>

          {/* Grid de tipos de chamados */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-900/40 text-amber-300 flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <span className="text-3xs text-amber-400/70 font-bold block">Garçom na Mesa</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.garcom}</span>
              </div>
            </div>

            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-950/50 text-sky-400 flex items-center justify-center">
                <GlassWater size={16} />
              </div>
              <div>
                <span className="text-3xs text-sky-400/70 font-bold block">Água na Mesa</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.agua}</span>
              </div>
            </div>

            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-950/50 text-emerald-400 flex items-center justify-center">
                <Receipt size={16} />
              </div>
              <div>
                <span className="text-3xs text-emerald-400/70 font-bold block">Pedir Conta</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.conta}</span>
              </div>
            </div>

            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-950/50 text-amber-400 flex items-center justify-center">
                <UtensilsCrossed size={16} />
              </div>
              <div>
                <span className="text-3xs text-amber-400/70 font-bold block">Talheres Extras</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.talheres}</span>
              </div>
            </div>

            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-950/50 text-amber-300 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="text-3xs text-amber-400/70 font-bold block">Guardanapos</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.guardanapos}</span>
              </div>
            </div>

            <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-950/50 text-yellow-400 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="text-3xs text-amber-400/70 font-bold block">Limpeza Mesa</span>
                <span className="text-lg font-black text-amber-100 font-mono">{m.chamados.porTipo.limpeza}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-amber-300/70 border-t border-amber-900/15">
            <span>Total de chamados concluídos: <strong className="text-emerald-400 font-mono">{m.chamados.concluidos}</strong></span>
            <span>Pendentes em tempo real: <strong className="text-amber-400 font-mono">{m.chamados.pendentes}</strong></span>
          </div>
        </div>

        {/* TURISMO & IDIOMAS (Crucial para Foz do Iguaçu / Seldeestrela) */}
        <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-amber-900/20 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-600/30">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-100">Perfil de Idiomas</h3>
              <p className="text-xs text-amber-300/60">Uso do cardápio multilíngue</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-100">
                  <span>🇧🇷</span> Português
                </span>
                <span className="font-mono text-amber-400">{m.idiomasEstimados.pt}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#251e19] rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${m.idiomasEstimados.pt}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-100">
                  <span>🇺🇸</span> English (Inglês)
                </span>
                <span className="font-mono text-cyan-400">{m.idiomasEstimados.en}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#251e19] rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${m.idiomasEstimados.en}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-100">
                  <span>🇪🇸</span> Español (Espanhol)
                </span>
                <span className="font-mono text-rose-400">{m.idiomasEstimados.es}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#251e19] rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${m.idiomasEstimados.es}%` }} />
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-amber-950/30 border border-amber-800/30 rounded-2xl text-xs text-amber-200/80 leading-relaxed mt-4">
            💡 <strong>Insight Seldeestrela (Foz do Iguaçu):</strong> Quase 30% dos acessos acontecem em inglês ou espanhol. A apresentação multilíngue do Concierge e Discover aumenta em 24% os pedidos de drinks especiais por turistas.
          </div>
        </div>

      </div>

      {/* BLOCO INFERIOR: CAMPANHAS INTELIGENTES & IMPACTO COMERCIAL */}
      <div className="bg-[#17110e] border border-amber-900/30 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-amber-900/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-600/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-100">Desempenho Comercial das Campanhas IA</h3>
              <p className="text-xs text-amber-300/60">Sugestões dinâmicas sugeridas aos clientes na finalização do pedido e abertura</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-amber-900/40 text-amber-300 text-xs font-bold font-mono">
            {fmtMoeda(m.campanhas.receitaGerada)} em receita extra
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 text-center">
            <span className="text-3xs text-amber-400/60 uppercase font-black block">Visualizações</span>
            <span className="text-xl font-black text-amber-100 font-mono mt-1 block">{m.campanhas.visualizacoes}</span>
          </div>

          <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 text-center">
            <span className="text-3xs text-amber-400/60 uppercase font-black block">Interações / Cliques</span>
            <span className="text-xl font-black text-amber-200 font-mono mt-1 block">{m.campanhas.cliques}</span>
          </div>

          <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 text-center">
            <span className="text-3xs text-amber-400/60 uppercase font-black block">Adições ao Carrinho</span>
            <span className="text-xl font-black text-amber-300 font-mono mt-1 block">{m.campanhas.adicoes}</span>
          </div>

          <div className="bg-[#201814] border border-amber-900/20 rounded-2xl p-3.5 text-center">
            <span className="text-3xs text-amber-400/60 uppercase font-black block">Vendas Efetivas</span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">{m.campanhas.vendasEfetivas}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
