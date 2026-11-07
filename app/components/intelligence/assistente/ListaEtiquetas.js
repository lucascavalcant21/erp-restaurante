"use client";

// LISTA DE ETIQUETAS NA CONVERSA (pedido do dono, 07/11/2026): o assistente
// entende o pedido, pergunta se quer mais e mostra as etiquetas que a casa
// sempre pede. Um toque inclui; quantidade e validade de cada uma se ajustam
// aqui; "Imprimir" abre a tela de Etiquetas com a fila montada (lá ficam quem
// etiquetou, a prévia e a confirmação, porque imprimir dá entrada no estoque).

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Printer } from "lucide-react";
import { MAX_COPIAS, MAX_ITENS, chaveDeNome, loteParaUrl } from "../../../lib/etiquetas-pedido.mjs";

const rotuloDias = (d) => (d === 0 ? "No dia" : d === 1 ? "1 dia" : `${d} dias`);
const limitar = (n) => Math.max(1, Math.min(MAX_COPIAS, Math.floor(Number(n) || 1)));

function Linha({ l, validades, mudar }) {
  const opcoesDias = useMemo(() => [...new Set([...(l.dias != null ? [l.dias] : []), ...validades])].sort((a, b) => a - b), [l.dias, validades]);
  // a validade escolhida fica à vista mesmo quando a fileira rola (90 dias está no fim)
  // (rola só a fileira, nunca a conversa)
  const fileira = useRef(null);
  const escolhida = useRef(null);
  useEffect(() => {
    const f = fileira.current; const c = escolhida.current;
    if (l.marcado && f && c) f.scrollLeft = Math.max(0, c.offsetLeft - f.offsetLeft - (f.clientWidth - c.clientWidth) / 2);
  }, [l.marcado, l.dias]);
  return (
    <li className="rounded-lg border px-2 py-1.5" style={{ borderColor: l.marcado ? "var(--wa-verde)" : "rgba(0,0,0,0.08)", background: l.marcado ? "rgba(0,122,99,0.06)" : "transparent" }}>
      <button type="button" aria-pressed={l.marcado} onClick={() => mudar({ marcado: !l.marcado })} className="flex min-h-[44px] w-full items-center gap-2 text-left">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2" style={{ borderColor: "var(--wa-verde)", background: l.marcado ? "var(--wa-verde)" : "transparent" }}>
          {l.marcado && <Check size={16} className="text-white" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold">{l.nome}</span>
          {!l.marcado && l.vezes ? <span className="block text-[12.5px]" style={{ color: "var(--wa-meta)" }}>Costuma pedir {l.copias}{l.dias != null ? ` · ${rotuloDias(l.dias)}` : ""}</span> : null}
          {l.marcado && l.origem === "Nome livre" ? <span className="block text-[12.5px]" style={{ color: "var(--wa-meta)" }}>Nome livre: sem entrada no estoque</span> : null}
        </span>
        {l.marcado && <span className="shrink-0 text-right text-[15px] font-bold tabular-nums" style={{ color: "var(--wa-verde-escuro)" }}>{l.copias}×<span className="block text-[12px] font-semibold">{l.dias != null ? rotuloDias(l.dias) : "validade padrão"}</span></span>}
      </button>
      {l.marcado && (
        <div className="mt-1 space-y-1.5 pb-1">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px]" style={{ color: "var(--wa-meta)" }}>Quantidade</span>
            <button type="button" aria-label={`Menos uma etiqueta de ${l.nome}`} onClick={() => mudar({ copias: limitar(l.copias - 1) })} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><Minus size={16} /></button>
            <input inputMode="numeric" aria-label={`Quantidade de etiquetas de ${l.nome}`} value={l.copias} onChange={(e) => mudar({ copias: e.target.value.replace(/\D/g, "").slice(0, 3) })} onBlur={() => mudar({ copias: limitar(l.copias) })}
              className="h-10 w-14 rounded-md border border-black/10 bg-white text-center text-[16px] font-bold tabular-nums outline-none" />
            <button type="button" aria-label={`Mais uma etiqueta de ${l.nome}`} onClick={() => mudar({ copias: limitar(Number(l.copias) + 1) })} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><Plus size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px]" style={{ color: "var(--wa-meta)" }}>Validade</span>
            <div ref={fileira} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5" role="group" aria-label={`Validade de ${l.nome}`}>
              {l.dias == null && <span className="flex min-h-[36px] shrink-0 items-center rounded-full bg-white px-2.5 text-[13px] font-semibold" style={{ color: "var(--wa-verde-escuro)", outline: "2px solid var(--wa-verde)" }}>Padrão</span>}
              {opcoesDias.map((d) => (
                <button key={d} ref={l.dias === d ? escolhida : null} type="button" aria-pressed={l.dias === d} onClick={() => mudar({ dias: l.dias === d ? null : d })}
                  className="min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold"
                  style={l.dias === d ? { background: "var(--wa-verde)", color: "#fff" } : { background: "#fff", color: "var(--wa-texto)" }}>{rotuloDias(d)}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ListaEtiquetas({ bloco, onRota }) {
  const validades = bloco.validades?.length ? bloco.validades : [1, 3, 7, 15, 30, 60, 90];
  const [linhas, setLinhas] = useState(() => [
    ...(bloco.selecionadas || []).map((i) => ({ ...i, copias: limitar(i.copias), marcado: true })),
    ...(bloco.habituais || []).map((i) => ({ ...i, copias: limitar(i.copias), marcado: false })),
  ]);
  const [outra, setOutra] = useState("");
  const marcadas = linhas.filter((l) => l.marcado);
  const total = marcadas.reduce((t, l) => t + limitar(l.copias), 0);
  const mudar = (k, campos) => setLinhas((ls) => ls.map((l, i) => (i === k ? { ...l, ...campos } : l)));

  function incluirOutra(e) {
    e.preventDefault();
    const nome = outra.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!nome) return;
    const k = linhas.findIndex((l) => chaveDeNome(l.nome) === chaveDeNome(nome));
    if (k >= 0) mudar(k, { marcado: true });
    else setLinhas((ls) => [...ls, { nome: nome.charAt(0).toLocaleUpperCase("pt-BR") + nome.slice(1), copias: 1, dias: null, marcado: true, origem: null }]);
    setOutra("");
  }

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1">
        {linhas.map((l, i) => <Linha key={`${l.nome}-${i}`} l={l} validades={validades} mudar={(c) => mudar(i, c)} />)}
      </ul>
      <form onSubmit={incluirOutra} className="flex gap-1.5">
        <input value={outra} maxLength={80} onChange={(e) => setOutra(e.target.value)} placeholder="Outra etiqueta" aria-label="Nome de outra etiqueta"
          className="h-11 min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 text-[16px] outline-none" />
        <button type="submit" aria-label="Incluir etiqueta" className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white shadow-sm" style={{ color: "var(--wa-verde-escuro)" }}><Plus size={20} /></button>
      </form>
      <button type="button" disabled={!marcadas.length || marcadas.length > MAX_ITENS}
        onClick={() => onRota?.(loteParaUrl(marcadas.map((l) => ({ nome: l.nome, copias: limitar(l.copias), dias: l.dias }))))}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md text-[16px] font-semibold text-white disabled:opacity-50" style={{ background: "var(--wa-verde-escuro)" }}>
        <Printer size={18} />{marcadas.length ? `Imprimir ${total} etiqueta${total === 1 ? "" : "s"}` : "Toque nas etiquetas que quer"}
      </button>
      {marcadas.length > MAX_ITENS && <p className="text-[12.5px] text-amber-700">Até {MAX_ITENS} produtos por vez.</p>}
      <p className="text-[12.5px]" style={{ color: "var(--wa-meta)" }}>Na tela de Etiquetas você escolhe quem etiquetou, confere a prévia e imprime.</p>
    </div>
  );
}
