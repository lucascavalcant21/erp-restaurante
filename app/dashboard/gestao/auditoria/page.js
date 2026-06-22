"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldAlert, TrendingDown, PackageMinus, Search, ChevronRight, Activity, Percent } from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, fmtBRL
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchRelatorioPerdas } from "../../../lib/auditoria";

export default function AuditoriaPerdasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [relatorio, setRelatorio] = useState([]);
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchRelatorioPerdas(unidadeAtiva, dias);
    setRelatorio(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line
  }, [unidadeAtiva, dias]);

  // Indicadores Consolidados
  const resumo = useMemo(() => {
    let prejuizoTotal = 0;
    let vendasTotais = 0;
    let perdasManuaisTotais = 0;
    let itensCriticos = 0;

    relatorio.forEach(item => {
      prejuizoTotal += item.prejuizo;
      vendasTotais += item.teorico_vendas;
      perdasManuaisTotais += item.perda_manual;
      if (item.status === "critico") itensCriticos++;
    });

    const taxaGeral = (vendasTotais + perdasManuaisTotais) > 0 
      ? (perdasManuaisTotais / (vendasTotais + perdasManuaisTotais)) * 100 
      : 0;

    return { prejuizoTotal, vendasTotais, perdasManuaisTotais, taxaGeral, itensCriticos };
  }, [relatorio]);

  const filtrados = useMemo(() => {
    return relatorio.filter(item => {
      if (!busca) return true;
      return item.nome.toLowerCase().includes(busca.toLowerCase());
    });
  }, [relatorio, busca]);

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Auditoria & Perdas" 
        subtitle={`Monitoramento de desperdícios e furtos vs vendas · ${unidadeInfo.nome}`} 
        icon={ShieldAlert}
        onAction={carregar} 
        actionLabel="Atualizar Dados"
      />

      <PageBody>
        {/* Filtro de Dias (Chips) */}
        <div className="flex justify-center mb-6">
          <Chips 
            options={[
              { value: 7, label: "Últimos 7 dias" },
              { value: 15, label: "Últimos 15 dias" },
              { value: 30, label: "Últimos 30 dias" },
              { value: 90, label: "Últimos 90 dias" },
            ]} 
            value={dias} 
            onChange={v => setDias(Number(v))} 
          />
        </div>

        {/* Alerta Geral (se a taxa da rede estiver muito alta) */}
        {resumo.taxaGeral > 5 && (
          <Card style={{ background: "rgba(239,68,68,0.12)", borderColor: "#EF4444", marginBottom: 20 }} className="flex items-start gap-3">
            <TrendingDown size={22} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#DC2626" }}>Alerta Crítico: Desperdício Acima da Média!</p>
              <p className="text-[12px]" style={{ color: "var(--fg-soft)" }}>A taxa média de perdas da sua operação está em <b style={{ color: "#DC2626" }}>{resumo.taxaGeral.toFixed(1)}%</b> (o normal é manter abaixo de 3~5%). Faça uma contagem urgente dos insumos com selo vermelho.</p>
            </div>
          </Card>
        )}

        <KpiGrid>
          <Kpi icon={TrendingDown} label={`Prejuízo Estimado (${dias}d)`} value={fmtBRL(resumo.prejuizoTotal)} tint={resumo.prejuizoTotal > 0 ? "#EF4444" : "var(--muted)"} />
          <Kpi icon={Percent} label="Taxa Global de Perda" value={`${resumo.taxaGeral.toFixed(1)}%`} tint={resumo.taxaGeral > 5 ? "#EF4444" : resumo.taxaGeral > 2 ? "#F59E0B" : "#10B981"} />
          <Kpi icon={ShieldAlert} label="Insumos Críticos" value={resumo.itensCriticos} tint={resumo.itensCriticos > 0 ? "#EF4444" : "var(--muted)"} />
          <Kpi icon={PackageMinus} label="Baixas Manuais (Un)" value={resumo.perdasManuaisTotais} tint="#8B5CF6" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Procurar insumo analisado..." />

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-4">
            <Activity size={48} className="animate-pulse" style={{ color: "var(--dim)" }} />
            <p style={{ color: "var(--dim)", fontWeight: 600 }}>Cruzando fichas técnicas com baixas de inventário...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="Nenhuma perda registrada!" hint={`Não houveram saídas manuais ou ajustes negativos nos últimos ${dias} dias.`} />
        ) : (
          <div className="grid gap-3">
            <p className="erp-label mb-1">Ranking de Insumos com Maiores Divergências</p>
            
            {filtrados.map(item => {
              const critico = item.status === "critico";
              const alerta = item.status === "alerta";
              const corStatus = critico ? "#EF4444" : alerta ? "#F59E0B" : "var(--dim)";
              
              return (
                <Card key={item.estoque_id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4" style={critico ? { borderLeft: "4px solid #EF4444", background: "rgba(239,68,68,0.03)" } : { borderLeft: "4px solid var(--line)" }}>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{item.nome}</p>
                      {critico && <span className="erp-badge erp-badge-danger">Vazamento Crítico</span>}
                      {alerta && <span className="erp-badge erp-badge-warning">Alerta</span>}
                    </div>
                    <p className="text-xs" style={{ color: "var(--dim)" }}>
                      Categoria: {item.categoria || "N/A"} · Custo Unitário: {fmtBRL(item.custo_unitario)}
                    </p>
                  </div>

                  <div className="flex gap-6 items-center flex-wrap">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Vendas (Teórico)</p>
                      <p className="text-lg font-black" style={{ color: "var(--fg)" }}>{item.teorico_vendas}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Baixa Manual</p>
                      <p className="text-lg font-black" style={{ color: critico ? "#EF4444" : "var(--fg)" }}>{item.perda_manual}</p>
                    </div>

                    <div className="text-right bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Taxa %</p>
                      <p className="text-xl font-black" style={{ color: corStatus }}>{item.taxa_perda.toFixed(1)}%</p>
                    </div>

                    <div className="text-right bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-28">
                      <p className="text-[10px] font-bold uppercase text-slate-600">Ralo Financeiro</p>
                      <p className="text-lg font-black text-slate-600">{fmtBRL(item.prejuizo)}</p>
                    </div>
                  </div>

                </Card>
              );
            })}
          </div>
        )}
      </PageBody>
    </div>
  );
}
