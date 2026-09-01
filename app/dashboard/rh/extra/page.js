"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Briefcase, Check, CheckCircle2, Copy, DollarSign, ExternalLink,
  FileClock, Loader2, MoreHorizontal, Pencil, Phone, Plus, ReceiptText, Search, UserPlus, UsersRound,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { faixaCompras, andarPeriodo, rotuloPeriodo, isoData } from "../../../lib/compras.mjs";

const fmtBRL = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (valor) => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function CadastroExtrasPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [extras, setExtras] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("mes");   // dia | semana | mes
  const [refPagamento, setRefPagamento] = useState(() => new Date());
  const [carregando, setCarregando] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [menuPortalAberto, setMenuPortalAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setExtras([]); setRecibos([]); setCarregando(false);
      return () => { ativo = false; };
    }
    setCarregando(true);
    Promise.all([fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva)]).then(([cadastros, historico]) => {
      if (!ativo) return;
      setExtras((cadastros.data || []).filter((item) => item.tipo_contrato === "Freelancer"));
      setRecibos(historico.data || []);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return extras.filter((extra) => !termo || `${extra.nome || ""} ${extra.cargo || ""} ${extra.telefone || ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, extras]);

  const nomes = useMemo(() => Object.fromEntries(extras.map((extra) => [extra.id, extra.nome])), [extras]);
  const pendentes = recibos.filter((recibo) => !recibo.pagamento_realizado);
  const totalPendente = pendentes.reduce((soma, recibo) => soma + Number(recibo.valor_total || 0), 0);

  const faixaPagamentos = useMemo(() => faixaCompras(refPagamento, periodo), [refPagamento, periodo]);
  const pagosNoPeriodo = useMemo(() => {
    const de = isoData(faixaPagamentos.de), ate = isoData(faixaPagamentos.ate);
    return recibos.filter((r) => {
      if (!r.pagamento_realizado) return false;
      const d = String(r.data_pagamento || r.data_trabalho || "").slice(0, 10);
      return d >= de && d <= ate;
    });
  }, [recibos, faixaPagamentos]);
  const totalPago = pagosNoPeriodo.reduce((soma, r) => soma + Number(r.valor_total || 0), 0);

  const copiarLinkPortal = () => {
    const link = window.location.origin + "/extras/" + unidadeAtiva;
    navigator.clipboard?.writeText(link);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100/80 pb-16 text-slate-900">
      {/* HEADER COMPACTO E ORGANIZADO */}
      <header className="border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-xl font-black text-slate-900">Extras</h1>
              <p className="text-xs font-semibold text-slate-500">Cadastro e recibos · {unidadeInfo?.nome || "unidade ativa"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => router.push("/dashboard/rh/extra/novo")} className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700">
              <UserPlus size={15} /> Cadastrar extra
            </button>
            <button onClick={() => router.push("/dashboard/rh/extra/banco")} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50">
              <UsersRound size={15}/> Banco
            </button>

            {/* Menu Dropdown do Portal para economizar espaço */}
            <div className="relative">
              <button onClick={() => setMenuPortalAberto(a => !a)} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                Portal <MoreHorizontal size={15}/>
              </button>
              {menuPortalAberto && (
                <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs font-bold">
                  <button onClick={() => { setMenuPortalAberto(false); router.push("/dashboard/rh/extra/portal"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"><Pencil size={14}/> Editar portal</button>
                  <button onClick={() => { setMenuPortalAberto(false); copiarLinkPortal(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50">{linkCopiado ? <Check size={14} className="text-emerald-600"/> : <Copy size={14}/>} {linkCopiado ? "Link copiado!" : "Copiar link"}</button>
                  <a href={`/extras/${unidadeAtiva}`} target="_blank" rel="noreferrer" onClick={() => setMenuPortalAberto(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"><ExternalLink size={14}/> Abrir portal</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        {/* MÉTRICAS COMPACTAS (4 COLUNAS EM GRID DIRETO) */}
        <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Cadastrados</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><UsersRound size={16} /></span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{extras.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Recibos Emitidos</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><ReceiptText size={16} /></span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{recibos.length}</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">Pendentes</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-800"><DollarSign size={16} /></span>
            </div>
            <p className="mt-2 text-xl font-black text-amber-950">{fmtBRL(totalPendente)}</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Pago no período</span>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                {[["dia", "Dia"], ["semana", "Sem."], ["mes", "Mês"]].map(([v, r]) => (
                  <button key={v} onClick={() => setPeriodo(v)} className={`px-2 py-0.5 rounded text-[10px] font-black ${periodo === v ? "bg-emerald-600 text-white" : "text-slate-600"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-xl font-black text-slate-900">{fmtBRL(totalPago)}</p>
              <div className="flex items-center gap-1 text-[11px] font-black text-slate-500">
                <button onClick={() => setRefPagamento(andarPeriodo(refPagamento, periodo, -1))} className="px-1 hover:text-slate-900">&lsaquo;</button>
                <span className="capitalize">{rotuloPeriodo(faixaPagamentos, periodo)}</span>
                <button onClick={() => setRefPagamento(andarPeriodo(refPagamento, periodo, 1))} className="px-1 hover:text-slate-900">&rsaquo;</button>
              </div>
            </div>
          </div>
        </section>

        {/* CONTEÚDO PRINCIPAL: EXTRAS + SIDEBAR DE RECIBOS MAIS COMPACTA */}
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, função ou telefone..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm" />
            </div>

            {!unidadeAtiva || unidadeAtiva === "todas" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Selecione uma unidade específica para acessar os extras.</div>
            ) : carregando ? (
              <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
            ) : filtrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <UsersRound className="mx-auto text-slate-300" size={36} />
                <p className="mt-2 font-black text-slate-700">Nenhum extra encontrado</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtrados.map((extra) => (
                  <article key={extra.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{extra.nome}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-500"><Briefcase size={12} /> {extra.cargo || "Extra"}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">Ativo</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1"><Phone size={13} className="text-emerald-600" /> {extra.telefone || "Sem fone"}</span>
                      <span className="font-black text-slate-900">Diária: {fmtBRL(extra.salario)}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-black text-slate-700 hover:bg-slate-200">
                        <Pencil size={14} /> Editar
                      </button>
                      <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}/recibo`)} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700">
                        <Plus size={14} /> Recibo
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* SIDEBAR DE RECIBOS RECENTES ENXUTA E COMPACTA */}
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-3">
              <FileClock className="text-emerald-600" size={18} />
              <h2 className="text-sm font-black text-slate-900">Recibos recentes</h2>
            </div>

            {recibos.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Nenhum recibo emitido.</p>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-0.5">
                {recibos.slice(0, 10).map((recibo) => (
                  <button
                    key={recibo.id}
                    onClick={() => router.push(`/dashboard/rh/extra/${recibo.colaborador_id}/recibo`)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-left hover:border-emerald-300 hover:bg-white transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-slate-800">{nomes[recibo.colaborador_id] || recibo.dados?.nome || "Extra"}</p>
                      {recibo.pagamento_realizado ? (
                        <CheckCircle2 className="shrink-0 text-emerald-600" size={14} />
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>{dataBR(recibo.data_trabalho)}</span>
                      <span className="font-black text-slate-800">{fmtBRL(recibo.valor_total)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
