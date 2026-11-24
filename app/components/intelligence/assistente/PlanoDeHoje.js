"use client";

// "O que eu faço agora?" no Nico: o plano do dia que o dono aprovou (o Jhon
// combinou com o Nico). A equipe toca para marcar feito; o Jhon vê o
// andamento. "Ver como faz" abre a ficha ou o procedimento da tarefa.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { lerPlanoDeHoje, marcarTarefa } from "../../../lib/plano-dia-dados";
import { andamento, comandoDaTarefa } from "../../../lib/plano-dia.mjs";

export default function PlanoDeHoje({ unidadeId, onComando, desabilitado = false }) {
  const [dados, setDados] = useState(null);
  const [marcando, setMarcando] = useState(null);
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    if (!unidadeId) return;
    setDados(await lerPlanoDeHoje(unidadeId).catch(() => null));
  }, [unidadeId]);
  useEffect(() => {
    ler();
    const t = setInterval(ler, 60 * 1000);
    return () => clearInterval(t);
  }, [ler]);

  if (!dados?.plano || !dados.tarefas.length) return null;
  const a = andamento(dados.tarefas);

  async function alternar(t) {
    if (!dados.comProgresso || marcando) return;
    setMarcando(t.id); setErro("");
    const r = await marcarTarefa(t.id, !t.feitoEm, t.responsavelNome);
    setMarcando(null);
    if (r.error) setErro(r.error); else ler();
  }

  return (
    <div className="flex justify-start px-3 pb-1.5 sm:px-[6%]">
      <section className="w-full max-w-[82%] rounded-[16px] p-3.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[520px]" style={{ background: "var(--wa-ele)" }} aria-label="Plano de hoje">
        <p className="text-[13px] font-semibold" style={{ color: "var(--wa-verde-escuro)" }}>Plano de hoje · combinado com o Jhon</p>
        <p className="mt-0.5 text-[16px] font-semibold">{a.feitas === a.total ? "Tudo feito. Bom trabalho!" : a.proxima ? `Agora: ${a.proxima.titulo}` : ""}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full transition-all" style={{ width: `${a.pct}%`, background: "var(--wa-verde-escuro)" }} /></div>
        <p className="mt-1 text-[13px]" style={{ color: "var(--wa-meta)" }}>{a.feitas} de {a.total} feitas</p>
        <ol className="mt-3 space-y-2.5">
          {dados.tarefas.map((t) => {
            const comando = comandoDaTarefa(t);
            return (
              <li key={t.id || t.ordem} className="flex gap-3">
                <button type="button" onClick={() => alternar(t)} disabled={!dados.comProgresso || desabilitado}
                  aria-pressed={!!t.feitoEm} aria-label={`${t.titulo}: ${t.feitoEm ? "feito" : "marcar como feito"}`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-semibold ${t.feitoEm ? "text-white" : ""}`}
                  style={t.feitoEm ? { background: "var(--wa-verde-escuro)", borderColor: "var(--wa-verde-escuro)" } : { borderColor: "var(--wa-verde-escuro)", color: "var(--wa-verde-escuro)" }}>
                  {marcando === t.id ? <Loader2 size={16} className="animate-spin" /> : t.feitoEm ? <Check size={18} /> : t.ordem}
                </button>
                <div className={`min-w-0 flex-1 pt-0.5 ${t.feitoEm ? "opacity-60" : ""}`}>
                  <p className={`text-[15.5px] font-semibold leading-snug ${t.feitoEm ? "line-through" : ""}`}>{t.titulo}</p>
                  <p className="text-[13.5px]" style={{ color: "var(--wa-meta)" }}>
                    {[t.quantidade != null ? `${t.quantidade.toLocaleString("pt-BR")} ${t.unidade || ""}`.trim() : null, t.responsavelNome, t.depoisDoIntervalo ? "depois do intervalo" : null].filter(Boolean).join(" · ")}
                  </p>
                  {comando && !t.feitoEm && (
                    <button type="button" disabled={desabilitado} onClick={() => onComando(comando)}
                      className="mt-1 inline-flex min-h-[40px] items-center gap-1 text-[14.5px] font-semibold" style={{ color: "var(--wa-verde-escuro)" }}>
                      Ver como faz <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {erro && <p className="mt-2 text-[13px] text-hf-danger">{erro}</p>}
      </section>
    </div>
  );
}
