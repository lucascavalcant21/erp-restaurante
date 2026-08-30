"use client";

// COMPRAS DO MÊS — quanto entrou de mercadoria e em quê.
// Não se digita compra aqui: a compra é a própria entrada de estoque. Lançou a
// entrada, o gasto aparece nesta tela, na categoria do estoque em que caiu.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, PackagePlus, ShoppingCart,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoques, fetchMovimentosMulti } from "../../../lib/estoques-multiplos";
import {
  ehCompra, valorDaCompra, categoriaDaCompra, totaisPorCategoria,
  faixaCompras, andarPeriodo, rotuloPeriodo, isoData,
} from "../../../lib/compras.mjs";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const soData = (v) => String(v || "").slice(0, 10);

const COR_CATEGORIA = {
  Cozinha: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Bar: "border-violet-200 bg-violet-50 text-violet-800",
  Embalagens: "border-pink-200 bg-pink-50 text-pink-800",
  Limpeza: "border-sky-200 bg-sky-50 text-sky-800",
  "Materiais gerais": "border-amber-200 bg-amber-50 text-amber-800",
  Outros: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function ComprasDoMesPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [estoques, setEstoques] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState("mes");          // dia | semana | mes | meses
  const [mesesJuntos, setMesesJuntos] = useState(3);
  const [referencia, setReferencia] = useState(() => new Date());
  const [categoria, setCategoria] = useState("Todas");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    fetchEstoques(unidadeAtiva).then(r => setEstoques(r.data || []));
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!estoques.length) return;
    let ativo = true;
    setCarregando(true);
    Promise.all(estoques.map(e => fetchMovimentosMulti(unidadeAtiva, e.id, 500))).then(respostas => {
      if (!ativo) return;
      // O mesmo movimento aparece nos dois estoques de uma transferência.
      const porId = new Map();
      respostas.forEach(r => (r.data || []).filter(ehCompra).forEach(m => porId.set(m.id, m)));
      setMovimentos([...porId.values()]);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva, estoques]);

  const faixa = useMemo(() => faixaCompras(referencia, modo, mesesJuntos), [referencia, modo, mesesJuntos]);

  const doPeriodo = useMemo(() => {
    const de = isoData(faixa.de), ate = isoData(faixa.ate);
    return movimentos
      .filter(m => { const d = soData(m.data_movimento || m.created_at); return d >= de && d <= ate; })
      .sort((a, b) => String(b.data_movimento || "").localeCompare(String(a.data_movimento || "")));
  }, [movimentos, faixa]);

  const totais = useMemo(() => totaisPorCategoria(doPeriodo, estoques), [doPeriodo, estoques]);
  const totalGeral = totais.reduce((s, [, v]) => s + v.total, 0);

  const lista = useMemo(
    () => categoria === "Todas" ? doPeriodo : doPeriodo.filter(m => categoriaDaCompra(m, estoques) === categoria),
    [doPeriodo, categoria, estoques],
  );

  const porDia = useMemo(() => {
    const mapa = new Map();
    lista.forEach(m => {
      const d = soData(m.data_movimento || m.created_at);
      if (!mapa.has(d)) mapa.set(d, []);
      mapa.get(d).push(m);
    });
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [lista]);

  const hojeNoPeriodo = isoData(new Date()) >= isoData(faixa.de) && isoData(new Date()) <= isoData(faixa.ate);

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Compras do mês</h1>
            <p className="text-xs font-bold text-slate-500">Vem das entradas de estoque — lançou lá, aparece aqui</p>
          </div>
          <button onClick={() => router.push("/dashboard/operacao/estoque")}
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">
            <PackagePlus size={17} /> Lançar entrada
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["meses", "Vários meses"]].map(([v, r]) => (
              <button key={v} onClick={() => setModo(v)}
                className={`h-9 rounded-lg px-3.5 text-sm font-black ${modo === v ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {r}
              </button>
            ))}
          </div>
          {modo === "meses" && (
            <select value={mesesJuntos} onChange={e => setMesesJuntos(Number(e.target.value))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-700">
              {[2, 3, 4, 6, 12].map(n => <option key={n} value={n}>{n} meses</option>)}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setReferencia(andarPeriodo(referencia, modo, -1, mesesJuntos))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <span className="min-w-[200px] text-center text-sm font-black capitalize text-slate-800">{rotuloPeriodo(faixa, modo)}</span>
            <button onClick={() => setReferencia(andarPeriodo(referencia, modo, 1, mesesJuntos))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
          {!hojeNoPeriodo && (
            <button onClick={() => setReferencia(new Date())} className="h-11 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">Hoje</button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : carregando ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
        ) : (
          <>
            <section className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Total comprado no período</p>
              <p className="mt-1 text-4xl font-black text-slate-900 sm:text-5xl">{brl(totalGeral)}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{doPeriodo.length} entrada(s) de estoque</p>
            </section>

            {/* Por onde o dinheiro foi */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {totais.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center font-bold text-slate-500 sm:col-span-2 lg:col-span-3">
                  Nenhuma compra neste período.
                </p>
              ) : totais.map(([cat, v]) => (
                <button key={cat} onClick={() => setCategoria(categoria === cat ? "Todas" : cat)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${COR_CATEGORIA[cat] || COR_CATEGORIA.Outros} ${categoria === cat ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}>
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{cat}</p>
                  <p className="mt-1 text-2xl font-black">{brl(v.total)}</p>
                  <p className="text-xs font-bold opacity-70">
                    {v.itens} entrada(s) · {totalGeral > 0 ? Math.round((v.total / totalGeral) * 100) : 0}% do total
                  </p>
                </button>
              ))}
            </section>

            {categoria !== "Todas" && (
              <button onClick={() => setCategoria("Todas")} className="text-sm font-black text-emerald-700 hover:underline">
                Mostrando só {categoria} — ver todas
              </button>
            )}

            {porDia.map(([dia, doDia]) => {
              const totalDia = doDia.reduce((s, m) => s + valorDaCompra(m), 0);
              return (
                <section key={dia} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-black capitalize text-slate-800">
                      {new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
                    </p>
                    <p className="text-sm font-black text-emerald-700">{brl(totalDia)}</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {doDia.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShoppingCart size={16} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-black text-slate-900">{m.insumo?.nome || "Produto removido"}</p>
                          <p className="truncate text-[11px] font-bold text-slate-500">
                            {Number(m.quantidade || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {m.insumo?.unidade_medida || ""}
                            {m.estoque?.nome ? ` · ${m.estoque.nome}` : ""}
                            {m.usuario_nome ? ` · ${m.usuario_nome}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-base font-black text-slate-800">{brl(valorDaCompra(m))}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            <p className="pt-2 text-center text-xs font-bold text-slate-400">
              Cada entrada guarda o preço do dia em que foi lançada. Entradas antigas, de antes disso, usam o custo atual do ingrediente.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
