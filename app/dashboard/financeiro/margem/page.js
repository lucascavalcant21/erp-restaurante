"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Crown, AlertCircle } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCardapio } from "../../../lib/cardapio";

const META_MC = 30; // % mínimo saudável de margem de contribuição

export default function MargemPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [pratos, setPratos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCardapio(unidadeAtiva).then(({ data }) => {
      setPratos((data || []).filter((p) => (Number(p.preco) || 0) > 0));
      setLoading(false);
    });
  }, [unidadeAtiva]);

  const linhas = useMemo(() => pratos.map((p) => {
    const preco = Number(p.preco) || 0;
    const custo = Number(p.custo) || 0;
    const mcR = preco - custo;
    return { ...p, preco, custo, mcR, mc: preco > 0 ? (mcR / preco) * 100 : 0 };
  }).sort((a, b) => b.mc - a.mc), [pratos]);

  const resumo = useMemo(() => {
    if (!linhas.length) return { media: 0, abaixo: 0, top: null };
    const media = linhas.reduce((a, l) => a + l.mc, 0) / linhas.length;
    const abaixo = linhas.filter((l) => l.mc < META_MC).length;
    const top = linhas.reduce((m, l) => (l.mcR > m.mcR ? l : m));
    return { media, abaixo, top };
  }, [linhas]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Lucro" subtitle={`Margem de contribuição · ${unidadeInfo.nome}`} icon={TrendingUp} />
      <PageBody>
        {loading ? (
          <EmptyState icon={TrendingUp} title="Carregando..." />
        ) : linhas.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Sem dados de margem"
            hint="Cadastre pratos com preço e custo no Cardápio para calcular a margem." />
        ) : (
          <>
            <KpiGrid>
              <Kpi icon={TrendingUp} label="Margem média (MC)" value={fmtPct(resumo.media)} tint={resumo.media >= META_MC ? "#10B981" : "#F59E0B"} />
              <Kpi icon={AlertCircle} label={`Abaixo de ${META_MC}%`} value={resumo.abaixo} tint={resumo.abaixo > 0 ? "#EF4444" : "#10B981"} />
            </KpiGrid>

            {resumo.top && (
              <Card className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
                  <Crown size={18} style={{ color: "var(--accent-fg)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Maior lucro por unidade vendida</p>
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{resumo.top.nome} · {fmtBRL(resumo.top.mcR)} ({fmtPct(resumo.top.mc)})</p>
                </div>
              </Card>
            )}

            <div>
              <SectionLabel>Margem por prato (maior → menor)</SectionLabel>
              <div className="space-y-2">
                {linhas.map((l) => {
                  const ok = l.mc >= META_MC;
                  return (
                    <Card key={l.id} className="!p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{l.nome}</p>
                        <span className="text-sm font-bold" style={{ color: ok ? "var(--accent-fg)" : "#DC2626" }}>{fmtBRL(l.mcR)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--elevated)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(l.mc, 0), 100)}%`, background: ok ? "#10B981" : "#F59E0B" }} />
                      </div>
                      <div className="flex justify-between text-[10px]" style={{ color: "var(--dim)" }}>
                        <span>MC {fmtPct(l.mc)}</span><span>Preço {fmtBRL(l.preco)}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
