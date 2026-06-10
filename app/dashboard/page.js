"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertTriangle, Bell, TrendingUp, TrendingDown, Package, ChefHat,
  Calendar, Users, Building2, ArrowRight, ChevronRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { PageBody, Card, SectionLabel, fmtBRL } from "../components/ui";
import { useERP } from "../context/ERPContext";
import { lerSessao } from "../lib/auth";
import { fetchLancamentos } from "../lib/financeiro";

const ATALHOS = [
  { label: "Estoque", Icon: Package, href: "/dashboard/operacao/estoque" },
  { label: "Cardápio", Icon: ChefHat, href: "/dashboard/operacao/cardapio" },
  { label: "Eventos", Icon: Calendar, href: "/dashboard/operacao/eventos" },
  { label: "Fluxo", Icon: Wallet, href: "/dashboard/financeiro/fluxo" },
  { label: "RH", Icon: Users, href: "/dashboard/rh/gestao" },
  { label: "Validade", Icon: AlertTriangle, href: "/dashboard/operacao/validade" },
];

function variacao(atual, anterior) {
  if (!anterior) return atual > 0 ? 100 : null;
  return ((atual - anterior) / anterior) * 100;
}

// KPI estilo Ascend: valor + selo de variação
function KpiVar({ label, value, delta, inverter }) {
  // inverter: para Despesas, subir é ruim (vermelho)
  const pos = delta != null && (inverter ? delta < 0 : delta >= 0);
  return (
    <Card className="p-4">
      <p className="erp-label">{label}</p>
      <p className="text-2xl font-bold mt-1.5" style={{ color: "var(--fg)" }}>{value}</p>
      {delta == null ? (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--dim)" }}>sem histórico ainda</p>
      ) : (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: pos ? "var(--accent-soft)" : "var(--danger-soft)", color: pos ? "var(--accent-strong)" : "#DC2626" }}>
            {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta).toFixed(0)}%
          </span>
          <span className="text-[11px]" style={{ color: "var(--dim)" }}>vs. 30 dias anteriores</span>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { resumoEstoque, estoque, naoLidas, unidadeInfo, isCentral, podeTrocar, unidadeAtiva } = useERP();
  const [nome, setNome] = useState("");
  const [lanc, setLanc] = useState([]);

  useEffect(() => { lerSessao().then((s) => setNome(s?.nome?.split(" ")[0] || "Operador")); }, []);
  useEffect(() => { fetchLancamentos(unidadeAtiva).then(({ data }) => setLanc(data || [])); }, [unidadeAtiva]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));

  // Métricas financeiras reais (30d atual vs 30d anterior)
  const fin = useMemo(() => {
    const hoje = Date.now();
    const d30 = 30 * 86400000;
    const soma = (tipo, ini, fim) => lanc.filter((l) => {
      const t = new Date(l.data).getTime();
      return l.tipo === tipo && t >= ini && t < fim;
    }).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const recA = soma("entrada", hoje - d30, hoje + 86400000);
    const recB = soma("entrada", hoje - 2 * d30, hoje - d30);
    const desA = soma("saida", hoje - d30, hoje + 86400000);
    const desB = soma("saida", hoje - 2 * d30, hoje - d30);
    return { recA, desA, lucro: recA - desA, lucroB: recB - desB, varRec: variacao(recA, recB), varDes: variacao(desA, desB), varLuc: variacao(recA - desA, recB - desB) };
  }, [lanc]);

  // Série diária de receita (últimos 14 dias) para o gráfico
  const barras = useMemo(() => {
    const porDia = {};
    lanc.filter((l) => l.tipo === "entrada").forEach((l) => { const k = String(l.data).slice(0, 10); porDia[k] = (porDia[k] || 0) + (Number(l.valor) || 0); });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return { label: d.getDate(), valor: porDia[d.toISOString().slice(0, 10)] || 0 };
    });
  }, [lanc]);
  const maxBar = Math.max(1, ...barras.map((b) => b.valor));
  const semDados = barras.every((b) => b.valor === 0);

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-2" style={{ background: "var(--surface)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>{saudacao},</p>
        <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--fg)" }}>{nome} 👋</h1>
        <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: unidadeInfo.cor }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--fg-soft)" }}>{isCentral ? "Central · consolidado da rede" : unidadeInfo.nome}</span>
        </div>
      </div>

      <PageBody>
        {/* KPIs com variação */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiVar label="Receita (30d)" value={fmtBRL(fin.recA)} delta={fin.varRec} />
          <KpiVar label="Despesas (30d)" value={fmtBRL(fin.desA)} delta={fin.varDes} inverter />
          <KpiVar label="Lucro (30d)" value={fmtBRL(fin.lucro)} delta={fin.varLuc} />
          <Card className="p-4">
            <p className="erp-label">Valor em estoque</p>
            <p className="text-2xl font-bold mt-1.5" style={{ color: "var(--fg)" }}>{fmtBRL(resumoEstoque.valor)}</p>
            <p className="text-[11px] mt-1.5" style={{ color: resumoEstoque.criticos > 0 ? "#DC2626" : "var(--dim)" }}>
              {resumoEstoque.criticos > 0 ? `${resumoEstoque.criticos} item(ns) crítico(s)` : "estoque saudável"}
            </p>
          </Card>
        </div>

        {/* Gráfico de desempenho */}
        <div>
          <SectionLabel>Receita — últimos 14 dias</SectionLabel>
          <Card>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {barras.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max((b.valor / maxBar) * 100, 2)}%`, background: i === 13 ? "var(--accent)" : "var(--accent-soft)", minHeight: 3 }} title={fmtBRL(b.valor)} />
                  <span className="text-[9px]" style={{ color: "var(--dim)" }}>{b.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-center mt-3" style={{ color: "var(--dim)" }}>
              {semDados ? "Sem lançamentos ainda · registre vendas no Fluxo de Caixa" : `Pico: ${fmtBRL(maxBar)}/dia`}
            </p>
          </Card>
        </div>

        {/* Atalho Central → Rede */}
        {isCentral && podeTrocar && (
          <Card className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard/rede")}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel)" }}>
              <Building2 size={18} style={{ color: "var(--subtle)" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Visão de Rede</p>
              <p className="text-[11px]" style={{ color: "var(--dim)" }}>Comparar as unidades lado a lado</p>
            </div>
            <ArrowRight size={16} style={{ color: "var(--dim)" }} />
          </Card>
        )}

        {/* Estoque crítico */}
        {criticos.length > 0 && (
          <div>
            <SectionLabel>Estoque crítico ({criticos.length})</SectionLabel>
            <Card className="!p-0 overflow-hidden">
              {criticos.slice(0, 5).map((i, idx) => (
                <button key={i.id} onClick={() => router.push("/dashboard/operacao/estoque")}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left" style={idx ? { borderTop: "1px solid var(--line)" } : {}}>
                  <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--fg)" }}>{i.nome}</span>
                  <span className="text-[11px]" style={{ color: "#DC2626" }}>{i.quantidade} {i.unidade}</span>
                  <ChevronRight size={14} style={{ color: "var(--dim)" }} />
                </button>
              ))}
            </Card>
          </div>
        )}

        {/* Atalhos */}
        <div>
          <SectionLabel>Atalhos</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            {ATALHOS.map((a) => (
              <button key={a.label} onClick={() => router.push(a.href)} className="erp-card p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--panel)" }}>
                  <a.Icon size={18} style={{ color: "var(--subtle)" }} />
                </div>
                <span className="text-[11px] font-bold" style={{ color: "var(--fg-soft)" }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PageBody>
    </div>
  );
}
