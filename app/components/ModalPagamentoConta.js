"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fmtBRL } from "./ui";
import { hojeLocal, lerValor, novaChave } from "../lib/contas-pagar.mjs";
import CampoDecimal from "./CampoDecimal";

const FORMAS = [
  ["", "Não informada"], ["pix", "PIX"], ["dinheiro", "Dinheiro"], ["boleto", "Boleto"],
  ["transferencia", "Transferência"], ["debito", "Débito"], ["credito", "Crédito"], ["voucher", "Voucher"], ["outro", "Outro"],
];

/**
 * Registrar pagamento (F2.2) — pela RPC fin_registrar_pagamento.
 * Parcial ou integral; juros, multa e desconto; conta financeira opcional.
 * A chave de idempotência nasce quando o modal abre: reenviar o mesmo
 * formulário (clique duplo, rede caiu) não gera dois pagamentos.
 */
export default function ModalPagamentoConta({ conta, contasFinanceiras = [], processando, onConfirmar, onFechar }) {
  const hoje = hojeLocal();
  const saldo = Number(conta?.saldo) || 0;
  const [chave] = useState(() => novaChave());
  const [f, setF] = useState({
    pago_em: hoje,
    valor_principal: saldo.toFixed(2).replace(".", ","),
    juros: "", multa: "", desconto: "",
    forma_pagamento: "", conta_financeira_id: "", observacao: "",
  });
  if (!conta) return null;

  const num = (v) => { const n = lerValor(v); return Number.isFinite(n) ? n : 0; };
  const principal = num(f.valor_principal);
  const saida = principal + num(f.juros) + num(f.multa) - num(f.desconto);
  const restante = Math.max(saldo - principal, 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const enviar = (e) => {
    e.preventDefault();
    if (processando) return;
    onConfirmar({ ...f, conta_pagar_id: conta.id, saldo, chave });
  };

  const campo = "w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <form onSubmit={enviar} className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start pb-3 border-b border-line">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase text-emerald-600 tracking-wider">Registrar pagamento</span>
            <h3 className="text-lg font-black text-slate-800 truncate">{conta.descricao}</h3>
          </div>
          <button type="button" onClick={onFechar} disabled={processando} className="text-slate-800" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs bg-white rounded-2xl p-3">
          <div><p className="text-fg font-bold">Valor original</p><p className="font-black">{fmtBRL(conta.valor_original)}</p></div>
          <div><p className="text-fg font-bold">Já pago</p><p className="font-black">{fmtBRL(conta.valor_pago)}</p></div>
          <div><p className="text-fg font-bold">Saldo</p><p className="font-black text-slate-900">{fmtBRL(saldo)}</p></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Data do pagamento</span>
            <input required type="date" max={hoje} value={f.pago_em} onChange={set("pago_em")} className={campo} /></label>
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Valor pago (R$)</span>
            <CampoDecimal required value={f.valor_principal} onChange={set("valor_principal")} className={campo} /></label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Juros</span>
            <CampoDecimal placeholder="0,00" value={f.juros} onChange={set("juros")} className={campo} /></label>
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Multa</span>
            <CampoDecimal placeholder="0,00" value={f.multa} onChange={set("multa")} className={campo} /></label>
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Desconto</span>
            <CampoDecimal placeholder="0,00" value={f.desconto} onChange={set("desconto")} className={campo} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Forma</span>
            <select value={f.forma_pagamento} onChange={set("forma_pagamento")} className={campo}>
              {FORMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Conta financeira</span>
            <select value={f.conta_financeira_id} onChange={set("conta_financeira_id")} className={campo}>
              <option value="">{contasFinanceiras.length ? "Não informada" : "Nenhuma cadastrada"}</option>
              {contasFinanceiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></label>
        </div>
        <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Observação</span>
          <input value={f.observacao} onChange={set("observacao")} className={campo} /></label>

        <div className="rounded-2xl bg-slate-50 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Sai do caixa (valor + juros + multa − desconto)</span><b>{fmtBRL(saida)}</b></div>
          <div className="flex justify-between"><span>Saldo depois deste pagamento</span><b>{fmtBRL(restante)}</b></div>
          <p className="text-fg">{restante > 0.004 ? "A conta ficará PARCIAL." : "A conta ficará PAGA."}</p>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} disabled={processando} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm rounded-xl">Cancelar</button>
          <button type="submit" disabled={processando} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-sm rounded-xl">
            {processando ? "Registrando..." : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
