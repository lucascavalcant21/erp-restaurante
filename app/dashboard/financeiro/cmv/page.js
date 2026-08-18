"use client";

import { useState, useEffect, useMemo } from "react";
import { Percent, AlertCircle, Crown, History, X, TrendingUp, TrendingDown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoques, fetchMovimentosMulti } from "../../../lib/estoques-multiplos";
import { valorDaCompra, faixaCompras, isoData } from "../../../lib/compras.mjs";
import { fetchFichas, fetchHistoricoPrecos } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";

// Todos os insumo_ids usados por uma ficha (resolvendo sub-receitas)
function insumosDaFichaRec(f, todasFichas, acc = new Set(), guard = new Set()) {
  if (!f || guard.has(f.id)) return acc;
  guard.add(f.id);
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) acc.add(fi.insumos.id);
    else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      if (base) insumosDaFichaRec(base, todasFichas, acc, guard);
    }
  });
  return acc;
}

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
  // CMV de estoque: o que cada estoque consumiu de verdade no mês, em reais.
  const [consumo, setConsumo] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [historico, setHistorico] = useState([]); // alterações de preço dos insumos
  const [loading, setLoading] = useState(true);
  const [modalHistPrato, setModalHistPrato] = useState(null); // { nome, mudancas }

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    fetchEstoques(unidadeAtiva).then(async ({ data: estoques }) => {
      const faixa = faixaCompras(new Date(), "mes");
      const de = isoData(faixa.de), ate = isoData(faixa.ate);
      const respostas = await Promise.all((estoques || []).map(e => fetchMovimentosMulti(unidadeAtiva, e.id, 500)));
      if (!ativo) return;
      const soma = (estoques || []).map((e, i) => {
        const saidas = (respostas[i]?.data || []).filter(m => m.tipo === "saida" && m.estoque_id === e.id
          && (m.data_movimento || m.created_at || "").slice(0, 10) >= de
          && (m.data_movimento || m.created_at || "").slice(0, 10) <= ate);
        return { nome: e.nome, total: saidas.reduce((s, m) => s + valorDaCompra(m), 0), itens: saidas.length };
      }).filter(x => x.itens > 0).sort((a, b) => b.total - a.total);
      setConsumo(soma);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchHistoricoPrecos(unidadeAtiva)]).then(([resFichas, resProdutos, resHist]) => {
      setFichas(resFichas.data || []);
      setProdutos(resProdutos.data || []);
      setHistorico(resHist.data || []);
      setLoading(false);
    });
  }, [unidadeAtiva]);

  // Por prato: quais alterações de preço de ingredientes o afetaram
  const mudancasDoPrato = (produto) => {
    const comps = Array.isArray(produto.composicao) && produto.composicao.length
      ? produto.composicao
      : (produto.ficha_id ? [{ ficha_id: produto.ficha_id, qtd: 1 }] : []);
    const ids = new Set();
    comps.forEach(c => {
      const ficha = fichas.find(f => f.id === c.ficha_id);
      if (ficha) insumosDaFichaRec(ficha, fichas, ids);
    });
    // só alterações reais (ignora o cadastro inicial)
    return historico.filter(h => ids.has(h.insumo_id) && h.custo_anterior !== null);
  };

  // CMV real: produtos.preco_venda x custo dos componentes (composição múltipla
  // ou ficha única), com bases/sub-receitas resolvidas
  const linhas = useMemo(() => {
    const fichasPorId = {};
    fichas.forEach(f => { fichasPorId[f.id] = f; });

    return produtos
      .filter(p => (Number(p.preco_venda) || 0) > 0)
      .map(p => {
        const componentes = Array.isArray(p.composicao) && p.composicao.length
          ? p.composicao
          : (p.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : []);
        let custo = 0, temFicha = false;
        componentes.forEach(c => {
          const ficha = fichasPorId[c.ficha_id];
          if (!ficha) return;
          temFicha = true;
          custo += (custoTotalDaFicha(ficha, fichas) / porcoesDaFicha(ficha)) * (Number(c.qtd) || 1);
        });
        if (!temFicha) return null;
        const preco = Number(p.preco_venda) || 0;
        return { id: p.id, nome: p.nome_produto, departamento: p.departamento, preco, custo, cmv: preco > 0 ? (custo / preco) * 100 : 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b.cmv - a.cmv);
  }, [produtos, fichas]);

  const resumo = useMemo(() => {
    if (!linhas.length) return { medio: 0, acima: 0, melhor: null };
    const medio = linhas.reduce((a, l) => a + l.cmv, 0) / linhas.length;
    const acima = linhas.filter((l) => l.cmv > META_CMV).length;
    const melhor = linhas.reduce((m, l) => (l.cmv < m.cmv ? l : m));
    return { medio, acima, melhor };
  }, [linhas]);

  // Cada area tem sua carta e seu proprio patamar de CMV: misturar drink com
  // prato esconde o problema de um dos dois.
  const porArea = useMemo(() => {
    const areas = [
      { chave: "cozinha", rotulo: "Cozinha", teste: (d) => !String(d || "").toLowerCase().includes("bar") },
      { chave: "bar", rotulo: "Bar", teste: (d) => String(d || "").toLowerCase().includes("bar") },
    ];
    return areas.map(a => {
      const daArea = linhas.filter(l => a.teste(l.departamento));
      if (!daArea.length) return { ...a, itens: 0, medio: 0, acima: 0 };
      return {
        ...a,
        itens: daArea.length,
        medio: daArea.reduce((s, l) => s + l.cmv, 0) / daArea.length,
        acima: daArea.filter(l => l.cmv > META_CMV).length,
      };
    }).filter(a => a.itens > 0);
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

            {porArea.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {porArea.map(a => (
                  <Card key={a.chave} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>CMV médio · {a.rotulo}</p>
                      <p className="mt-1 text-3xl font-black" style={{ color: a.medio <= META_CMV ? "#10B981" : "#EF4444" }}>{fmtPct(a.medio)}</p>
                      <p className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>{a.itens} item(ns) · {a.acima} acima da meta</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* CMV de estoque: o que saiu de cada estoque no mês, em reais */}
            {consumo.length > 0 && (
              <Card>
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Consumo de estoque no mês</p>
                <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--dim)" }}>Saídas de cada estoque valorizadas pelo custo do ingrediente.</p>
                <div className="mt-3 space-y-2">
                  {consumo.map(c => (
                    <div key={c.nome} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--elevated)" }}>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: "var(--fg)" }}>{c.nome}</span>
                      <span className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>{c.itens} saída(s)</span>
                      <span className="shrink-0 text-base font-black" style={{ color: "var(--accent-strong)" }}>{fmtBRL(c.total)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-center justify-between text-sm font-black" style={{ color: "var(--fg)" }}>
                  <span>Total consumido</span>
                  <span>{fmtBRL(consumo.reduce((s, c) => s + c.total, 0))}</span>
                </p>
              </Card>
            )}

            {resumo.melhor && (
              <Card className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)" }}>
                  <Crown size={18} style={{ color: "var(--accent-fg)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>Melhor CMV da carta</p>
                  <p className="text-sm font-bold break-words" style={{ color: "var(--fg)" }}>{resumo.melhor.nome} · {fmtPct(resumo.melhor.cmv)}</p>
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
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{l.nome}</p>
                          {l.departamento && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--elevated)", color: "var(--dim)" }}>{l.departamento}</span>
                          )}
                          {(() => {
                            const p = produtos.find(x => x.id === l.id);
                            const mud = p ? mudancasDoPrato(p) : [];
                            if (!mud.length) return null;
                            return (
                              <button onClick={() => setModalHistPrato({ nome: l.nome, mudancas: mud })}
                                className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1 transition-colors"
                                style={{ background: "rgba(245,158,11,0.13)", color: "#B45309" }}
                                title="Alterações de preço dos ingredientes deste prato">
                                <History size={9} /> {mud.length} alteração{mud.length > 1 ? "ões" : ""}
                              </button>
                            );
                          })()}
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

      {/* MODAL: histórico de alterações de ingredientes do prato */}
      {modalHistPrato && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto" onClick={() => setModalHistPrato(null)}>
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[85vh] rounded-2xl sm:rounded-3xl border flex flex-col p-4 sm:p-6 my-auto" style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-3 mb-4 shrink-0">
              <div className="min-w-0">
                <h2 className="font-black text-base sm:text-lg break-words" style={{ color: "var(--fg)" }}>Alterações de Ingredientes</h2>
                <p className="text-xs font-bold mt-0.5 break-words" style={{ color: "var(--muted)" }}>{modalHistPrato.nome} · {modalHistPrato.mudancas.length} mudança(s) de preço</p>
              </div>
              <button onClick={() => setModalHistPrato(null)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}><X size={16} /></button>
            </div>
            <div className="overflow-y-auto space-y-2">
              {modalHistPrato.mudancas.map(h => {
                const antigo = Number(h.custo_anterior) || 0;
                const novo = Number(h.custo_novo) || 0;
                const varPct = antigo > 0 ? ((novo - antigo) / antigo) * 100 : 0;
                const subiu = varPct > 0;
                return (
                  <div key={h.id} className="p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--elevated)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: subiu ? "rgba(239,68,68,0.12)" : "rgba(5,150,105,0.12)", color: subiu ? "#DC2626" : "#047857" }}>
                      {subiu ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{h.insumo_nome}</p>
                      <p className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>
                        {fmtBRL(antigo)} → {fmtBRL(novo)} · {new Date(h.created_at).toLocaleDateString("pt-BR")} às {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="text-xs font-black shrink-0" style={{ color: subiu ? "#DC2626" : "#047857" }}>{subiu ? "+" : ""}{varPct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] font-medium mt-3 shrink-0" style={{ color: "var(--dim)" }}>O CMV do prato já reflete o preço atual — cada mudança acima recalculou fichas, cardápio e CMV na hora.</p>
          </div>
        </div>
      )}
    </div>
  );
}
