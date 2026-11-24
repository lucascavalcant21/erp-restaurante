"use client";

// Peças da Fritadeira e coifa usadas na tela e no Nico/Jhon.

import { useState } from "react";
import { AlertTriangle, CalendarClock, Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { TAREFAS, UNIDADES_MATERIAL, dataBR, hojeSP, modeloDe, situacaoDaTarefa, somarDiasEquip, textoMaterial } from "../../lib/equipamentos.mjs";

const COR = { atrasada: "bg-hf-danger/10 text-hf-danger", hoje: "bg-hf-warning/15 text-hf-text", amanha: "bg-hf-warning/15 text-hf-text", breve: "bg-hf-elevated text-hf-text", ok: "bg-hf-elevated text-hf-text-2", sem_data: "bg-hf-elevated text-hf-muted" };
export const inputEq = "h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-[15px] text-hf-text outline-none focus:border-hf-accent";

export function Situacao({ tarefa }) {
  const s = situacaoDaTarefa(tarefa.proxima_prevista);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${COR[s.nivel]}`}>{s.texto}{tarefa.proxima_prevista ? ` · ${dataBR(tarefa.proxima_prevista)}` : ""}</span>;
}

/** Materiais (com a quantidade exata), passo a passo numerado e cuidados. */
export function ComoFazer({ tarefa }) {
  const p = tarefa.procedimento || {};
  const vazio = !p.materiais?.length && !p.passos?.length && !p.cuidados?.length;
  if (vazio) return <p className="rounded-xl bg-hf-elevated px-3 py-2.5 text-[14px] text-hf-muted">O passo a passo de {TAREFAS[tarefa.tarefa]?.rotulo.toLowerCase()} ainda não foi cadastrado.</p>;
  return (
    <div className="space-y-3 text-[15px] text-hf-text">
      {p.materiais?.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-hf-muted">Vai precisar de</p>
          <ul className="space-y-1">{p.materiais.map((m, i) => <li key={i} className="rounded-lg bg-hf-elevated px-3 py-2 font-medium">{textoMaterial(m)}</li>)}</ul>
        </div>
      )}
      {p.passos?.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-hf-muted">Passo a passo</p>
          <ol className="space-y-1.5">{p.passos.map((s, i) => <li key={i} className="flex gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hf-menu text-[12px] font-bold text-white">{i + 1}</span><span>{s}</span></li>)}</ol>
        </div>
      )}
      {p.cuidados?.length > 0 && (
        <div className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-hf-text"><AlertTriangle size={15} className="text-hf-warning" /> Cuidados</p>
          <ul className="list-disc space-y-1 pl-5">{p.cuidados.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/** "Fiz agora" (registra e agenda a próxima) e "Reagendar" (em N dias ou numa data). */
export function AcoesTarefa({ tarefa, onFiz, onReagendar }) {
  const [modo, setModo] = useState(null);
  const [quem, setQuem] = useState("");
  const [obs, setObs] = useState("");
  const [data, setData] = useState(somarDiasEquip(hojeSP(), 2));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  const rodar = async (fn, ok) => {
    setOcupado(true); setMsg("");
    try { await fn(); setMsg(ok); setModo(null); } catch (e) { setMsg(`Não salvou: ${e.message}`); }
    setOcupado(false);
  };
  const reag = (iso) => rodar(() => onReagendar(tarefa, iso), `Remarcado para ${dataBR(iso)}.`);
  const btn = "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold";
  return (
    <div className="space-y-2">
      {!modo && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setModo("fiz")} className={`${btn} bg-hf-menu text-white`}><Check size={18} /> Fiz agora</button>
          <button type="button" onClick={() => setModo("reagendar")} className={`${btn} border border-hf-border text-hf-text`}><CalendarClock size={18} /> Reagendar</button>
        </div>
      )}
      {modo === "fiz" && (
        <div className="space-y-2 rounded-xl bg-hf-elevated p-3">
          <input value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Quem fez" className={inputEq} />
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className={inputEq} />
          <p className="text-[13px] text-hf-muted">{tarefa.frequencia_dias ? `A próxima fica para daqui a ${tarefa.frequencia_dias} dias.` : ""}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModo(null)} className={`${btn} border border-hf-border text-hf-text`}>Cancelar</button>
            <button type="button" disabled={ocupado} onClick={() => rodar(() => onFiz(tarefa, { responsavel: quem.trim(), observacao: obs.trim() }), "Registrado.")} className={`${btn} bg-hf-menu text-white disabled:opacity-50`}>{ocupado ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Registrar</button>
          </div>
        </div>
      )}
      {modo === "reagendar" && (
        <div className="space-y-2 rounded-xl bg-hf-elevated p-3">
          <div className="flex flex-wrap gap-2">
            {[[1, "Amanhã"], [2, "Em 2 dias"], [3, "Em 3 dias"], [7, "Em 7 dias"], [15, "Em 15 dias"]].map(([n, r]) => (
              <button key={n} type="button" disabled={ocupado} onClick={() => reag(somarDiasEquip(hojeSP(), n))} className="min-h-[44px] rounded-full border border-hf-border bg-hf-surface px-4 text-[14px] font-semibold text-hf-text">{r}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" value={data} min={hojeSP()} onChange={(e) => setData(e.target.value)} className={inputEq} aria-label="Data" />
            <button type="button" disabled={ocupado || !data} onClick={() => reag(data)} className="h-12 shrink-0 rounded-xl bg-hf-menu px-4 text-[15px] font-semibold text-white disabled:opacity-50">Marcar</button>
          </div>
          <button type="button" onClick={() => setModo(null)} className="h-10 text-[14px] font-medium text-hf-muted">Cancelar</button>
        </div>
      )}
      {msg && <p role="status" className="text-[14px] font-semibold text-hf-text">{msg}</p>}
    </div>
  );
}

/** Ajustar a tarefa: de quantos em quantos dias, materiais, passos e cuidados. */
export function EditorTarefa({ equipamento, tarefa, onSalvar, onCancelar }) {
  const p = tarefa.procedimento || {};
  const [freq, setFreq] = useState(tarefa.frequencia_dias || "");
  const [materiais, setMateriais] = useState(p.materiais?.length ? p.materiais.map((m) => ({ ...m, quantidade: m.quantidade ?? "" })) : [{ nome: "", quantidade: "", unidade: "kg" }]);
  const [passos, setPassos] = useState((p.passos || []).join("\n"));
  const [cuidados, setCuidados] = useState((p.cuidados || []).join("\n"));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const modelo = modeloDe(equipamento.tipo, tarefa.tarefa);
  const usarModelo = () => {
    if (!modelo) return;
    setMateriais(modelo.materiais.map((m) => ({ ...m, quantidade: "" })));
    setPassos(modelo.passos.join("\n"));
    setCuidados(modelo.cuidados.join("\n"));
  };
  const mudar = (i, k, v) => setMateriais((l) => l.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  async function salvar() {
    if (!(Number(freq) > 0)) return setErro("Diga de quantos em quantos dias.");
    setSalvando(true); setErro("");
    try { await onSalvar(tarefa, { frequencia_dias: Number(freq), procedimento: { materiais, passos, cuidados } }); onCancelar(); } catch (e) { setErro(e.message); }
    setSalvando(false);
  }
  return (
    <div className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-3">
      <label className="flex items-center gap-2 text-[15px] text-hf-text">De quantos em quantos dias
        <input inputMode="numeric" value={freq} onChange={(e) => setFreq(e.target.value.replace(/\D/g, ""))} className={`${inputEq} w-20 text-center`} /> dias
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between"><span className="text-[13px] font-semibold text-hf-muted">Materiais e quantidade exata</span>
          {modelo && <button type="button" onClick={usarModelo} className="text-[13px] font-semibold text-hf-accent">Usar sugestão</button>}</div>
        <div className="space-y-2">
          {materiais.map((m, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={m.nome} onChange={(e) => mudar(i, "nome", e.target.value)} placeholder="Ex.: Sal grosso" className={`${inputEq} min-w-0 flex-1`} />
              <input inputMode="decimal" value={m.quantidade} onChange={(e) => mudar(i, "quantidade", e.target.value)} placeholder="Qtd" className={`${inputEq} w-20 text-center`} />
              <select value={m.unidade} onChange={(e) => mudar(i, "unidade", e.target.value)} className={`${inputEq} w-[72px] px-1`}>{UNIDADES_MATERIAL.map((u) => <option key={u}>{u}</option>)}</select>
              <button type="button" aria-label="Tirar" onClick={() => setMateriais((l) => l.filter((_, j) => j !== i))} className="grid h-12 w-9 shrink-0 place-items-center text-hf-muted"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setMateriais((l) => [...l, { nome: "", quantidade: "", unidade: "kg" }])} className="flex h-10 items-center gap-1.5 text-[14px] font-semibold text-hf-text"><Plus size={16} /> Material</button>
        </div>
      </div>
      <label className="block"><span className="text-[13px] font-semibold text-hf-muted">Passo a passo (um por linha, na ordem)</span>
        <textarea value={passos} onChange={(e) => setPassos(e.target.value)} rows={6} placeholder={"Ex.:\nColoque a água até a marca\nColoque 1 kg de sal grosso\nComplete com o óleo"} className={`${inputEq} mt-1 h-auto py-2`} />
      </label>
      <label className="block"><span className="text-[13px] font-semibold text-hf-muted">Cuidados (um por linha)</span>
        <textarea value={cuidados} onChange={(e) => setCuidados(e.target.value)} rows={3} placeholder="Ex.: Nunca coloque água com o óleo quente" className={`${inputEq} mt-1 h-auto py-2`} />
      </label>
      {modelo && <p className="text-[12.5px] text-hf-muted">A sugestão é só para começar: confira com o manual da {equipamento.tipo === "coifa" ? "coifa" : "fritadeira"} e ponha as quantidades de vocês.</p>}
      {erro && <p className="text-[14px] font-semibold text-hf-danger">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="h-12 flex-1 rounded-xl border border-hf-border text-[15px] font-semibold text-hf-text">Cancelar</button>
        <button type="button" disabled={salvando} onClick={salvar} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-hf-menu text-[15px] font-semibold text-white disabled:opacity-50">{salvando && <Loader2 size={16} className="animate-spin" />} Salvar</button>
      </div>
    </div>
  );
}

/** Avisos: amanhã é dia de limpar…, com o que vai precisar e o que falta no estoque. */
export function AvisosEquipamentos({ avisos = [], compacto = false }) {
  const [abertos, setAbertos] = useState(false);
  if (!avisos.length) return null;
  const lista = compacto && !abertos ? avisos.slice(0, 2) : avisos;
  return (
    <section className="space-y-2" aria-label="Avisos da fritadeira e da coifa">
      {lista.map((a) => (
        <div key={a.id} className={`rounded-2xl border p-3 ${a.nivel === "atrasada" ? "border-hf-danger/40 bg-hf-danger/5" : "border-hf-warning/40 bg-hf-warning/10"}`}>
          <p className="text-[15px] font-semibold text-hf-text">{a.texto}</p>
          {a.materiais.length > 0 && <p className="mt-1 text-[13.5px] text-hf-text-2">Vai precisar de: {a.materiais.join(" · ")}</p>}
          {a.faltando.length > 0 && <p className="mt-1 text-[13.5px] font-semibold text-hf-danger">Falta: {a.faltando.join(" · ")}</p>}
        </div>
      ))}
      {compacto && avisos.length > 2 && (
        <button type="button" onClick={() => setAbertos((v) => !v)} className="flex items-center gap-1 text-[14px] font-medium text-hf-muted">{abertos ? "Ver menos" : `Ver mais ${avisos.length - 2}`} <ChevronDown size={15} className={abertos ? "rotate-180" : ""} /></button>
      )}
    </section>
  );
}
