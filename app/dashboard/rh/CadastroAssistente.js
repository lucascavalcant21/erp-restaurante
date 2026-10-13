"use client";

// Assistente de cadastro em etapas (HDEV-RH-001, Fase 5).
// Mostra só os campos da modalidade escolhida; regras em lib/cadastro-assistente.mjs.
// Grava pelo handleSalvar da página (validação, duplicados) e o banco abre o
// vínculo (RH-6). Rascunho: fica neste navegador até salvar ou descartar.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MODALIDADES, DIAS_EXPERIENCIA, modalidadeDe, aplicarModalidade, diasExperienciaDe,
  etapasPara, camposDaEtapa, validarEtapa, revisarCadastro, documentosExigidos,
} from "../../lib/cadastro-assistente.mjs";

const CHAVE = (unidade) => `hefisto:rh:rascunho-cadastro:${unidade || "-"}`;
export function lerRascunhoCadastro(unidade) {
  try { const r = JSON.parse(localStorage.getItem(CHAVE(unidade)) || "null"); return r?.form ? r : null; } catch { return null; }
}
export function limparRascunhoCadastro(unidade) {
  try { localStorage.removeItem(CHAVE(unidade)); } catch { /* sem armazenamento: nada a limpar */ }
}
function guardarRascunho(unidade, form, etapa) {
  try {
    const { foto, ...semFoto } = form; // foto é grande: não vai para o rascunho
    localStorage.setItem(CHAVE(unidade), JSON.stringify({ form: semFoto, etapa, salvoEm: new Date().toISOString() }));
  } catch { /* armazenamento cheio ou bloqueado: segue sem rascunho */ }
}

const NIVEL = { obrigatorio: <span className="text-red-700" title="Obrigatório">*</span>, recomendado: <span className="text-3xs font-bold text-amber-700 uppercase ml-1">recomendado</span>, opcional: <span className="text-3xs font-semibold text-subtle uppercase ml-1">opcional</span> };
const DIAS = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"]];
const inp = "w-full min-h-12 p-3 mt-1 bg-card border border-line rounded-xl font-semibold text-fg-soft outline-none focus:border-emerald-600";

