"use client";

// PROCESSOS — a lista dos modelos que a operação executa.
// Daqui se cria do zero, se começa de um modelo pronto, se duplica e se arquiva.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Archive, ArchiveRestore, ClipboardList, Copy, Layers,
  Loader2, Pencil, Plus, Search, Clock, AlertTriangle,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { lerSessao } from "../../../../lib/auth";
import {
  fetchProcessos, fetchAgendas, arquivarProcesso, duplicarProcesso,
} from "../../../../lib/operacao-inteligente";
import { descreverAgenda, CRITICIDADES } from "../../../../lib/operacao-tipos.mjs";
import { MODELOS_PROCESSO } from "../../../../lib/operacao-modelos.mjs";

const CORCRIT = {
  critica: "bg-red-50 text-red-700 border-red-200",
  alta: "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  baixa: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ProcessosPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [processos, setProcessos] = useState([]);
  const [agendas, setAgendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [verArquivados, setVerArquivados] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [sessao, setSessao] = useState(null);
  const [modelos, setModelos] = useState(false);

  useEffect(() => { lerSessao().then(setSessao).catch(() => {}); }, []);

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setProcessos([]); setCarregando(false); return; }
    setCarregando(true);
    const [p, a] = await Promise.all([
      fetchProcessos(unidadeAtiva, { incluirArquivados: true }),
      fetchAgendas(unidadeAtiva),
    ]);
    setProcessos(p.data || []);
    setAgendas(a.data || []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unidadeAtiva]);

  const agendaDe = (processoId) => agendas.filter(a => a.processo_id === processoId);

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return processos
      .filter(p => !!p.arquivado === verArquivados)
      .filter(p => !termo || `${p.nome} ${p.categoria || ""} ${p.setor || ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [processos, busca, verArquivados]);

  const duplicar = async (p) => {
    setOcupado(p.id);
    const { id, error } = await duplicarProcesso(p.id, { criadoPor: sessao?.nome });
    setOcupado("");
    if (error) return;
    router.push(`/dashboard/operacao/inteligente/processos/${id}`);
  };

  const alternarArquivo = async (p) => {
    setOcupado(p.id);
    await arquivarProcesso(p.id, !p.arquivado);
    setOcupado("");
    carregar();
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-20">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Processos</h1>
            <p className="text-xs font-bold text-slate-500">Os modelos que a equipe executa todo dia</p>
          </div>
          <button onClick={() => setModelos(v => !v)}
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">
            <Layers size={17} /> Modelos prontos
          </button>
          <button onClick={() => router.push("/dashboard/operacao/inteligente/processos/novo")}
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700">
            <Plus size={18} /> Novo processo
          </button>
        </div>
        <div className="erp-busca-fixa mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar processo"
            className="h-12 w-full bg-transparent font-bold text-slate-800 outline-none" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {modelos && (
          <section className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Começar de um modelo pronto</p>
            <p className="mb-3 mt-1 text-sm font-medium text-slate-500">O processo é criado já preenchido. Depois é só ajustar.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {MODELOS_PROCESSO.map(m => (
                <button key={m.id} onClick={() => router.push(`/dashboard/operacao/inteligente/processos/novo?modelo=${m.id}`)}
                  className="rounded-xl border border-slate-200 p-3.5 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/60">
                  <p className="text-[15px] font-black text-slate-900">{m.nome}</p>
                  <p className="mt-0.5 text-[13px] font-medium text-slate-500">{m.descricao}</p>
                  <p className="mt-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    {m.secoes.length} seções · {m.secoes.reduce((s, x) => s + x.itens.length, 0)} itens
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-2">
          {[{ v: false, r: "Ativos" }, { v: true, r: "Arquivados" }].map(o => (
            <button key={String(o.v)} onClick={() => setVerArquivados(o.v)}
              className={`h-10 rounded-xl px-4 text-sm font-black ${verArquivados === o.v ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {o.r}
            </button>
          ))}
        </div>

        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : carregando ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ClipboardList className="mx-auto text-slate-300" size={40} />
            <p className="mt-3 font-black text-slate-700">{verArquivados ? "Nada arquivado" : "Nenhum processo ainda"}</p>
            {!verArquivados && (
              <>
                <p className="mt-1 text-sm text-slate-500">Crie o primeiro do zero ou comece por um modelo pronto.</p>
                <button onClick={() => setModelos(true)} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Ver modelos prontos</button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {lista.map(p => {
              const ags = agendaDe(p.id);
              return (
                <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300">
                  <div className="flex flex-wrap items-start gap-3">
                    <button onClick={() => router.push(`/dashboard/operacao/inteligente/processos/${p.id}`)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[16px] font-black text-slate-900">{p.nome}</h2>
                        <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-black ${CORCRIT[p.criticidade] || CORCRIT.normal}`}>
                          {CRITICIDADES.find(c => c.valor === p.criticidade)?.rotulo || "Normal"}
                        </span>
                        {p.versao > 1 && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">v{p.versao}</span>}
                      </div>
                      {p.descricao && <p className="mt-1 text-[13px] font-medium text-slate-500 line-clamp-2">{p.descricao}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-500">
                        {p.setor && <span className="capitalize">{p.setor}</span>}
                        {ags.length === 0 ? (
                          <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={13} /> sem agendamento</span>
                        ) : ags.map(a => (
                          <span key={a.id} className="flex items-center gap-1 text-emerald-700"><Clock size={13} /> {descreverAgenda(a)}</span>
                        ))}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => router.push(`/dashboard/operacao/inteligente/processos/${p.id}`)} title="Editar"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50"><Pencil size={17} /></button>
                      <button onClick={() => duplicar(p)} disabled={ocupado === p.id} title="Duplicar"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {ocupado === p.id ? <Loader2 size={17} className="animate-spin" /> : <Copy size={17} />}
                      </button>
                      <button onClick={() => alternarArquivo(p)} disabled={ocupado === p.id} title={p.arquivado ? "Reativar" : "Arquivar"}
                        className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {p.arquivado ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
