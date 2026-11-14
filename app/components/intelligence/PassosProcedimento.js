"use client";

// Bloco "passos" do Assistente: o procedimento que a casa cadastrou
// (Inteligência > Procedimentos da casa), em passos numerados grandes,
// para ler de relance. Desde 14/11/2026: produto e quantidade de cada passo,
// fotos e vídeos, voltagem e lugar do equipamento, "Ver como faz" (abre o
// procedimento do passo) e, em rotina e limpeza, marcar o que já fez.

import { useState } from "react";
import { Check, ChevronRight, MapPin, PlayCircle, Zap, ExternalLink } from "lucide-react";

function Midia({ m }) {
  if (m.tipo === "foto") {
    return (
      <a href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-hf-border">
        <img src={m.url} alt={m.legenda || "Foto do passo"} loading="lazy" className="max-h-56 w-full object-cover" />
      </a>
    );
  }
  if (m.tipo === "video") {
    return <video src={m.url} controls preload="none" playsInline className="max-h-64 w-full rounded-xl border border-hf-border bg-black" />;
  }
  return (
    <a href={m.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border px-3 text-[14.5px] font-semibold text-hf-text">
      <PlayCircle size={18} /> Ver vídeo <ExternalLink size={14} />
    </a>
  );
}

export default function PassosProcedimento({ bloco, onComando }) {
  const etapas = bloco?.etapas?.length ? bloco.etapas : (bloco?.passos || []).map((texto) => ({ texto }));
  const [feitos, setFeitos] = useState(() => new Set());
  if (!etapas.length) return null;
  const marcar = Boolean(bloco.marcar);
  const eq = bloco.equipamento || null;
  const alternar = (i) => setFeitos((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const pct = Math.round((feitos.size / etapas.length) * 100);

  return (
    <section className="mt-1 rounded-2xl border border-hf-border bg-hf-surface p-3.5 text-hf-text" aria-label={bloco.titulo || "Procedimento"}>
      <span className="inline-flex rounded-full border border-hf-accent/50 px-2.5 py-0.5 text-[12px] font-semibold text-hf-accent">{bloco.rotulo || "Procedimento da casa"}</span>
      {bloco.titulo ? <p className="mt-2 text-[17px] font-semibold tracking-tight">{bloco.titulo}</p> : null}
      {bloco.quando ? <p className="mt-0.5 text-[13.5px] text-hf-muted">{bloco.quando}</p> : null}

      {eq && (eq.voltagem || eq.local || eq.cuidados) && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-hf-elevated px-3 py-2.5">
          {eq.voltagem && <p className="flex items-center gap-2 text-[17px] font-bold"><Zap size={18} className="text-hf-warning" /> {eq.voltagem}</p>}
          {eq.local && <p className="flex items-start gap-2 text-[14.5px]"><MapPin size={16} className="mt-0.5 shrink-0 text-hf-muted" /> Fica: {eq.local}</p>}
          {eq.cuidados && <p className="text-[14px] text-hf-text-2">{eq.cuidados}</p>}
        </div>
      )}

      {bloco.midias?.length ? <div className="mt-3 space-y-2">{bloco.midias.map((m, i) => <Midia key={i} m={m} />)}</div> : null}

      {marcar && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-hf-elevated"><div className="h-full rounded-full bg-hf-success transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[13px] text-hf-muted">{feitos.size} de {etapas.length} feitos{pct === 100 ? " · tudo pronto" : ""}</p>
        </div>
      )}

      <ol className="mt-3 space-y-3">
        {etapas.map((e, i) => {
          const feito = feitos.has(i);
          return (
            <li key={i} className="flex gap-3">
              {marcar ? (
                <button type="button" onClick={() => alternar(i)} aria-pressed={feito} aria-label={`Passo ${i + 1}: ${feito ? "feito" : "marcar como feito"}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-semibold ${feito ? "border-hf-success bg-hf-success text-white" : "border-hf-menu text-hf-menu"}`}>
                  {feito ? <Check size={18} /> : i + 1}
                </button>
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hf-menu text-[13px] font-semibold text-white">{i + 1}</span>
              )}
              <div className={`min-w-0 flex-1 space-y-1.5 pt-0.5 ${feito ? "opacity-60" : ""}`}>
                <p className={`text-[15.5px] leading-snug ${feito ? "line-through" : ""}`}>{e.texto}</p>
                {(e.produto || e.quantidade) && (
                  <p className="flex flex-wrap gap-1.5">
                    {e.produto && <span className="rounded-full bg-hf-elevated px-2.5 py-1 text-[13.5px] font-semibold">{e.produto}</span>}
                    {e.quantidade && <span className="rounded-full bg-hf-elevated px-2.5 py-1 text-[13.5px] font-semibold">{e.quantidade}</span>}
                  </p>
                )}
                {e.detalhe && <p className="text-[14px] text-hf-text-2">{e.detalhe}</p>}
                {e.midias?.length ? <div className="space-y-2">{e.midias.map((m, j) => <Midia key={j} m={m} />)}</div> : null}
                {e.abre && onComando && (
                  <button type="button" onClick={() => onComando(e.abre.comando)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-hf-border px-3 text-[14.5px] font-semibold text-hf-text">
                    Ver como faz: {e.abre.nome} <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {bloco.gerente?.length ? (
        <div className="mt-3 rounded-xl bg-hf-warning/10 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-hf-warning">Chame o gerente quando</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14.5px]">
            {bloco.gerente.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
