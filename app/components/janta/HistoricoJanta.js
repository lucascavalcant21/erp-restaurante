"use client";

// Histórico da janta (dono, 24/11/2026): quanto custou cada dia e por pessoa,
// com o resumo do mês. Contas em app/lib/janta-historico.mjs.

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { mesesDoHistorico, resumoDoMes } from "../../lib/janta-historico.mjs";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBR = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const rotuloMes = (m) => { const [a, mm] = m.split("-"); const t = new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };

export default function HistoricoJanta({ historico, carregando, onRemover }) {
  const meses = useMemo(() => mesesDoHistorico(historico), [historico]);
  const [mes, setMes] = useState("");
  const mesSel = mes || meses[0] || new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const r = useMemo(() => resumoDoMes(historico, mesSel), [historico, mesSel]);

  if (carregando) return <p className="p-6 text-center text-sm font-bold text-hf-text-2">Carregando o histórico…</p>;
  if (!historico.length) {
    return (
      <div className="rounded-3xl border border-dashed border-hf-border p-6 text-center text-sm text-hf-text-2">
        Nenhuma janta registrada ainda. Em <b>Montar a semana</b>, depois de confirmar quantas pessoas jantaram, toque em <b>Registrar no histórico</b>.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {meses.map((m) => (
          <button key={m} type="button" aria-pressed={mesSel === m} onClick={() => setMes(m)}
            className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${mesSel === m ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>{rotuloMes(m)}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Gasto no mês", brl(r.custoTotal), `${r.diasComCusto} de ${r.dias} dia(s) com custo`], ["Média por dia", brl(r.mediaPorDia), "nos dias com custo"], ["Média por pessoa", brl(r.mediaPorPessoa), "por janta servida"], ["Jantas servidas", r.pessoas.toLocaleString("pt-BR"), `em ${r.dias} dia(s)`]].map(([t, v, nota]) => (
          <div key={t} className="min-w-0 rounded-2xl border border-hf-border bg-hf-surface p-3">
            <p className="text-xs font-bold text-hf-text-2">{t}</p>
            <p className="truncate text-xl font-black tabular-nums text-hf-text">{v}</p>
            <p className="text-[11px] text-hf-muted">{nota}</p>
          </div>
        ))}
      </div>
      {r.natureza === "ESTIMATIVA" && <p className="text-xs font-semibold text-hf-warning">ESTIMATIVA: algum dia teve item sem preço no cadastro (ou ficou sem custo). Ponha o preço do produto para o valor ficar exato.</p>}
      <ul className="divide-y divide-hf-border rounded-3xl border border-hf-border bg-hf-surface">
        {r.lista.map((h) => (
          <li key={h.data} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold capitalize text-hf-text">{dataBR(h.data)}</p>
              <p className="truncate text-[12px] text-hf-muted">{h.pessoas} pessoa(s){h.pratos?.length ? ` · ${h.pratos.join(", ")}` : ""}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-black tabular-nums text-hf-text">{brl(h.custo)}</p>
              <p className="text-[12px] tabular-nums text-hf-text-2">{h.custoPorPessoa != null ? `${brl(h.custoPorPessoa)} por pessoa` : "sem custo"}{h.natureza === "ESTIMATIVA" ? " · estimativa" : ""}</p>
            </div>
            {onRemover && (
              <button type="button" aria-label={`Tirar ${h.data} do histórico`} onClick={() => { if (confirm("Tirar este dia do histórico?")) onRemover(h.data); }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-hf-muted hover:text-hf-danger"><Trash2 size={15} /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
