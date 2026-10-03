"use client";

// Lista de compras do evento: listaDeComprasDoOrcamento (evento-orcamento.mjs).
// Fichas exclusivas entram pelos ingredientes cadastrados no evento.
// Cada prato × porções servidas, abrindo os pré-preparos até o cru, com a
// quantidade BRUTA (perda do ingrediente) e o custo de compra. A versão
// anterior lia colunas que não existem no cadastro (custo_unit, peso_unit) e
// ignorava rendimento, perda e subfichas.

import { useState } from "react";
import { ShoppingCart, Printer, AlertTriangle } from "lucide-react";
import { fmtReais, fmtPct, percentualDe } from "../../../../lib/valor-percentual.mjs";

// 1.250 g → "1,25 kg"; 0,35 kg → "350 g".
function fmtQtd(q, unidade) {
  const u = String(unidade || "").toLowerCase();
  const n = Number(q) || 0;
  const num = (x, c = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: c });
  if (u === "g" && n >= 1000) return `${num(n / 1000, 3)} kg`;
  if (u === "ml" && n >= 1000) return `${num(n / 1000, 3)} L`;
  if (u === "kg" && n > 0 && n < 1) return `${num(n * 1000, 0)} g`;
  if (u === "l" && n > 0 && n < 1) return `${num(n * 1000, 0)} ml`;
  return `${num(n, 3)} ${u === "l" ? "L" : u}`;
}

export default function ComprasTab({ lista, valor = 0, nItens = 0 }) {
  const [marcados, setMarcados] = useState(() => new Set());
  const alternar = (k) => setMarcados((m) => { const n = new Set(m); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden print:border-none print:shadow-none">
      <header className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-end gap-3 bg-white">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2"><ShoppingCart className="text-emerald-600"/> Lista de compras</h2>
          <p className="text-slate-700 font-medium text-sm mt-1">
            Para {nItens} produto(s) do cardápio, com a quantidade bruta (já com a perda de cada ingrediente) e os pré-preparos abertos até o ingrediente cru.
          </p>
        </div>
        <button onClick={() => window.print()} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold flex items-center gap-2 hover:bg-slate-100 print:hidden">
          <Printer size={16}/> Imprimir lista
        </button>
      </header>

      {lista.avisos.length > 0 && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{lista.avisos.join(" ")}</span>
        </div>
      )}

      {lista.itens.length === 0 ? (
        <div className="p-12 text-center text-slate-700">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-50"/>
          <p className="font-bold">Nenhum ingrediente para comprar.</p>
          <p className="text-sm">Monte o cardápio e informe quantas pessoas.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {lista.itens.map((item) => {
              const k = item.insumo_id || item.nome;
              return (
                <li key={k} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 ${marcados.has(k) ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={marcados.has(k)} onChange={() => alternar(k)} aria-label={`Comprado: ${item.nome}`}
                    className="h-5 w-5 rounded border-slate-300 accent-emerald-600 print:hidden" />
                  <span className="min-w-0 flex-1 basis-40 font-bold text-slate-800">{item.nome}{item.exclusivo && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-violet-800">exclusivo</span>}</span>
                  <span className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1 font-black tabular-nums text-slate-800">{fmtQtd(item.quantidade, item.unidade)}</span>
                  <span className="w-40 whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-800 print:hidden">
                    {fmtReais(item.custo)}{valor > 0 ? <span className="font-semibold text-slate-500"> · {fmtPct(percentualDe(item.custo, valor))}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <footer className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 bg-slate-50 px-6 py-3 print:hidden">
            <span className="text-sm font-black uppercase tracking-wide text-slate-700">Custo estimado das compras</span>
            <span className="ml-auto whitespace-nowrap text-lg font-black tabular-nums text-slate-900">
              {fmtReais(lista.total)}{valor > 0 ? <span className="text-sm font-bold text-slate-500"> · {fmtPct(percentualDe(lista.total, valor))} do valor do evento</span> : null}
            </span>
          </footer>
          <p className="px-6 pb-4 pt-2 text-xs font-medium text-slate-500 print:hidden">Custo pelo preço de compra atual de cada ingrediente. Pode diferir do CMV do cardápio quando a embalagem do produto entra à parte.</p>
        </>
      )}
    </div>
  );
}
