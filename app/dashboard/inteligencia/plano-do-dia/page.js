"use client";

// PLANO DO DIA (dono, 14/11/2026): "eu mando para o Jhon; ele conversa com o
// Nico para encontrarem a melhor maneira de agilizar as tarefas diárias" e
// "quero que sejam IA conversando". O dono escreve o que precisa; o Jhon e o
// Nico (duas IAs) combinam o plano; o dono vê a conversa, o plano e o que
// falta responder, e aprova. Só o dono usa (o servidor confere).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Check, Clock, Loader2, Send, User } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { FundoMedway, RotuloSecao, TopoComVoltar } from "../../../components/ui/Medway";
import { sessaoEhDono } from "../../../lib/assistentes.mjs";
import { combinarPlanoDoDia } from "../../../lib/intelligence/client/api";
import { fetchPlanoDoDia, salvarPlanoDoDia } from "../../../lib/parametros";

const EXEMPLOS = [
  "Hoje tem que bater 4 litros de açaí, fazer vatapá e limpar o balcão.",
  "Produzir 3 kg de arroz, organizar os freezers e fazer as etiquetas da produção.",
];
const TIPO = { producao: "Produção", limpeza: "Limpeza", etiquetas: "Etiquetas", organizacao: "Organização", outro: "Tarefa" };
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function Balao({ m }) {
  const jhon = m.de === "jhon";
  return (
    <div className={`flex ${jhon ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-[18px] px-4 py-3 ${jhon ? "rounded-tl-[6px] bg-mw-card border border-mw-borda" : "rounded-tr-[6px] bg-mw-agua-claro"}`}>
        <p className={`text-[13px] font-semibold ${jhon ? "text-mw-azul" : "text-mw-agua"}`}>{jhon ? "Jhon · consultor" : "Nico · chef"}</p>
        <p className="mt-0.5 text-[15.5px] leading-snug text-mw-texto">{m.texto}</p>
        {!jhon && m.ajustes?.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[14px] text-mw-texto">{m.ajustes.map((a, i) => <li key={i}>{a}</li>)}</ul>
        )}
        {!jhon && m.aceito && <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-mw-agua"><Check size={14} /> Combinado</p>}
      </div>
    </div>
  );
}

