"use client";

// Dias da semana em botões + hora no relógio do celular (input type="time").
// Devolve o texto curto pronto ("Ter a Dom, 11h às 23h") por onChange/onPronto.
// Regras: app/lib/horario-funcionamento.mjs.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { DIAS_SEMANA, textoDoHorario } from "../../lib/horario-funcionamento.mjs";

export default function SeletorHorario({ onConfirmar, rotuloBotao = "Responder", salvando = false, inicial = null }) {
  const [dias, setDias] = useState(inicial?.dias || []);
  const [turnos, setTurnos] = useState(inicial?.turnos || [{ abre: "", fecha: "" }]);
  const [erro, setErro] = useState("");
  const r = textoDoHorario({ dias, turnos });

  const alternar = (id) => setDias((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const mudar = (i, campo, v) => setTurnos((t) => t.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));
  const hora = "h-12 w-full rounded-xl border border-mw-borda bg-white px-3 text-center text-[17px] font-semibold text-mw-marinho outline-none focus:border-mw-agua";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[14px] font-medium text-mw-sec">Dias em que abre</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((d) => {
            const on = dias.includes(d.id);
            return (
              <button key={d.id} type="button" aria-pressed={on} onClick={() => alternar(d.id)}
                className={`h-12 rounded-xl border text-[14px] font-semibold shadow-none ${on ? "border-mw-marinho bg-mw-marinho text-white" : "border-mw-borda bg-white text-mw-marinho"}`}>
                {d.curto}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 text-[13px]">
          <button type="button" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])} className="rounded-full border border-mw-borda bg-white px-3 py-1.5 font-medium text-mw-marinho shadow-none">Todos</button>
          <button type="button" onClick={() => setDias([2, 3, 4, 5, 6, 0])} className="rounded-full border border-mw-borda bg-white px-3 py-1.5 font-medium text-mw-marinho shadow-none">Ter a Dom</button>
          <button type="button" onClick={() => setDias([1, 2, 3, 4, 5])} className="rounded-full border border-mw-borda bg-white px-3 py-1.5 font-medium text-mw-marinho shadow-none">Seg a Sex</button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[14px] font-medium text-mw-sec">Horário</p>
        {turnos.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex-1"><span className="sr-only">Abre</span><input type="time" value={t.abre} onChange={(e) => mudar(i, "abre", e.target.value)} className={hora} aria-label={`Abre (turno ${i + 1})`} /></label>
            <span className="text-[14px] text-mw-sec">às</span>
            <label className="flex-1"><span className="sr-only">Fecha</span><input type="time" value={t.fecha} onChange={(e) => mudar(i, "fecha", e.target.value)} className={hora} aria-label={`Fecha (turno ${i + 1})`} /></label>
            {i > 0 && <button type="button" aria-label="Tirar turno" onClick={() => setTurnos((x) => x.filter((_, j) => j !== i))} className="grid h-12 w-10 place-items-center text-mw-sec shadow-none"><X size={18} /></button>}
          </div>
        ))}
        {turnos.length < 2 && (
          <button type="button" onClick={() => setTurnos((x) => [...x, { abre: "", fecha: "" }])} className="flex min-h-[40px] items-center gap-1.5 text-[14px] font-medium text-mw-marinho shadow-none">
            <Plus size={16} /> Fecha no meio do dia? Adicionar 2º turno
          </button>
        )}
      </div>

      {r.texto && <p className="rounded-xl bg-mw-bg px-3 py-2 text-[15px] text-mw-marinho">{r.texto}</p>}
      {erro && <p className="text-[14px] text-hf-danger">{erro}</p>}
      <button type="button" disabled={salvando} onClick={() => (r.erro ? setErro(r.erro) : (setErro(""), onConfirmar(r.texto)))}
        className="min-h-[48px] w-full rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-40">
        {salvando ? "Salvando…" : rotuloBotao}
      </button>
    </div>
  );
}
