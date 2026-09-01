"use client";

// CUSTOS FIXOS — a conta direta: quanto o restaurante gasta por dia só para
// abrir a porta. Você escreve o nome e o valor do mês; o sistema divide pelos
// dias do mês e soma a folha fixa. Sem categoria, sem vencimento, sem etapa.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores } from "../../../lib/rh";
import {
  fetchCustosFixos, salvarCustosFixos,
  diasNoMes, porDia, folhaFixa, totalMensal,
} from "../../../lib/custos-fixos";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let seq = 0;
const novoCusto = () => ({ id: `c${Date.now().toString(36)}${(seq += 1)}`, nome: "", valor: "" });

export default function CustosFixosPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [custos, setCustos] = useState([]);
  const [incluirFolha, setIncluirFolha] = useState(true);
  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let ativo = true;
    Promise.all([fetchCustosFixos(unidadeAtiva), fetchColaboradores(unidadeAtiva)]).then(([c, col]) => {
      if (!ativo) return;
      setCustos(c.data.length ? c.data : [novoCusto()]);
      setIncluirFolha(c.incluirFolha);
      setColaboradores(col.data || []);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const dias = diasNoMes();
  const folha = useMemo(() => folhaFixa(colaboradores), [colaboradores]);
  const contratados = useMemo(
    () => colaboradores.filter(c => (c.status || "ativo") !== "inativo" && String(c.tipo_contrato || "") !== "Freelancer").length,
    [colaboradores],
  );
  const total = totalMensal(custos, folha, { incluirFolha });
  const custoDia = porDia(total, dias);

  const mudar = (id, campos) => setCustos(l => l.map(c => c.id === id ? { ...c, ...campos } : c));
  const remover = (id) => setCustos(l => l.filter(c => c.id !== id));
  const adicionar = () => setCustos(l => [...l, novoCusto()]);

  const salvar = async () => {
    setSalvando(true); setErro(""); setAviso("");
    const r = await salvarCustosFixos(unidadeAtiva, custos.filter(c => c.nome.trim()), { incluirFolha });
    setSalvando(false);
    if (r.error) { setErro(r.error); return; }
    setAviso("Custos salvos.");
    setTimeout(() => setAviso(""), 3000);
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-32">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => router.push("/dashboard/financeiro")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Custos fixos</h1>
            <p className="text-xs font-bold text-slate-500">Quanto custa abrir a porta, por dia</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : (
          <>
            {/* O número que importa */}
            <section className="rounded-2xl border-2 border-emerald-200 bg-white p-5 text-center shadow-sm sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Custo fixo por dia</p>
              <p className="mt-1 text-4xl font-black text-slate-900 sm:text-5xl">{brl(custoDia)}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {brl(total)} no mês ÷ {dias} dias
              </p>
            </section>

            {/* Folha */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={incluirFolha} onChange={e => setIncluirFolha(e.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[15px] font-black text-slate-900"><Users size={16} className="text-slate-400" /> Salário fixo (folha)</span>
                    <span className="text-[15px] font-black text-slate-900">{brl(folha)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] font-medium text-slate-500">
                    {contratados} contratado(s) · vem do RH, extras não entram · {brl(porDia(folha, dias))} por dia
                  </span>
                </span>
              </label>
            </section>

            {/* A lista */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">O que sai todo mês</p>
                <button onClick={adicionar} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-white px-3.5 font-black text-emerald-700 hover:bg-emerald-50">
                  <Plus size={16} /> Custo
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                {custos.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <input value={c.nome} onChange={e => mudar(c.id, { nome: e.target.value })}
                      placeholder="Aluguel, luz, água, internet, contador..."
                      className="h-12 min-w-[140px] flex-1 rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                    <input type="number" step="0.01" min="0" inputMode="decimal" value={c.valor}
                      onChange={e => mudar(c.id, { valor: e.target.value })} placeholder="0,00"
                      className="h-12 w-32 rounded-xl border border-slate-300 px-3 text-right font-black text-slate-800 outline-none focus:border-emerald-600" />
                    <span className="w-24 shrink-0 text-right text-[13px] font-bold text-slate-500">{brl(porDia(c.valor, dias))}/dia</span>
                    <button onClick={() => remover(c.id)} title={`Excluir ${c.nome || "custo"}`}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
                  </div>
                ))}
                {custos.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum custo na lista. Toque em “Custo” para começar.</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-black text-slate-600">Soma dos custos</span>
                <span className="text-lg font-black text-slate-900">{brl(totalMensal(custos, 0, { incluirFolha: false }))}</span>
              </div>
            </section>

            {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
            {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{aviso}</p>}
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="hidden text-sm font-black text-slate-500 sm:block">{brl(custoDia)} por dia</span>
          <button onClick={salvar} disabled={salvando || !unidadeAtiva || unidadeAtiva === "todas"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
            {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
