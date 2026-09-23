"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Info, Calculator, FileText } from "lucide-react";
import {
  PageBody, Card, EmptyState, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchContas, fetchLancamentos } from "../../../lib/financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { calcularCMO, pesoDoCMO } from "../../../lib/cmo.mjs";
import { montarDREGerencial } from "../../../lib/financeiro-domain";
import FechamentoMes from "./FechamentoMes";

export default function DreGerencialPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lanc, setLanc] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoLetra, setPeriodoLetra] = useState("Mensal");
  const [cmo, setCmo] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva) return;
    setLoading(true);
    Promise.all([
      fetchLancamentos(unidadeAtiva),
      fetchContas(unidadeAtiva)
    ]).then(([resLanc, resContas]) => {
      setLanc(resLanc.data || []);
      setContasPagar(resContas.data || []);
      setLoading(false);
    });
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCmo(null); return; }
    let ativo = true;
    Promise.all([fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva)])
      .then(([equipe, recibos]) => {
        if (!ativo) return;
        setCmo(calcularCMO({ colaboradores: equipe.data || [], recibos: recibos.data || [] }));
      });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  // DRE Gerencial por Regime de Competência usando Fonte Única da Verdade
  const dre = useMemo(() => {
    const faturamentoTotal = lanc.filter((l) => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    const cmoTotal = cmo?.total || 0;

    const calculo = montarDREGerencial({
      faturamentoTotal,
      despesasContasPagar: contasPagar,
      cmoTotal
    });

    return calculo;
  }, [lanc, contasPagar, cmo]);

  const temDados = dre.receitaBruta > 0 || Object.keys(dre.categoriasDespesas).length > 0;
  const isLucro = dre.resultadoOperacional >= 0;

  return (
    <div className="min-h-screen bg-[var(--surface)] font-sans pb-20">
      {/* HEADER EXECUTIVO */}
      <div className="bg-slate-900 text-white px-6 py-10 md:py-14 rounded-b-[40px] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5"><FileText size={200} /></div>

         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 max-w-5xl mx-auto">
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
                  <BarChart3 size={14}/> Fonte Única da Verdade • Regime de Competência
               </p>
               <h1 className="text-3xl md:text-5xl font-black tracking-tighter">DRE Gerencial</h1>
               <p className="text-sm font-medium text-slate-300 mt-2">Demonstrativo de Resultados do Exercício da {unidadeInfo.nome}</p>
            </div>

            <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700">
               {["Semanal", "Mensal", "Anual"].map(p => (
                  <button
                    key={p} onClick={() => setPeriodoLetra(p)}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${periodoLetra === p ? 'bg-card text-fg shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    {p}
                  </button>
               ))}
            </div>
         </div>
      </div>

      <FechamentoMes unidadeAtiva={unidadeAtiva} unidadeInfo={unidadeInfo} />
      <PageBody className="max-w-5xl mx-auto -mt-8 relative z-20">
        {loading ? (
          <EmptyState icon={Calculator} title="Processando DRE por competência..." />
        ) : !temDados ? (
          <EmptyState icon={BarChart3} title="Extrato Limpo" hint="Registre faturamento e contas a pagar para montar o DRE." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

             {/* COLUNA ESQUERDA: RESULTADO (1/3) */}
             <div className="lg:col-span-1 space-y-6">

                {/* Termômetro de Lucratividade */}
                <div className={`p-5 sm:p-8 rounded-2xl sm:rounded-[32px] shadow-lg border relative overflow-hidden text-accent-fg ${isLucro ? 'bg-accent border-emerald-500' : 'bg-accent border-emerald-500'}`}>
                   <div className="absolute top-0 right-0 p-6 opacity-10">
                      {isLucro ? <TrendingUp size={120} /> : <TrendingDown size={120} />}
                   </div>

                   <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-4">Resultado Operacional ({periodoLetra})</p>

                   <h2 className="text-3xl sm:text-4xl font-black tracking-tighter drop-shadow-sm mb-2 break-words">{fmtBRL(dre.resultadoOperacional)}</h2>

                   <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md mt-2">
                      <span className="font-bold text-sm">Margem Operacional</span>
                      <span className="font-black text-lg bg-card text-fg px-2 py-0.5 rounded-lg ml-1 shadow-sm">{fmtPct(dre.margemOperacionalPct)}</span>
                   </div>

                   <p className="text-xs font-medium text-white/80 mt-6 leading-relaxed">
                      {isLucro
                        ? "Excelente! A operação está saudável e gerando resultado positivo."
                        : "Atenção Crítica: Custos operacionais e CMO superaram o faturamento bruto."}
                   </p>
                </div>

                {/* Resumo Rápido */}
                <div className="bg-card p-6 rounded-[24px] shadow-sm border border-line">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2"><Info size={16}/> Resumo do Período</h3>

                   <div className="space-y-4">
                      <div>
                         <p className="text-2xs font-bold text-muted uppercase">Receita Operacional Bruta</p>
                         <p className="text-xl font-black text-fg">{fmtBRL(dre.receitaBruta)}</p>
                      </div>
                      <div className="w-full h-px bg-elevated"></div>
                      <div>
                         <p className="text-2xs font-bold text-muted uppercase">Custos & Despesas Totais</p>
                         <p className="text-xl font-black text-fg">{fmtBRL(dre.cmv + dre.cmo + dre.despesasOperacionais)}</p>
                      </div>
                   </div>
                </div>

             </div>

             {/* COLUNA DIREITA: TABELA DRE PADRONIZADA (2/3) */}
             <div className="lg:col-span-2">
                <div className="bg-card rounded-[32px] shadow-sm border border-line overflow-hidden">

                   <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-line flex flex-wrap justify-between items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">Estrutura DRE Gerencial</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">Valor Acumulado</span>
                   </div>

                   {/* Linha 1: Receita Bruta */}
                   <LinhaTotal codigo="1" label="(=) Receita Operacional Bruta" valor={dre.receitaBruta} cor="text-fg" bg="bg-slate-100/50" />

                   {/* Linha 2: Lucro Bruto / CMV */}
                   <div className="px-6 py-2.5 flex justify-between text-xs font-bold text-slate-600 border-b border-line">
                      <span>(-) CMV (Custo Mercadoria Vendida)</span>
                      <span className="font-mono text-red-600">- {fmtBRL(dre.cmv)}</span>
                   </div>
                   <LinhaTotal codigo="2" label="(=) Lucro Bruto" valor={dre.lucroBruto} cor="text-emerald-700" bg="bg-emerald-50/30" />

                   <div className="h-2"></div>

                   {/* Linha 3: CMO */}
                   <div className="px-6 py-2.5 flex justify-between text-xs font-bold text-slate-600 border-b border-line">
                      <span>(-) CMO (Custo Mão de Obra / RH)</span>
                      <span className="font-mono text-red-600">- {fmtBRL(dre.cmo)}</span>
                   </div>

                   {/* Listagem de Despesas Operacionais */}
                   <div className="px-6 py-2">
                      <span className="text-3xs font-bold uppercase tracking-widest text-slate-600 bg-slate-50 px-2 py-1 rounded-md">
                         (-) Outras Despesas Operacionais
                      </span>
                   </div>

                   <div className="pb-4">
                      {Object.entries(dre.categoriasDespesas).sort((a, b) => b[1] - a[1]).map(([cat, val], idx) => (
                         <div key={cat} className="flex flex-wrap justify-between items-center gap-2 px-4 sm:px-6 py-2.5 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3">
                               <span className="text-3xs font-bold text-muted w-4">{idx + 1}</span>
                               <span className="text-sm font-bold text-slate-600 group-hover:text-fg transition-colors">{cat}</span>
                            </div>
                            <span className="text-sm font-medium text-muted font-mono">
                               - {fmtBRL(val)}
                            </span>
                         </div>
                      ))}
                   </div>

                   {/* Linha Final: Resultado Operacional */}
                   <div className={`px-4 sm:px-6 py-5 sm:py-6 border-t-2 border-slate-900 flex flex-wrap justify-between items-center gap-2 ${isLucro ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                         <span className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-bold">3</span>
                         <div>
                            <span className={`text-lg font-black uppercase tracking-widest ${isLucro ? 'text-emerald-900' : 'text-red-900'}`}>(=) Resultado Operacional</span>
                            <p className={`text-3xs font-bold uppercase tracking-widest mt-1 ${isLucro ? 'text-success' : 'text-success'}`}>Resultado do Exercício</p>
                         </div>
                      </div>
                      <span className={`text-2xl font-black font-mono ${isLucro ? 'text-success' : 'text-success'}`}>
                         {fmtBRL(dre.resultadoOperacional)}
                      </span>
                   </div>

                </div>
              </div>

           </div>
        )}
        {cmo && (
          <Card className="mt-4">
            <p className="text-2xs font-bold uppercase tracking-widest" style={{ color: "var(--dim)" }}>CMO · custo de mão de obra no mês</p>
            <p className="mt-0.5 text-2xs font-medium" style={{ color: "var(--dim)" }}>Folha vem do RH; diárias vêm dos recibos pagos no módulo de Extras.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl px-3 py-2" style={{ background: "var(--elevated)" }}>
                <p className="text-3xs font-bold uppercase tracking-widest" style={{ color: "var(--dim)" }}>Folha dos contratados</p>
                <p className="text-lg font-black" style={{ color: "var(--fg)" }}>{fmtBRL(cmo.folha)}</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "var(--elevated)" }}>
                <p className="text-3xs font-bold uppercase tracking-widest" style={{ color: "var(--dim)" }}>Diárias de extras</p>
                <p className="text-lg font-black" style={{ color: "var(--fg)" }}>{fmtBRL(cmo.extras)}</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "var(--accent-soft)" }}>
                <p className="text-3xs font-bold uppercase tracking-widest" style={{ color: "var(--accent-strong)" }}>CMO total</p>
                <p className="text-lg font-black" style={{ color: "var(--accent-strong)" }}>{fmtBRL(cmo.total)}</p>
              </div>
            </div>
          </Card>
        )}
      </PageBody>
    </div>
  );
}

function LinhaTotal({ codigo, label, valor, cor, bg }) {
  return (
    <div className={`flex flex-wrap justify-between items-center gap-2 px-4 sm:px-6 py-4 border-b border-line ${bg}`}>
      <div className="flex items-center gap-3">
         <span className="text-3xs font-bold text-muted border border-slate-300 w-5 h-5 rounded-md flex items-center justify-center bg-card">{codigo}</span>
         <span className={`text-sm font-black uppercase tracking-widest ${cor}`}>{label}</span>
      </div>
      <span className={`text-lg font-black font-mono ${cor}`}>{fmtBRL(valor)}</span>
    </div>
  );
}
