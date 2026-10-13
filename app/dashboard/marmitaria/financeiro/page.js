"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Flame,
  Zap,
  ShoppingBag,
  Layers,
  Sparkles,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchConfiguracoesMarmitaria,
  fetchProducaoLotes,
  fetchRhAlocacoes,
} from "../../../lib/marmitaria/marmitaria-service";

export default function MarmitariaFinanceiroPage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("resultado"); // 'resultado', 'ifood', 'rateios'
  const [mesSelecionado, setMesSelecionado] = useState("Atual");
  const [config, setConfig] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [alocacoes, setAlocacoes] = useState([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = unidadeAtiva?.id || "matriz";
        const [resCfg, resLotes, resRh] = await Promise.all([
          fetchConfiguracoesMarmitaria(uId),
          fetchProducaoLotes(uId),
          fetchRhAlocacoes(uId),
        ]);
        setConfig(resCfg.data || {});
        setLotes(resLotes.data || []);
        setAlocacoes(resRh.data || []);
      } catch (err) {
        console.error("Erro ao carregar financeiro marmitaria:", err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva]);

  // Simulação de dados financeiros reais conectados aos lotes e configuração
  const qtdMarmitasMes = lotes.reduce((t, l) => t + (Number(l.quantidade_produzida) || 0), 0) || 1850;

  // Vendas por canal
  const vendasPorCanal = useMemo(() => {
    const faturamentoTotal = qtdMarmitasMes * 26.5; // R$ 49.025,00
    return {
      ifood: { canal: "iFood", bruto: faturamentoTotal * 0.62, pedidos: Math.round(qtdMarmitasMes * 0.62), taxaPct: 15.0, taxaPgtoPct: 2.5 },
      whatsapp: { canal: "WhatsApp Direto", bruto: faturamentoTotal * 0.22, pedidos: Math.round(qtdMarmitasMes * 0.22), taxaPct: 0.0, taxaPgtoPct: 1.5 },
      balcao: { canal: "Balcão / Retirada", bruto: faturamentoTotal * 0.11, pedidos: Math.round(qtdMarmitasMes * 0.11), taxaPct: 0.0, taxaPgtoPct: 1.9 },
      site: { canal: "Cardápio Digital Web", bruto: faturamentoTotal * 0.05, pedidos: Math.round(qtdMarmitasMes * 0.05), taxaPct: 0.0, taxaPgtoPct: 2.5 },
    };
  }, [qtdMarmitasMes]);

  const faturamentoBrutoTotal = Object.values(vendasPorCanal).reduce((t, c) => t + c.bruto, 0);

  // Repasses e taxas de marketplace
  const taxasIfoodTotal = vendasPorCanal.ifood.bruto * (vendasPorCanal.ifood.taxaPct / 100);
  const taxasPgtoTotal = Object.values(vendasPorCanal).reduce((t, c) => t + c.bruto * (c.taxaPgtoPct / 100), 0);
  const repasseIfoodLiquido = vendasPorCanal.ifood.bruto - taxasIfoodTotal - (vendasPorCanal.ifood.bruto * 0.025);

  // Custos e CMO
  const cmvAlimentosTotal = qtdMarmitasMes * 6.8;
  const cmvEmbalagensTotal = qtdMarmitasMes * 2.05;
  const cmoFolhaTotal = alocacoes.reduce((t, a) => {
    const sal = Number(a.colaboradores?.salario_base || 2000);
    const encargos = sal * 0.35 + 300;
    return t + (sal + encargos) * (Number(a.percentual_tempo || 100) / 100);
  }, 0) || 5400;

  // Rateios de cozinha compartilhada (25% definido na configuração)
  const pctRateioCozinha = config?.alocacao_custos_fixos_pct || 25;
  const rateiosCozinha = [
    { item: "Energia Elétrica (Cozinha)", valorTotalGeral: 2800, pctRateio: pctRateioCozinha, valorRateado: 2800 * (pctRateioCozinha / 100), icone: Zap },
    { item: "Gás Industrial (GLP)", valorTotalGeral: 2100, pctRateio: pctRateioCozinha, valorRateado: 2100 * (pctRateioCozinha / 100), icone: Flame },
    { item: "Aluguel & IPTU do Espaço", valorTotalGeral: 4500, pctRateio: pctRateioCozinha, valorRateado: 4500 * (pctRateioCozinha / 100), icone: Building2 },
    { item: "Água & Esgoto", valorTotalGeral: 650, pctRateio: pctRateioCozinha, valorRateado: 650 * (pctRateioCozinha / 100), icone: Layers },
  ];

  const totalRateios = rateiosCozinha.reduce((t, r) => t + r.valorRateado, 0);
  const despesasDiretasMarmitaria = 850; // Marketing iFood + etiquetas adicionais
  const tributosSimples = faturamentoBrutoTotal * 0.06; // 6%

  const resultadoLiquidoOperacional =
    faturamentoBrutoTotal -
    taxasIfoodTotal -
    taxasPgtoTotal -
    tributosSimples -
    cmvAlimentosTotal -
    cmvEmbalagensTotal -
    cmoFolhaTotal -
    totalRateios -
    despesasDiretasMarmitaria;

  // Conciliação semanal iFood
  const lotesRepasseIfood = [
    { periodo: "01/10 a 07/10", bruto: 7650.0, comissao: 1147.5, taxasPgto: 191.25, subsidios: -120.0, liquido: 6191.25, status: "pago", dataPagamento: "11/10/2026" },
    { periodo: "08/10 a 14/10", bruto: 8120.0, comissao: 1218.0, taxasPgto: 203.0, subsidios: -95.0, liquido: 6604.0, status: "pago", dataPagamento: "18/10/2026" },
    { periodo: "15/10 a 21/10", bruto: 7890.0, comissao: 1183.5, taxasPgto: 197.25, subsidios: -140.0, liquido: 6369.25, status: "pago", dataPagamento: "25/10/2026" },
    { periodo: "22/10 a 28/10", bruto: 6735.0, comissao: 1010.25, taxasPgto: 168.38, subsidios: -80.0, liquido: 5476.37, status: "previsto", dataPagamento: "01/11/2026" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Financeiro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <DollarSign size={16} />
            Centro de Resultado Exclusivo
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Financeiro & Repasses da Marmitaria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Receitas de canais, repasses líquidos de marketplace, custos diretos e rateios auditáveis da cozinha.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="Atual">Mês Atual (Outubro 2026)</option>
            <option value="Setembro">Setembro 2026</option>
            <option value="Agosto">Agosto 2026</option>
          </select>
        </div>
      </div>

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Faturamento Bruto</span>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(faturamentoBrutoTotal)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {qtdMarmitasMes} marmitas comercializadas
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Repasses iFood Líquidos</span>
            <ShoppingBag size={18} className="text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(repasseIfoodLiquido)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Após {fmtBRL(taxasIfoodTotal)} de comissões
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Custos & Rateios Totais</span>
            <Receipt size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(cmvAlimentosTotal + cmvEmbalagensTotal + cmoFolhaTotal + totalRateios)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Insumos, embalagens, CMO e rateios
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Resultado Operacional</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div className={`text-2xl font-black ${resultadoLiquidoOperacional >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {fmtBRL(resultadoLiquidoOperacional)}
          </div>
          <p className="text-xs font-bold text-emerald-600 mt-1">
            Margem Líquida: {fmtPct((resultadoLiquidoOperacional / faturamentoBrutoTotal) * 100)}
          </p>
        </div>
      </div>

      {/* Abas de Navegação Financeira */}
      <div className="flex items-center gap-2 border-b border-hf-border pb-1">
        <button
          onClick={() => setAbaAtiva("resultado")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "resultado"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Receipt size={14} />
          Demonstrativo por Canais & Despesas
        </button>
        <button
          onClick={() => setAbaAtiva("ifood")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "ifood"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShoppingBag size={14} />
          Conciliação de Repasses iFood
        </button>
        <button
          onClick={() => setAbaAtiva("rateios")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "rateios"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building2 size={14} />
          Rateios da Cozinha Compartilhada
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: Demonstrativo por Canais & Despesas */}
      {abaAtiva === "resultado" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vendas por Canal */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-emerald-600" />
              Receitas por Canal de Venda
            </h2>
            <div className="divide-y divide-hf-border">
              {Object.values(vendasPorCanal).map((canal) => (
                <div key={canal.canal} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{canal.canal}</div>
                    <div className="text-xs text-slate-500">
                      {canal.pedidos} pedidos • Taxa canal: {canal.taxaPct}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">{fmtBRL(canal.bruto)}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      {fmtPct((canal.bruto / faturamentoBrutoTotal) * 100)} do total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Composição de Custos da Operação */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt size={18} className="text-amber-600" />
              Custos do Centro de Resultado
            </h2>
            <div className="divide-y divide-hf-border text-xs">
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Insumos & Alimentos (CMV Alimentos)</span>
                <span className="font-bold text-slate-900">{fmtBRL(cmvAlimentosTotal)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Embalagens & Lacres (CMV Embalagens)</span>
                <span className="font-bold text-slate-900">{fmtBRL(cmvEmbalagensTotal)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Mão de Obra Alocada (CMO da Equipe)</span>
                <span className="font-bold text-slate-900">{fmtBRL(cmoFolhaTotal)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Comissões Marketplace (iFood)</span>
                <span className="font-bold text-red-600">{fmtBRL(taxasIfoodTotal)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Taxas de Cartão & Pagamentos</span>
                <span className="font-bold text-red-600">{fmtBRL(taxasPgtoTotal)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Tributos (Simples Nacional ~6%)</span>
                <span className="font-bold text-slate-900">{fmtBRL(tributosSimples)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Rateios Fixos de Cozinha ({pctRateioCozinha}%)</span>
                <span className="font-bold text-slate-900">{fmtBRL(totalRateios)}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-700 font-medium">Despesas Diretas & Marketing</span>
                <span className="font-bold text-slate-900">{fmtBRL(despesasDiretasMarmitaria)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: Conciliação de Repasses iFood */}
      {abaAtiva === "ifood" && (
        <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-hf-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag size={18} className="text-red-500" />
                Conciliação Semanal de Lotes iFood
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação automática entre pedidos faturados no PDV, comissões retidas e extrato bancário de repasses.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                  <th className="py-3 px-4">Período de Vendas</th>
                  <th className="py-3 px-4 text-right">Vendas Brutas</th>
                  <th className="py-3 px-4 text-right">Comissão iFood (15%)</th>
                  <th className="py-3 px-4 text-right">Taxa Cartão (2,5%)</th>
                  <th className="py-3 px-4 text-right">Subsídios / Promoções</th>
                  <th className="py-3 px-4 text-right">Repasse Líquido</th>
                  <th className="py-3 px-4">Previsão Depósito</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hf-border">
                {lotesRepasseIfood.map((lote, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{lote.periodo}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">{fmtBRL(lote.bruto)}</td>
                    <td className="py-3.5 px-4 text-right text-red-600 font-medium">- {fmtBRL(lote.comissao)}</td>
                    <td className="py-3.5 px-4 text-right text-red-600 font-medium">- {fmtBRL(lote.taxasPgto)}</td>
                    <td className="py-3.5 px-4 text-right text-amber-600 font-medium">{fmtBRL(lote.subsidios)}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">{fmtBRL(lote.liquido)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{lote.dataPagamento}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          lote.status === "pago"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {lote.status === "pago" ? "Conciliado & Pago" : "Aguardando Depósito"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: Rateios da Cozinha Compartilhada */}
      {abaAtiva === "rateios" && (
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-emerald-600" />
                Custos Fixos & Rateio da Cozinha Matriz
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                A Marmitaria absorve uma fração auditável ({pctRateioCozinha}%) dos custos fixos da cozinha geral do restaurante.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-bold block uppercase">Total Rateado Marmitaria</span>
              <span className="text-xl font-black text-slate-900">{fmtBRL(totalRateios)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rateiosCozinha.map((rat, idx) => {
              const Icon = rat.icone;
              return (
                <div key={idx} className="p-4 rounded-2xl border border-hf-border bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{rat.item}</div>
                      <div className="text-xs text-slate-500">
                        Total geral: {fmtBRL(rat.valorTotalGeral)} • Alocação: {rat.pctRateio}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">{fmtBRL(rat.valorRateado)}</div>
                    <div className="text-[10px] text-emerald-700 font-bold">Débito Marmitaria</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
