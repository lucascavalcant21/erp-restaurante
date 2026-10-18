"use client";

// Prévia ao vivo: o cardápio de verdade (/cardapio/[u]?previa=1) numa
// moldura do tamanho do aparelho escolhido. O editor manda o rascunho já
// montado por mensagem; nada é gravado nem pedido na prévia. Trocar o
// aparelho mostra como o cardápio fica em pé e deitado.

import { useEffect, useRef, useState } from "react";
import { Smartphone, Tablet } from "lucide-react";

export const APARELHOS = [
  { id: "celular", rotulo: "Celular", w: 390, h: 844, Icone: Smartphone },
  { id: "celular-deitado", rotulo: "Celular deitado", w: 844, h: 390, Icone: Smartphone, deitado: true },
  { id: "tablet", rotulo: "Tablet", w: 820, h: 1180, Icone: Tablet },
  { id: "tablet-deitado", rotulo: "Tablet deitado", w: 1180, h: 820, Icone: Tablet, deitado: true },
];

export default function Previa({ unidadeId, cardapio, alturaMax = 720, aparelhoInicial = "celular" }) {
  const [aparelho, setAparelho] = useState(aparelhoInicial);
  const [largura, setLargura] = useState(360);
  const moldura = useRef(null);
  const frame = useRef(null);
  const ultimo = useRef(cardapio);
  ultimo.current = cardapio;
  const a = APARELHOS.find((x) => x.id === aparelho) || APARELHOS[0];
  const escala = Math.min(1, largura / a.w, alturaMax / a.h);

  useEffect(() => {
    const el = moldura.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const enviar = () => {
    const w = frame.current?.contentWindow;
    if (w && ultimo.current) w.postMessage({ tipo: "hefisto-cardapio-previa", cardapio: ultimo.current }, window.location.origin);
  };
  useEffect(() => {
    const aoReceber = (e) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.tipo === "hefisto-cardapio-previa-pronta") enviar();
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, []);
  useEffect(() => { const t = setTimeout(enviar, 120); return () => clearTimeout(t); }, [cardapio]);

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Aparelho da prévia" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-hf-elevated p-1 sm:grid-cols-4">
        {APARELHOS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={aparelho === x.id} onClick={() => setAparelho(x.id)}
            className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${aparelho === x.id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
            <x.Icone size={14} className={x.deitado ? "rotate-90" : ""} /> {x.rotulo}
          </button>
        ))}
      </div>
      <div ref={moldura} className="flex w-full justify-center">
        <div style={{ width: a.w * escala, height: a.h * escala }} className="overflow-hidden rounded-[18px] border-[6px] border-hf-text/80 bg-hf-surface shadow-lg">
          <iframe
            ref={frame}
            title="Prévia do cardápio"
            src={`/cardapio/${encodeURIComponent(unidadeId)}?previa=1`}
            onLoad={enviar}
            style={{ width: a.w, height: a.h, transform: `scale(${escala})`, transformOrigin: "0 0", border: 0, display: "block" }}
          />
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-hf-muted">Prévia com o que ainda não foi salvo. Pedidos ficam desligados aqui.</p>
    </div>
  );
}
