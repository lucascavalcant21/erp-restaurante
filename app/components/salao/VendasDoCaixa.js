"use client";

// Vendas do caixa aberto e cancelamento de venda (COM-4, 07/11/2026).
// Cancelar desfaz pelo banco, numa transação: contas a receber, faturamento do
// dia e comanda. O dinheiro a devolver ao cliente sai da gaveta (o caixa já
// ignora vendas canceladas). Devolver ao estoque é opcional: só se os itens
// não foram preparados.

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Receipt, X } from "lucide-react";
import { cancelarVenda, fetchVendasDoCaixa } from "../../lib/comandas";
import { fmtBRL } from "../ui";

const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito", voucher: "Voucher", outro: "Outro", multiplo: "Várias formas" };
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const formasTxt = (v) => (v.venda_pagamentos?.length ? v.venda_pagamentos.map((p) => `${FORMAS[p.forma] || p.forma} ${fmtBRL(p.valor)}`).join(" · ") : "Sem pagamento detalhado");

function FormCancelar({ venda, unidadeId, quem, onFeito, onVoltar }) {
  const [motivo, setMotivo] = useState("");
  const [devolver, setDevolver] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const dinheiro = (venda.venda_pagamentos || []).filter((p) => p.forma === "dinheiro").reduce((t, p) => t + Number(p.valor || 0), 0);

  async function confirmar(e) {
    e.preventDefault();
    if (enviando) return;
    if (motivo.trim().length < 3) { setErro("Informe o motivo do cancelamento."); return; }
    setEnviando(true); setErro("");
    const r = await cancelarVenda({ vendaId: venda.id, motivo: motivo.trim(), devolverEstoque: devolver, unidadeId, quem });
    setEnviando(false);
    if (r.error) { setErro(r.error); return; }
    onFeito(r);
  }

  return (
    <form onSubmit={confirmar} className="mt-3 space-y-3 rounded-2xl border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-black text-red-800">Cancelar esta venda de {fmtBRL(venda.total)}?</p>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-900">
        <li>Sai do faturamento do dia e do fechamento do caixa.</li>
        <li>O cartão e o Pix que ainda estão a conferir são cancelados no Financeiro.</li>
        {dinheiro > 0 && <li>Devolva <b>{fmtBRL(dinheiro)}</b> em dinheiro ao cliente, da gaveta.</li>}
        {venda.venda_pagamentos?.some((p) => p.forma !== "dinheiro") && <li>O estorno do cartão ou do Pix ao cliente é feito na maquininha ou no banco.</li>}
      </ul>
      <label className="block">
        <span className="text-xs font-bold text-red-900">Motivo</span>
        <input value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(""); }} maxLength={300} autoFocus
          placeholder="Ex.: forma de pagamento lançada errada"
          className="mt-1 min-h-[44px] w-full rounded-xl border border-red-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-500" />
      </label>
      <label className="flex min-h-[44px] items-center gap-3 text-sm text-red-900">
        <input type="checkbox" checked={devolver} onChange={(e) => setDevolver(e.target.checked)} className="h-5 w-5 accent-red-600" />
        Os itens não foram preparados: devolver ao estoque
      </label>
      {erro && <p className="text-sm font-bold text-red-700" role="alert">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onVoltar} className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-bold text-slate-700">Voltar</button>
        <button type="submit" disabled={enviando} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-60">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} Confirmar cancelamento
        </button>
      </div>
    </form>
  );
}

export default function VendasDoCaixa({ caixaId, unidadeId, quem, podeCancelar, onClose, onMudou }) {
  const [estado, setEstado] = useState({ carregando: true, vendas: [], erro: "", semCancelamento: false });
  const [cancelando, setCancelando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    const r = await fetchVendasDoCaixa(caixaId);
    setEstado({ carregando: false, vendas: r.data, erro: r.error || "", semCancelamento: r.semCancelamento });
  }, [caixaId]);
  useEffect(() => { carregar(); }, [carregar]);

  const ativas = estado.vendas.filter((v) => v.status !== "cancelada");
  const total = ativas.reduce((t, v) => t + Number(v.total || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Vendas do caixa">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">Vendas do caixa</h2>
            <p className="text-xs text-slate-500">{ativas.length} {ativas.length === 1 ? "venda" : "vendas"} · {fmtBRL(total)}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {aviso && (
            <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              <p className="font-bold">Venda cancelada.{Number(aviso.data?.devolver_em_dinheiro) > 0 ? ` Devolva ${fmtBRL(aviso.data.devolver_em_dinheiro)} em dinheiro ao cliente.` : ""}</p>
              {aviso.avisos?.map((a) => <p key={a} className="mt-1 text-amber-800">{a}</p>)}
            </div>
          )}
          {estado.carregando ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando…</p>
            : estado.erro ? <p className="text-sm font-bold text-red-700">{estado.erro}</p>
            : !estado.vendas.length ? <p className="text-sm text-slate-500">Nenhuma venda neste caixa ainda.</p>
            : (
              <ul className="space-y-2">
                {estado.vendas.map((v) => {
                  const cancelada = v.status === "cancelada";
                  return (
                    <li key={v.id} className={`rounded-2xl border p-3 ${cancelada ? "border-slate-200 bg-slate-50" : "border-slate-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`flex items-center gap-1.5 text-sm font-black ${cancelada ? "text-slate-400 line-through" : "text-slate-900"}`}>
                            <Receipt size={14} className="shrink-0" /> <span className="truncate">{String(v.observacao || "Venda").replace(/^Comanda (Balcão|iFood|Cardápio digital)$/, "$1")}</span>
                          </p>
                          <p className="text-xs text-slate-500">{hora(v.created_at)}{v.cliente ? ` · ${v.cliente}` : ""}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{formasTxt(v)}</p>
                          {cancelada && <p className="mt-1 text-xs font-bold text-red-700">Cancelada{v.motivo_cancelamento ? `: ${v.motivo_cancelamento}` : ""}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-black tabular-nums ${cancelada ? "text-slate-400 line-through" : "text-slate-900"}`}>{fmtBRL(v.total)}</p>
                          {!cancelada && podeCancelar && v.pedido_id && !estado.semCancelamento && cancelando !== v.id && (
                            <button onClick={() => { setCancelando(v.id); setAviso(null); }} className="mt-1 min-h-[36px] rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50">Cancelar venda</button>
                          )}
                        </div>
                      </div>
                      {cancelando === v.id && (
                        <FormCancelar venda={v} unidadeId={unidadeId} quem={quem} onVoltar={() => setCancelando(null)}
                          onFeito={(r) => { setCancelando(null); setAviso(r); carregar(); onMudou?.(); }} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          {estado.semCancelamento && <p className="mt-3 text-xs text-slate-500">O cancelamento de vendas ainda não foi ativado no banco (COM-4).</p>}
        </div>
      </div>
    </div>
  );
}
