"use client";

// Cartão de insight: SITUAÇÃO → EVIDÊNCIA → [Por quê?] POSSÍVEIS CAUSAS →
// IMPACTO → RECOMENDAÇÃO, com a pergunta (opções clicáveis = feedback que a
// unidade "ensina") e ações (abrir tela ou mandar um comando ao Héfisto).

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X, Check, Loader2, AlertTriangle } from "lucide-react";
import { SeloNatureza } from "./Blocos";

export const NIVEIS = {
  critico: { rotulo: "Crítico", barra: "bg-hf-danger", selo: "bg-rose-50 text-rose-800 ring-rose-200" },
  importante: { rotulo: "Importante", barra: "bg-amber-500", selo: "bg-amber-50 text-amber-800 ring-amber-200" },
  oportunidade: { rotulo: "Oportunidade", barra: "bg-hf-accent", selo: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  informacao: { rotulo: "Informação", barra: "bg-zinc-400", selo: "bg-hf-elevated text-hf-text-2 ring-hf-border" },
};

const MODULO = { estoque: "Estoque", compras: "Compras", financeiro: "Financeiro", vendas: "Vendas", rh: "RH" };

const InsightCartao = memo(function InsightCartao({ insight, onComando, onResponder, onDispensar, compacto = false, semPergunta = false }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [respondido, setRespondido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [erroLocal, setErroLocal] = useState(null);
  const n = NIVEIS[insight.nivel] || NIVEIS.informacao;

  async function responder(opcao) {
    if (!onResponder || enviando) return;
    setEnviando(true);
    setErroLocal(null);
    try {
      const ok = await onResponder(insight, opcao);
      if (ok) {
        setRespondido(opcao);
      } else {
        setErroLocal("Não foi possível registrar agora. Tente novamente.");
      }
    } catch {
      setErroLocal("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function dispensar() {
    if (!onDispensar || dispensando) return;
    setDispensando(true);
    setErroLocal(null);
    try {
      const ok = await onDispensar(insight);
      if (ok === false) {
        setErroLocal("Não foi possível dispensar o alerta agora.");
      }
    } catch {
      setErroLocal("Sem conexão para dispensar o alerta.");
    } finally {
      setDispensando(false);
    }
  }

  function acao(a) {
    if (a.rota) router.push(a.rota);
    else if (a.comando && onComando) onComando(a.comando);
  }

  return (
    <article className="hf-animate-in relative overflow-hidden rounded-2xl border border-hf-border bg-hf-surface transition-all duration-200 hover:border-hf-border-strong">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${n.barra}`} aria-hidden="true" />
      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ring-1 ${n.selo}`}>{n.rotulo}</span>
            {MODULO[insight.modulo] && <span className="text-[12px] font-bold text-hf-text-2">{MODULO[insight.modulo]}</span>}
          </div>
          {onDispensar && !respondido && (
            <button
              type="button"
              disabled={dispensando}
              onClick={dispensar}
              aria-label="Dispensar por 7 dias"
              title="Dispensar por 7 dias"
              className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-hf-muted transition-colors hover:bg-hf-elevated hover:text-hf-text disabled:opacity-50"
            >
              {dispensando ? <Loader2 size={15} className="animate-spin" /> : <X size={16} />}
            </button>
          )}
        </div>

        <h3 className="mt-2 text-[15px] sm:text-base font-extrabold leading-snug text-hf-text">{insight.titulo}</h3>
        <p className="mt-1 text-[13px] sm:text-[14px] leading-relaxed text-hf-text-2">{insight.situacao}</p>

        {!compacto && insight.evidencias?.length > 0 && (
          <dl className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {insight.evidencias.slice(0, 6).map((e, i) => (
              <div key={i} className="rounded-xl border border-hf-border/70 bg-hf-elevated/60 px-3 py-2">
                <dt className="truncate text-[11px] font-bold uppercase tracking-wide text-hf-text-2">{e.rotulo}</dt>
                <dd className="mt-0.5 text-sm font-black tabular-nums text-hf-text">{e.valor}</dd>
              </div>
            ))}
          </dl>
        )}

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2 -ml-2 text-[13px] font-bold text-hf-text-2 transition-colors hover:bg-hf-elevated hover:text-hf-text"
        >
          Por quê? <ChevronDown size={15} className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
        </button>

        {aberto && (
          <div className="hf-animate-in space-y-3 border-t border-hf-border pt-3.5 text-[13px] text-hf-text">
            {insight.fatorPrincipal && (
              <p><span className="font-bold text-hf-text">{insight.fatorPrincipal.qualificador}: </span>{insight.fatorPrincipal.texto}</p>
            )}
            {insight.possiveisCausas?.length > 0 && (
              <div>
                <p className="mb-1.5 font-bold text-hf-text">Possíveis causas</p>
                <ul className="space-y-1.5">
                  {insight.possiveisCausas.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hf-muted" />
                      <span>{c.texto}{c.historico && <span className="text-hf-text-2"> — {c.historico}</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insight.impacto && (
              <p className="flex flex-wrap items-center gap-1.5"><span className="font-bold text-hf-text">Impacto:</span>{insight.impacto.texto}<SeloNatureza natureza={insight.impacto.natureza} /></p>
            )}
            {insight.recomendacao && <p><span className="font-bold text-hf-text">Recomendação: </span>{insight.recomendacao}</p>}
            <p className="text-[11px] font-medium text-hf-muted">
              Fonte: {(insight.fontes || []).map((f) => f.descricao || f.tabela).join(" · ") || "—"}
              {insight.periodo?.de ? ` · ${insight.periodo.de}${insight.periodo.ate && insight.periodo.ate !== insight.periodo.de ? ` a ${insight.periodo.ate}` : ""}` : ""} · confiança {insight.confianca}
            </p>
          </div>
        )}

        {insight.pergunta && !semPergunta && (
          <div className="mt-3 rounded-xl border border-hf-border bg-hf-elevated/60 p-3.5">
            <p className="text-[13px] font-bold text-hf-text">{insight.pergunta.texto}</p>
            {respondido ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-hf-accent">
                <Check size={15} /> Obrigado — registrado para as próximas análises.
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {insight.pergunta.opcoes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={enviando}
                    onClick={() => responder(o.id)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-hf-border-strong bg-hf-surface px-3.5 text-[13px] font-semibold text-hf-text shadow-xs transition hover:border-hf-accent hover:text-hf-accent disabled:opacity-50"
                  >
                    {enviando && <Loader2 size={13} className="animate-spin" />}
                    {o.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {erroLocal && (
          <p role="alert" className="mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-hf-warning">
            <AlertTriangle size={14} className="shrink-0" /> {erroLocal}
          </p>
        )}

        {insight.acoes?.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {insight.acoes.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => acao(a)}
                className={`min-h-[44px] rounded-xl px-4 text-[13px] font-bold transition active:scale-[0.98] ${
                  i === 0
                    ? "bg-hf-accent text-hf-accent-fg shadow-xs hover:bg-emerald-800"
                    : "border border-hf-border-strong bg-hf-surface text-hf-text hover:border-hf-text"
                }`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
});

export default InsightCartao;
