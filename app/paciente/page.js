"use client";

// Portal do paciente (dono, 21/11/2026): login e senha gerados pelo médico.
// O paciente marca e cancela consultas, entra na teleconsulta e vê os resumos
// das consultas. Tudo passa pelas funções cons_paciente_* (CONS-3): ele nunca
// lê as tabelas do consultório direto.

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "../lib/supabase";
import LogoHefisto from "../components/layout/LogoHefisto";

const DOMINIO = "pacientes.hefisto.app";
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hojeBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somar = (dia, n) => { const [a, m, d] = dia.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const STATUS = { agendada: "Agendada", confirmada: "Confirmada", chegou: "Na recepção", em_atendimento: "Em atendimento", atendida: "Realizada", faltou: "Faltou", cancelada: "Cancelada" };
const input = "w-full min-h-[48px] rounded-xl border border-hf-border bg-hf-surface px-3 text-base text-hf-text outline-none focus:border-hf-accent";
const botao = "min-h-[48px] rounded-xl bg-hf-menu px-4 text-base font-bold text-white disabled:opacity-50";

function Entrar({ onEntrou }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function entrar(e) {
    e.preventDefault(); setErro(""); setOcupado(true);
    const l = login.trim().toLowerCase().replace(/[.\-\s]/g, "");
    const { error } = await supabase.auth.signInWithPassword({ email: l.includes("@") ? l : `${l}@${DOMINIO}`, password: senha });
    setOcupado(false);
    if (error) return setErro("Login ou senha incorretos.");
    onEntrou();
  }
  return (
    <form onSubmit={entrar} className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-hf-border bg-hf-surface p-5">
      <div><h1 className="text-xl font-bold">Portal do paciente</h1><p className="text-sm text-hf-text-2">Entre com o login e a senha que o consultório enviou.</p></div>
      <label className="block text-sm font-medium text-hf-text-2">Login (CPF ou código)<input className={`${input} mt-1`} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" inputMode="text" /></label>
      <label className="block text-sm font-medium text-hf-text-2">Senha<input className={`${input} mt-1`} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></label>
      {erro && <p className="text-sm font-semibold text-hf-danger">{erro}</p>}
      <button type="submit" disabled={ocupado} className={`${botao} w-full`}>{ocupado ? "Entrando…" : "Entrar"}</button>
      <p className="text-xs text-hf-muted">Esqueceu a senha? Peça uma nova ao consultório.</p>
    </form>
  );
}

function Marcar({ onMarcou }) {
  const [tipos, setTipos] = useState([]);
  const [tipo, setTipo] = useState("");
  const [modalidade, setModalidade] = useState("presencial");
  const [dia, setDia] = useState(somar(hojeBR(), 1));
  const [livres, setLivres] = useState(null);
  const [hora, setHora] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { supabase.rpc("cons_paciente_tipos").then(({ data }) => { setTipos(data || []); if (data?.[0]) setTipo(data[0].id); }); }, []);
  useEffect(() => {
    if (!tipo || !dia) return;
    setLivres(null); setHora(null);
    supabase.rpc("cons_paciente_horarios", { p_tipo_id: tipo, p_dia: dia }).then(({ data }) => setLivres((data || []).map((x) => (typeof x === "string" ? x : x.cons_paciente_horarios || Object.values(x)[0]))));
  }, [tipo, dia]);
  async function marcar() {
    setMsg(null);
    const { data, error } = await supabase.rpc("cons_paciente_marcar", { p_tipo_id: tipo, p_inicio: hora, p_modalidade: modalidade, p_motivo: motivo });
    if (error || !data?.ok) return setMsg({ erro: true, texto: data?.erro || "Não consegui marcar. Tente outro horário." });
    setMsg({ erro: false, texto: "Consulta marcada!" }); setHora(null); setMotivo(""); onMarcou();
  }
  const t = tipos.find((x) => x.id === tipo);
  if (!tipos.length) return <p className="text-sm text-hf-text-2">O consultório ainda não abriu horários para marcar por aqui.</p>;
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-hf-text-2">Tipo de consulta
        <select className={`${input} mt-1`} value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.minutos} min{x.valor != null ? ` · ${brl(x.valor)}` : ""}</option>)}</select>
      </label>
      <div className="flex rounded-xl bg-hf-elevated p-1" role="radiogroup" aria-label="Como vai ser a consulta">
        {[["presencial", "No consultório"], ["teleconsulta", "Por vídeo"]].map(([id, r]) => (
          <button key={id} type="button" role="radio" aria-checked={modalidade === id} onClick={() => setModalidade(id)} className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold ${modalidade === id ? "bg-hf-surface shadow-sm" : "text-hf-text-2"}`}>{r}</button>
        ))}
      </div>
      <label className="block text-sm font-medium text-hf-text-2">Dia<input type="date" className={`${input} mt-1`} value={dia} min={hojeBR()} max={somar(hojeBR(), 90)} onChange={(e) => setDia(e.target.value)} /></label>
      <div>
        <p className="mb-2 text-sm font-medium text-hf-text-2">Horários livres</p>
        {livres === null ? <p className="text-sm text-hf-muted">Procurando horários…</p> : !livres.length ? <p className="text-sm text-hf-text-2">Nenhum horário livre nesse dia. Tente outro.</p> : (
          <div className="flex flex-wrap gap-2">{livres.map((h) => (
            <button key={h} type="button" onClick={() => setHora(h)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${hora === h ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border"}`}>
              {new Date(h).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            </button>))}</div>
        )}
      </div>
      <label className="block text-sm font-medium text-hf-text-2">O que você está sentindo? (opcional)<input className={`${input} mt-1`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} /></label>
      {msg && <p className={`text-sm font-semibold ${msg.erro ? "text-hf-danger" : "text-hf-success"}`}>{msg.texto}</p>}
      <button type="button" disabled={!hora} onClick={marcar} className={`${botao} w-full`}>{hora ? `Marcar ${t?.nome || "consulta"} ${quando(hora)}` : "Escolha um horário"}</button>
    </div>
  );
}

