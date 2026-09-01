"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldAlert, TrendingDown, PackageMinus, Activity, Percent, Mic, CheckCircle2, XCircle } from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, fmtBRL
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchRelatorioPerdas } from "../../../lib/auditoria";
import { fetchAuditoriaHefisto } from "../../../lib/hefisto-acoes";

const rotuloAcao = acao => ({
  "labels.voice_batch": "Etiquetas em lote",
  "labels.print_batch": "Impressão de etiquetas",
  "inventory.ingredients.voice_batch": "Cadastro de ingredientes",
  "inventory.ingredients.import_batch": "Importação de ingredientes",
  "inventory.create_entry_batch": "Entrada no depósito",
  "inventory.create_withdrawal_batch": "Retirada do depósito",
  "inventory.create_entry": "Entrada no estoque",
  "inventory.create_withdrawal": "Retirada do estoque",
  "inventory.entrada": "Entrada no inventário",
  "inventory.quebra": "Baixa por quebra no inventário",
  "inventory.perda": "Baixa por perda no inventário",
  "inventory.descarte": "Baixa por descarte no inventário",
  "inventory.ajuste": "Ajuste de contagem no inventário",
}[acao] || acao || "Ação do assistente");

const dataHoraAuditoria = valor => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "Data não informada" : data.toLocaleString("pt-BR");
};

export default function AuditoriaPerdasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [relatorio, setRelatorio] = useState([]);
  const [acoesAuditadas, setAcoesAuditadas] = useState([]);
  const [erroAuditoria, setErroAuditoria] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setLoading(true);
    const [perdas, acoes] = await Promise.all([
      fetchRelatorioPerdas(unidadeAtiva, dias),
      fetchAuditoriaHefisto(unidadeAtiva, 100),
    ]);
    setRelatorio(perdas.data || []);
    setAcoesAuditadas(acoes.data || []);
    setErroAuditoria(acoes.error || "");
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
        <div className="flex justify-start sm:justify-center mb-6 overflow-x-auto -mx-4 px-4 pb-1">
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
            <div className="min-w-0">
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

        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--fg)" }}><Mic size={17} className="text-violet-600" /> Comandos e ações auditadas</p>
              <p className="mt-1 text-xs" style={{ color: "var(--dim)" }}>Quem fez, o que falou, itens preparados e resultado da confirmação.</p>
            </div>
            <span className="erp-badge">{acoesAuditadas.length} registro(s)</span>
          </div>
          {erroAuditoria ? (
            // Lista vazia porque o banco recusou é problema de instalação, não
            // ausência de movimento — a tela precisa dizer qual dos dois é.
            <Card className="p-4 text-sm">
              <p className="font-black text-rose-600">A auditoria não pôde ser lida.</p>
              <p className="mt-1 break-words" style={{ color: "var(--fg-soft)" }}>{erroAuditoria}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--dim)" }}>Rode db/migracao_auditoria_correcao.sql no SQL Editor do Supabase.</p>
            </Card>
          ) : acoesAuditadas.length === 0 ? (
            <Card className="p-4 text-sm" style={{ color: "var(--dim)" }}>Nenhum comando auditado nesta unidade.</Card>
          ) : (
            <div className="grid gap-2">
              {acoesAuditadas.slice(0, 12).map(registro => {
                const sucesso = registro.resultado === "sucesso";
                return <Card key={registro.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {sucesso ? <CheckCircle2 size={17} className="text-emerald-600" /> : <XCircle size={17} className="text-rose-600" />}
                      <strong className="text-sm" style={{ color: "var(--fg)" }}>{rotuloAcao(registro.acao)}</strong>
                      <span className={`erp-badge ${sucesso ? "erp-badge-success" : "erp-badge-danger"}`}>{registro.resultado || "registrado"}</span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold" style={{ color: "var(--fg-soft)" }}>
                      {registro.intencao?.item
                        ? `${registro.intencao.item} · ${Number(registro.intencao.quantidade || 0).toLocaleString("pt-BR")} un${registro.intencao.motivo ? ` · ${registro.intencao.motivo}` : ""}`
                        : `“${registro.comando || "Ação manual confirmada"}”`}
                    </p>
                    {registro.erro && <p className="mt-1 text-xs text-rose-600">{registro.erro}</p>}
                  </div>
                  <div className="shrink-0 text-left text-xs sm:text-right" style={{ color: "var(--dim)" }}>
                    <p className="font-bold">{registro.usuario_nome || "Usuário do sistema"}</p>
                    <p className="mt-1">{dataHoraAuditoria(registro.created_at)}</p>
                    <p className="mt-1">{registro.exigiu_confirmacao ? "Confirmado antes de gravar" : "Sem confirmação"}</p>
                  </div>
                </Card>;
              })}
            </div>
          )}
        </div>

        <SearchBar value={busca} onChange={setBusca} placeholder="Procurar insumo analisado..." />

        {loading ? (
          <div className="flex flex-col items-center justify-center p-6 sm:p-12 gap-4 text-center">
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
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{item.nome}</p>
                      {critico && <span className="erp-badge erp-badge-danger">Vazamento Crítico</span>}
                      {alerta && <span className="erp-badge erp-badge-warning">Alerta</span>}
                    </div>
                    <p className="text-xs" style={{ color: "var(--dim)" }}>
                      Categoria: {item.categoria || "N/A"} · Custo Unitário: {fmtBRL(item.custo_unitario)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:grid-cols-4 md:gap-6 md:items-center">
                    <div className="text-left md:text-right min-w-0">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Vendas (Teórico)</p>
                      <p className="text-lg font-black" style={{ color: "var(--fg)" }}>{item.teorico_vendas}</p>
                    </div>

                    <div className="text-left md:text-right min-w-0">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Baixa Manual</p>
                      <p className="text-lg font-black" style={{ color: critico ? "#EF4444" : "var(--fg)" }}>{item.perda_manual}</p>
                    </div>

                    <div className="text-left md:text-right bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 min-w-0">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>Taxa %</p>
                      <p className="text-xl font-black" style={{ color: corStatus }}>{item.taxa_perda.toFixed(1)}%</p>
                    </div>

                    <div className="text-left md:text-right bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-full md:w-28 min-w-0">
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
