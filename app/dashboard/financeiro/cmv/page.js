"use client";

import { useState, useEffect, useMemo } from "react";
import { Percent, AlertCircle, Crown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";

const META_CMV = 30; // % alvo máximo de CMV (acima disso = atenção)

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}

// Nº real de porções: direto (porções/un) ou derivado do peso total quando
// o rendimento é em kg/g/l/ml (peso total ÷ peso da porção).
function porcoesDaFicha(f) {
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const pesoPorcao = Number(f?.peso_porcao_g) || 0;
  const pesoTotalG = (un === "kg" || un === "l") ? rend * 1000 : rend;
  return pesoPorcao > 0 ? pesoTotalG / pesoPorcao : rend;
}

export default function CmvPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva)]).then(([resFichas, resProdutos]) => {
      setFichas(resFichas.data || []);
      setProdutos(resProdutos.data || []);
      setLoading(false);
    });
  }, [unidadeAtiva]);

  // CMV real: produtos.preco_venda x custo da ficha_id vinculada (com bases/sub-receitas resolvidas)
  const linhas = useMemo(() => {
    const fichasPorId = {};
    fichas.forEach(f => { fichasPorId[f.id] = f; });

    return produtos
      .filter(p => (Number(p.preco_venda) || 0) > 0 && p.ficha_id && fichasPorId[p.ficha_id])
      .map(p => {
        const ficha = fichasPorId[p.ficha_id];
        const preco = Number(p.preco_venda) || 0;
        const custo = custoTotalDaFicha(ficha, fichas) / porcoesDaFicha(ficha);
        return { id: p.id, nome: p.nome_produto, departamento: p.departamento, preco, custo, cmv: preco > 0 ? (custo / preco) * 100 : 0 };
      })
      .sort((a, b) => b.cmv - a.cmv);
  }, [produtos, fichas]);

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
            hint="Cadastre produtos com preço de venda e vincule uma Ficha Técnica a eles para calcular o CMV." />
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
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{l.nome}</p>
                          {l.departamento && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--elevated)", color: "var(--dim)" }}>{l.departamento}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: alto ? "#DC2626" : "var(--accent-fg)" }}>{fmtPct(l.cmv)}</span>
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
