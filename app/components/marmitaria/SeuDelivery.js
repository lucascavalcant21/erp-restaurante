"use client";

// Passo 1: o nome e o segmento do delivery (16/11/2026).
import { useEffect, useState } from "react";
import { Aviso, Botao, Campo, Secao, inputCls } from "./ui";
import { useJornada } from "./useJornada";
import { SEGMENTOS, normalizarDelivery } from "../../lib/marmitaria/delivery.mjs";

export default function SeuDelivery() {
  const { delivery, salvarDelivery } = useJornada();
  const [d, setD] = useState({ nome: "", segmento: null });
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (delivery) setD({ nome: delivery.nome || "", segmento: delivery.segmento || null }); }, [delivery]);

  async function salvar() {
    const n = normalizarDelivery(d);
    if (!n.nome) return setMsg({ tipo: "alerta", texto: "Dê um nome ao delivery." });
    setSalvando(true); setMsg(null);
    const r = await salvarDelivery(n);
    setSalvando(false);
    setMsg(r?.error ? { tipo: "alerta", texto: r.error } : { tipo: "info", texto: "Delivery salvo." });
  }

  return (
    <Secao titulo="Seu delivery" subtitulo="O nome que aparece no topo e o tipo de comida que você vende.">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Campo rotulo="Nome do delivery"><input className={inputCls} value={d.nome} maxLength={40} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Ex.: Marmitas da Casa, Hamburgueria" /></Campo>
        <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
      </div>
      <p className="mb-1.5 mt-3 text-[13px] font-medium text-hf-muted">Segmento</p>
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTOS.map((s) => (
          <button key={s.id} type="button" aria-pressed={d.segmento === s.id} onClick={() => setD({ ...d, segmento: s.id })}
            className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${d.segmento === s.id ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border text-hf-text-2"}`}>{s.rotulo}</button>
        ))}
      </div>
      {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
    </Secao>
  );
}
