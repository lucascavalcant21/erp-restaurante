"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fmtBRL } from "./ui";
import { hojeLocal } from "../lib/contas-pagar.mjs";

/**
 * Registrar pagamento de conta a pagar — contrato mínimo (HOTFIX FIN-CP-1).
 * Pede só a DATA REAL do pagamento. Pagamento é integral: juros, multa,
 * desconto, forma e conta de origem ainda não têm onde ser gravados, então a
 * tela não os pede (não finge que persistiu).
 */
export default function ModalPagamentoConta({ conta, processando, onConfirmar, onFechar }) {
  const hoje = hojeLocal();
  const [data, setData] = useState(hoje);
  if (!conta) return null;

  const enviar = (e) => {
    e.preventDefault();
    if (processando) return;
    onConfirmar(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <form onSubmit={enviar} className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-start pb-3 border-b border-line">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase text-emerald-600 tracking-wider">Registrar pagamento</span>
            <h3 className="text-xl font-black text-slate-800 truncate">{conta.descricao}</h3>
          </div>
          <button type="button" onClick={onFechar} disabled={processando} className="text-slate-800 hover:text-slate-900" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="bg-white p-4 rounded-2xl text-sm flex justify-between">
          <span className="font-bold text-fg">Valor (integral)</span>
          <strong className="text-slate-900">{fmtBRL(conta.valor)}</strong>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-fg uppercase block mb-1">Data em que foi pago</span>
          <input required type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)}
            className="w-full p-3 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm" />
        </label>

        <p className="text-2xs text-fg leading-relaxed">
          Por enquanto o sistema registra só o pagamento integral e a data. Pagamento parcial, juros, multa,
          desconto e forma de pagamento ainda não são gravados.
        </p>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onFechar} disabled={processando} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm rounded-xl">Cancelar</button>
          <button type="submit" disabled={processando} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-sm rounded-xl">
            {processando ? "Registrando..." : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
