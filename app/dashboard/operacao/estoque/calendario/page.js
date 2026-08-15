"use client";

// CALENDÁRIO DE ENTRADAS E SAÍDAS
// O que entrou e o que saiu do estoque, no período que você escolher: um dia,
// a semana ou o mês inteiro. Etiqueta gerada aparece como entrada; baixa e
// perda aparecem como saída, junto das movimentações feitas na mão.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, ChevronLeft,
  ChevronRight, Loader2, Package,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchEstoques, fetchMovimentosMulti } from "../../../../lib/estoques-multiplos";

const p2 = (n) => String(n).padStart(2, "0");
const isoData = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const soData = (iso) => String(iso || "").slice(0, 10);
const fmtQtd = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// Início e fim do período escolhido, sempre em datas locais.
function faixaDoPeriodo(referencia, modo) {
  const base = new Date(referencia);
  base.setHours(0, 0, 0, 0);
  if (modo === "dia") return { de: new Date(base), ate: new Date(base) };
  if (modo === "semana") {
    const inicio = new Date(base);
    inicio.setDate(base.getDate() - base.getDay());       // domingo
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { de: inicio, ate: fim };
  }
  return {
    de: new Date(base.getFullYear(), base.getMonth(), 1),
    ate: new Date(base.getFullYear(), base.getMonth() + 1, 0),
  };
}

function andar(referencia, modo, passo) {
  const d = new Date(referencia);
  if (modo === "dia") d.setDate(d.getDate() + passo);
  else if (modo === "semana") d.setDate(d.getDate() + passo * 7);
  else d.setMonth(d.getMonth() + passo);
  return d;
}

function rotuloPeriodo({ de, ate }, modo) {
  const dia = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (modo === "dia") return de.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (modo === "semana") return `${dia(de)} a ${dia(ate)}`;
  return de.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function CalendarioEstoque() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [estoques, setEstoques] = useState([]);
  const [estoqueId, setEstoqueId] = useState("todos");
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState("dia");           // dia | semana | mes
  const [referencia, setReferencia] = useState(() => new Date());

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    fetchEstoques(unidadeAtiva).then(r => setEstoques(r.data || []));
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas" || !estoques.length) return;
    let ativo = true;
    setCarregando(true);
    const alvos = estoqueId === "todos" ? estoques : estoques.filter(e => e.id === estoqueId);
    Promise.all(alvos.map(e => fetchMovimentosMulti(unidadeAtiva, e.id, 500))).then(respostas => {
      if (!ativo) return;
      // Um mesmo movimento aparece nos dois estoques numa transferência.
      const porId = new Map();
      respostas.forEach(r => (r.data || []).forEach(m => porId.set(m.id, m)));
      setMovimentos([...porId.values()]);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva, estoques, estoqueId]);

  const faixa = useMemo(() => faixaDoPeriodo(referencia, modo), [referencia, modo]);

  const doPeriodo = useMemo(() => {
    const de = isoData(faixa.de), ate = isoData(faixa.ate);
    return movimentos
      .filter(m => { const d = soData(m.data_movimento || m.created_at); return d >= de && d <= ate; })
      .sort((a, b) => String(b.data_movimento || "").localeCompare(String(a.data_movimento || "")));
  }, [movimentos, faixa]);

  // Um bloco por dia, do mais recente para o mais antigo.
  const porDia = useMemo(() => {
    const mapa = new Map();
    doPeriodo.forEach(m => {
      const d = soData(m.data_movimento || m.created_at);
      if (!mapa.has(d)) mapa.set(d, []);
      mapa.get(d).push(m);
    });
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [doPeriodo]);

  const totais = useMemo(() => {
    let entradas = 0, saidas = 0, qtdE = 0, qtdS = 0;
    doPeriodo.forEach(m => {
      const q = Number(m.quantidade) || 0;
      if (m.tipo === "entrada") { entradas += 1; qtdE += q; }
      else if (m.tipo === "saida") { saidas += 1; qtdS += q; }
    });
    return { entradas, saidas, qtdE, qtdS };
  }, [doPeriodo]);

  const ehHoje = isoData(new Date()) >= isoData(faixa.de) && isoData(new Date()) <= isoData(faixa.ate);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/estoque")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Entradas e saídas</h1>
            <p className="text-xs font-bold text-slate-500">Movimento do estoque por dia, semana ou mês</p>
          </div>
          <select value={estoqueId} onChange={e => setEstoqueId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-700">
            <option value="todos">Todos os estoques</option>
            {estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([v, r]) => (
              <button key={v} onClick={() => setModo(v)}
                className={`h-9 rounded-lg px-4 text-sm font-black ${modo === v ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setReferencia(andar(referencia, modo, -1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <span className="min-w-[190px] text-center text-sm font-black capitalize text-slate-800">{rotuloPeriodo(faixa, modo)}</span>
            <button onClick={() => setReferencia(andar(referencia, modo, 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
          {!ehHoje && (
            <button onClick={() => setReferencia(new Date())} className="h-11 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">Hoje</button>
          )}
          <input type="date" value={isoData(referencia)} onChange={e => e.target.value && setReferencia(new Date(`${e.target.value}T12:00:00`))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-700" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-700"><ArrowUpRight size={13} /> Entrou</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{fmtQtd(totais.qtdE)}</p>
                <p className="text-xs font-bold text-slate-500">{totais.entradas} movimentação(ões)</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-700"><ArrowDownRight size={13} /> Saiu</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{fmtQtd(totais.qtdS)}</p>
                <p className="text-xs font-bold text-slate-500">{totais.saidas} movimentação(ões)</p>
              </div>
            </div>

            {carregando ? (
              <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
            ) : porDia.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <CalendarDays className="mx-auto text-slate-300" size={40} />
                <p className="mt-3 font-black text-slate-700">Nada movimentado neste período</p>
                <p className="mt-1 text-sm text-slate-500">Troque o período acima ou escolha outro estoque.</p>
              </div>
            ) : porDia.map(([dia, lista]) => {
              const entrou = lista.filter(m => m.tipo === "entrada").reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
              const saiu = lista.filter(m => m.tipo === "saida").reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
              return (
                <section key={dia} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-black capitalize text-slate-800">
                      {new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
                    </p>
                    <p className="flex gap-3 text-xs font-black">
                      <span className="text-emerald-700">+{fmtQtd(entrou)}</span>
                      <span className="text-rose-700">−{fmtQtd(saiu)}</span>
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {lista.map(m => {
                      const entrada = m.tipo === "entrada";
                      const hora = new Date(m.data_movimento || m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${entrada ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {entrada ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-black text-slate-900">{m.insumo?.nome || "Produto removido"}</p>
                            <p className="truncate text-[11px] font-bold text-slate-500">
                              {hora}
                              {m.estoque?.nome ? ` · ${m.estoque.nome}` : ""}
                              {m.destino?.nome ? ` → ${m.destino.nome}` : ""}
                              {m.usuario_nome ? ` · ${m.usuario_nome}` : ""}
                              {m.observacao ? ` · ${m.observacao}` : ""}
                            </p>
                          </div>
                          <span className={`shrink-0 text-base font-black ${entrada ? "text-emerald-700" : "text-rose-700"}`}>
                            {entrada ? "+" : "−"}{fmtQtd(m.quantidade)} {m.insumo?.unidade_medida || ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs font-bold text-slate-400">
              <Package size={13} /> Etiqueta gerada entra como entrada; baixa e perda saem.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
