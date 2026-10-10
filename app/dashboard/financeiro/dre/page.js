"use client";

// DRE gerencial do mês, por competência. A conta mora em lib/dre-gerencial.mjs
// (com teste); aqui só a leitura (lib/dre-dados.js) e o desenho.
//
// Antes havia dois DREs na mesma tela que não batiam entre si: um "fechamento"
// com faturamento digitado e CMV médio da carta, e uma "estrutura" que somava
// o extrato de teste (R$ 29,90) como receita, as contas a pagar de todos os
// meses, CMV zero e o CMO só do mês atual — e o seletor Semanal/Mensal/Anual
// não mudava nada. Agora é um só, do mês escolhido, cada linha em R$ e em % do
// faturamento, com a natureza do dado. O faturamento digitado continua
// possível, mas só como SIMULAÇÃO e só quando não há faturamento real.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Info, Calculator, ChevronRight } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { carregarBaseDre, cmvDoMes, cmoDoMesRH, lancarFechamentoMes } from "../../../lib/dre-dados";
import { janelaDoMes, faturamentoDoMes, montarDre } from "../../../lib/dre-gerencial.mjs";
import { fmtReais, fmtPct } from "../../../lib/valor-percentual.mjs";
import { lerValor } from "../../../lib/contas-pagar.mjs";
import CampoDecimal from "../../../components/CampoDecimal";

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const nomeDoMes = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

const NATUREZAS = {
  real: { rotulo: "Real", classe: "border-slate-300 text-slate-600", ajuda: "Lançado ou medido no sistema." },
  estimado: { rotulo: "Estimado", classe: "border-amber-300 bg-amber-50 text-amber-800", ajuda: "Pelo % configurado na Pizza do Lucro, porque não há lançamento no mês." },
  configurado: { rotulo: "Configurado", classe: "border-sky-300 bg-sky-50 text-sky-800", ajuda: "Valor informado nas configurações (Pizza do Lucro)." },
  simulacao: { rotulo: "Simulação", classe: "border-violet-300 bg-violet-50 text-violet-800", ajuda: "Valor digitado só para simular; não é apurado." },
  sem_dado: { rotulo: "Sem dado", classe: "border-rose-300 bg-rose-50 text-rose-700", ajuda: "Falta a fonte desse número; o motivo está logo abaixo." },
  sem_lancamento: { rotulo: "Sem lançamento", classe: "border-amber-300 bg-amber-50 text-amber-800", ajuda: "Nada lançado nem configurado para esta linha." },
};

function Selo({ natureza, mostrarReal = false }) {
  const n = NATUREZAS[natureza];
  if (!n || (natureza === "real" && !mostrarReal)) return null;
  return <span title={n.ajuda} className={`ml-2 inline-block whitespace-nowrap rounded border px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide ${n.classe}`}>{n.rotulo}</span>;
}

const deducao = (rotulo) => rotulo.startsWith("(−)");
// Um sinal de menos só (o tipográfico), em dedução e em subtotal negativo.
const comMenos = (s) => String(s).replace(/^-/, "−");
const reais = (v) => comMenos(fmtReais(v));
const pctTela = (p) => (p === null ? "—" : comMenos(fmtPct(p, 1)));
// Dedução aparece com o sinal de menos; subtotal com o sinal que tiver.
const valorNaTela = (rotulo, v) => (v === null ? "sem dado" : deducao(rotulo) && v !== 0 ? `−${fmtReais(v)}` : reais(v));

