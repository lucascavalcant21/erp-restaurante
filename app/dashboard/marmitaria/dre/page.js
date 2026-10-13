"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  TrendingUp,
  Receipt,
  Download,
  Printer,
  Calendar,
  DollarSign,
  PieChart,
  Percent,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Sparkles,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchConfiguracoesMarmitaria,
  fetchProducaoLotes,
  fetchRhAlocacoes,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import { calcularDreGerencialMarmitaria } from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaDrePage() {
  const { unidadeAtiva, unidades } = useERP();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes_atual");
  const [lotes, setLotes] = useState([]);
  const [config, setConfig] = useState(null);
  const [alocacoes, setAlocacoes] = useState([]);
  const tabelaRef = useRef(null);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = resolverUnidade(unidadeAtiva, unidades);
        const [resLotes, resCfg, resRh] = await Promise.all([
          fetchProducaoLotes(uId),
          fetchConfiguracoesMarmitaria(uId),
          fetchRhAlocacoes(uId),
        ]);
        setLotes(resLotes.data || []);
        setConfig(resCfg.data || {});
        setAlocacoes(resRh.data || []);
      } catch (err) {
        console.error("Erro ao carregar DRE:", err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva, unidades]);

  // Volume do período
  const qtdMarmitas = lotes.reduce((t, l) => t + (Number(l.quantidade_produzida) || 0), 0) || 1850;
  const faturamentoTotal = qtdMarmitas * 26.5;

  // Canais
  const canaisVendas = useMemo(() => {
    return {
      ifood: faturamentoTotal * 0.62,
      whatsapp: faturamentoTotal * 0.22,
      balcao: faturamentoTotal * 0.11,
      site: faturamentoTotal * 0.05,
    };
  }, [faturamentoTotal]);

  // CMO Alocado
  const cmoTotal = alocacoes.reduce((t, a) => {
    const sal = Number(a.colaboradores?.salario_base || 2000);
    const encargos = sal * 0.35 + 300;
    return t + (sal + encargos) * ((Number(a.percentual_tempo) || 100) / 100);
  }, 0) || 5400;

  // Rateio cozinha
  const pctRateio = config?.alocacao_custos_fixos_pct || 25;
  const rateiosCozinha = (2800 + 2100 + 4500 + 650) * (pctRateio / 100); // R$ 2.512,50

  // Cálculo da DRE através do motor puro e auditado
  const dre = useMemo(() => {
    return calcularDreGerencialMarmitaria({
      vendasCanais: canaisVendas,
      tributos: faturamentoTotal * 0.06,
      cancelamentosEDescontos: 450.0,
      cmvAlimentos: qtdMarmitas * 6.8,
      cmvEmbalagens: qtdMarmitas * 2.05,
      taxasIfood: canaisVendas.ifood * 0.15,
      taxasMeiosPagamento: faturamentoTotal * 0.022,
      subsidiosEntrega: 320.0,
      cmoAlocado: cmoTotal,
      despesasFixasDiretas: 850.0,
      despesasRateadasCozinha: rateiosCozinha,
      outrasReceitasDespesas: 0,
    });
  }, [canaisVendas, faturamentoTotal, qtdMarmitas, cmoTotal, rateiosCozinha]);

  const imprimirDre = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <TrendingUp size={16} />
            Resultado Econômico & Lucratividade
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            DRE Gerencial — Marmitaria & Delivery
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Demonstração de Resultado do Exercício com separação de CMV, taxas de canais, CMO alocado e rateios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="mes_atual">Mês Vigente (Outubro 2026)</option>
            <option value="mes_anterior">Mês Anterior (Setembro 2026)</option>
            <option value="trimestre">3º Trimestre 2026</option>
          </select>

          <button
            onClick={imprimirDre}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Printer size={15} />
            Imprimir DRE
          </button>
        </div>
      </div>

      {/* Cards de Destaque da DRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Receita Líquida</div>
          <div className="text-2xl font-black text-slate-900">{fmtBRL(dre.receitaLiquida)}</div>
          <p className="text-xs text-slate-500 mt-1">{fmtPct(dre.pctReceitaLiquida)} da bruta</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Margem de Contribuição</div>
          <div className="text-2xl font-black text-blue-700">{fmtBRL(dre.margemContribuicao)}</div>
          <p className="text-xs text-slate-500 mt-1">{fmtPct(dre.pctMargemContribuicao)} da bruta</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">CMV Total (Alimentos+Emb)</div>
          <div className="text-2xl font-black text-amber-700">{fmtBRL(dre.cmvTotal)}</div>
          <p className="text-xs text-slate-500 mt-1">{fmtPct(dre.pctCmvTotal)} da bruta</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Lucro Operacional Líquido</div>
          <div className={`text-2xl font-black ${dre.resultadoOperacional >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {fmtBRL(dre.resultadoOperacional)}
          </div>
          <p className="text-xs font-bold text-emerald-600 mt-1">{fmtPct(dre.pctResultadoOperacional)} de rentabilidade</p>
        </div>
      </div>

      {/* Tabela Estruturada da DRE */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden" ref={tabelaRef}>
        <div className="p-5 border-b border-hf-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Demonstrativo de Resultado Gerencial — Marmitaria & Delivery
            </h2>
            <p className="text-xs text-slate-500">
              Centro de Resultado: <strong>marmitaria</strong> • Competência: Outubro/2026
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Regime de Competência
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                <th className="py-3 px-5">Estrutura de Contas Gerenciais</th>
                <th className="py-3 px-5 text-right w-44">Valor (R$)</th>
                <th className="py-3 px-5 text-right w-28">Análise Vertical (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hf-border">
              {/* 1. RECEITA BRUTA */}
              <tr className="bg-emerald-50/40 font-bold text-slate-900">
                <td className="py-3.5 px-5">(+) RECEITA BRUTA OPERACIONAL</td>
                <td className="py-3.5 px-5 text-right">{fmtBRL(dre.receitaBruta)}</td>
                <td className="py-3.5 px-5 text-right">100,0%</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2 px-5 pl-10">• Vendas iFood Marketplace</td>
                <td className="py-2 px-5 text-right">{fmtBRL(dre.vendasPorCanal.ifood)}</td>
                <td className="py-2 px-5 text-right">{fmtPct((dre.vendasPorCanal.ifood / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2 px-5 pl-10">• Vendas WhatsApp Direto (Entrega Própria)</td>
                <td className="py-2 px-5 text-right">{fmtBRL(dre.vendasPorCanal.whatsapp)}</td>
                <td className="py-2 px-5 text-right">{fmtPct((dre.vendasPorCanal.whatsapp / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2 px-5 pl-10">• Vendas Balcão / Retirada</td>
                <td className="py-2 px-5 text-right">{fmtBRL(dre.vendasPorCanal.balcao)}</td>
                <td className="py-2 px-5 text-right">{fmtPct((dre.vendasPorCanal.balcao / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2 px-5 pl-10">• Vendas Site / Cardápio Digital</td>
                <td className="py-2 px-5 text-right">{fmtBRL(dre.vendasPorCanal.site)}</td>
                <td className="py-2 px-5 text-right">{fmtPct((dre.vendasPorCanal.site / dre.receitaBruta) * 100)}</td>
              </tr>

              {/* 2. DEDUÇÕES */}
              <tr className="text-slate-700 font-semibold bg-slate-50/50">
                <td className="py-2.5 px-5">(-) DEDUÇÕES E TRIBUTOS SOBRE VENDAS</td>
                <td className="py-2.5 px-5 text-right text-red-600">- {fmtBRL(dre.deducoesVendas)}</td>
                <td className="py-2.5 px-5 text-right text-red-600">-{fmtPct((dre.deducoesVendas / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Tributos sobre Faturamento (Simples Nacional ~6%)</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.tributos)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.tributos / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Cancelamentos, Estornos e Cupons da Loja</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.cancelamentosEDescontos)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.cancelamentosEDescontos / dre.receitaBruta) * 100)}</td>
              </tr>

              {/* 3. RECEITA LÍQUIDA */}
              <tr className="bg-slate-100/70 font-bold text-slate-900 border-t border-b border-slate-300">
                <td className="py-3 px-5">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                <td className="py-3 px-5 text-right">{fmtBRL(dre.receitaLiquida)}</td>
                <td className="py-3 px-5 text-right">{fmtPct(dre.pctReceitaLiquida)}</td>
              </tr>

              {/* 4. CMV */}
              <tr className="text-slate-700 font-semibold bg-slate-50/50">
                <td className="py-2.5 px-5">(-) CUSTO DAS MERCADORIAS VENDIDAS (CMV)</td>
                <td className="py-2.5 px-5 text-right text-red-600">- {fmtBRL(dre.cmvTotal)}</td>
                <td className="py-2.5 px-5 text-right text-red-600">-{fmtPct(dre.pctCmvTotal)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• CMV Alimentos & Insumos Culinários</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.cmvAlimentos)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.cmvAlimentos / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• CMV Embalagens, Tampas, Lacres e Sacolas</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.cmvEmbalagens)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.cmvEmbalagens / dre.receitaBruta) * 100)}</td>
              </tr>

              {/* 5. LUCRO BRUTO */}
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="py-2.5 px-5">(=) LUCRO BRUTO</td>
                <td className="py-2.5 px-5 text-right">{fmtBRL(dre.lucroBruto)}</td>
                <td className="py-2.5 px-5 text-right">{fmtPct(dre.pctLucroBruto)}</td>
              </tr>

              {/* 6. DESPESAS VARIÁVEIS */}
              <tr className="text-slate-700 font-semibold bg-slate-50/50">
                <td className="py-2.5 px-5">(-) DESPESAS VARIÁVEIS DE CANAIS & VENDAS</td>
                <td className="py-2.5 px-5 text-right text-red-600">- {fmtBRL(dre.despesasVariaveis)}</td>
                <td className="py-2.5 px-5 text-right text-red-600">-{fmtPct(dre.pctDespesasVariaveis)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Comissões de Marketplace (iFood ~15%)</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.taxasIfood)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.taxasIfood / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Taxas de Adquirentes e Cartões</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.taxasMeiosPagamento)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.taxasMeiosPagamento / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Subsídios de Entrega da Marmitaria</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.subsidiosEntrega)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.subsidiosEntrega / dre.receitaBruta) * 100)}</td>
              </tr>

              {/* 7. MARGEM DE CONTRIBUIÇÃO */}
              <tr className="bg-blue-50/60 font-bold text-blue-900 border-t border-b border-blue-200">
                <td className="py-3 px-5">(=) MARGEM DE CONTRIBUIÇÃO OPERACIONAL</td>
                <td className="py-3 px-5 text-right">{fmtBRL(dre.margemContribuicao)}</td>
                <td className="py-3 px-5 text-right">{fmtPct(dre.pctMargemContribuicao)}</td>
              </tr>

              {/* 8. DESPESAS OPERACIONAIS */}
              <tr className="text-slate-700 font-semibold bg-slate-50/50">
                <td className="py-2.5 px-5">(-) CUSTOS OPERACIONAIS & MÃO DE OBRA (CMO)</td>
                <td className="py-2.5 px-5 text-right text-red-600">- {fmtBRL(dre.despesasOperacionais)}</td>
                <td className="py-2.5 px-5 text-right text-red-600">-{fmtPct(dre.pctDespesasOperacionais)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• CMO Mão de Obra Alocada (Equipe da Marmitaria)</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.cmoAlocado)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.cmoAlocado / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Rateios da Cozinha Matriz (Energia, Gás, Aluguel)</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.despesasRateadasCozinha)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.despesasRateadasCozinha / dre.receitaBruta) * 100)}</td>
              </tr>
              <tr className="text-slate-500">
                <td className="py-1.5 px-5 pl-10">• Despesas Fixas Diretas & Marketing</td>
                <td className="py-1.5 px-5 text-right">{fmtBRL(dre.despesasFixasDiretas)}</td>
                <td className="py-1.5 px-5 text-right">{fmtPct((dre.despesasFixasDiretas / dre.receitaBruta) * 100)}</td>
              </tr>

              {/* 9. RESULTADO OPERACIONAL FINAL */}
              <tr className="bg-emerald-100/70 font-black text-emerald-950 text-sm border-t-2 border-emerald-500">
                <td className="py-4 px-5">(=) RESULTADO OPERACIONAL LÍQUIDO (EBITDA MARMITARIA)</td>
                <td className="py-4 px-5 text-right text-emerald-800">{fmtBRL(dre.resultadoOperacional)}</td>
                <td className="py-4 px-5 text-right text-emerald-800">{fmtPct(dre.pctResultadoOperacional)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
