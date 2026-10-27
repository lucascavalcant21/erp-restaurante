"use client";

// PERGUNTA DO HÉFISTO — uma inconsistência que só a equipe sabe explicar
// ("O que ocorreu com aproximadamente 3,6 kg de camarão?"). A resposta vira
// feedback ESTRUTURADO no servidor (com a evidência recalculada lá) e passa a
// reordenar as hipóteses da unidade. Não executa nada: se foi perda, o
// Héfisto oferece registrar a perda — com prévia e confirmação, como sempre.

import { memo, useState } from "react";
import { Check, HelpCircle, Loader2, AlertTriangle } from "lucide-react";

const PerguntaCartao = memo(function PerguntaCartao({ pergunta, onResponder, onComando }) {
  const [respondido, setRespondido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const evid = (pergunta.evidencias || []).slice(0, 3);

  async function responder(o) {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const ok = await onResponder(pergunta, o.id);
      if (ok) {
        setRespondido(o);
      } else {
        setErro("Não consegui registrar agora. Verifique a conexão e tente de novo.");
      }
    } catch {
      setErro("Falha de rede ao enviar resposta. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="hf-animate-in rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5 transition-all duration-200 hover:border-hf-border-strong">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-hf-accent">
        <HelpCircle size={14} /> Pergunta do Héfisto
      </p>
      {pergunta.situacao && <p className="mt-2 text-[14px] leading-relaxed text-hf-text-2">{pergunta.situacao}</p>}
      {evid.length > 0 && (
        <ul className="mt-2.5 space-y-1 rounded-xl bg-hf-elevated/60 p-3 text-[12px] text-hf-text-2">
          {evid.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="font-semibold">{e.rotulo}:</span>
              <span className="font-bold tabular-nums text-hf-text">{e.valor}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[15px] font-extrabold text-hf-text">{pergunta.texto}</p>
      {respondido ? (
        <div className="hf-animate-in mt-2.5 space-y-2.5">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-hf-accent">
            <Check size={15} /> Registrado: {respondido.rotulo}. Vou usar isso nas próximas análises.
          </p>
          {respondido.id === "perda" && pergunta.entidade?.nome && onComando && (
            <button
              type="button"
              onClick={() => onComando(`Registrar perda de ${pergunta.entidade.nome}`)}
              className="block min-h-[44px] rounded-xl bg-hf-accent px-4 text-[13px] font-bold text-hf-accent-fg shadow-xs transition hover:bg-emerald-800"
            >
              Registrar a perda de {pergunta.entidade.nome}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {(pergunta.opcoes || []).map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={enviando}
              onClick={() => responder(o)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-hf-border-strong bg-hf-surface px-4 text-[13px] font-semibold text-hf-text shadow-xs transition hover:border-hf-accent hover:text-hf-accent disabled:opacity-50"
            >
              {enviando && <Loader2 size={13} className="animate-spin" />}
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-hf-warning">
          <AlertTriangle size={14} className="shrink-0" /> {erro}
        </p>
      )}
    </article>
  );
});

export default PerguntaCartao;
