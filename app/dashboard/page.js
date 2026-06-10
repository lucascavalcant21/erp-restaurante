"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertTriangle, Package, ChefHat, Calendar, Users, Building2,
  ArrowRight, ChevronRight, ArrowUpRight, ArrowDownRight,
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

const PERIODOS = {
  mensal:     { label: "Mensal",     dias: 30,  step: "day",   count: 14 },
  trimestral: { label: "Trimestral", dias: 90,  step: "week",  count: 12 },
  anual:      { label: "Anual",      dias: 365, step: "month", count: 12 },
};
const MES_LETRA = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function montarBuckets(step, count) {
  const arr = []; const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    let ini, fim, label;
    if (step === "day") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      ini = d.getTime(); fim = ini + 86400000; label = d.getDate();
    } else if (step === "week") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i * 7);
      ini = d.getTime() - 6 * 86400000; fim = d.getTime() + 86400000; label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ini = d.getTime(); fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); label = MES_LETRA[d.getMonth()];
    }
    arr.push({ ini, fim, label, receita: 0, despesa: 0 });
  }
  return arr;
}
function variacao(a, b) { if (!b) return a > 0 ? 100 : null; return ((a - b) / b) * 100; }

function KpiVar({ label, value, delta, inverter }) {
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
          <span className="text-[11px]" style={{ color: "var(--dim)" }}>vs. período anterior</span>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { resumoEstoque, estoque, unidadeInfo, isCentral, podeTrocar, unidadeAtiva } = useERP();
  const [nome, setNome] = useState("");
  const [lanc, setLanc] = useState([]);
  const [periodo, setPeriodo] = useState("mensal");
  const cfg = PERIODOS[periodo];

  useEffect(() => { lerSessao().then((s) => setNome(s?.nome?.split(" ")[0] || "Operador")); }, []);
  useEffect(() => { fetchLancamentos(unidadeAtiva).then(({ data }) => setLanc(data || [])); }, [unidadeAtiva]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));

  // KPIs do período atual vs anterior
  const fin = useMemo(() => {
    const now = Date.now(); const d = cfg.dias * 86400000;
    const soma = (tipo, ini, fim) => lanc.filter((l) => { const t = new Date(l.data).getTime(); return l.tipo === tipo && t >= ini && t < fim; }).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const recA = soma("entrada", now - d, now + 86400000), recB = soma("entrada", now - 2 * d, now - d);
    const desA = soma("saida", now - d, now + 86400000), desB = soma("saida", now - 2 * d, now - d);
    return { recA, desA, lucro: recA - desA, varRec: variacao(recA, recB), varDes: variacao(desA, desB), varLuc: variacao(recA - desA, recB - desB) };
  }, [lanc, cfg]);

  // Gráfico receita × despesa por bucket
  const barras = useMemo(() => {
    const b = montarBuckets(cfg.step, cfg.count);
    lanc.forEach((l) => {
      const t = new Date(l.data).getTime();
      const bk = b.find((x) => t >= x.ini && t < x.fim);
      if (bk) { if (l.tipo === "entrada") bk.receita += Number(l.valor) || 0; else bk.despesa += Number(l.valor) || 0; }
    });
    return b;
  }, [lanc, cfg]);
  const maxBar = Math.max(1, ...barras.map((b) => Math.max(b.receita, b.despesa)));
  const semDados = barras.every((b) => b.receita === 0 && b.despesa === 0);

  // Distribuição de despesas por categoria (período atual)
  const distrib = useMemo(() => {
    const now = Date.now(); const ini = now - cfg.dias * 86400000;
    const map = {};
    lanc.filter((l) => l.tipo === "saida" && new Date(l.data).getTime() >= ini).forEach((l) => { map[l.categoria || "Outros"] = (map[l.categoria || "Outros"] || 0) + (Number(l.valor) || 0); });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return { total, itens: Object.entries(map).map(([cat, val]) => ({ cat, val, pct: total ? (val / total) * 100 : 0 })).sort((a, b) => b.val - a.val).slice(0, 5) };
  }, [lanc, cfg]);

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-2" style={{ background: "var(--surface)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>{saudacao},</p>
        <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--fg)" }}>{nome} 👋</h1>
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: unidadeInfo.cor }} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--fg-soft)" }}>{isCentral ? "Central · consolidado" : unidadeInfo.nome}</span>
          </div>
          {/* Filtro de período */}
          <div className="inline-flex p-0.5 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
            {Object.entries(PERIODOS).map(([k, v]) => (
              <button key={k} onClick={() => setPeriodo(k)} className="text-[11px] font-bold px-2.5 py-1 rounded-md transition-all"
                style={periodo === k ? { background: "var(--accent-strong)", color: "#fff" } : { color: "var(--muted)" }}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiVar label={`Receita (${cfg.label})`} value={fmtBRL(fin.recA)} delta={fin.varRec} />
          <KpiVar label={`Despesas (${cfg.label})`} value={fmtBRL(fin.desA)} delta={fin.varDes} inverter />
          <KpiVar label={`Lucro (${cfg.label})`} value={fmtBRL(fin.lucro)} delta={fin.varLuc} />
          <Card className="p-4">
            <p className="erp-label">Valor em estoque</p>
            <p className="text-2xl font-bold mt-1.5" style={{ color: "var(--fg)" }}>{fmtBRL(resumoEstoque.valor)}</p>
            <p className="text-[11px] mt-1.5" style={{ color: resumoEstoque.criticos > 0 ? "#DC2626" : "var(--dim)" }}>
              {resumoEstoque.criticos > 0 ? `${resumoEstoque.criticos} item(ns) crítico(s)` : "estoque saudável"}
            </p>
          </Card>
        </div>

        {/* Gráfico receita × despesa */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Receita × Despesa</SectionLabel>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}><span className="w-2 h-2 rounded-sm" style={{ background: "var(--accent)" }} /> Receita</span>
              <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}><span className="w-2 h-2 rounded-sm" style={{ background: "#EF4444" }} /> Despesa</span>
            </div>
          </div>
          <Card>
            <div className="flex items-end gap-1.5" style={{ height: 130 }}>
              {barras.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                  <div className="w-full flex items-end justify-center gap-0.5" style={{ height: "100%" }}>
                    <div className="rounded-t-sm transition-all" style={{ width: "45%", height: `${Math.max((b.receita / maxBar) * 100, b.receita ? 3 : 0)}%`, background: "var(--accent)" }} title={`Receita ${fmtBRL(b.receita)}`} />
                    <div className="rounded-t-sm transition-all" style={{ width: "45%", height: `${Math.max((b.despesa / maxBar) * 100, b.despesa ? 3 : 0)}%`, background: "#EF4444" }} title={`Despesa ${fmtBRL(b.despesa)}`} />
                  </div>
                  <span className="text-[9px]" style={{ color: "var(--dim)" }}>{b.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-center mt-3" style={{ color: "var(--dim)" }}>
              {semDados ? "Sem lançamentos no período · registre no Fluxo de Caixa" : `Período: ${cfg.label}`}
            </p>
          </Card>
        </div>

        {/* Distribuição de despesas */}
        {distrib.total > 0 && (
          <div>
            <SectionLabel>Distribuição de despesas ({cfg.label})</SectionLabel>
            <Card className="space-y-2.5">
              {distrib.itens.map((d) => (
                <div key={d.cat}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "var(--fg-soft)" }}>{d.cat}</span>
                    <span className="font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(d.val)} · {d.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--panel)" }}>
                    <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: "var(--fg-soft)" }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

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
