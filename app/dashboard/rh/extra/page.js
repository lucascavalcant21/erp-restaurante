"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Briefcase, Calendar, Check, CheckCircle2, Copy, DollarSign, ExternalLink,
  FileClock, History, Loader2, MoreHorizontal, Pencil, Phone, Plus, Printer, ReceiptText, Search, UserPlus, UsersRound, X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { faixaCompras, andarPeriodo, rotuloPeriodo, isoData } from "../../../lib/compras.mjs";
import { imprimirReciboExtra } from "../../../lib/recibo-extra";

const fmtBRL = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (valor) => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const fmtTel = (v) => {
  const limpo = String(v || "").replace(/\D/g, "");
  if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(v || "Sem telefone");
};

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
  
  // Modal de histórico da pessoa selecionada
  const [historicoModal, setHistoricoModal] = useState(null); // extra object

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
              <div className="grid gap-4 sm:grid-cols-2">
                {filtrados.map((extra) => {
                  const recibosPessoa = recibos.filter(r => String(r.colaborador_id) === String(extra.id));
                  const totalGastoPessoa = recibosPessoa.filter(r => r.pagamento_realizado).reduce((s, r) => s + Number(r.valor_total || 0), 0);
                  const diasTrabalhadosCount = recibosPessoa.length;
                  const funcoesExercidasSet = new Set(recibosPessoa.map(r => r.funcao || extra.cargo).filter(Boolean));
                  if (!funcoesExercidasSet.size && extra.cargo) funcoesExercidasSet.add(extra.cargo);
                  const funcoesTexto = Array.from(funcoesExercidasSet).slice(0, 2).join(", ");

                  return (
                    <article key={extra.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md flex flex-col justify-between">
                      <div>
                        {/* CABEÇALHO DO CARD */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 font-black text-base uppercase">
                              {extra.nome ? extra.nome[0] : "E"}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-black text-slate-900 leading-tight" title={extra.nome}>{extra.nome}</h3>
                              <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-500 truncate"><Briefcase size={12} className="shrink-0 text-slate-400" /> {extra.cargo || "Extra"}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 shrink-0">
                            Cadastrado
                          </span>
                        </div>

                        {/* DETALHES DE CONTATO E DIÁRIA */}
                        <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs font-semibold text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Phone size={13} className="text-emerald-600 shrink-0" /> {fmtTel(extra.telefone)}</span>
                            <span className="font-black text-slate-900">Diária: <strong className="text-emerald-700 font-black">{fmtBRL(extra.salario)}</strong></span>
                          </div>

                          {/* RESUMO HISTÓRICO VISÍVEL NO CARD */}
                          <div className="mt-2.5 rounded-2xl bg-slate-50/80 p-2.5 text-xs border border-slate-100 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Total Gasto</span>
                              <strong className="text-emerald-700 font-black text-sm">{fmtBRL(totalGastoPessoa)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Trabalhos</span>
                              <strong className="text-slate-800 font-black text-sm">{diasTrabalhadosCount} {diasTrabalhadosCount === 1 ? "dia" : "dias"}</strong>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Função</span>
                              <strong className="text-slate-700 font-black text-xs truncate block" title={funcoesTexto}>{funcoesTexto}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES NO CARD */}
                      <div className="mt-3.5 grid grid-cols-3 gap-2">
                        <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-100 text-xs font-black text-slate-700 hover:bg-slate-200 transition-colors">
                          <Pencil size={13} /> Editar
                        </button>
                        <button onClick={() => setHistoricoModal(extra)} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-amber-50 text-xs font-black text-amber-800 hover:bg-amber-100 border border-amber-200/80 transition-colors">
                          <History size={13} /> Histórico
                        </button>
                        <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}/recibo`)} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition-colors">
                          <Plus size={13} /> Recibo
                        </button>
                      </div>
                    </article>
                  );
                })}
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

      {/* MODAL DE HISTÓRICO COMPLETO DA PESSOA */}
      {historicoModal && (() => {
        const extra = historicoModal;
        const recibosPessoa = recibos.filter(r => String(r.colaborador_id) === String(extra.id));
        const totalGastoPessoa = recibosPessoa.filter(r => r.pagamento_realizado).reduce((s, r) => s + Number(r.valor_total || 0), 0);
        const funcoesExercidasSet = new Set(recibosPessoa.map(r => r.funcao || extra.cargo).filter(Boolean));
        if (!funcoesExercidasSet.size && extra.cargo) funcoesExercidasSet.add(extra.cargo);
        const funcoesTexto = Array.from(funcoesExercidasSet).join(", ");

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setHistoricoModal(null)}>
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xl uppercase">
                    {extra.nome ? extra.nome[0] : "E"}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Histórico do Profissional</span>
                    <h2 className="text-xl font-black text-slate-900">{extra.nome}</h2>
                    <p className="text-xs font-semibold text-slate-500">{extra.cargo || "Extra"} · Diária: {fmtBRL(extra.salario)}</p>
                  </div>
                </div>
                <button onClick={() => setHistoricoModal(null)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><X size={18} /></button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* RESUMO GERAL */}
                <div className="grid grid-cols-3 gap-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-center">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800">Total Gasto</span>
                    <p className="text-xl font-black text-emerald-700">{fmtBRL(totalGastoPessoa)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800">Dias Trabalhados</span>
                    <p className="text-xl font-black text-slate-800">{recibosPessoa.length} turno(s)</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800">Funções Exercidas</span>
                    <p className="text-xs font-bold text-slate-800 truncate" title={funcoesTexto}>{funcoesTexto}</p>
                  </div>
                </div>

                {/* LISTA DE RECIBOS */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Todos os recibos gerados ({recibosPessoa.length})</h3>
                  {recibosPessoa.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">Nenhum recibo emitido para esta pessoa ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {recibosPessoa.map(r => {
                        const entrada = r.hora_entrada || r.dados?.entrada || extra.horario_entrada || "";
                        const saida = r.hora_saida || r.dados?.saida || extra.horario_saida || "";
                        const horarioShift = entrada && saida ? `${entrada} às ${saida}` : (entrada ? `Início ${entrada}` : "");
                        return (
                          <div key={r.id} className="rounded-2xl border border-slate-200 p-3.5 bg-white hover:border-emerald-300 transition-all flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-sm font-black text-slate-900">{dataBR(r.data_trabalho)}</strong>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.pagamento_realizado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.pagamento_realizado ? "Pago" : "Pendente"}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-500 mt-0.5">Função: <span className="text-slate-800">{r.funcao || extra.cargo || "Extra"}</span>{horarioShift ? ` · Horário: ${horarioShift}` : ""}</p>
                              <p className="text-xs font-bold text-slate-500">Forma de pagamento: <span className="text-slate-800">{r.forma_pagamento || "Pix"}</span></p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-base font-black text-slate-900">{fmtBRL(r.valor_total)}</span>
                              <button onClick={() => imprimirReciboExtra({ extra, recibo: r, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome, textos: {} })} className="flex h-9 items-center gap-1 px-3 rounded-xl bg-slate-100 text-xs font-black text-slate-700 hover:bg-slate-200">
                                <Printer size={14} /> Imprimir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setHistoricoModal(null)} className="px-5 py-2.5 rounded-xl bg-slate-200 text-xs font-black text-slate-700 hover:bg-slate-300">Fechar</button>
                <button onClick={() => { setHistoricoModal(null); router.push(`/dashboard/rh/extra/${extra.id}/recibo`); }} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700">Gerar novo recibo</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
