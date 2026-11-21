"use client";

// Agenda do consultório (dono, 21/11/2026): a secretária marca, confirma pelo
// WhatsApp, recebe na chegada e cobra. Diagnóstico nunca aparece aqui.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Plus } from "lucide-react";
import { useConsultorio } from "../../components/consultorio/contexto";
import { EscolherPaciente, SeloStatus, dataBR, hojeLocal, hora, inicioDoDiaIso, mascaraFone, somarDiasLocal } from "../../components/consultorio/partes";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, lerNumero } from "../../components/marmitaria/ui";
import { ACOES, conflitos, fimDaConsulta, horariosLivres, resumoDoDia, textoDeConfirmacao, textoDeSatisfacao, valorDaConsulta } from "../../lib/consultorio/agenda.mjs";
import { fetchConsultas, fetchPacientesPorId, salvarConsulta } from "../../lib/consultorio/dados";
import { SalaDaConsulta } from "../../components/consultorio/Teleconsulta";

const FORMAS = ["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Convênio"];
const ROTULO_ACAO = { confirmada: "Confirmar", chegou: "Chegou", em_atendimento: "Iniciar atendimento", atendida: "Atendida", faltou: "Faltou", cancelada: "Cancelar", agendada: "Reagendar" };

function NovaConsulta({ dia, consultas, onFechar, onSalvo }) {
  const { tiposAtivos, conveniosAtivos, config } = useConsultorio();
  const [paciente, setPaciente] = useState(null);
  const [tipoId, setTipoId] = useState(tiposAtivos[0]?.id || "");
  const [convenioId, setConvenioId] = useState("");
  const [modalidade, setModalidade] = useState("presencial");
  const [data, setData] = useState(dia);
  const [horaTxt, setHoraTxt] = useState("");
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("");
  const [valorEditado, setValorEditado] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const tipo = tiposAtivos.find((t) => t.id === tipoId) || null;
  const convenio = conveniosAtivos.find((c) => c.id === convenioId) || null;
  const valorAuto = valorDaConsulta(tipo, convenio);
  useEffect(() => { if (paciente?.convenio_id) setConvenioId(paciente.convenio_id); }, [paciente]);
  useEffect(() => { if (!valorEditado) setValor(valorAuto ?? ""); }, [valorAuto, valorEditado]);
  const doDia = data === dia ? consultas : [];
  const livres = useMemo(() => horariosLivres({ dia: data, consultas: doDia, expediente: config?.expediente || { inicio: "08:00", fim: "18:00" }, minutos: tipo?.minutos || 30, passo: 15 }), [data, doDia, config, tipo]);
  const inicioIso = horaTxt ? new Date(`${data}T${horaTxt}:00`).toISOString() : null;
  const fimIso = inicioIso ? fimDaConsulta(inicioIso, tipo?.minutos || 30) : null;
  const choque = inicioIso ? conflitos(doDia, inicioIso, fimIso) : [];

  async function salvar() {
    setErro(null);
    if (!paciente) return setErro("Escolha ou cadastre o paciente.");
    if (!inicioIso) return setErro("Escolha o horário.");
    setSalvando(true);
    const r = await salvarConsulta({ paciente_id: paciente.id, tipo_id: tipo?.id || null, convenio_id: convenio?.id || null, inicio: inicioIso, fim: fimIso, modalidade, motivo: motivo.trim() || null, valor: lerNumero(valor) === "" ? null : lerNumero(valor), status: "agendada" });
    setSalvando(false);
    if (r.error) return setErro(r.error);
    onSalvo();
  }

  return (
    <Secao titulo="Nova consulta" direita={<Botao variante="secundario" onClick={onFechar}>Fechar</Botao>}>
      <div className="space-y-4">
        {paciente ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-hf-border px-3 py-2">
            <span><span className="block text-sm font-bold text-hf-text">{paciente.nome}</span><span className="text-xs text-hf-muted">{paciente.telefone ? mascaraFone(paciente.telefone) : "sem telefone"}</span></span>
            <button type="button" onClick={() => setPaciente(null)} className="min-h-[44px] text-sm font-semibold text-hf-accent">Trocar</button>
          </div>
        ) : <EscolherPaciente onEscolher={setPaciente} convenios={conveniosAtivos} />}
        {!tiposAtivos.length && <Aviso tipo="alerta">Cadastre os tipos de consulta (duração e valor) em <Link href="/dashboard/consultorio/cadastros" className="font-bold underline">Consultas e convênios</Link>.</Aviso>}
        <div className="flex rounded-xl bg-hf-elevated p-1 sm:inline-flex" role="radiogroup" aria-label="Modalidade">
          {[["presencial", "Presencial"], ["teleconsulta", "Teleconsulta (vídeo)"]].map(([id, r]) => (
            <button key={id} type="button" role="radio" aria-checked={modalidade === id} onClick={() => setModalidade(id)}
              className={`min-h-[40px] flex-1 rounded-lg px-4 text-sm font-semibold sm:flex-none ${modalidade === id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2"}`}>{r}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Tipo de consulta">
            <select className={inputCls} value={tipoId} onChange={(e) => { setTipoId(e.target.value); setValorEditado(false); }}>
              <option value="">Escolha</option>{tiposAtivos.map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.minutos} min</option>)}
            </select>
          </Campo>
          <Campo rotulo="Pagamento">
            <select className={inputCls} value={convenioId} onChange={(e) => { setConvenioId(e.target.value); setValorEditado(false); }}>
              <option value="">Particular</option>{conveniosAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Dia"><input type="date" className={inputCls} value={data} onChange={(e) => { setData(e.target.value); setHoraTxt(""); }} /></Campo>
          <Campo rotulo="Horário" dica={data === dia && livres.length ? `Livres: ${livres.slice(0, 6).map(hora).join(", ")}${livres.length > 6 ? "…" : ""}` : undefined}>
            <input type="time" className={inputCls} value={horaTxt} onChange={(e) => setHoraTxt(e.target.value)} step={300} />
          </Campo>
        </div>
        {data === dia && livres.length > 0 && (
          <div className="flex flex-wrap gap-2">{livres.slice(0, 12).map((l) => <button key={l} type="button" onClick={() => setHoraTxt(hora(l))} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${horaTxt === hora(l) ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border text-hf-text-2"}`}>{hora(l)}</button>)}</div>
        )}
        {choque.length > 0 && <Aviso tipo="alerta">Esse horário bate com {choque.length} consulta(s). Dá para encaixar, mas confira.</Aviso>}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Campo rotulo="Motivo da consulta" dica="O que o paciente contou ao marcar."><input className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: dor nas costas há uma semana" /></Campo>
          <Campo rotulo="Valor"><CampoNumero prefixo="R$" valor={valor} onChange={(v) => { setValor(v); setValorEditado(true); }} placeholder="0,00" /></Campo>
        </div>
        {erro && <Aviso tipo="alerta">{erro}</Aviso>}
        <Botao onClick={salvar} disabled={salvando} className="min-h-[48px] w-full sm:w-auto">{salvando ? "Salvando…" : `Agendar${inicioIso ? ` ${dataBR(data)} às ${horaTxt}` : ""}`}</Botao>
      </div>
    </Secao>
  );
}

function Receber({ c, onFeito }) {
  const [forma, setForma] = useState(c.convenio_id ? "Convênio" : "PIX");
  const [valor, setValor] = useState(c.valor ?? "");
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-hf-elevated p-3">
      <Campo rotulo="Valor" className="w-32"><CampoNumero prefixo="R$" valor={valor} onChange={setValor} /></Campo>
      <Campo rotulo="Forma" className="min-w-0 flex-1"><select className={inputCls} value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></Campo>
      <Botao disabled={salvando} onClick={async () => { setSalvando(true); const r = await salvarConsulta({ id: c.id, valor: lerNumero(valor) === "" || lerNumero(valor) === null ? c.valor : lerNumero(valor), forma_pagamento: forma, pago_em: new Date().toISOString() }); setSalvando(false); onFeito(r.error); }}>Confirmar recebimento</Botao>
    </div>
  );
}

// Lembretes da véspera (dono, 21/11/2026): as consultas de amanhã ainda sem
// confirmação, com a mensagem pronta para o WhatsApp de cada paciente.
function LembretesDeAmanha({ hoje }) {
  const [lista, setLista] = useState(null);
  const [pacs, setPacs] = useState(new Map());
  useEffect(() => {
    const amanha = somarDiasLocal(hoje, 1);
    fetchConsultas(inicioDoDiaIso(amanha), inicioDoDiaIso(somarDiasLocal(amanha, 1))).then(async (r) => {
      const pend = r.data.filter((c) => c.status === "agendada");
      const p = await fetchPacientesPorId(pend.map((c) => c.paciente_id));
      setPacs(new Map(p.data.map((x) => [x.id, x]))); setLista(pend);
    });
  }, [hoje]);
  if (!lista || !lista.length) return null;
  return (
    <Secao titulo={`Lembretes de amanhã (${lista.length})`} subtitulo="Consultas ainda sem confirmação. Toque para mandar o lembrete pelo WhatsApp.">
      <ul className="divide-y divide-hf-border">
        {lista.map((c) => {
          const p = pacs.get(c.paciente_id); const fone = String(p?.telefone || "").replace(/\D/g, "");
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><b className="tabular-nums">{hora(c.inicio)}</b> {p?.nome || "Paciente"}{p && !p.aceita_whatsapp ? <span className="text-xs text-hf-muted"> · não autorizou lembrete</span> : null}</span>
              {fone ? <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(textoDeConfirmacao({ paciente: p, inicio: c.inicio }))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-hf-border px-3 font-semibold"><MessageCircle size={15} /> Lembrar</a> : <span className="text-xs text-hf-muted">sem telefone</span>}
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

export default function AgendaConsultorio() {
  const { tipos, convenios } = useConsultorio();
  const [dia, setDia] = useState(hojeLocal());
  const [consultas, setConsultas] = useState([]);
  const [pacientes, setPacientes] = useState(new Map());
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState(false);
  const [recebendo, setRecebendo] = useState(null);
  const [sala, setSala] = useState(null);
  const [msg, setMsg] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetchConsultas(inicioDoDiaIso(dia), inicioDoDiaIso(somarDiasLocal(dia, 1)));
    const p = await fetchPacientesPorId(r.data.map((c) => c.paciente_id));
    setConsultas(r.data); setPacientes(new Map(p.data.map((x) => [x.id, x])));
    setMsg(r.error ? { tipo: "alerta", texto: r.error } : null);
    setCarregando(false);
  }, [dia]);
  useEffect(() => { carregar(); }, [carregar]);

  const resumo = resumoDoDia(consultas);
  const tipoDe = (id) => tipos.find((t) => t.id === id);
  const convDe = (id) => convenios.find((c) => c.id === id);
  async function mudar(c, status) {
    const agora = new Date().toISOString();
    const extra = status === "chegou" ? { chegada_em: agora } : status === "em_atendimento" ? { atendimento_inicio: agora } : status === "atendida" ? { atendimento_fim: agora } : {};
    const r = await salvarConsulta({ id: c.id, status, ...extra });
    if (r.error) setMsg({ tipo: "alerta", texto: r.error }); else carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setDia(somarDiasLocal(dia, -1))} aria-label="Dia anterior" className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border"><ChevronLeft size={18} /></button>
        <input type="date" className={`${inputCls} w-44`} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Dia da agenda" />
        <button type="button" onClick={() => setDia(somarDiasLocal(dia, 1))} aria-label="Próximo dia" className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border"><ChevronRight size={18} /></button>
        {dia !== hojeLocal() && <button type="button" onClick={() => setDia(hojeLocal())} className="min-h-[44px] px-2 text-sm font-semibold text-hf-accent">Hoje</button>}
        {!nova && <Botao onClick={() => setNova(true)} className="ml-auto"><Plus size={16} /> Nova consulta</Botao>}
      </div>

      {nova && <NovaConsulta dia={dia} consultas={consultas} onFechar={() => setNova(false)} onSalvo={() => { setNova(false); carregar(); }} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Consultas", resumo.total], ["Atendidas", resumo.atendidas], ["Recebido", brl(resumo.recebido)], ["A receber", brl(resumo.aReceber)]].map(([r, v]) => (
          <div key={r} className="rounded-2xl border border-hf-border bg-hf-surface px-4 py-3"><p className="text-[13px] font-medium text-hf-muted">{r}</p><p className="text-xl font-bold tabular-nums text-hf-text">{v}</p></div>
        ))}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      <Secao titulo={dia === hojeLocal() ? "Hoje" : dataBR(dia)} subtitulo={resumo.faltas ? `${resumo.faltas} falta(s)` : undefined}>
        {carregando ? <p className="text-sm text-hf-muted">Carregando…</p> : !consultas.length ? <p className="text-sm text-hf-text-2">Nenhuma consulta neste dia.</p> : (
          <ul className="divide-y divide-hf-border">
            {consultas.map((c) => {
              const p = pacientes.get(c.paciente_id);
              const t = tipoDe(c.tipo_id); const cv = convDe(c.convenio_id);
              const fone = p?.telefone ? String(p.telefone).replace(/\D/g, "") : "";
              return (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="w-14 shrink-0 text-base font-bold tabular-nums text-hf-text">{hora(c.inicio)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-hf-text">{p?.nome || "Paciente"} <SeloStatus status={c.status} />{c.modalidade === "teleconsulta" && <span className="ml-1 inline-flex rounded-full bg-hf-menu px-2 py-0.5 text-[11px] font-bold text-white">Vídeo</span>}</p>
                      <p className="text-xs text-hf-text-2">{t?.nome || "Consulta"} · {cv ? cv.nome : "Particular"}{c.valor != null ? ` · ${brl(c.valor)}` : ""}{c.pago_em ? ` · pago (${c.forma_pagamento || "—"})` : ""}</p>
                      {c.motivo && <p className="text-xs text-hf-muted">Motivo: {c.motivo}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 sm:pl-16">
                    {(ACOES[c.status] || []).filter((s) => s !== "em_atendimento" && s !== "atendida").map((s) => (
                      <button key={s} type="button" onClick={() => mudar(c, s)} className={`min-h-[40px] rounded-xl border px-3 text-sm font-semibold ${s === "chegou" ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border text-hf-text"}`}>{ROTULO_ACAO[s]}</button>
                    ))}
                    {fone && ["agendada", "confirmada"].includes(c.status) && (
                      <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(textoDeConfirmacao({ paciente: p, inicio: c.inicio }))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text"><MessageCircle size={15} /> Confirmar no WhatsApp</a>
                    )}
                    {c.status === "atendida" && fone && (
                      <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(textoDeSatisfacao(p))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text"><MessageCircle size={15} /> Pedir avaliação</a>
                    )}
                    {c.modalidade === "teleconsulta" && !["cancelada", "faltou", "atendida"].includes(c.status) && (
                      <button type="button" onClick={() => setSala(sala === c.id ? null : c.id)} className="min-h-[40px] rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text">Sala e convite</button>
                    )}
                    {!c.pago_em && ["chegou", "em_atendimento", "atendida"].includes(c.status) && (
                      <button type="button" onClick={() => setRecebendo(recebendo === c.id ? null : c.id)} className="min-h-[40px] rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text">Receber</button>
                    )}
                  </div>
                  {sala === c.id && <div className="mt-2 sm:pl-16"><SalaDaConsulta consulta={c} paciente={p} /></div>}
                  {recebendo === c.id && <div className="sm:pl-16"><Receber c={c} onFeito={(e) => { setRecebendo(null); if (e) setMsg({ tipo: "alerta", texto: e }); else carregar(); }} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>
      {dia === hojeLocal() && <LembretesDeAmanha hoje={dia} />}
      <p className="text-xs text-hf-muted">O médico chama o paciente pela tela Atendimento.</p>
    </div>
  );
}
