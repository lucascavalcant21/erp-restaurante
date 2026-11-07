"use client";

// Anotações da equipe: o que produzir hoje ou amanhã e o que falta comprar.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores } from "../../../lib/rh";
import { equipeParaEtiquetar } from "../../../lib/equipe-area.mjs";
import { criarAnotacao, fetchAnotacoes, marcarAnotacao } from "../../../lib/area-anotacoes";
import { areaValida, diaIso, ordenarAnotacoes, validarAnotacao } from "../../../lib/consulta-area.mjs";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

const UNIDADES = ["un", "kg", "g", "L", "ml", "pacote", "caixa"];
const campoCls = "h-12 w-full min-w-0 rounded-xl border border-hf-border bg-hf-surface px-3 text-base text-hf-text outline-none focus:border-hf-accent";
const qtdTexto = (a) => (a.quantidade == null ? "" : `${String(Number(a.quantidade)).replace(".", ",")} ${a.unidade || ""}`.trim());

function Linha({ a, aoMarcar, ocupado }) {
  const feita = a.status === "feita";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-hf-border bg-hf-surface p-2">
      <button type="button" role="checkbox" aria-checked={feita} aria-label={`${feita ? "Reabrir" : "Marcar como feito"}: ${a.texto}`} disabled={ocupado} onClick={() => aoMarcar(a)}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${feita ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border text-transparent"}`}><Check size={20} aria-hidden="true" /></button>
      <span className="min-w-0 flex-1">
        <span className={`block break-words font-bold ${feita ? "text-hf-muted line-through" : "text-hf-text"}`}>{a.texto}{qtdTexto(a) ? ` · ${qtdTexto(a)}` : ""}</span>
        <span className="block text-xs text-hf-muted">{a.quem}</span>
      </span>
    </li>
  );
}