function Portal({ eu, onSair }) {
  const [aba, setAba] = useState("consultas");
  const [consultas, setConsultas] = useState(null);
  const [resumos, setResumos] = useState(null);
  const [msg, setMsg] = useState(null);
  const carregar = useCallback(() => supabase.rpc("cons_paciente_consultas").then(({ data }) => setConsultas(data || [])), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (aba === "resumos" && resumos === null) supabase.rpc("cons_paciente_resumos").then(({ data }) => setResumos(data || [])); }, [aba, resumos]);
  const agora = Date.now();
  const proximas = (consultas || []).filter((c) => new Date(c.fim).getTime() > agora && !["cancelada", "faltou", "atendida"].includes(c.status)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const passadas = (consultas || []).filter((c) => !proximas.includes(c));
  async function cancelar(c) {
    if (!window.confirm(`Cancelar a consulta de ${quando(c.inicio)}?`)) return;
    const { data } = await supabase.rpc("cons_paciente_cancelar", { p_consulta_id: c.id });
    setMsg(data?.ok ? "Consulta cancelada." : data?.erro || "Não consegui cancelar."); carregar();
  }
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2"><div><p className="text-sm text-hf-text-2">Olá,</p><h1 className="text-xl font-bold">{eu.nome}</h1></div>
        <button type="button" onClick={onSair} className="min-h-[44px] text-sm font-semibold text-hf-accent">Sair</button></div>
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-hf-elevated p-1" aria-label="Portal">
        {[["consultas", "Minhas consultas"], ["marcar", "Marcar consulta"], ["resumos", "Resumos"], ["conta", "Minha conta"]].map(([id, r]) => (
          <button key={id} type="button" onClick={() => setAba(id)} aria-current={aba === id ? "page" : undefined} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${aba === id ? "bg-hf-surface shadow-sm" : "text-hf-text-2"}`}>{r}</button>
        ))}
      </nav>
      {msg && <p className="rounded-xl bg-hf-elevated p-3 text-sm">{msg}</p>}
      {aba === "consultas" && (
        <section className="space-y-3">
          {consultas === null ? <p className="text-sm text-hf-muted">Carregando…</p> : !proximas.length ? <p className="text-sm text-hf-text-2">Nenhuma consulta marcada.</p> : proximas.map((c) => (
            <div key={c.id} className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <p className="text-base font-bold">{quando(c.inicio)}</p>
              <p className="text-sm text-hf-text-2">{c.tipo || "Consulta"} · {c.modalidade === "teleconsulta" ? "por vídeo" : "no consultório"} · {STATUS[c.status] || c.status}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.modalidade === "teleconsulta" && (c.convite ? <a href={`/teleconsulta/${c.convite}`} className={`${botao} inline-flex items-center`}>{c.termo_aceito ? "Entrar na sala" : "Ler o termo e entrar"}</a>
                  : <span className="text-sm text-hf-text-2">O link da sala chega antes da consulta.</span>)}
                {["agendada", "confirmada"].includes(c.status) && <button type="button" onClick={() => cancelar(c)} className="min-h-[48px] rounded-xl border border-hf-border px-4 text-sm font-semibold">Cancelar</button>}
              </div>
            </div>))}
          {passadas.length > 0 && (
            <details className="rounded-2xl border border-hf-border bg-hf-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Consultas anteriores ({passadas.length})</summary>
              <ul className="mt-2 divide-y divide-hf-border text-sm">{passadas.map((c) => <li key={c.id} className="flex justify-between gap-2 py-2"><span>{quando(c.inicio)} · {c.tipo || "Consulta"}</span><span className="text-hf-text-2">{STATUS[c.status] || c.status}</span></li>)}</ul>
            </details>
          )}
        </section>
      )}
      {aba === "marcar" && <section className="rounded-2xl border border-hf-border bg-hf-surface p-4"><Marcar onMarcou={() => { carregar(); }} /></section>}
      {aba === "resumos" && (
        <section className="space-y-3">
          {resumos === null ? <p className="text-sm text-hf-muted">Carregando…</p> : !resumos.length ? <p className="text-sm text-hf-text-2">Nenhum resumo ainda. Ele aparece depois da consulta.</p> : resumos.map((r, i) => (
            <div key={i} className="space-y-1 rounded-2xl border border-hf-border bg-hf-surface p-4 text-sm">
              <p className="text-base font-bold">{new Date(r.data).toLocaleDateString("pt-BR")} · {r.modalidade === "teleconsulta" ? "por vídeo" : "no consultório"}</p>
              {[["Motivo", r.queixa], ["Diagnóstico", [r.diagnostico, r.cid && `(CID ${r.cid})`].filter(Boolean).join(" ")], ["Conduta", r.conduta], ["Exames pedidos", r.exames], ["Medicação", r.medicacao], ["Orientações", r.orientacoes], ["Retorno", r.retorno_dias ? `em ${r.retorno_dias} dias` : null]]
                .filter(([, v]) => v).map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
            </div>))}
          <p className="text-xs text-hf-muted">Resumo das suas consultas. Para cópia completa do prontuário, peça ao consultório.</p>
        </section>
      )}
      {aba === "conta" && <Conta eu={eu} />}
    </div>
  );
}

function Conta({ eu }) {
  const [s1, setS1] = useState(""); const [s2, setS2] = useState(""); const [msg, setMsg] = useState(null);
  async function trocar() {
    if (s1.length < 8) return setMsg("A senha precisa ter pelo menos 8 caracteres.");
    if (s1 !== s2) return setMsg("As duas senhas não são iguais.");
    const { error } = await supabase.auth.updateUser({ password: s1 });
    setMsg(error ? "Não consegui trocar a senha." : "Senha trocada."); if (!error) { setS1(""); setS2(""); }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
      <p className="text-sm text-hf-text-2">{eu.telefone ? `Telefone: ${eu.telefone}` : ""}{eu.convenio ? ` · Convênio: ${eu.convenio}` : " · Particular"}</p>
      <label className="block text-sm font-medium text-hf-text-2">Nova senha<input className={`${input} mt-1`} type="password" value={s1} onChange={(e) => setS1(e.target.value)} autoComplete="new-password" /></label>
      <label className="block text-sm font-medium text-hf-text-2">Repita a nova senha<input className={`${input} mt-1`} type="password" value={s2} onChange={(e) => setS2(e.target.value)} autoComplete="new-password" /></label>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
      <button type="button" onClick={trocar} className={botao}>Trocar senha</button>
    </section>
  );
}

export default function PortalDoPaciente() {
  const [estado, setEstado] = useState({ carregando: true, eu: null });
  const verificar = useCallback(async () => {
    if (!isSupabaseReady()) return setEstado({ carregando: false, eu: null });
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) return setEstado({ carregando: false, eu: null });
    const { data } = await supabase.rpc("cons_paciente_eu");
    setEstado({ carregando: false, eu: data?.ok ? data : null, outroLogin: !data?.ok });
  }, []);
  useEffect(() => { verificar(); }, [verificar]);
  const sair = async () => { await supabase.auth.signOut(); setEstado({ carregando: false, eu: null }); };
  return (
    <main className="min-h-screen bg-hf-bg px-4 py-6 text-hf-text">
      <div className="mx-auto mb-5 flex w-full max-w-2xl items-center gap-2"><LogoHefisto className="h-8 w-8" /><span className="text-sm font-semibold text-hf-text-2">Consultório</span></div>
      {estado.carregando ? <p className="text-center text-sm text-hf-muted">Abrindo…</p>
        : estado.eu ? <Portal eu={estado.eu} onSair={sair} />
        : <>
            {estado.outroLogin && <p className="mx-auto mb-3 max-w-sm rounded-xl bg-hf-elevated p-3 text-sm">Este login não é de paciente. <button type="button" onClick={sair} className="font-semibold underline">Sair e entrar como paciente</button></p>}
            <Entrar onEntrou={verificar} />
          </>}
    </main>
  );
}
