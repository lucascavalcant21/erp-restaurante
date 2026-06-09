"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertTriangle, Bell, TrendingUp, Package, ChefHat, Calendar,
  Users, Building2, ChevronRight, ArrowRight,
} from "lucide-react";
import { PageBody, Card, SectionLabel, KpiGrid, Kpi, fmtBRL } from "../components/ui";
import { useERP } from "../context/ERPContext";
import { lerSessao } from "../lib/auth";

const ATALHOS = [
  { label: "Estoque",   Icon: Package,  href: "/dashboard/operacao/estoque",  cor: "#3B82F6" },
  { label: "Cardápio",  Icon: ChefHat,  href: "/dashboard/operacao/cardapio", cor: "#10B981" },
  { label: "Eventos",   Icon: Calendar, href: "/dashboard/operacao/eventos",  cor: "#F59E0B" },
  { label: "Fluxo",     Icon: Wallet,   href: "/dashboard/financeiro/fluxo",  cor: "#8B5CF6" },
  { label: "RH",        Icon: Users,    href: "/dashboard/rh/gestao",         cor: "#EC4899" },
  { label: "CMV",       Icon: TrendingUp, href: "/dashboard/financeiro/cmv",  cor: "#06B6D4" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { resumoEstoque, estoque, naoLidas, unidadeInfo, isCentral, podeTrocar } = useERP();
  const [nome, setNome] = useState("");
  useEffect(() => { lerSessao().then((s) => setNome(s?.nome?.split(" ")[0] || "Operador")); }, []);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0));

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-2" style={{ background: "var(--surface)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>{saudacao},</p>
        <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--fg)" }}>{nome} 👋</h1>
        <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: unidadeInfo.cor }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--fg-soft)" }}>
            {isCentral ? "Central · visão consolidada da rede" : unidadeInfo.nome}
          </span>
        </div>
      </div>

      <PageBody>
        {/* KPIs */}
        <KpiGrid>
          <Kpi icon={Wallet} label="Valor em estoque" value={fmtBRL(resumoEstoque.valor)} tint="#10B981" />
          <Kpi icon={AlertTriangle} label="Itens críticos" value={resumoEstoque.criticos} tint={resumoEstoque.criticos > 0 ? "#EF4444" : "var(--muted)"} />
          <Kpi icon={Bell} label="Notificações" value={naoLidas} tint="#F59E0B" />
          <Kpi icon={TrendingUp} label="Faturamento" value="—" tint="#3B82F6" />
        </KpiGrid>

        {/* Atalho Central */}
        {isCentral && podeTrocar && (
          <Card className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard/rede")}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
              <Building2 size={18} style={{ color: "var(--accent-fg)" }} />
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
                  <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--fg)" }}>{i.nome}</span>
                  <span className="text-[11px]" style={{ color: "#FCA5A5" }}>{i.quantidade} {i.unidade}</span>
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: a.cor + "22" }}>
                  <a.Icon size={18} style={{ color: a.cor }} />
                </div>
                <span className="text-[11px] font-bold" style={{ color: "var(--fg-soft)" }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-center" style={{ color: "var(--elevated)" }}>
          Integre seu PDV para faturamento e gráficos de desempenho em tempo real.
        </p>
      </PageBody>
    </div>
  );
}