function Anotacoes() {
  const area = areaValida(useSearchParams().get("dept")) || "cozinha";
  const { unidadeAtiva } = useERP();
  const [tipo, setTipo] = useState("producao");
  const [lista, setLista] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [form, setForm] = useState({ texto: "", quantidade: "", unidade: "un", dia: "hoje", quem: "" });
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const hoje = diaIso();
  const amanha = diaIso(new Date(), 1);
  const chaveQuem = `hefisto_anotacoes_quem_${area}`;

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const r = await fetchAnotacoes(unidadeAtiva, area, hoje);
    if (r.error) setErro("Não consegui carregar as anotações.");
    setLista(r.data);
  }, [unidadeAtiva, area, hoje]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!unidadeAtiva) return;
    fetchColaboradores(unidadeAtiva).then((r) => setEquipe(equipeParaEtiquetar(r.data)));
    try { const q = localStorage.getItem(chaveQuem); if (q) setForm((f) => ({ ...f, quem: q })); } catch { /* segue sem lembrar */ }
  }, [unidadeAtiva, chaveQuem]);

  const visiveis = useMemo(() => ordenarAnotacoes((lista || []).filter((a) => a.tipo === tipo)), [lista, tipo]);
  const grupos = tipo === "compra"
    ? [["Pedidos", visiveis]]
    : [["Hoje e atrasadas", visiveis.filter((a) => a.para_dia <= hoje)], ["Amanhã", visiveis.filter((a) => a.para_dia === amanha)], ["Depois", visiveis.filter((a) => a.para_dia > amanha)]];

  async function adicionar(e) {
    e.preventDefault();
    if (ocupado) return;
    const quantidade = String(form.quantidade).replace(",", ".").trim();
    const problema = validarAnotacao({ tipo, texto: form.texto, quantidade, quem: form.quem });
    if (problema) return setErro(problema);
    setOcupado(true); setErro(null);
    try {
      const r = await criarAnotacao(unidadeAtiva, { area, tipo, para_dia: tipo === "producao" && form.dia === "amanha" ? amanha : hoje, texto: form.texto, quantidade, unidade: form.unidade, quem: form.quem });
      if (r.error) { setErro("Não consegui salvar. Tente de novo."); return; }
      try { localStorage.setItem(chaveQuem, form.quem); } catch { /* segue sem lembrar */ }
      setForm((f) => ({ ...f, texto: "", quantidade: "" }));
      await carregar();
    } finally { setOcupado(false); }
  }

  async function marcar(a) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await marcarAnotacao(a.id, a.status !== "feita");
      if (r.error) setErro("Não consegui atualizar. Tente de novo.");
      await carregar();
    } finally { setOcupado(false); }
  }

  const chip = (ativo) => `min-h-[44px] flex-1 rounded-xl px-3 text-sm font-bold ${ativo ? "bg-hf-accent text-hf-accent-fg" : "border border-hf-border bg-hf-surface text-hf-text-2"}`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl bg-hf-bg px-4 pb-16 pt-4">
      <CabecalhoTela embutido titulo={`Anotações ${area === "bar" ? "do bar" : "da cozinha"}`} />
      <div role="tablist" aria-label="Tipo de anotação" className="mt-3 flex gap-2">
        <button type="button" role="tab" aria-selected={tipo === "producao"} className={chip(tipo === "producao")} onClick={() => { setTipo("producao"); setErro(null); }}>Produção</button>
        <button type="button" role="tab" aria-selected={tipo === "compra"} className={chip(tipo === "compra")} onClick={() => { setTipo("compra"); setErro(null); }}>Pedir compra</button>
      </div>
      <form onSubmit={adicionar} className="mt-3 space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-3">
        <label className="block text-sm font-semibold text-hf-text-2">{tipo === "compra" ? "O que está faltando" : "O que vai produzir"}
          <input className={`${campoCls} mt-1`} value={form.texto} maxLength={300} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-hf-text-2">Quantidade (opcional)
            <input className={`${campoCls} mt-1`} inputMode="decimal" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-hf-text-2">Unidade
            <select className={`${campoCls} mt-1`} value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </label>
        </div>
        {tipo === "producao" && (
          <div className="flex gap-2">
            <button type="button" aria-pressed={form.dia === "hoje"} className={chip(form.dia === "hoje")} onClick={() => setForm({ ...form, dia: "hoje" })}>Hoje</button>
            <button type="button" aria-pressed={form.dia === "amanha"} className={chip(form.dia === "amanha")} onClick={() => setForm({ ...form, dia: "amanha" })}>Amanhã</button>
          </div>
        )}
        <label className="block text-sm font-semibold text-hf-text-2">Quem está anotando
          <select className={`${campoCls} mt-1`} value={form.quem} onChange={(e) => setForm({ ...form, quem: e.target.value })}>
            <option value="">Escolha…</option>
            {equipe.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </label>
        {erro && <p role="alert" className="text-sm font-bold text-hf-danger">{erro}</p>}
        <button type="submit" disabled={ocupado} className="min-h-[48px] w-full rounded-xl bg-hf-accent px-4 font-bold text-hf-accent-fg disabled:opacity-60">{ocupado ? "Salvando…" : tipo === "compra" ? "Pedir" : "Anotar"}</button>
      </form>
      {!lista ? <p className="mt-4 text-sm text-hf-muted">Carregando…</p> : (
        <div className="mt-4 space-y-4">
          {grupos.filter(([, itens]) => itens.length).map(([titulo, itens]) => (
            <section key={titulo} aria-label={titulo}>
              <h2 className="mb-2 text-sm font-black text-hf-text">{titulo}</h2>
              <ul className="space-y-2">{itens.map((a) => <Linha key={a.id} a={a} aoMarcar={marcar} ocupado={ocupado} />)}</ul>
            </section>
          ))}
          {visiveis.length === 0 && <p className="text-sm text-hf-text-2">{tipo === "compra" ? "Nenhum pedido aberto." : "Nada anotado para hoje ou amanhã."}</p>}
        </div>
      )}
    </div>
  );
}

export default function AnotacoesPage() {
  return <Suspense fallback={<p className="p-8 text-center text-sm text-hf-muted">Carregando…</p>}><Anotacoes /></Suspense>;
}
