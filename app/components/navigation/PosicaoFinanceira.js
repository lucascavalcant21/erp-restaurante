"use client";

// Posição financeira (F2.3): números das estruturas F2.1, cada um com a
// origem. Não é DRE: "pago/recebido no mês" é CAIXA (data do dinheiro);
// faturamento continua NÃO APURADO enquanto não houver fonte completa de vendas.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchContasPagar, fetchContasReceber, fetchFluxoCaixa, fetchSaldosContasFinanceiras } from "../../lib/financeiro";
import { resumoContas } from "../../lib/contas-pagar.mjs";
import { resumoReceber, resumoFluxo, hojeLocal, somarDias } from "../../lib/contas-receber.mjs";
import { intervaloPeriodo, unidadeValida } from "../../lib/contas-pagar.mjs";
import { fmtBRL } from "../ui";

export default function PosicaoFinanceira({ unidadeId }) {
  const router = useRouter();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!unidadeValida(unidadeId)) return;
    const hoje = hojeLocal();
    const mes = intervaloPeriodo("mes", hoje);
    Promise.all([
      fetchContasPagar(unidadeId), fetchContasReceber(unidadeId),
      fetchFluxoCaixa(unidadeId, mes.de, mes.ate), fetchSaldosContasFinanceiras(unidadeId),
    ]).then(([p, r, f, s]) => {
      setErro([p.error, r.error, f.error, s.error].filter(Boolean).join(" · "));
      const pagar = resumoContas(p.data || [], [], null, hoje);
      const receber = resumoReceber(r.data || [], [], null);
      const fluxo = resumoFluxo(f.data || []);
      const ativas = (s.data || []).filter((x) => x.ativa);
      const ate7 = somarDias(hoje, 7);
      const receber7 = (r.data || []).filter((c) => ["previsto", "parcial"].includes(c.situacao) && c.data_prevista >= hoje && c.data_prevista <= ate7)
        .reduce((t, c) => t + Number(c.saldo_bruto || 0), 0);
      setD({
        aPagar: pagar.aPagar, vencido: pagar.vencido, pagar7: pagar.proximos7,
        aReceber: receber.aReceberBruto, atrasado: receber.atrasado, receber7,
        entradas: fluxo.realizado.entradas, saidas: fluxo.realizado.saidas, saldoMes: fluxo.realizado.saldo, legado: fluxo.incluiLegado,
        saldoGerencial: ativas.length ? ativas.reduce((t, x) => t + Number(x.saldo_calculado || 0), 0) : null,
      });
    });
  }, [unidadeId]);

  if (!unidadeValida(unidadeId)) return null;
  const Card = ({ titulo, valor, nota, onClick, tom = "" }) => (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-emerald-500 disabled:hover:border-slate-200">
      <p className="text-3xs font-black uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={`text-lg font-black ${tom}`}>{valor}</p>
      {nota && <p className="text-3xs text-slate-500 leading-snug">{nota}</p>}
    </button>
  );
  const v = (x) => (x == null ? "—" : fmtBRL(x));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Posição financeira</h2>
        <div className="flex gap-2">
          <button onClick={() => router.push("/dashboard/financeiro/receber")} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black">Contas a Receber</button>
          <button onClick={() => router.push("/dashboard/financeiro/caixa")} className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold border border-slate-700">Caixa e Contas</button>
        </div>
      </div>
      {erro && <p className="text-xs font-bold text-red-400">Parte dos dados não carregou: {erro}</p>}
      {!d ? <p className="text-xs text-slate-400">Carregando...</p> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card titulo="A pagar (em aberto)" valor={v(d.aPagar)} nota={`vencido ${v(d.vencido)} · próximos 7 dias ${v(d.pagar7)}`} onClick={() => router.push("/dashboard/financeiro/contas")} />
          <Card titulo="A receber (bruto)" valor={v(d.aReceber)} nota={`atrasado ${v(d.atrasado)} · próximos 7 dias ${v(d.receber7)}`} onClick={() => router.push("/dashboard/financeiro/receber")} />
          <Card titulo="Entradas no mês (caixa)" valor={v(d.entradas)} nota="recebimentos efetivos, líquido" tom="text-emerald-700" onClick={() => router.push("/dashboard/financeiro/caixa")} />
          <Card titulo="Saídas no mês (caixa)" valor={v(d.saidas)} nota={d.legado ? "pagamentos efetivos · inclui pagamentos antigos sem histórico" : "pagamentos efetivos"} tom="text-red-700" onClick={() => router.push("/dashboard/financeiro/caixa")} />
          <Card titulo="Saldo do mês (caixa)" valor={v(d.saldoMes)} nota="entradas − saídas registradas no financeiro novo" />
          <Card titulo="Saldo gerencial" valor={d.saldoGerencial == null ? "Não apurado" : v(d.saldoGerencial)}
            nota={d.saldoGerencial == null ? "cadastre as contas financeiras com saldo inicial real" : "contas financeiras ativas · não é saldo conciliado do banco"} onClick={() => router.push("/dashboard/financeiro/caixa")} />
          <Card titulo="Faturamento" valor="Não apurado" nota="não há fonte completa de vendas conectada" />
        </div>
      )}
    </section>
  );
}
