"use client";

// Pacientes: busca, cadastro e histórico de consultas e pagamentos.

import { useEffect, useState } from "react";
import { useConsultorio } from "../../../components/consultorio/contexto";
import { EscolherPaciente, SeloStatus, dataBR, hojeLocal, hora, mascaraCpf, mascaraFone } from "../../../components/consultorio/partes";
import { Aviso, Botao, Campo, Secao, brl, inputCls } from "../../../components/marmitaria/ui";
import { cpfValido, idade, soDigitos } from "../../../lib/consultorio/agenda.mjs";
import { buscarPacientes, fetchConsultasDoPaciente, salvarPaciente } from "../../../lib/consultorio/dados";

function Ficha({ p, onVoltar }) {
  const { conveniosAtivos, tipos, convenios } = useConsultorio();
  const [f, setF] = useState({ ...p, cpf: p.cpf || "", telefone: p.telefone || "", email: p.email || "", nascimento: p.nascimento || "", carteirinha: p.carteirinha || "", observacoes: p.observacoes || "", convenio_id: p.convenio_id || "", sexo: p.sexo || "" });
  const [historico, setHistorico] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { fetchConsultasDoPaciente(p.id).then((r) => setHistorico(r.data)); }, [p.id]);
  const mudar = (m) => { setMsg(null); setF((x) => ({ ...x, ...m })); };
  async function salvar() {
    if (f.nome.trim().length < 2) return setMsg({ tipo: "alerta", texto: "Informe o nome." });
    if (f.cpf && !cpfValido(f.cpf)) return setMsg({ tipo: "alerta", texto: "CPF inválido." });
    const r = await salvarPaciente({ id: p.id, nome: f.nome.trim(), cpf: soDigitos(f.cpf) || null, telefone: soDigitos(f.telefone) || null, email: f.email.trim() || null,
      nascimento: f.nascimento || null, sexo: f.sexo || null, convenio_id: f.convenio_id || null, carteirinha: f.carteirinha.trim() || null, observacoes: f.observacoes.trim() || null, aceita_whatsapp: !!f.aceita_whatsapp });
    setMsg(r.error ? { tipo: "alerta", texto: /cpf_unico|duplicate/i.test(r.error) ? "Já existe paciente com esse CPF." : r.error } : { tipo: "info", texto: "Cadastro salvo." });
  }
  const pagos = (historico || []).filter((c) => c.pago_em).reduce((t, c) => t + (Number(c.valor) || 0), 0);
  return (
    <div className="space-y-4">
      <Botao variante="secundario" onClick={onVoltar}>Voltar à lista</Botao>
      <Secao titulo={f.nome || "Paciente"} subtitulo={f.nascimento ? `${idade(f.nascimento, hojeLocal())} anos` : undefined}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome completo" className="sm:col-span-2"><input className={inputCls} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
          <Campo rotulo="CPF"><input className={inputCls} inputMode="numeric" value={mascaraCpf(f.cpf)} onChange={(e) => mudar({ cpf: e.target.value })} /></Campo>
          <Campo rotulo="Nascimento"><input type="date" className={inputCls} value={f.nascimento} onChange={(e) => mudar({ nascimento: e.target.value })} /></Campo>
          <Campo rotulo="Telefone (WhatsApp)"><input className={inputCls} inputMode="tel" value={mascaraFone(f.telefone)} onChange={(e) => mudar({ telefone: e.target.value })} /></Campo>
          <Campo rotulo="E-mail"><input className={inputCls} type="email" value={f.email} onChange={(e) => mudar({ email: e.target.value })} /></Campo>
          <Campo rotulo="Sexo"><select className={inputCls} value={f.sexo} onChange={(e) => mudar({ sexo: e.target.value })}><option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option></select></Campo>
          <Campo rotulo="Convênio"><select className={inputCls} value={f.convenio_id} onChange={(e) => mudar({ convenio_id: e.target.value })}><option value="">Particular</option>{conveniosAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
          <Campo rotulo="Carteirinha"><input className={inputCls} value={f.carteirinha} onChange={(e) => mudar({ carteirinha: e.target.value })} /></Campo>
          <Campo rotulo="Observações (administrativas)" className="sm:col-span-2"><input className={inputCls} value={f.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} placeholder="Ex.: prefere horário da manhã" /></Campo>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-hf-text"><input type="checkbox" checked={!!f.aceita_whatsapp} onChange={(e) => mudar({ aceita_whatsapp: e.target.checked })} /> Aceita lembretes pelo WhatsApp</label>
        </div>
        {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
        <div className="mt-3 flex gap-2"><Botao onClick={salvar}>Salvar cadastro</Botao>
          <Botao variante="secundario" onClick={async () => { if (!window.confirm("Inativar este paciente? Ele some da busca, mas o histórico fica guardado.")) return; const r = await salvarPaciente({ id: p.id, ativo: false }); if (!r.error) onVoltar(); else setMsg({ tipo: "alerta", texto: r.error }); }}>Inativar</Botao></div>
      </Secao>
      <Secao titulo="Consultas" subtitulo={historico ? `${historico.length} consulta(s) · ${brl(pagos)} pagos` : undefined}>
        {historico === null ? <p className="text-sm text-hf-muted">Carregando…</p> : !historico.length ? <p className="text-sm text-hf-text-2">Nenhuma consulta ainda.</p> : (
          <ul className="divide-y divide-hf-border">{historico.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-bold tabular-nums">{dataBR(c.inicio)} {hora(c.inicio)}</span>
              <span className="text-hf-text-2">{tipos.find((t) => t.id === c.tipo_id)?.nome || "Consulta"} · {convenios.find((x) => x.id === c.convenio_id)?.nome || "Particular"}</span>
              <SeloStatus status={c.status} />
              <span className="ml-auto tabular-nums">{c.valor != null ? brl(c.valor) : "—"}{c.pago_em ? " · pago" : ""}</span>
            </li>))}</ul>
        )}
      </Secao>
    </div>
  );
}

export default function PacientesPage() {
  const { conveniosAtivos } = useConsultorio();
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [novo, setNovo] = useState(false);
  useEffect(() => { const id = setTimeout(() => buscarPacientes(termo, 60).then((r) => setLista(r.data)), 250); return () => clearTimeout(id); }, [termo, aberto]);
  if (aberto) return <Ficha key={aberto.id} p={aberto} onVoltar={() => setAberto(null)} />;
  return (
    <div className="space-y-4">
      {novo ? <Secao titulo="Novo paciente"><EscolherPaciente convenios={conveniosAtivos} onEscolher={(p) => { setNovo(false); setAberto(p); }} /></Secao> : null}
      <Secao titulo="Pacientes" direita={!novo && <Botao onClick={() => setNovo(true)}>Novo paciente</Botao>}>
        <input className={inputCls} value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" aria-label="Buscar paciente" />
        <ul className="mt-3 divide-y divide-hf-border">
          {lista.map((p) => (
            <li key={p.id}><button type="button" onClick={() => setAberto(p)} className="flex min-h-[52px] w-full items-center justify-between gap-2 text-left hover:bg-hf-elevated">
              <span className="text-sm font-semibold text-hf-text">{p.nome}</span>
              <span className="text-xs text-hf-muted">{p.telefone ? mascaraFone(p.telefone) : ""}{p.cpf ? ` · ${mascaraCpf(p.cpf)}` : ""}</span>
            </button></li>
          ))}
          {!lista.length && <li className="py-3 text-sm text-hf-text-2">{termo ? "Ninguém encontrado." : "Nenhum paciente cadastrado ainda."}</li>}
        </ul>
      </Secao>
    </div>
  );
}
