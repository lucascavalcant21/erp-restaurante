"use client";

// NÃO CONFORMIDADES — o que saiu do padrão e o que está sendo feito a respeito.
// Nasce sozinha quando um item reprova na execução; aqui o gestor trata.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldAlert, Plus, Check, Clock, X } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { lerSessao } from "../../../../lib/auth";
import {
  fetchNaoConformidades, atualizarNaoConformidade,
  fetchAcoesCorretivas, salvarAcaoCorretiva,
} from "../../../../lib/operacao-inteligente";

const STATUS = ["ABERTA", "EM_ANALISE", "ACAO_DEFINIDA", "EM_CORRECAO", "AGUARDANDO_VALIDACAO", "RESOLVIDA", "CANCELADA"];
const ROTULO = {
  ABERTA: "Aberta", EM_ANALISE: "Em análise", ACAO_DEFINIDA: "Ação definida",
  EM_CORRECAO: "Em correção", AGUARDANDO_VALIDACAO: "Aguardando validação",
  RESOLVIDA: "Resolvida", CANCELADA: "Cancelada",
};
const COR = (s) => s === "RESOLVIDA" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
  : s === "CANCELADA" ? "bg-elevated text-muted border-line"
  : s === "ABERTA" ? "bg-red-50 text-red-700 border-red-200"
  : "bg-amber-50 text-amber-700 border-amber-200";

export default function NaoConformidades() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("ABERTA");
  const [aberta, setAberta] = useState(null);      // NC expandida
  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel_nome: "", prazo: "" });
  const [sessao, setSessao] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { lerSessao().then(setSessao).catch(() => {}); }, []);

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    setCarregando(true);
    const { data } = await fetchNaoConformidades(unidadeAtiva, { status: filtro });
    setLista(data || []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unidadeAtiva, filtro]);

  const abrir = async (nc) => {
    if (aberta?.id === nc.id) { setAberta(null); return; }
    setAberta(nc);
    const { data } = await fetchAcoesCorretivas(nc.id);
    setAcoes(data || []);
  };

  const mudarStatus = async (nc, status) => {
    const { error } = await atualizarNaoConformidade(nc.id, { status }, { nome: sessao?.nome });
    if (error) return alert(`Não consegui atualizar esta não conformidade: ${error}`);
    await carregar();
    if (aberta?.id === nc.id) setAberta({ ...nc, status });
  };

  const criarAcao = async () => {
    if (!novaAcao.descricao.trim()) return;
    setSalvando(true);
    await salvarAcaoCorretiva({
      nao_conformidade_id: aberta.id,
      descricao: novaAcao.descricao.trim(),
      responsavel_nome: novaAcao.responsavel_nome || null,
      prazo: novaAcao.prazo || null,
      status: "PENDENTE",
    });
    // Definir ação move a NC adiante sozinha.
    if (aberta.status === "ABERTA") await atualizarNaoConformidade(aberta.id, { status: "ACAO_DEFINIDA" }, { nome: sessao?.nome });
    setNovaAcao({ descricao: "", responsavel_nome: "", prazo: "" });
    const { data } = await fetchAcoesCorretivas(aberta.id);
    setAcoes(data || []);
    setSalvando(false);
    await carregar();
  };

  const concluirAcao = async (acao) => {
    await salvarAcaoCorretiva({ id: acao.id, status: "CONCLUIDA" });
    const { data } = await fetchAcoesCorretivas(aberta.id);
    setAcoes(data || []);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-20">
      <div className="sticky top-0 z-20 border-b border-line bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated text-slate-600"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-fg sm:text-xl">Não conformidades</h1>
            <p className="text-xs font-bold text-muted">O que saiu do padrão e as ações corretivas</p>
          </div>
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className="h-11 rounded-xl border border-line bg-card px-3 font-bold text-fg-soft">
            {STATUS.map(s => <option key={s} value={s}>{ROTULO[s]}</option>)}
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
        {carregando ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-success" size={28} /></div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-card p-10 text-center">
            <ShieldAlert className="mx-auto text-dim" size={40} />
            <p className="mt-3 font-black text-fg-soft">Nada fora do padrão por aqui</p>
            <p className="mt-1 text-sm text-muted">As não conformidades aparecem sozinhas quando um item reprova numa execução.</p>
          </div>
        ) : lista.map(nc => (
          <article key={nc.id} className="rounded-2xl border border-line bg-card shadow-sm">
            <button onClick={() => abrir(nc)} className="flex w-full items-start gap-3 p-4 text-left">
              <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${nc.criticidade === "critica" ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                <ShieldAlert size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-fg">{nc.titulo}</span>
                {nc.descricao && <span className="mt-0.5 block whitespace-pre-line text-[13px] font-medium text-muted line-clamp-2">{nc.descricao}</span>}
                <span className="mt-1 block text-2xs font-bold text-subtle">
                  {nc.setor || "geral"} · {new Date(nc.created_at).toLocaleString("pt-BR")}
                  {nc.criticidade === "critica" ? " · crítica" : ""}
                </span>
              </span>
              <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-2xs font-bold ${COR(nc.status)}`}>{ROTULO[nc.status]}</span>
            </button>

            {aberta?.id === nc.id && (
              <div className="border-t border-line-soft p-4">
                <div className="flex flex-wrap gap-2">
                  {["EM_ANALISE", "EM_CORRECAO", "RESOLVIDA", "CANCELADA"].map(s => (
                    <button key={s} onClick={() => mudarStatus(nc, s)}
                      className={`min-h-10 rounded-xl px-3 text-xs font-bold ${nc.status === s ? "bg-accent text-accent-fg" : "border border-line bg-card text-slate-600 hover:bg-slate-50"}`}>
                      {ROTULO[s]}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-2xs font-bold uppercase tracking-widest text-accent">Ações corretivas</p>
                {acoes.length === 0 ? (
                  <p className="mt-1.5 text-[13px] font-medium text-muted">Nenhuma ação definida ainda.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {acoes.map(a => (
                      <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold text-slate-800">{a.descricao}</span>
                          <span className="block text-2xs font-bold text-subtle">
                            {a.responsavel_nome || "sem responsável"}{a.prazo ? ` · até ${new Date(`${a.prazo}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                          </span>
                        </span>
                        {a.status === "CONCLUIDA" ? (
                          <span className="flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1 text-2xs font-bold text-accent-strong"><Check size={13} /> Feita</span>
                        ) : (
                          <button onClick={() => concluirAcao(a)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-accent-strong hover:bg-accent-soft">Concluir</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_150px_auto]">
                  <input value={novaAcao.descricao} onChange={e => setNovaAcao(v => ({ ...v, descricao: e.target.value }))}
                    placeholder="O que precisa ser feito?" className="h-11 rounded-xl border border-line px-3 font-bold text-slate-800 outline-none focus:border-emerald-500" />
                  <input value={novaAcao.responsavel_nome} onChange={e => setNovaAcao(v => ({ ...v, responsavel_nome: e.target.value }))}
                    placeholder="Responsável" className="h-11 rounded-xl border border-line px-3 font-bold text-slate-800 outline-none focus:border-emerald-500" />
                  <input type="date" value={novaAcao.prazo} onChange={e => setNovaAcao(v => ({ ...v, prazo: e.target.value }))}
                    className="h-11 rounded-xl border border-line px-3 font-bold text-fg-soft outline-none focus:border-emerald-500" />
                  <button onClick={criarAcao} disabled={salvando || !novaAcao.descricao.trim()}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 font-black text-accent-fg hover:bg-accent disabled:opacity-50">
                    {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Ação
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
