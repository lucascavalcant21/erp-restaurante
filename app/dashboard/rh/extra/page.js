"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Briefcase, CheckCircle2, DollarSign, FileClock, Loader2,
  Check, Copy, Pencil, Phone, Plus, Printer, ReceiptText, Search, UserPlus, UsersRound,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";

const fmtBRL = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (valor) => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function CadastroExtrasPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [extras, setExtras] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar à tela anterior"><ArrowLeft size={20} /></button>
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Módulo exclusivo</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Extras</h1><p className="text-sm font-medium text-slate-500">Cadastro e recibos · {unidadeInfo?.nome || "unidade selecionada"}</p></div>
          </div>
          <button onClick={() => router.push("/dashboard/rh/extra/novo")} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 font-black text-white shadow-sm hover:bg-emerald-700"><UserPlus size={18} /> Cadastrar novo extra</button><button onClick={() => router.push("/dashboard/rh/extra/banco")} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-5 font-black text-emerald-700 hover:bg-emerald-50"><UsersRound size={18}/> Banco de extras</button><button onClick={() => { const link = window.location.origin + "/extras/" + unidadeAtiva; navigator.clipboard?.writeText(link); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2500); }} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-5 font-black text-emerald-700 hover:bg-emerald-50">{linkCopiado ? <><Check size={18}/> Link copiado</> : <><Copy size={18}/> Link de cadastro</>}</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><UsersRound size={20} /></span><strong className="text-3xl text-slate-900">{extras.length}</strong></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Extras cadastrados</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><ReceiptText size={20} /></span><strong className="text-3xl text-slate-900">{recibos.length}</strong></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Recibos emitidos</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><DollarSign size={20} /></span><strong className="text-2xl text-amber-950">{fmtBRL(totalPendente)}</strong></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-amber-700">Pagamentos pendentes</p></div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><ReceiptText className="mt-0.5 shrink-0 text-emerald-700" size={22} /><div><p className="font-black text-emerald-950">Cadastro totalmente ligado ao recibo</p><p className="mt-1 text-sm font-medium text-emerald-800">Nome, CPF, PIX, função, diária, horário e itens emprestados entram automaticamente. Cada recibo fica salvo no histórico da pessoa.</p></div></div></section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <div className="relative"><Search className="absolute left-4 top-3.5 text-slate-400" size={20} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, função ou telefone..." className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 font-semibold outline-none focus:border-emerald-500" /></div>

            {!unidadeAtiva || unidadeAtiva === "todas" ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica para acessar os extras.</div> : carregando ? <div className="grid min-h-52 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div> : filtrados.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><UsersRound className="mx-auto text-slate-300" size={42} /><p className="mt-3 font-black text-slate-700">Nenhum extra encontrado</p><p className="mt-1 text-sm text-slate-500">Cadastre o primeiro freelancer ou diarista desta unidade.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{filtrados.map((extra) => <article key={extra.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black text-slate-900">{extra.nome}</p><p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500"><Briefcase size={13} /> {extra.cargo || "Extra"}</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">Cadastrado</span></div>
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-600"><p className="flex items-center gap-2"><Phone size={14} className="text-emerald-600" /> {extra.telefone || "Telefone não informado"}</p><p className="flex items-center gap-2"><DollarSign size={14} className="text-emerald-600" /> Diária: {fmtBRL(extra.salario)}</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200"><Pencil size={16} /> Editar</button><button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}/recibo`)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700"><Plus size={16} /> Recibo</button></div>
            </article>)}</div>}
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4"><div className="flex items-center gap-2"><FileClock className="text-emerald-600" size={20} /><h2 className="font-black">Recibos recentes</h2></div>{recibos.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Os recibos emitidos aparecerão aqui.</p> : <div className="mt-4 space-y-3">{recibos.slice(0, 8).map((recibo) => <button key={recibo.id} onClick={() => router.push(`/dashboard/rh/extra/${recibo.colaborador_id}/recibo`)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-black text-slate-800">{nomes[recibo.colaborador_id] || recibo.dados?.nome || "Profissional extra"}</p>{recibo.pagamento_realizado ? <CheckCircle2 className="shrink-0 text-emerald-600" size={16} /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />}</div><div className="mt-1 flex items-center justify-between text-xs font-bold text-slate-500"><span>{dataBR(recibo.data_trabalho)}</span><span>{fmtBRL(recibo.valor_total)}</span></div></button>)}</div>}</aside>
        </div>
      </main>
    </div>
  );
}
