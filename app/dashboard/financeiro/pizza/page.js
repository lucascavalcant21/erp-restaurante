"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PieChart, Search, Loader2, X } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { dadosDoPrato, fatiasDoPrato } from "../../../lib/pizza-do-prato.mjs";
import PizzaDoPrato from "../../operacao/fichas/PizzaDoPrato";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PizzaDoLucroPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setLoading(true);
    Promise.all([fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchParams(unidadeAtiva)])
      .then(([resFichas, resProdutos, resParams]) => {
        if (!ativo) return;
        setFichas(resFichas.data || []);
        setProdutos(resProdutos.data || []);
        setParams({ ...PARAMS_PADRAO, ...(resParams.data || {}) });
        setLoading(false);
      });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  // Só pratos que se vendem entram no ranking: base/pré-preparo não tem preço,
  // e uma linha sem lucro no meio de um ranking de lucro só atrapalha.
  const ranking = useMemo(() => {
    return fichas
      .filter((f) => !f.eh_base)
      .map((f) => {
        const entrada = dadosDoPrato(f, { fichas, produtos, params });
        const conta = fatiasDoPrato(entrada);
        return { ficha: f, entrada, conta };
      })
      .filter((x) => x.conta.preco > 0)
      .sort((a, b) => {
        // Prejuízo primeiro: é o que precisa de decisão hoje.
        if ((a.conta.prejuizo > 0) !== (b.conta.prejuizo > 0)) return a.conta.prejuizo > 0 ? -1 : 1;
        if (a.conta.prejuizo > 0) return b.conta.prejuizo - a.conta.prejuizo;
        return (b.conta.lucro / b.conta.preco) - (a.conta.lucro / a.conta.preco);
      });
  }, [fichas, produtos, params]);

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ranking;
    return ranking.filter((x) => String(x.ficha.nome_receita || "").toLowerCase().includes(q));
  }, [ranking, busca]);

  const atual = escolhida
    ? ranking.find((x) => x.ficha.id === escolhida)
    : filtrado[0];

  const semRateio = !fatiasDoPrato({ preco: 1, params }).rateavel;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/modulo/financeiro")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Voltar ao módulo Financeiro">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
              <PieChart className="text-emerald-600" size={24} /> Pizza do Lucro
            </h1>
            <p className="text-xs font-bold text-slate-500">Para onde vai cada real que você vende.</p>
          </div>
        </div>

        {semRateio && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500">
            Custo fixo e CMO estão de fora: falta preencher os custos do mês, dias de operação e pratos por dia em{" "}
            <button onClick={() => router.push("/dashboard/financeiro/equilibrio")} className="text-emerald-700 underline underline-offset-2">Ponto de Equilíbrio</button>.
            Sem isso a pizza mostra um lucro maior do que o real.
          </p>
        )}

        {loading ? (
          <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
        ) : !ranking.length ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-400">
            Nenhum prato com preço de venda ainda. Defina o preço nas fichas para ver a pizza.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Ranking: tudo de uma vez, que é o "ver tudo". */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400" />
                {busca && <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-700"><X size={15} /></button>}
              </label>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-2 pr-2">Prato</th>
                      <th className="py-2 px-2 text-right">Venda</th>
                      <th className="py-2 px-2 text-right">Sobra</th>
                      <th className="py-2 pl-2 text-right">% da venda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrado.map((x) => {
                      const ehAtual = atual && atual.ficha.id === x.ficha.id;
                      const pct = x.conta.preco > 0 ? (x.conta.lucro / x.conta.preco) * 100 : 0;
                      return (
                        <tr key={x.ficha.id} onClick={() => setEscolhida(x.ficha.id)}
                          className={`cursor-pointer transition-colors ${ehAtual ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                          <td className="py-2 pr-2 font-bold text-slate-700">{x.ficha.nome_receita}</td>
                          <td className="py-2 px-2 text-right font-bold text-slate-500">{fmt(x.conta.preco)}</td>
                          <td className="py-2 px-2 text-right font-black text-slate-800">
                            {x.conta.prejuizo > 0 ? `− ${fmt(x.conta.prejuizo)}` : fmt(x.conta.lucro)}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <span className={`rounded-lg px-2 py-0.5 font-black ${x.conta.prejuizo > 0 ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>
                              {x.conta.prejuizo > 0 ? "prejuízo" : `${pct.toFixed(0)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filtrado.length && <p className="py-8 text-center text-xs font-bold text-slate-400">Nenhum prato com esse nome.</p>}
              </div>
            </div>

            {/* A pizza do prato escolhido. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
              {atual ? (
                <>
                  <p className="mb-3 truncate text-sm font-black text-slate-800">{atual.ficha.nome_receita}</p>
                  <PizzaDoPrato {...atual.entrada} />
                </>
              ) : (
                <p className="py-10 text-center text-xs font-bold text-slate-400">Escolha um prato na lista.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