function LinhaDre({ l }) {
  const sub = l.tipo === "subtotal";
  const res = l.tipo === "resultado";
  const corRes = l.valor === null ? "text-slate-400" : l.valor < 0 ? "text-rose-700" : "text-emerald-700";
  return (
    <div className={res ? "border-t-2 border-slate-900 bg-slate-50 px-4 py-4 sm:px-6" : sub ? "border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-6" : "border-b border-slate-100 px-4 py-3 sm:px-6"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 sm:grid-cols-[minmax(0,1fr)_9.5rem_5.5rem]">
        <p className={`min-w-0 ${res ? "text-base font-black text-slate-900 sm:text-lg" : sub ? "text-sm font-black text-slate-900" : "text-sm font-semibold text-slate-700"}`}>
          {l.rotulo}{(l.natureza !== "sem_dado" || l.nota) && <Selo natureza={l.natureza} />}
        </p>
        <p className={`text-right tabular-nums ${res ? `text-lg font-black sm:text-xl ${corRes}` : sub ? "text-sm font-black text-slate-900" : `text-sm font-bold ${l.valor === null ? "text-slate-400" : "text-slate-800"}`}`}>
          {valorNaTela(l.rotulo, l.valor)}
        </p>
        <p className={`col-start-2 text-right text-xs font-bold tabular-nums sm:col-start-auto sm:text-sm ${res ? corRes : "text-slate-500"}`}>
          {pctTela(l.pct)}
        </p>
      </div>
      {l.nota && <p className="mt-1 max-w-2xl text-xs font-medium leading-snug text-slate-500">{l.nota}</p>}
      {l.filhos.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-3">
          {l.filhos.map((f, i) => (
            <li key={`${f.rotulo}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 sm:grid-cols-[minmax(0,1fr)_9.5rem_5.5rem]">
              <span className="min-w-0 text-[13px] font-medium text-slate-600">
                {f.rotulo}{f.qtd > 1 ? <span className="text-slate-400"> · {f.qtd} contas</span> : null}<Selo natureza={f.natureza} />
              </span>
              <span className="text-right text-[13px] font-semibold tabular-nums text-slate-700">{f.valor === null ? "sem dado" : `−${fmtReais(f.valor)}`}</span>
              <span className="col-start-2 text-right text-xs font-semibold tabular-nums text-slate-500 sm:col-start-auto">{pctTela(f.pct)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, tom = "neutro" }) {
  const cor = tom === "bom" ? "text-emerald-700" : tom === "ruim" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[13px] font-bold text-slate-600 sm:text-sm">{rotulo}</p>
      <p className={`mt-2 text-xl font-black leading-none tracking-tight sm:text-2xl ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1.5 text-[13px] font-semibold text-slate-500">{detalhe}</p>}
    </div>
  );
}

export default function DreGerencialPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [mes, setMes] = useState(() => hojeIso().slice(0, 7));
  const [base, setBase] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [simFat, setSimFat] = useState("");
  const [simCmv, setSimCmv] = useState("");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setCarregando(true);
    carregarBaseDre(unidadeAtiva).then((b) => { if (ativo) { setBase(b); setCarregando(false); } });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  // Simulação é por mês: trocar de mês não leva o número digitado junto.
  useEffect(() => { setSimFat(""); setSimCmv(""); }, [mes]);

  const calc = useMemo(() => {
    if (!base) return null;
    const janela = janelaDoMes(mes, hojeIso());
    const fat = faturamentoDoMes(base.cmvDados?.fonteFaturamento, janela);
    const cmv = cmvDoMes(base.cmvDados, janela);
    const cmo = cmoDoMesRH(base, mes);
    const simulacao = { faturamento: lerValor(simFat), taxaServico: lerValor(simCmv) };
    const dre = montarDre({ mes, janela, fat, contas: base.contas, categorias: base.categorias, cmv, cmo, params: base.params, simulacao });
    return { janela, fat, cmv, dre };
  }, [base, mes, simFat, simCmv]);

  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const dre = calc?.dre;
  const ind = dre?.indicadores;
  const linhaDe = (id) => dre?.linhas.find((l) => l.id === id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-7 text-white sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-300">Regime de competência · {unidadeInfo?.nome || "unidade"}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">DRE gerencial</h1>
            <p className="mt-1 text-sm font-medium text-slate-300 first-letter:uppercase">{nomeDoMes(mes)}{calc?.janela.emAndamento ? " · mês em andamento" : ""}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-300">
            Mês
            <input type="month" value={mes} max={hojeIso().slice(0, 7)} onChange={(e) => e.target.value && setMes(e.target.value)}
              className="h-11 rounded-xl border-0 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-400" />
          </label>
        </div>
      </section>

      {semUnidade ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">Escolha uma unidade no topo para ver o DRE.</p>
      ) : carregando || !calc ? (
        <div className="grid min-h-[30vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
      ) : (
        <>
          {base.erros.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              {base.erros.map((e) => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* Sem faturamento real: explica e deixa simular, marcado como simulação */}
          {calc.fat.valor === null && (
            <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Calculator size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">Faturamento do mês: sem dado</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-600">{calc.fat.motivo}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    O faturamento oficial é o diário (vendas − cancelamentos − descontos), o mesmo do CMV %.{" "}
                    <Link href="/dashboard/operacao/estoque/cmv" className="inline-flex items-center font-bold text-emerald-700 hover:underline">Lançar em Estoque → CMV real <ChevronRight size={14} /></Link>
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
                    <label className="text-xs font-bold text-slate-600">Simular com faturamento (R$)
                      <CampoDecimal value={simFat} onChange={(e) => setSimFat(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                    </label>
                    {calc.cmv.valor === null && (
                      <label className="text-xs font-bold text-slate-600">CMV para simular (%)
                        <input inputMode="decimal" value={simCmv} onChange={(e) => setSimCmv(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="ex.: 32"
                          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                      </label>
                    )}
                  </div>
                  {dre.simulando && <p className="mt-2 text-xs font-bold text-violet-700">Simulação: os números abaixo usam o valor digitado e não ficam gravados.</p>}
                </div>
              </div>
            </section>
          )}

          {dre.alertas.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-900"><AlertTriangle size={16} /> Antes de confiar no resultado</p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm font-medium text-amber-900">
                {dre.alertas.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </section>
          )}

          {/* Indicadores */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Indicador rotulo={dre.simulando ? "Faturamento (simulação)" : "Faturamento"} valor={ind.faturamento === null ? "sem dado" : fmtReais(ind.faturamento)}
              detalhe={linhaDe("vendas_brutas")?.valor != null ? `vendas brutas ${fmtReais(linhaDe("vendas_brutas").valor)}` : null} />
            <Indicador rotulo="CMV" valor={ind.cmvPct === null ? "sem dado" : fmtPct(ind.cmvPct, 1)}
              detalhe={linhaDe("cmv")?.valor != null ? fmtReais(linhaDe("cmv").valor) : "precisa de inventário no início e no fim do mês"} />
            <Indicador rotulo="Pessoal (CMO)" valor={ind.pessoalPct === null ? fmtReais(linhaDe("pessoal").valor) : fmtPct(ind.pessoalPct, 1)}
              detalhe={ind.pessoalPct === null ? "sem faturamento para o %" : fmtReais(linhaDe("pessoal").valor)} />
            <Indicador rotulo="Resultado do mês" tom={ind.resultado === null ? "neutro" : ind.resultado < 0 ? "ruim" : "bom"}
              valor={ind.resultado === null ? "sem dado" : reais(ind.resultado)}
              detalhe={ind.resultadoPct === null ? "depende das linhas sem dado" : `${pctTela(ind.resultadoPct)} do faturamento`} />
          </section>

          {/* DRE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_5.5rem] gap-x-4 border-b border-slate-200 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Demonstrativo de {nomeDoMes(mes)}</span><span className="text-right">R$</span><span className="text-right">% fat.</span>
            </div>
            {dre.linhas.map((l) => <LinhaDre key={l.id} l={l} />)}
          </section>

          {dre.fora.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-900">Fora do resultado</p>
              <p className="mt-0.5 text-sm font-medium text-slate-500">Saíram do caixa com competência neste mês, mas não são despesa da operação.</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {dre.fora.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                    <span className="min-w-0 text-sm font-semibold text-slate-700">{f.rotulo}<span className="block text-xs font-medium text-slate-500">{f.nota}</span></span>
                    <span className="text-sm font-bold tabular-nums text-slate-800">{fmtReais(f.valor)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="flex gap-2 text-xs font-medium leading-relaxed text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Percentuais sobre o faturamento (vendas − cancelamentos − descontos). Despesas pela competência da conta (sem competência, vale o mês do vencimento); contas canceladas ficam de fora.
              CMV real = inventário do 1º dia + compras confirmadas − inventário do 1º dia do mês seguinte, o mesmo da tela de CMV.
              Salários e diárias vêm do RH, como na Pizza do Lucro; contas de salário e extras do mês não somam de novo.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
