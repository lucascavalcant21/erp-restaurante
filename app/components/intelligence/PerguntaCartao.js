"use client";

// PERGUNTA DO HÉFISTO — uma inconsistência que só a equipe sabe explicar
// ("O que ocorreu com aproximadamente 3,6 kg de camarão?"). A resposta vira
// feedback ESTRUTURADO no servidor (com a evidência recalculada lá) e passa a
// reordenar as hipóteses da unidade. Não executa nada: se foi perda, o
// Héfisto oferece registrar a perda — com prévia e confirmação, como sempre.

import { useState } from "react";
import { Check, HelpCircle } from "lucide-react";

export default function PerguntaCartao({ pergunta, onResponder, onComando }) {
  const [respondido, setRespondido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const evid = (pergunta.evidencias || []).slice(0, 3);

  async function responder(o) {
    if (enviando) return;
    setEnviando(true); setErro(null);
    const ok = await onResponder(pergunta, o.id);
    setEnviando(false);
    if (ok) setRespondido(o); else setErro("Não consegui registrar agora. Tente de novo.");
  }

  return (
    <article className="rounded-2xl border border-sky-200 bg-white p-4">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-sky-700"><HelpCircle size={14} /> Pergunta do Héfisto</p>
      {pergunta.situacao && <p className="mt-2 text-[14px] leading-snug text-slate-700">{pergunta.situacao}</p>}
      {evid.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-slate-600">
          {evid.map((e, i) => <li key={i}><span className="font-semibold">{e.rotulo}:</span> {e.valor}</li>)}
        </ul>
      )}
      <p className="mt-3 text-[15px] font-bold text-slate-900">{pergunta.texto}</p>
      {respondido ? (
        <div className="mt-2 space-y-2">
          <p className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700"><Check size={15} /> Registrado: {respondido.rotulo}. Vou usar isso nas próximas análises.</p>
          {respondido.id === "perda" && pergunta.entidade?.nome && onComando && (
            <button type="button" onClick={() => onComando(`Registrar perda de ${pergunta.entidade.nome}`)}
              className="block min-h-[44px] rounded-xl bg-slate-900 px-4 text-[13px] font-bold text-white hover:bg-slate-800">
              Registrar a perda de {pergunta.entidade.nome}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {(pergunta.opcoes || []).map((o) => (
            <button key={o.id} type="button" disabled={enviando} onClick={() => responder(o)}
              className="min-h-[44px] rounded-full border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:border-slate-500 disabled:opacity-50">
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mt-2 text-[12px] text-amber-700">{erro}</p>}
    </article>
  );
}
