"use client";

// Cartão da sequência da marmitaria (16/11/2026). Enquanto a implantação não
// acabou: os nove passos, na ordem, com o que falta em cada um e o botão do
// próximo. Depois: só os passos que voltaram a ficar pendentes, como aviso.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { Aviso, Secao } from "./ui";
import { useJornada } from "./useJornada";

function Icone({ status }) {
  if (status === "feito") return <CheckCircle2 size={20} className="shrink-0 text-hf-success" aria-label="Pronto" />;
  if (status === "sem_dado") return <HelpCircle size={20} className="shrink-0 text-hf-muted" aria-label="Não conferido" />;
  return <Circle size={20} className="shrink-0 text-hf-border-strong" aria-label="Pendente" />;
}

export default function JornadaDaMarmitaria() {
  const { jornada, concluir } = useJornada();
  const [pulando, setPulando] = useState(false);
  if (!jornada) return null;

  if (jornada.concluida) {
    const pendentes = jornada.passos.filter((p) => p.status === "pendente");
    if (!pendentes.length) return null;
    return (
      <Aviso tipo="alerta">
        <p className="font-semibold">Cadastro com pendência:</p>
        <ul className="mt-1 space-y-1">
          {pendentes.map((p) => (
            <li key={p.id}><Link href={p.rota} className="underline underline-offset-2">{p.titulo}</Link>: {p.detalhe}</li>
          ))}
        </ul>
      </Aviso>
    );
  }

  const prox = jornada.proximo;
  return (
    <Secao titulo="Implantação da marmitaria" subtitulo={`${jornada.feitos} de ${jornada.total} passos prontos. Siga na ordem: cada passo usa o anterior para chegar ao custo e ao preço exatos.`}>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-hf-elevated" aria-hidden="true">
        <div className="h-full rounded-full bg-hf-accent transition-all" style={{ width: `${jornada.pct}%` }} />
      </div>
      {prox && (
        <Link href={prox.rota} className="mb-3 flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-hf-accent px-4 py-2 text-white hover:brightness-110">
          <span className="min-w-0">
            <span className="block text-[12px] font-medium opacity-90">Próximo passo</span>
            <span className="block truncate font-bold">{prox.numero}. {prox.titulo}</span>
          </span>
          <ArrowRight size={20} className="shrink-0" />
        </Link>
      )}
      <ol className="divide-y divide-hf-border">
        {jornada.passos.map((p) => (
          <li key={p.id}>
            <Link href={p.rota} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-hf-elevated/60">
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-hf-muted">{p.numero}</span>
              <Icone status={p.status} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${p.status === "feito" ? "text-hf-muted" : "text-hf-text"}`}>{p.titulo}</span>
                <span className="block text-[12px] text-hf-muted">{p.status === "feito" ? p.detalhe : `${p.texto} ${p.detalhe || ""}`}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-t border-hf-border pt-3 text-[12px] text-hf-muted">
        Já usa a marmitaria há tempo?{" "}
        <button type="button" disabled={pulando} onClick={async () => { setPulando(true); await concluir(); setPulando(false); }}
          className="min-h-[40px] font-semibold text-hf-text underline underline-offset-2 disabled:opacity-50">
          {pulando ? "Salvando…" : "Ir direto para o dia a dia"}
        </button>
        {" "}(o que faltar continua aparecendo aqui como aviso).
      </div>
    </Secao>
  );
}
