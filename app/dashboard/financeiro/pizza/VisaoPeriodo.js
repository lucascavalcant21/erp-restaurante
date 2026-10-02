"use client";

// Visão gerencial do período: faturamento → CMV real → margem → variáveis →
// CMO → despesas → pró-labore → resultado. O CMV real vem do motor do
// estoque (cmv-real.mjs, entre inventários fechados); os custos do mês entram
// proporcionais aos dias do período. Linha sem fonte aparece "sem dado", com o
// motivo — nunca zero. Toda conta mora em composicao-preco.mjs.

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { carregarDadosCmv } from "../../../lib/cmv-dados.mjs";
import { periodosEntreContagens, apurarPeriodo } from "../../../lib/cmv-real.mjs";
import { visaoGerencialDoPeriodo, estruturaDeCustosDoMes } from "../../../lib/composicao-preco.mjs";
import { fmtReais, fmtPct, NATUREZA } from "../../../lib/valor-percentual.mjs";

const fmtDia = (iso) => { const [a, m, d] = String(iso || "").split("-"); return d ? `${d}/${m}/${a}` : "—"; };
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Natureza({ id }) {
  const n = NATUREZA[id];
  return n ? <span title={n.ajuda} className="ml-1.5 rounded border border-line px-1 text-3xs font-bold uppercase tracking-wide text-subtle">{n.rotulo}</span> : null;
}

const SUBTOTAIS = new Set(["margem_bruta", "contribuicao", "resultado"]);

function LinhaDre({ l }) {
  const sub = SUBTOTAIS.has(l.id);
  return (
    <div className={`py-2 ${sub ? "border-y border-line bg-surface px-2" : "border-b border-line-soft"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className={`min-w-0 text-xs text-fg-soft ${sub ? "font-black" : "font-semibold"}`}>{l.rotulo}<Natureza id={l.natureza} /></span>
        <span className={`ml-auto whitespace-nowrap text-right tabular-nums ${sub ? "text-sm font-black" : "text-xs font-bold"} ${l.id === "resultado" && l.valor !== null ? (l.valor < 0 ? "text-red-600" : "text-emerald-700") : "text-fg"}`}>
          {l.valor === null ? "sem dado" : `${fmtReais(l.valor)}${l.pct !== null ? ` · ${fmtPct(l.pct)}` : ""}`}
        </span>
      </div>
      {l.nota && <p className="mt-0.5 text-3xs font-medium leading-snug text-subtle">{l.nota}</p>}
    </div>
  );
}

export default function VisaoPeriodo({ unidadeAtiva, params }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [escolhido, setEscolhido] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setCarregando(true);
    carregarDadosCmv(supabase, unidadeAtiva).then((r) => {
      if (!ativo) return;
      setDados(r.data); setErro(r.error || ""); setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const apurados = useMemo(() => {
    if (!dados) return [];
    return periodosEntreContagens(dados.contagens, hojeIso()).map((p) => apurarPeriodo(p, dados)).reverse();
  }, [dados]);
  const ap = apurados.find((a) => a.periodo.id === escolhido) || apurados.find((a) => a.status === "apurado") || apurados[0] || null;
  const visao = useMemo(() => visaoGerencialDoPeriodo(ap, params), [ap, params]);
  const estrutura = useMemo(() => estruturaDeCustosDoMes(params), [params]);

  if (carregando) return <div className="grid min-h-[30vh] place-items-center"><Loader2 className="animate-spin text-success" size={28} /></div>;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Resultado do período</p>
        {erro && <p className="mt-2 text-xs font-bold text-red-600">{erro}</p>}
        {!visao ? (
          <div className="mt-2 space-y-2 text-xs font-semibold text-fg-soft">
            <p>Ainda não há inventário fechado: o CMV real nasce da contagem de estoque (estoque inicial + compras − estoque final).</p>
            <p>Feche a primeira contagem da unidade inteira em <b>Estoque → Contagem</b>; o período começa nela e é apurado na contagem seguinte.</p>
            {dados?.fonteFaturamento && !dados.fonteFaturamento.disponivel && <p className="text-subtle">{dados.fonteFaturamento.motivo}</p>}
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={ap.periodo.id} onChange={(e) => setEscolhido(e.target.value)} aria-label="Período"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-xs font-bold text-fg">
                {apurados.map((a) => (
                  <option key={a.periodo.id} value={a.periodo.id}>
                    {fmtDia(a.periodo.de)} a {fmtDia(a.periodo.ate)} · {a.status === "apurado" ? "apurado" : a.status === "em_andamento" ? "em andamento" : "não apurado"}
                  </option>
                ))}
              </select>
              <span className="text-3xs font-bold text-subtle">{ap.periodo.dias} dia(s)</span>
            </div>
            <div className="mt-3">{visao.linhas.map((l) => <LinhaDre key={l.id} l={l} />)}</div>
            <p className="mt-2 text-3xs font-medium leading-snug text-subtle">
              % sobre o faturamento do período. CMV real: o mesmo da tela de CMV do estoque. CMO, despesas e pró-labore entram proporcionais aos dias do período.
            </p>
          </>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Custos do mês</p>
        <p className="mt-1 text-2xs font-semibold text-fg-soft">
          {estrutura.faturamentoReferencia
            ? <>% sobre o faturamento de referência de <b>{fmtReais(estrutura.faturamentoReferencia)}</b><Natureza id="configurado" /> — referência, não faturamento medido.</>
            : "Informe o faturamento mensal de referência nos custos acima para ver o peso de cada custo."}
        </p>
        <div className="mt-2">
          {estrutura.linhas.map((l) => (
            <div key={l.id} className="border-b border-line-soft py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-xs font-bold text-fg-soft">{l.rotulo}<Natureza id={l.natureza} /></span>
                <span className="ml-auto whitespace-nowrap text-xs font-black tabular-nums text-fg">{fmtReais(l.valor)}{l.pct !== null ? ` · ${fmtPct(l.pct)}` : ""}</span>
              </div>
              {l.partes.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
                  {l.partes.map((p) => (
                    <li key={p.rotulo} className="flex flex-wrap justify-between gap-x-3 text-2xs text-fg-soft">
                      <span>{p.rotulo}</span><span className="ml-auto whitespace-nowrap font-bold tabular-nums">{fmtReais(p.valor)}{p.pct !== null ? ` · ${fmtPct(p.pct)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 pt-2">
            <span className="text-xs font-black text-fg">{estrutura.total.rotulo}</span>
            <span className="ml-auto whitespace-nowrap text-sm font-black tabular-nums text-fg">{fmtReais(estrutura.total.valor)}{estrutura.total.pct !== null ? ` · ${fmtPct(estrutura.total.pct)}` : ""}</span>
          </div>
          {estrutura.variaveisPct.length > 0 && (
            <p className="mt-2 text-2xs font-semibold text-fg-soft">
              Mais, sobre cada venda: {estrutura.variaveisPct.map((v) => `${v.rotulo} ${fmtPct(v.pct)}`).join(" · ")}<Natureza id="configurado" />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
