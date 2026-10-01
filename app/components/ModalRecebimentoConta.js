"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fmtBRL } from "./ui";
import { hojeLocal, novaChave } from "../lib/contas-receber.mjs";
import { lerValor } from "../lib/contas-pagar.mjs";

/**
 * Registrar recebimento (F2.3) — RPC fin_registrar_recebimento.
 * BRUTO BAIXADO = quanto da receita foi quitado. LÍQUIDO = o que de fato
 * entrou na conta. A diferença é a taxa efetiva. Chave de idempotência
 * criada quando o modal abre (clique duplo/retry não duplica).
 */
export default function ModalRecebimentoConta({ conta, contasFinanceiras = [], processando, onConfirmar, onFechar }) {
  const hoje = hojeLocal();
  const saldo = Number(conta?.saldo_bruto) || 0;
  // líquido sugerido só quando a taxa é conhecida (proporcional ao saldo); senão o usuário informa
  const liqSugerido = conta?.valor_liquido_previsto != null && Number(conta?.valor_bruto) > 0
    ? (saldo * Number(conta.valor_liquido_previsto) / Number(conta.valor_bruto)).toFixed(2).replace(".", ",")
    : "";
  const [chave] = useState(() => novaChave());
  const [f, setF] = useState({
    recebido_em: hoje,
    valor_bruto_baixado: saldo.toFixed(2).replace(".", ","),
    valor_liquido_recebido: liqSugerido,
    conta_financeira_id: conta?.conta_financeira_prevista_id || "",
    conciliacao_referencia: "", observacao: "",
  });
  if (!conta) return null;
  const n = (v) => { const x = lerValor(v); return Number.isFinite(x) ? x : 0; };
  const taxa = n(f.valor_bruto_baixado) - n(f.valor_liquido_recebido);
  const restante = Math.max(saldo - n(f.valor_bruto_baixado), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const enviar = (e) => {
    e.preventDefault();
    if (processando) return;
    onConfirmar({ ...f, conta_receber_id: conta.id, saldo_bruto: saldo, chave });
  };
  const campo = "w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
      <form onSubmit={enviar} className="bg-card rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl max-h-[94vh] flex flex-col">
        <div className="flex justify-between items-start p-5 pb-3 border-b border-line">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase text-emerald-600 tracking-wider">Registrar recebimento</span>
            <h3 className="text-lg font-black text-slate-800 truncate">{conta.descricao}</h3>
          </div>
          <button type="button" onClick={onFechar} disabled={processando} aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 text-xs bg-white rounded-2xl p-3">
            <div><p className="text-fg font-bold">Bruto</p><p className="font-black">{fmtBRL(conta.valor_bruto)}</p></div>
            <div><p className="text-fg font-bold">Já baixado</p><p className="font-black">{fmtBRL(conta.bruto_baixado)}</p></div>
            <div><p className="text-fg font-bold">Saldo bruto</p><p className="font-black">{fmtBRL(saldo)}</p></div>
          </div>
          {conta.taxa_nao_informada && <p className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-2">Taxa prevista não informada: digite o líquido que realmente entrou.</p>}

          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Data em que entrou</span>
            <input required type="date" max={hoje} value={f.recebido_em} onChange={set("recebido_em")} className={campo} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Bruto baixado (R$)</span>
              <input required inputMode="decimal" value={f.valor_bruto_baixado} onChange={set("valor_bruto_baixado")} className={campo} /></label>
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Líquido que entrou (R$)</span>
              <input required inputMode="decimal" value={f.valor_liquido_recebido} onChange={set("valor_liquido_recebido")} className={campo} placeholder="0,00" /></label>
          </div>
          <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Conta financeira (onde entrou)</span>
            <select value={f.conta_financeira_id} onChange={set("conta_financeira_id")} className={campo}>
              <option value="">{contasFinanceiras.length ? "Não informada" : "Nenhuma cadastrada"}</option>
              {contasFinanceiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></label>
          <details className="rounded-xl border border-line bg-white p-3 text-sm">
            <summary className="font-bold text-xs uppercase text-fg cursor-pointer">Mais detalhes</summary>
            <label className="block mt-2"><span className="text-xs font-bold text-fg block mb-1">Referência de conciliação (extrato, lote)</span>
              <input value={f.conciliacao_referencia} onChange={set("conciliacao_referencia")} className={campo} /></label>
            <label className="block mt-2"><span className="text-xs font-bold text-fg block mb-1">Observação</span>
              <input value={f.observacao} onChange={set("observacao")} className={campo} /></label>
          </details>

          <div className="rounded-2xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Taxa efetiva (bruto − líquido)</span><b>{fmtBRL(taxa)}</b></div>
            <div className="flex justify-between"><span>Saldo bruto depois</span><b>{fmtBRL(restante)}</b></div>
            <p className="text-fg">{restante > 0.004 ? "A conta ficará PARCIAL." : "A conta ficará RECEBIDA."} A receita continua sendo o bruto.</p>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-line">
          <button type="button" onClick={onFechar} disabled={processando} className="flex-1 py-3 bg-slate-100 font-bold text-sm rounded-xl">Cancelar</button>
          <button type="submit" disabled={processando} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-sm rounded-xl">
            {processando ? "Registrando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
