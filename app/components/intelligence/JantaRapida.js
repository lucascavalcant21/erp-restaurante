"use client";

// Janta da equipe no Assistente (dono, 22/11/2026): "janta" → hoje é dia
// tal, a janta é essa → quantas pessoas (1 a 12 ou digitar) → quanto fazer de
// cada coisa, a receita multiplicada e como montar o prato de cada pessoa.
// Tudo calculado aqui no aparelho (janta-funcionarios.mjs), sem internet.

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, Users } from "lucide-react";
import { DIAS_SEMANA, cardapioDoDia, normalizarJanta, pessoasDoDia, pratoDaPessoa, temJantaNoDia } from "../../lib/janta-funcionarios.mjs";

const VERDE = "var(--wa-verde-escuro, #005A49)";
const META = "var(--wa-meta, #667781)";

function Item({ i }) {
  const [aberta, setAberta] = useState(false);
  const r = i.receita;
  return (
    <li className="rounded-2xl bg-white p-3">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 pt-0.5 text-[17px] font-bold">{i.nome}</span>
        <span className="text-right text-[20px] font-extrabold tabular-nums" style={{ color: VERDE }}>{i.modo === "geral" ? "" : i.rotulo}</span>
      </div>
      {i.modo === "geral"
        ? <p className="mt-1 text-[15.5px] font-semibold" style={{ color: VERDE }}>{i.rotulo}</p>
        : <p className="mt-0.5 text-[13.5px]" style={{ color: META }}>{i.porcaoN ? `pronto · ${i.porcaoN.toLocaleString("pt-BR")} ${i.modo === "un" ? "un" : i.modo} por pessoa` : "falta a porção por pessoa"}</p>}
      {i.cru && <p className="mt-1 rounded-xl bg-amber-50 px-3 py-1.5 text-[14.5px] text-amber-900">Cozinhe cerca de <b>{i.cru.rotulo}</b> cru <span className="text-[12px]">(estimativa)</span></p>}
      {r?.status === "ok" && (
        <div className="mt-2">
          <button type="button" onClick={() => setAberta(!aberta)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[14.5px] font-bold" style={{ background: "rgba(0,90,73,.08)", color: VERDE }}>
            <BookOpen size={16} /> Receita: {r.rotuloFator} <ChevronDown size={14} className={aberta ? "rotate-180" : ""} />
          </button>
          {aberta && (
            <div className="mt-2 rounded-xl p-3" style={{ background: "rgba(0,90,73,.05)" }}>
              <ul className="divide-y divide-black/5">
                {r.ingredientes.map((g, k) => (
                  <li key={k} className="flex justify-between gap-3 py-1.5 text-[15.5px]"><span>{g.nome}</span><b className="tabular-nums">{g.quantidade}</b></li>
                ))}
              </ul>
              {r.preparo && <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed">{r.preparo}</p>}
            </div>
          )}
        </div>
      )}
      {r?.status === "insuficiente" && <p className="mt-1 text-[13px] font-semibold text-amber-700">Receita: {r.motivo}</p>}
    </li>
  );
}

export default function JantaRapida({ janta: salvo, dia, fichas = [] }) {
  const janta = useMemo(() => normalizarJanta(salvo), [salvo]);
  const mapa = useMemo(() => new Map((fichas || []).map((f) => [f.id, f])), [fichas]);
  const padrao = pessoasDoDia(janta, dia);
  const [pessoas, setPessoas] = useState(null);
  const [digitado, setDigitado] = useState("");
  const rotDia = DIAS_SEMANA.find((d) => d.id === dia)?.rotulo || "";
  const hoje = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date().getDay()] === dia;
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const tem = temJantaNoDia(janta, dia);
  const c = useMemo(() => (pessoas ? cardapioDoDia(janta, dia, { pessoas, fichas: mapa }) : null), [janta, dia, pessoas, mapa]);
  const pratosDoDia = (janta.dias?.[dia]?.pratos || []).map((p) => p.nome).filter(Boolean);
  const prato = c ? pratoDaPessoa(c) : [];

  if (!tem) {
    return <p className="text-[16px]">Não há janta montada para {hoje ? "hoje" : rotDia.toLowerCase()} ({rotDia}). O dono monta em RH › Janta dos funcionários.</p>;
  }
  return (
    <section className="-mx-0.5 space-y-3" aria-label="Janta da equipe">
      <header>
        <p className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: META }}>{hoje ? `Hoje · ${rotDia}, ${data}` : rotDia} · janta da equipe</p>
        <h3 className="text-[22px] font-extrabold leading-tight">{pratosDoDia.length ? pratosDoDia.join(" + ") : "Janta do dia"}</h3>
      </header>

      <div className="space-y-2 rounded-2xl p-3" style={{ background: "rgba(0,90,73,.07)" }}>
        <p className="flex items-center gap-2 text-[16px] font-bold"><Users size={18} /> Quantas pessoas vão jantar?</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, k) => k + 1).map((q) => (
            <button key={q} type="button" onClick={() => { setPessoas(q); setDigitado(""); }} aria-pressed={pessoas === q}
              className="h-[52px] rounded-xl text-[19px] font-extrabold tabular-nums transition active:scale-95"
              style={pessoas === q ? { background: VERDE, color: "#fff" } : { background: "#fff", color: VERDE, boxShadow: padrao === q ? "inset 0 0 0 2px #F59E0B" : "inset 0 0 0 1.5px rgba(0,90,73,.2)" }}>
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input inputMode="numeric" value={digitado} onChange={(e) => setDigitado(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Outro número"
            className="h-[52px] min-w-0 flex-1 rounded-xl border-0 bg-white px-4 text-[18px] font-bold outline-none" aria-label="Número de pessoas" />
          <button type="button" disabled={!Number(digitado)} onClick={() => setPessoas(Number(digitado))} className="h-[52px] rounded-xl px-5 text-[16px] font-bold text-white disabled:opacity-40" style={{ background: VERDE }}>OK</button>
        </div>
        {padrao > 0 && !pessoas && <p className="text-[13px]" style={{ color: META }}>O de costume é {padrao} (contornado em amarelo).</p>}
      </div>

      {c && (
        <>
          <div>
            <p className="mb-1 text-[13px] font-bold uppercase tracking-wide" style={{ color: META }}>O que fazer para {c.pessoas} pessoa{c.pessoas > 1 ? "s" : ""}</p>
            <ul className="space-y-2">{c.pratos.flatMap((p) => p.itens).map((i) => <Item key={i.id} i={i} />)}</ul>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "#FFF8E1" }}>
            <p className="mb-1 text-[15px] font-extrabold">Prato de cada pessoa</p>
            <ul className="space-y-1">
              {prato.map((x, k) => (
                <li key={k} className="flex justify-between gap-3 text-[16px]"><span>{x.nome}</span><b className={x.geral ? "font-semibold" : "tabular-nums"}>{x.texto}</b></li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