export default function CadastroAssistente({ unidadeId, form, setForm, cargos = [], supervisores = [], piso = null, salvando, onSalvar, onFormularioCompleto }) {
  const modalidade = modalidadeDe(form);
  const etapas = useMemo(() => etapasPara(modalidade), [modalidade]);
  const [idx, setIdx] = useState(0);
  const [tentou, setTentou] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const inicio = useRef(true);
  const etapa = etapas[Math.min(idx, etapas.length - 1)];

  useEffect(() => { const r = lerRascunhoCadastro(unidadeId); if (r && !form.nome) setRascunho(r); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (inicio.current) { inicio.current = false; return; }
    if (!String(form.nome || "").trim()) return;
    const t = setTimeout(() => guardarRascunho(unidadeId, form, etapa.id), 600);
    return () => clearTimeout(t);
  }, [form, etapa.id, unidadeId]);

  const v = validarEtapa(form, etapa.id, { piso });
  const revisao = etapa.id === "revisao" ? revisarCadastro(form, { piso }) : null;
  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));
  const avancar = () => { setTentou(true); if (!v.ok) return; setTentou(false); setIdx((i) => Math.min(i + 1, etapas.length - 1)); };
  const irPara = (id) => { const i = etapas.findIndex((e) => e.id === id); if (i >= 0) { setIdx(i); setTentou(true); } };

  const campo = (c) => {
    const erro = (tentou || form[c.k]) && v.erros[c.k];
    let ctrl;
    if (c.tipo === "modalidade") ctrl = (
      <div className="grid gap-2 mt-1">
        {Object.entries(MODALIDADES).map(([id, m]) => (
          <label key={id} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${modalidade === id ? "border-emerald-500 bg-accent-soft" : "border-line bg-card"}`}>
            <input type="radio" name="modalidade" checked={modalidade === id} onChange={() => setForm((f) => aplicarModalidade(f, id, diasExperienciaDe(f)))} className="mt-1" />
            <span><b className="text-sm text-fg">{m.rotulo}</b><span className="block text-xs text-fg">{m.ajuda}</span></span>
          </label>
        ))}
        <p className="text-2xs text-subtle">Intermitente ou outra modalidade: cadastre e depois registre a mudança na aba "Contratos e vínculos" do prontuário (com aprovação).</p>
      </div>
    );
    else if (c.tipo === "dias_experiencia") ctrl = (
      <select value={diasExperienciaDe(form)} onChange={(e) => setForm((f) => aplicarModalidade(f, "clt_experiencia", e.target.value))} className={inp}>
        {DIAS_EXPERIENCIA.map((d) => <option key={d} value={d}>{d} dias</option>)}
      </select>
    );
    else if (c.tipo === "cargo") ctrl = (
      <>
        <input list="assistente-cargos" value={form.cargo || ""} onChange={(e) => set("cargo", e.target.value)} className={inp} placeholder="Ex.: Garçom" />
        <datalist id="assistente-cargos">{cargos.map((n) => <option key={n} value={n} />)}</datalist>
      </>
    );
    else if (c.tipo === "supervisor") ctrl = (
      <select value={form.supervisores_ids?.[0] || ""} onChange={(e) => setForm((f) => ({ ...f, supervisor_id: e.target.value, supervisores_ids: e.target.value ? [e.target.value] : [] }))} className={inp}>
        <option value="">Sem supervisor (topo do organograma)</option>
        {supervisores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
    );
    else if (c.tipo === "escolha") ctrl = (
      <select value={form[c.k] ?? ""} onChange={(e) => set(c.k, e.target.value)} className={inp}>
        {c.opcoes.map((o) => <option key={o} value={o}>{o === "" ? "Não participa" : o.replace(".", ",")}</option>)}
      </select>
    );
    else if (c.tipo === "sim_nao") ctrl = (
      <div className="flex gap-2 mt-1">{[[true, "Sim"], [false, "Não"]].map(([val, r]) => (
        <button key={r} type="button" onClick={() => set(c.k, val)} className={`min-h-11 flex-1 rounded-xl border text-sm font-bold ${!!form[c.k] === val ? "border-emerald-500 bg-accent-soft text-accent-strong" : "border-line bg-card text-fg"}`}>{r}</button>
      ))}</div>
    );
    else if (c.tipo === "dias") {
      const marcados = new Set(String(form.dias_trabalho || "").split(",").filter(Boolean));
      ctrl = (
        <div className="flex flex-wrap gap-2 mt-1">{DIAS.map(([d, r]) => (
          <button key={d} type="button" onClick={() => { const s = new Set(marcados); s.has(d) ? s.delete(d) : s.add(d); set("dias_trabalho", [...s].sort().join(",")); }}
            className={`min-h-11 min-w-12 rounded-xl border text-sm font-bold ${marcados.has(d) ? "border-emerald-500 bg-accent-soft text-accent-strong" : "border-line bg-card text-fg"}`}>{r}</button>
        ))}</div>
      );
    } else {
      const tipo = { data: "date", hora: "time", numero: "number", dinheiro: "number", email: "email", telefone: "tel" }[c.tipo] || "text";
      ctrl = <input type={tipo} inputMode={c.tipo === "cpf" || c.tipo === "telefone" ? "numeric" : undefined} step={c.tipo === "dinheiro" ? "0.01" : undefined} min={c.tipo === "dinheiro" || c.tipo === "numero" ? 0 : undefined}
        value={form[c.k] ?? ""} onChange={(e) => set(c.k, e.target.value)} className={inp} />;
    }
    return (
      <div key={c.k}>
        <label className="text-xs font-bold text-fg uppercase tracking-widest">{c.rotulo} {NIVEL[c.nivel]}</label>
        {ctrl}
        {c.ajuda && <p className="text-2xs text-subtle mt-1">{c.ajuda}</p>}
        {erro && <p className="text-xs font-bold text-red-700 mt-1" role="alert">{erro}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line-soft bg-white px-4 py-3 sm:px-6" aria-label="Etapas do cadastro">
        {etapas.map((e, i) => (
          <button key={e.id} type="button" onClick={() => (i <= idx ? setIdx(i) : null)} aria-current={i === idx ? "step" : undefined}
            className={`min-h-9 shrink-0 rounded-xl border px-2.5 text-2xs font-bold ${i === idx ? "border-emerald-500 bg-accent-soft text-accent-strong" : i < idx ? "border-line bg-card text-fg" : "border-line-soft bg-white text-subtle"}`}>
            {i + 1}. {e.rotulo}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white/60">
        {rascunho && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-bold">Há um cadastro em andamento: {rascunho.form.nome || "sem nome"} (salvo {new Date(rascunho.salvoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}, neste navegador).</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="min-h-10 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white" onClick={() => {
                setForm((f) => ({ ...f, ...rascunho.form })); const i = etapasPara(modalidadeDe(rascunho.form)).findIndex((e) => e.id === rascunho.etapa); setIdx(Math.max(0, i)); setRascunho(null);
              }}>Continuar de onde parou</button>
              <button type="button" className="min-h-10 rounded-xl border border-sky-300 px-3 text-xs font-bold" onClick={() => { limparRascunhoCadastro(unidadeId); setRascunho(null); }}>Descartar</button>
            </div>
          </div>
        )}

        <div>
          <p className="text-2xs font-bold uppercase tracking-widest text-accent">Etapa {idx + 1} de {etapas.length}</p>
          <h3 className="text-lg font-black text-slate-800">{etapa.rotulo}</h3>
          {modalidade && etapa.id !== "vinculo" && <p className="text-xs text-fg">{MODALIDADES[modalidade].rotulo}</p>}
        </div>

        {etapa.campos.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{camposDaEtapa(etapa.id, modalidade).map(campo)}</div>}

        {etapa.id === "documentos" && (
          <div className="space-y-2">
            <p className="text-sm text-fg">Os arquivos são anexados no prontuário, aba <b>Documentos e treinamentos</b>, depois de salvar. Esta lista fica como pendência até lá.</p>
            <ul className="space-y-1.5">{documentosExigidos(modalidade).map((d) => (
              <li key={d.doc} className="rounded-xl border border-line bg-card p-3 text-sm">
                <b className="text-fg">{d.doc}</b> {NIVEL[d.nivel]}{d.quando && <span className="block text-2xs text-subtle">{d.quando}</span>}
              </li>
            ))}</ul>
          </div>
        )}

        {revisao && (
          <div className="space-y-3">
            {revisao.porEtapa.map(({ etapa: e, erros, avisos }) => (
              <div key={e.id} className="rounded-xl border border-line bg-card p-3">
                <div className="flex justify-between gap-2"><b className="text-sm text-fg">{e.rotulo}</b><button type="button" onClick={() => irPara(e.id)} className="text-xs font-bold text-accent">Editar</button></div>
                <dl className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-xs">
                  {camposDaEtapa(e.id, modalidade).map((c) => {
                    const val = c.k === "modalidade" ? MODALIDADES[modalidade].rotulo : c.k === "dias_experiencia" ? `${diasExperienciaDe(form)} dias`
                      : c.k === "supervisor_id" ? (supervisores.find((s) => s.id === form.supervisores_ids?.[0])?.nome || "—")
                      : c.tipo === "sim_nao" ? (form[c.k] ? "Sim" : "Não") : (String(form[c.k] ?? "").trim() || "—");
                    return <div key={c.k} className="flex justify-between gap-2 border-b border-line-soft py-1"><dt className="text-subtle">{c.rotulo}</dt><dd className="font-semibold text-fg text-right">{val}</dd></div>;
                  })}
                </dl>
                {Object.values(erros).map((m) => <p key={m} className="text-xs font-bold text-red-700 mt-1">{m}</p>)}
                {Object.values(avisos).map((m) => <p key={m} className="text-xs text-amber-800 mt-1">{m}</p>)}
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={onFormularioCompleto} className="text-xs font-bold text-accent underline">Prefiro o formulário completo (endereço, filhos, foto, horário por dia)</button>
      </div>

      <div className="border-t border-line bg-card p-3 sm:p-4 shrink-0 flex gap-2">
        {idx > 0 && <button type="button" onClick={() => setIdx(idx - 1)} className="min-h-14 px-5 rounded-2xl border border-line font-bold text-fg">Voltar</button>}
        {etapa.id !== "revisao" ? (
          <button type="button" onClick={avancar} className="flex-1 min-h-14 bg-accent text-accent-fg font-black text-lg rounded-2xl">Continuar</button>
        ) : (
          <button type="button" disabled={!revisao.ok || salvando} onClick={onSalvar} className="flex-1 min-h-14 bg-accent disabled:bg-slate-300 text-accent-fg font-black text-lg rounded-2xl">
            {salvando ? "Salvando..." : revisao.ok ? "Confirmar e salvar" : "Corrija os itens em vermelho"}
          </button>
        )}
      </div>
    </div>
  );
}
