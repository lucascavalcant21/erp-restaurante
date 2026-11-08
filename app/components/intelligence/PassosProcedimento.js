"use client";

// Bloco "passos" do Assistente: o procedimento que a casa cadastrou
// (Inteligência > Procedimentos da casa), em passos numerados grandes,
// para ler de relance no salão.

export default function PassosProcedimento({ bloco }) {
  const passos = bloco?.passos || [];
  if (!passos.length) return null;
  return (
    <section className="mt-1 rounded-2xl border border-hf-border bg-hf-surface p-3.5 text-hf-text" aria-label={bloco.titulo || "Procedimento"}>
      <span className="inline-flex rounded-full border border-hf-accent/50 px-2.5 py-0.5 text-[12px] font-semibold text-hf-accent">{bloco.rotulo || "Procedimento da casa"}</span>
      {bloco.titulo ? <p className="mt-2 text-[17px] font-semibold tracking-tight">{bloco.titulo}</p> : null}
      {bloco.quando ? <p className="mt-0.5 text-[13.5px] text-hf-muted">{bloco.quando}</p> : null}
      <ol className="mt-3 space-y-2.5">
        {passos.map((p, i) => (
          <li key={i} className="flex gap-3 text-[15.5px] leading-snug">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hf-menu text-[13px] font-semibold text-white">{i + 1}</span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
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