function Tarefa({ t }) {
  return (
    <li className="flex gap-3 rounded-[20px] border border-mw-borda bg-mw-card p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mw-marinho text-[15px] font-semibold text-white">{t.ordem}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-mw-sec">{TIPO[t.tipo] || "Tarefa"}{t.depoisDoIntervalo ? " · depois do intervalo" : ""}</p>
        <p className="text-[16px] font-semibold text-mw-marinho">{t.titulo}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[13.5px]">
          {t.quantidade != null && <span className="rounded-full bg-mw-suave px-2.5 py-1 font-semibold text-mw-marinho">{t.quantidade.toLocaleString("pt-BR")} {t.unidade || ""}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-mw-suave px-2.5 py-1 text-mw-texto"><User size={13} /> {t.responsavelNome || "sem responsável"}</span>
          {t.fichaNome && <span className="inline-flex items-center gap-1 rounded-full bg-mw-suave px-2.5 py-1 text-mw-texto"><BookOpen size={13} /> {t.fichaNome}</span>}
          {t.procedimento && <span className="inline-flex items-center gap-1 rounded-full bg-mw-suave px-2.5 py-1 text-mw-texto"><BookOpen size={13} /> {t.procedimento}</span>}
        </div>
        {t.motivo && <p className="mt-1.5 text-[13.5px] text-mw-sec">{t.motivo}</p>}
      </div>
    </li>
  );
}

export default function PlanoDoDia() {
  const { unidadeAtiva, sessao } = useERP();
  const router = useRouter();
  const [pedido, setPedido] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState(null);
  const [erro, setErro] = useState("");
  const [aprovado, setAprovado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const dono = sessaoEhDono(sessao);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchPlanoDoDia(unidadeAtiva).then(({ data }) => { if (data?.data === hojeISO()) setAprovado(data); }).catch(() => {});
  }, [unidadeAtiva]);

  async function mandar() {
    if (pedido.trim().length < 3 || ocupado) return;
    setOcupado(true); setErro(""); setR(null);
    const out = await combinarPlanoDoDia(unidadeAtiva, pedido.trim());
    setOcupado(false);
    if (!out.ok) { setErro(out.dados?.erro || "Não deu para combinar agora."); return; }
    setR(out.dados.resultado);
  }

  async function aprovar() {
    if (!r?.plano?.length) return;
    setSalvando(true);
    const plano = { data: hojeISO(), pedido: r.pedido, plano: r.plano, pendencias: r.pendencias, aprovadoPor: sessao?.nome || sessao?.email || "Dono", aprovadoEm: new Date().toISOString() };
    const s = await salvarPlanoDoDia(unidadeAtiva, plano);
    setSalvando(false);
    if (s?.error) { setErro(`Não salvou: ${s.error}`); return; }
    setAprovado(plano); setR(null); setPedido("");
  }

  if (sessao && !dono) {
    return <FundoMedway><TopoComVoltar titulo="Plano do dia" /><p className="px-4 py-8 text-[15px] text-mw-sec">O plano do dia é combinado pelo dono com o Jhon. Veja o seu dia no Nico.</p></FundoMedway>;
  }

  return (
    <FundoMedway>
      <TopoComVoltar titulo="Plano do dia" />
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-5 sm:px-6">
        <section className="space-y-3">
          <p className="text-[15px] text-mw-sec">Diga ao Jhon o que precisa ser feito hoje. Ele combina com o Nico a ordem e quem faz o quê, e te mostra a conversa.</p>
          <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={2000} rows={4}
            placeholder="Ex.: hoje tem que bater 4 litros de açaí, fazer vatapá e limpar o balcão"
            className="w-full rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[16px] text-mw-texto outline-none focus:border-mw-agua" />
          {!pedido && (
            <div className="flex flex-wrap gap-2">
              {EXEMPLOS.map((e) => <button key={e} type="button" onClick={() => setPedido(e)} className="min-h-[44px] rounded-full border border-mw-borda bg-mw-card px-4 text-left text-[14px] text-mw-texto shadow-none">{e}</button>)}
            </div>
          )}
          <button type="button" onClick={mandar} disabled={ocupado || pedido.trim().length < 3}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-50">
            {ocupado ? <><Loader2 size={18} className="animate-spin" /> O Jhon está conversando com o Nico…</> : <><Send size={18} /> Mandar para o Jhon</>}
          </button>
          {ocupado && <p className="text-center text-[13px] text-mw-sec">Pode levar até um minuto: os dois vão e voltam até combinar.</p>}
          {erro && <p className="rounded-[16px] bg-hf-danger/10 px-4 py-3 text-[14px] text-hf-danger">{erro}</p>}
        </section>

        {r && (
          <>
            {r.status === "sem_ia" || r.status === "falha" ? (
              <p className="rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-texto">{r.motivo}</p>
            ) : null}
            {r.conversa?.length > 0 && (
              <section className="space-y-3">
                <RotuloSecao>Conversa do Jhon com o Nico</RotuloSecao>
                <div className="space-y-2.5">{r.conversa.map((m, i) => <Balao key={i} m={m} />)}</div>
              </section>
            )}
            {r.plano?.length > 0 && (
              <section className="space-y-3">
                <RotuloSecao>Plano combinado ({r.natureza || "SUGESTÃO"})</RotuloSecao>
                <ol className="space-y-2.5">{r.plano.map((t) => <Tarefa key={t.ordem} t={t} />)}</ol>
              </section>
            )}
            {(r.pendencias?.length > 0 || r.faltando?.length > 0) && (
              <section className="space-y-2 rounded-[20px] border border-hf-warning/40 bg-hf-warning/5 p-4">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-mw-marinho"><AlertTriangle size={18} className="text-hf-warning" /> O Jhon precisa de você</p>
                <ul className="list-disc space-y-1 pl-5 text-[14.5px] text-mw-texto">
                  {r.pendencias.map((p, i) => <li key={`p${i}`}>{p}</li>)}
                  {r.faltando?.map((f, i) => <li key={`f${i}`}>DADOS INSUFICIENTES: {f}</li>)}
                </ul>
              </section>
            )}
            {r.plano?.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={() => setR(null)} className="min-h-[52px] flex-1 rounded-full border border-mw-borda bg-mw-card text-[16px] font-semibold text-mw-marinho shadow-none">Refazer</button>
                <button type="button" onClick={aprovar} disabled={salvando} className="min-h-[52px] flex-[2] rounded-full bg-mw-agua text-[16px] font-semibold text-white shadow-none disabled:opacity-50">
                  {salvando ? "Salvando…" : "Aprovar plano"}
                </button>
              </div>
            )}
          </>
        )}

        {aprovado && !r && (
          <section className="space-y-3">
            <RotuloSecao>Plano aprovado hoje</RotuloSecao>
            <p className="flex items-center gap-2 text-[14px] text-mw-sec"><Clock size={15} /> Por {aprovado.aprovadoPor} às {new Date(aprovado.aprovadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <ol className="space-y-2.5">{(aprovado.plano || []).map((t) => <Tarefa key={t.ordem} t={t} />)}</ol>
            <button type="button" onClick={() => router.push("/dashboard")} className="min-h-[48px] w-full rounded-full border border-mw-borda bg-mw-card text-[15px] font-semibold text-mw-marinho shadow-none">Voltar ao início</button>
          </section>
        )}
      </div>
    </FundoMedway>
  );
}
