"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchLancamentos } from "../../../lib/financeiro";

export default function DrePage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lanc, setLanc] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLancamentos(unidadeAtiva).then(({ data }) => { setLanc(data || []); setLoading(false); });
  }, [unidadeAtiva]);

  const dre = useMemo(() => {
    const receita = lanc.filter((l) => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    const desp = {};
    lanc.filter((l) => l.tipo === "saida").forEach((l) => {
      desp[l.categoria || "Outras despesas"] = (desp[l.categoria || "Outras despesas"] || 0) + (Number(l.valor) || 0);
    });
    const despesaTotal = Object.values(desp).reduce((a, v) => a + v, 0);
    const resultado = receita - despesaTotal;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { receita, desp, despesaTotal, resultado, margem };
  }, [lanc]);

  const temDados = lanc.length > 0;

  return (
    <div className="min-h-screen">
      <PageHeader title="DRE" subtitle={`Demonstrativo de resultado · ${unidadeInfo.nome}`} icon={BarChart3} />
      <PageBody>
        {loading ? (
          <EmptyState icon={BarChart3} title="Carregando..." />
        ) : !temDados ? (
          <EmptyState icon={BarChart3} title="Sem movimentações"
            hint="Registre entradas e saídas em Fluxo de Caixa para gerar o DRE." />
        ) : (
          <>
            {/* Resultado em destaque */}
            <Card>
              <p className="erp-label">Resultado do período</p>
              <p className="text-3xl font-bold mt-1" style={{ color: dre.resultado >= 0 ? "var(--accent-fg)" : "#DC2626" }}>
                {fmtBRL(dre.resultado)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[12px] font-bold" style={{ color: dre.resultado >= 0 ? "var(--accent-fg)" : "#DC2626" }}>
                {dre.resultado >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>Margem líquida {fmtPct(dre.margem)}</span>
              </div>
            </Card>

            {/* Estrutura do DRE */}
            <Card className="!p-0 overflow-hidden">
              <Linha label="(+) Receita bruta" valor={dre.receita} forte cor="#34D399" />
              <div style={{ borderTop: "1px solid var(--line)" }} />
              <div className="px-4 py-2">
                <p className="erp-label">(−) Despesas</p>
              </div>
              {Object.entries(dre.desp).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                <Linha key={cat} label={cat} valor={-val} indent />
              ))}
              <Linha label="Total de despesas" valor={-dre.despesaTotal} cor="#DC2626" />
              <div style={{ borderTop: "2px solid var(--line)" }} />
              <Linha label="(=) Resultado líquido" valor={dre.resultado} forte cor={dre.resultado >= 0 ? "#34D399" : "#DC2626"} />
            </Card>
          </>
        )}
      </PageBody>
    </div>
  );
}

function Linha({ label, valor, forte, indent, cor }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={indent ? { paddingLeft: 28 } : {}}>
      <span className="text-sm" style={{ color: forte ? "var(--fg)" : "var(--muted)", fontWeight: forte ? 700 : 500 }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: cor || "var(--fg)" }}>{fmtBRL(valor)}</span>
    </div>
  );
}
