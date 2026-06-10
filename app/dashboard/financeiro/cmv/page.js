"use client";

import { useState, useEffect, useMemo } from "react";
import { Percent, AlertCircle, Crown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCardapio } from "../../../lib/cardapio";

const META_CMV = 35; // % alvo máximo de CMV (acima disso = atenção)

export default function CmvPage() {
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
    return { ...p, preco, custo, cmv: preco > 0 ? (custo / preco) * 100 : 0 };
  }).sort((a, b) => b.cmv - a.cmv), [pratos]);

  const resumo = useMemo(() => {
    if (!linhas.length) return { medio: 0, acima: 0, melhor: null };
    const medio = linhas.reduce((a, l) => a + l.cmv, 0) / linhas.length;
    const acima = linhas.filter((l) => l.cmv > META_CMV).length;
    const melhor = linhas.reduce((m, l) => (l.cmv < m.cmv ? l : m));
    return { medio, acima, melhor };
  }, [linhas]);

  return (
    <div className="min-h-screen">
      <PageHeader title="CMV" subtitle={`Custo da mercadoria vendida · ${unidadeInfo.nome}`} icon={Percent} />
      <PageBody>
        {loading ? (
          <EmptyState icon={Percent} title="Carregando..." />
        ) : linhas.length === 0 ? (
          <EmptyState icon={Percent} title="Sem dados de CMV"
            hint="Cadastre pratos com preço e custo no Cardápio para calcular o CMV." />
        ) : (
          <>
            <KpiGrid>
              <Kpi icon={Percent} label="CMV médio da carta" value={fmtPct(resumo.medio)} tint={resumo.medio <= META_CMV ? "#10B981" : "#EF4444"} />
              <Kpi icon={AlertCircle} label={`Acima da meta (${META_CMV}%)`} value={resumo.acima} tint={resumo.acima > 0 ? "#EF4444" : "#10B981"} />
            </KpiGrid>

            {resumo.melhor && (
              <Card className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
                  <Crown size={18} style={{ color: "var(--accent-fg)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Melhor CMV da carta</p>
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{resumo.melhor.nome} · {fmtPct(resumo.melhor.cmv)}</p>
                </div>
              </Card>
            )}

            <div>
              <SectionLabel>CMV por prato (maior → menor)</SectionLabel>
              <div className="space-y-2">
                {linhas.map((l) => {
                  const alto = l.cmv > META_CMV;
                  return (
                    <Card key={l.id} className="!p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{l.nome}</p>
                        <span className="text-sm font-bold" style={{ color: alto ? "#DC2626" : "var(--accent-fg)" }}>{fmtPct(l.cmv)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--elevated)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(l.cmv, 100)}%`, background: alto ? "#EF4444" : "#10B981" }} />
                      </div>
                      <div className="flex justify-between text-[10px]" style={{ color: "var(--dim)" }}>
                        <span>Custo {fmtBRL(l.custo)}</span><span>Preço {fmtBRL(l.preco)}</span>
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
