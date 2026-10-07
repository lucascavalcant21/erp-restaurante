"use client";

// Cartão de insight: SITUAÇÃO → EVIDÊNCIA → [Por quê?] POSSÍVEIS CAUSAS →
// IMPACTO → RECOMENDAÇÃO, com a pergunta (opções clicáveis = feedback que a
// unidade "ensina") e ações (abrir tela ou mandar um comando ao Héfisto).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X, Check } from "lucide-react";
import { SeloNatureza } from "./Blocos";

export const NIVEIS = {
  critico: { rotulo: "Crítico", barra: "bg-rose-600", selo: "bg-rose-50 text-rose-800 ring-rose-200" },
  importante: { rotulo: "Importante", barra: "bg-amber-500", selo: "bg-amber-50 text-amber-800 ring-amber-200" },
  oportunidade: { rotulo: "Oportunidade", barra: "bg-emerald-600", selo: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  informacao: { rotulo: "Informação", barra: "bg-slate-400", selo: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const MODULO = { estoque: "Estoque", compras: "Compras", financeiro: "Financeiro", vendas: "Vendas", rh: "RH" };

export default function InsightCartao({ insight, onComando, onResponder, onDispensar, compacto = false, semPergunta = false }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [respondido, setRespondido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const n = NIVEIS[insight.nivel] || NIVEIS.informacao;

  async function responder(opcao) {
    if (!onResponder || enviando) return;
    setEnviando(true);
    const ok = await onResponder(insight, opcao);
    setEnviando(false);
    if (ok) setRespondido(opcao);
  }

  function acao(a) {
    if (a.rota) router.push(a.rota);
    else if (a.comando && onComando) onComando(a.comando);
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${n.barra}`} aria-hidden="true" />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${n.selo}`}>{n.rotulo}</span>
            {MODULO[insight.modulo] && <span className="text-[12px] font-semibold text-slate-500">{MODULO[insight.modulo]}</span>}
          </div>
          {onDispensar && !respondido && (
            <button type="button" onClick={() => onDispensar(insight)} aria-label="Dispensar por 7 dias" title="Dispensar por 7 dias"
              className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X size={16} />
            </button>
          )}
        </div>

        <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-slate-900">{insight.titulo}</h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">{insight.situacao}</p>

        {!compacto && insight.evidencias?.length > 0 && (
          <dl className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {insight.evidencias.slice(0, 6).map((e, i) => (
              <div key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="truncate text-[11px] font-semibold text-slate-500">{e.rotulo}</dt>
                <dd className="text-sm font-bold tabular-nums text-slate-900">{e.valor}</dd>
              </div>
            ))}
          </dl>
        )}

        <button type="button" onClick={() => setAberto((v) => !v)} className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-xl px-1 text-[13px] font-bold text-slate-700 hover:text-slate-900">
          Por quê? <ChevronDown size={15} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>

        {aberto && (
          <div className="space-y-3 border-t border-slate-100 pt-3 text-[13px] text-slate-700">
            {insight.fatorPrincipal && (
              <p><span className="font-bold text-slate-900">{insight.fatorPrincipal.qualificador}: </span>{insight.fatorPrincipal.texto}</p>
            )}
            {insight.possiveisCausas?.length > 0 && (
              <div>
                <p className="mb-1 font-bold text-slate-900">Possíveis causas</p>
                <ul className="space-y-1">
                  {insight.possiveisCausas.map((c) => (
                    <li key={c.id} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{c.texto}{c.historico && <span className="text-slate-500"> — {c.historico}</span>}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {insight.impacto && (
              <p className="flex flex-wrap items-center gap-1.5"><span className="font-bold text-slate-900">Impacto:</span>{insight.impacto.texto}<SeloNatureza natureza={insight.impacto.natureza} /></p>
            )}
            {insight.recomendacao && <p><span className="font-bold text-slate-900">Recomendação: </span>{insight.recomendacao}</p>}
            <p className="text-[11px] text-slate-500">Fonte: {(insight.fontes || []).map((f) => f.descricao || f.tabela).join(" · ") || "—"}{insight.periodo?.de ? ` · ${insight.periodo.de}${insight.periodo.ate && insight.periodo.ate !== insight.periodo.de ? ` a ${insight.periodo.ate}` : ""}` : ""} · confiança {insight.confianca}</p>
          </div>
        )}

        {insight.pergunta && !semPergunta && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[13px] font-semibold text-slate-800">{insight.pergunta.texto}</p>
            {respondido ? (
              <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700"><Check size={15} /> Obrigado — registrado para as próximas análises.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {insight.pergunta.opcoes.map((o) => (
                  <button key={o.id} type="button" disabled={enviando} onClick={() => responder(o.id)}
                    className="min-h-[40px] rounded-full border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-500 disabled:opacity-50">
                    {o.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {insight.acoes?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {insight.acoes.map((a, i) => (
              <button key={i} type="button" onClick={() => acao(a)}
                className={`min-h-[44px] rounded-xl px-4 text-[13px] font-bold ${i === 0 ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-300 text-slate-700 hover:border-slate-500"}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
