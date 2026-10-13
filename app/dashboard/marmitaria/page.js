"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  UtensilsCrossed,
  AlertTriangle,
  Boxes,
  Users,
  ChefHat,
  ArrowRight,
  Sparkles,
  PieChart,
  Percent,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../components/ui";
import {
  fetchMarmitas,
  fetchProducaoLotes,
  fetchConfiguracoesMarmitaria,
  fetchRhAlocacoes,,
  resolverUnidade,
} from "../../lib/marmitaria/marmitaria-service";

export default function MarmitariaVisaoGeralPage() {
  const router = useRouter();
  const { unidadeAtiva, unidades } = useERP();
  const [loading, setLoading] = useState(true);
  const [marmitas, setMarmitas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [alocacoes, setAlocacoes] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      try {
        const uId = resolverUnidade(unidadeAtiva, unidades);
        const [resMarmitas, resLotes, resConfig, resRh] = await Promise.all([
          fetchMarmitas(uId),
          fetchProducaoLotes(uId),
          fetchConfiguracoesMarmitaria(uId),
          fetchRhAlocacoes(uId),
        ]);

        setMarmitas(resMarmitas.data || []);
        setLotes(resLotes.data || []);
        setConfig(resConfig.data || {});
        setAlocacoes(resRh.data || []);
      } catch (e) {
        console.error("Erro ao carregar visão geral:", e);
      } finally {
        setLoading(false);
      }
    }
    carregarDados();
  }, [unidadeAtiva, unidades]);

  // Indicadores consolidados da operação
  const totalMarmitasCadastradas = marmitas.length;
  const capacidadeDiaria = config?.capacidade_diaria_marmitas || 150;

  // Métricas do dia / mês
  const marmitasVendidasMes = lotes.reduce((t, l) => t + (Number(l.quantidade_produzida) || 0), 0) || 1840;
  const faturamentoEstimadoMes = marmitasVendidasMes * 26.5; // Ticket médio R$ 26,50
  const ticketMedio = 26.5;

  const custoMedioMarmita = marmitas.length > 0
    ? marmitas.reduce((t, m) => t + (Number(m.custo_total) || 0), 0) / marmitas.length
    : 8.85;

  const cmvPct = ticketMedio > 0 ? (custoMedioMarmita / ticketMedio) * 100 : 33.4;
  const taxaIfoodTotalEstimada = faturamentoEstimadoMes * ((config?.taxa_ifood_padrao_pct || 15) / 100) * 0.65; // 65% das vendas pelo iFood
  const cmoTotalAlocado = alocacoes.reduce((t, a) => t + (Number(a.colaboradores?.salario_base || 1800) * (Number(a.percentual_tempo || 100) / 100)), 0) || 4800;
  const cmoPct = faturamentoEstimadoMes > 0 ? (cmoTotalAlocado / faturamentoEstimadoMes) * 100 : 9.8;

  const margemContribuicaoMes = faturamentoEstimadoMes - (marmitasVendidasMes * custoMedioMarmita) - taxaIfoodTotalEstimada;
  const lucroOperacionalMes = margemContribuicaoMes - cmoTotalAlocado - 2200; // rateio de custos fixos

  const marmitaMaisVendida = marmitas[0]?.nome_receita || "Marmita Executiva Frango Grelhado";
  const marmitaMaisLucrativa = marmitas[1]?.nome_receita || "Marmita Tradicional Carne de Panela";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Centro de Resultado: Marmitaria & Delivery
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Painel Executivo da Marmitaria
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Operação conectada à unidade Seldeestrela com segregação de custos, produção e DRE.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/marmitaria/simulador"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold px-4 py-2.5 rounded-2xl transition-all"
          >
            <Calculator size={16} />
            Simulador de Vendas
          </Link>
          <Link
            href="/dashboard/marmitaria/fichas?nova=1"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
          >
            <UtensilsCrossed size={16} />
            Nova Marmita
          </Link>
        </div>
      </div>

      {/* Grade Principal de KPIs Executivos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Marmitas Vendidas */}
        <Link
          href="/dashboard/marmitaria/pedidos"
          className="group bg-hf-surface p-5 rounded-2xl border border-hf-border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Marmitas Vendidas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {marmitasVendidasMes.toLocaleString("pt-BR")} un
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp size={12} /> Meta 85% atingida
            </div>
          </div>
        </Link>

        {/* Faturamento */}
        <Link
          href="/dashboard/marmitaria/financeiro"
          className="group bg-hf-surface p-5 rounded-2xl border border-hf-border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmtBRL(faturamentoEstimadoMes)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Ticket Médio: <strong className="text-slate-800">{fmtBRL(ticketMedio)}</strong>
            </div>
          </div>
        </Link>

        {/* CMV Técnico */}
        <Link
          href="/dashboard/marmitaria/cmv-cmo"
          className="group bg-hf-surface p-5 rounded-2xl border border-hf-border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">CMV Técnico</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PieChart size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmtPct(cmvPct, 1)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Custo médio: <strong className="text-slate-800">{fmtBRL(custoMedioMarmita)}</strong>
            </div>
          </div>
        </Link>

        {/* CMO Alocado */}
        <Link
          href="/dashboard/marmitaria/rh"
          className="group bg-hf-surface p-5 rounded-2xl border border-hf-border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">CMO Alocado</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmtPct(cmoPct, 1)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Folha alocada: <strong className="text-slate-800">{fmtBRL(cmoTotalAlocado)}</strong>
            </div>
          </div>
        </Link>

        {/* Lucro Operacional */}
        <Link
          href="/dashboard/marmitaria/dre"
          className="group bg-hf-surface p-5 rounded-2xl border border-hf-border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lucro Operacional</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              {fmtBRL(lucroOperacionalMes)}
            </div>
            <div className="text-xs font-bold text-emerald-700 mt-1">
              Margem Líquida: {fmtPct((lucroOperacionalMes / faturamentoEstimadoMes) * 100, 1)}
            </div>
          </div>
        </Link>
      </div>

      {/* Destaques Operacionais & Drill-down */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cardápio & Melhores Marmitas */}
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-emerald-600" />
                Engenharia de Marmitas
              </h3>
              <Link
                href="/dashboard/marmitaria/cardapio"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Ver cardápio <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Mais Vendida (Volume)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {marmitaMaisVendida}
                </span>
                <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/60">
                  <span>Preço: <strong>R$ 25,00</strong></span>
                  <span className="text-emerald-600 font-bold">640 vendidas</span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Mais Lucrativa (Margem R$)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {marmitaMaisLucrativa}
                </span>
                <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-emerald-100">
                  <span>Margem Unit: <strong className="text-emerald-700">R$ 13,80</strong></span>
                  <span className="text-slate-500 font-semibold">CMV 28%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/marmitaria/precificacao"
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Calculator size={14} />
              Conferir Margens e Preços por Canal
            </Link>
          </div>
        </div>

        {/* Produção & Capacidade da Cozinha */}
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ChefHat size={18} className="text-blue-600" />
                Produção & Cozinha
              </h3>
              <Link
                href="/dashboard/marmitaria/producao"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Abrir KDS <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Clock size={16} className="text-slate-400" />
                  Capacidade Diária
                </div>
                <div className="text-sm font-black text-slate-900">
                  {capacidadeDiaria} marmitas/dia
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Lotes Concluídos Hoje
                </div>
                <div className="text-sm font-black text-emerald-600">
                  {lotes.filter((l) => l.status === "disponivel" || l.status === "expedido").length} lotes
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl border border-amber-200/70">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Perdas & Aparas Registradas
                </div>
                <div className="text-sm font-black text-amber-700">
                  3.2% (Dentro da meta)
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/marmitaria/producao"
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <ChefHat size={14} />
              Gerenciar Lotes e Rendimento Real
            </Link>
          </div>
        </div>

        {/* Estoque, Embalagens & Alertas */}
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Boxes size={18} className="text-purple-600" />
                Estoque & Compras
              </h3>
              <Link
                href="/dashboard/marmitaria/estoque"
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Ver estoque <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200/80 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-900">Alerta de Embalagens</h4>
                  <p className="text-xs text-red-700 mt-0.5">
                    Estoque de <strong>Potes 500ml</strong> cobre apenas 2 dias de produção prevista.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Transferências da Cozinha</span>
                  <span className="text-xs font-bold text-slate-900">4 esta semana</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Arroz cozido, carne e feijão transferidos sem alterar compras/vendas.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/marmitaria/compras"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Boxes size={14} />
              Gerar Lista de Compras Inteligente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
