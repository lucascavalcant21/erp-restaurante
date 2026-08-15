"use client";

// CENTRAL OPERACIONAL — o que está acontecendo agora na operação.
// Ao abrir, gera as execuções do dia (idempotente: rodar de novo não duplica)
// e mostra a linha do tempo com status calculado no servidor.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Play, CheckCircle2, AlertTriangle, Clock,
  ListChecks, ShieldAlert, Plus, RefreshCw,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { lerSessao } from "../../../lib/auth";
import {
  gerarExecucoesDoDia, fetchExecucoes, fetchNaoConformidades,
} from "../../../lib/operacao-inteligente";
import { calcularScore, isoData } from "../../../lib/operacao-agenda.mjs";

const CORES = {
  AGENDADA: { rotulo: "Agendado", cor: "bg-slate-100 text-slate-600 border-slate-200" },
  DISPONIVEL: { rotulo: "Disponível", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  EM_ANDAMENTO: { rotulo: "Em andamento", cor: "bg-emerald-600 text-white border-emerald-600" },
  CONCLUIDA: { rotulo: "Concluído", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CONCLUIDA_COM_ATRASO: { rotulo: "Concluído com atraso", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  ATRASADA: { rotulo: "Atrasado", cor: "bg-red-50 text-red-700 border-red-200" },
  CANCELADA: { rotulo: "Cancelado", cor: "bg-slate-100 text-slate-400 border-slate-200" },
};

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--");

export default function CentralOperacional() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [execucoes, setExecucoes] = useState([]);
  const [ncs, setNcs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [dia, setDia] = useState(isoData(new Date()));
  const [filtroStatus, setFiltroStatus] = useState("");
  const [sessao, setSessao] = useState(null);

  useEffect(() => { lerSessao().then(setSessao).catch(() => {}); }, []);

  const carregar = async ({ gerar = false } = {}) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    setCarregando(true);
    // Gera o que falta para o dia. A chave única no banco garante que rodar
    // isso a cada abertura não cria execução repetida.
    if (gerar) { setGerando(true); await gerarExecucoesDoDia(unidadeAtiva, dia); setGerando(false); }
    const [exec, nc] = await Promise.all([
      fetchExecucoes(unidadeAtiva, { data: dia }),
      fetchNaoConformidades(unidadeAtiva, { status: "ABERTA" }),
    ]);
    setExecucoes(exec.data || []);
    setNcs(nc.data || []);
    setCarregando(false);
  };

  useEffect(() => { carregar({ gerar: dia === isoData(new Date()) }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unidadeAtiva, dia]);

  // Atualiza sozinho: status muda com o relógio, não com o clique do usuário.
  useEffect(() => {
    const t = setInterval(() => carregar(), 90000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva, dia]);

  const resumo = useMemo(() => {
    const por = (s) => execucoes.filter(e => e.status === s).length;
    return {
      agendadas: por("AGENDADA") + por("DISPONIVEL"),
      andamento: por("EM_ANDAMENTO"),
      atrasadas: por("ATRASADA"),
      concluidas: por("CONCLUIDA") + por("CONCLUIDA_COM_ATRASO"),
      ncs: ncs.length,
    };
  }, [execucoes, ncs]);

  const score = useMemo(() => calcularScore({ execucoes }), [execucoes]);
  const lista = useMemo(
    () => (filtroStatus ? execucoes.filter(e => e.status === filtroStatus) : execucoes),
    [execucoes, filtroStatus]);

  const abrir = (e) => {
    if (["CONCLUIDA", "CONCLUIDA_COM_ATRASO"].includes(e.status)) return router.push(`/dashboard/operacao/inteligente/execucao/${e.id}`);
    router.push(`/dashboard/operacao/inteligente/execucao/${e.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Central Operacional</h1>
            <p className="text-xs font-bold text-slate-500">Rotinas do dia, atrasos e não conformidades</p>
          </div>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-700" />
          <button onClick={() => carregar({ gerar: true })} disabled={gerando}
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">
            <RefreshCw size={17} className={gerando ? "animate-spin" : ""} /> Atualizar
          </button>
          <button onClick={() => router.push("/dashboard/operacao/inteligente/nao-conformidades")}
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700">
            <ShieldAlert size={18} /> Não conformidades
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : (
          <>
            {/* Indicadores do dia */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { rot: "Agendados", val: resumo.agendadas, filtro: "", icone: Clock },
                { rot: "Em andamento", val: resumo.andamento, filtro: "EM_ANDAMENTO", icone: Play },
                { rot: "Atrasados", val: resumo.atrasadas, filtro: "ATRASADA", icone: AlertTriangle, alerta: resumo.atrasadas > 0 },
                { rot: "Concluídos", val: resumo.concluidas, filtro: "CONCLUIDA", icone: CheckCircle2 },
                { rot: "Não conformidades", val: resumo.ncs, filtro: null, icone: ShieldAlert, alerta: resumo.ncs > 0 },
                { rot: "Score do dia", val: score.score == null ? "—" : `${score.score}`, filtro: null, icone: ListChecks },
              ].map(c => (
                <button key={c.rot}
                  onClick={() => c.filtro === null ? router.push("/dashboard/operacao/inteligente/nao-conformidades") : setFiltroStatus(c.filtro)}
                  className={`rounded-2xl border p-3 text-left shadow-sm transition-all hover:border-emerald-300 ${c.alerta ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                  <c.icone size={16} className={c.alerta ? "text-red-500" : "text-emerald-600"} />
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400 leading-tight">{c.rot}</p>
                  <p className={`text-xl font-black ${c.alerta ? "text-red-600" : "text-slate-800"}`}>{c.val}</p>
                </button>
              ))}
            </div>

            {score.score != null && (
              <div className="grid grid-cols-3 gap-2.5">
                {[["Pontualidade", score.pontualidade], ["Execução", score.execucao], ["Qualidade", score.qualidade]].map(([rot, val]) => (
                  <div key={rot} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{rot}</p>
                    <p className="text-lg font-black text-emerald-700">{val}%</p>
                  </div>
                ))}
              </div>
            )}

            {/* Acontecendo agora */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700">Acontecendo hoje</h2>
                {filtroStatus && (
                  <button onClick={() => setFiltroStatus("")} className="text-[12px] font-black text-emerald-700">Ver todos</button>
                )}
              </div>

              {carregando ? (
                <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
              ) : lista.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <ListChecks className="mx-auto text-slate-300" size={38} />
                  <p className="mt-3 font-black text-slate-700">Nenhuma rotina para este dia</p>
                  <p className="mt-1 text-sm text-slate-500">Crie um processo e agende o horário para ele aparecer aqui.</p>
                  <button onClick={() => router.push("/dashboard/operacao/inteligente/nao-conformidades")}
                    className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Ver não conformidades</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lista.map(e => {
                    const info = CORES[e.status] || CORES.AGENDADA;
                    const progresso = e.total_itens ? Math.round((e.itens_respondidos / e.total_itens) * 100) : 0;
                    return (
                      <button key={e.id} onClick={() => abrir(e)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-400">
                        <span className="w-14 shrink-0 text-center">
                          <span className="block text-[15px] font-black text-slate-800">{hora(e.previsto_para)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-black text-slate-900">{e.processo?.nome || "Processo"}</span>
                          <span className="block truncate text-[12px] font-bold text-slate-500">
                            {e.processo?.setor || "geral"}
                            {e.responsavel_nome ? ` · ${e.responsavel_nome}` : ""}
                            {e.total_itens ? ` · ${e.itens_respondidos}/${e.total_itens} itens` : ""}
                          </span>
                          {progresso > 0 && progresso < 100 && (
                            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progresso}%` }} />
                            </span>
                          )}
                        </span>
                        <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-black ${info.cor}`}>{info.rotulo}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Não conformidades abertas */}
            {ncs.length > 0 && (
              <section className="rounded-2xl border-2 border-red-200 bg-red-50/50 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-black uppercase tracking-widest text-red-700">Não conformidades abertas</h2>
                  <button onClick={() => router.push("/dashboard/operacao/inteligente/nao-conformidades")}
                    className="text-[12px] font-black text-red-700">Ver todas</button>
                </div>
                <div className="space-y-2">
                  {ncs.slice(0, 5).map(nc => (
                    <div key={nc.id} className="rounded-xl border border-red-100 bg-white p-3">
                      <p className="text-[14px] font-black text-slate-800">{nc.titulo}</p>
                      {nc.descricao && <p className="mt-0.5 whitespace-pre-line text-[12px] font-medium text-slate-500 line-clamp-2">{nc.descricao}</p>}
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
                        {nc.setor || "geral"} · {nc.criticidade === "critica" ? "crítica" : nc.criticidade} · {new Date(nc.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
