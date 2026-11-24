"use client";

// Pacientes: busca, cadastro e histórico de consultas e pagamentos.

import { useEffect, useState } from "react";
import { useConsultorio } from "../../../components/consultorio/contexto";
import { EscolherPaciente, SeloStatus, dataBR, hojeLocal, hora, mascaraCpf, mascaraFone } from "../../../components/consultorio/partes";
import { Aviso, Botao, Campo, Secao, brl, inputCls } from "../../../components/marmitaria/ui";
import { aniversariantes, cpfValido, idade, soDigitos, textoDeAniversario } from "../../../lib/consultorio/agenda.mjs";
import { buscarPacientes, fetchComNascimento, fetchConsultasDoPaciente, salvarPaciente } from "../../../lib/consultorio/dados";
import { fetchComSessao } from "../../../lib/api-sessao";

// Login do portal do paciente: gerado aqui, a senha aparece uma vez só.
function AcessoDoPaciente({ p }) {
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/paciente` : "/paciente";
  async function gerar() {
    if (p.auth_user_id && !window.confirm("Gerar uma senha nova? A senha antiga deixa de valer.")) return;
    setOcupado(true); setErro(null);
    try {
      const r = await fetchComSessao("/api/consultorio/paciente-acesso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paciente_id: p.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.error || "Não consegui gerar o acesso."); else setRes(j);
    } catch { setErro("Sem conexão. Tente de novo."); }
    setOcupado(false);
  }
  const texto = res ? `Olá, ${String(p.nome).split(" ")[0]}! Seu acesso ao portal do consultório: ${link}\nLogin: ${res.login}\nSenha: ${res.senha}\nTroque a senha no primeiro acesso.` : "";
  const fone = String(p.telefone || "").replace(/\D/g, "");
  return (
    <Secao titulo="Portal do paciente" subtitulo="Com login e senha, o paciente marca e cancela consultas, entra na teleconsulta e vê os resumos das consultas (sem as suas anotações internas).">
      {p.auth_user_id && !res && <p className="mb-2 text-sm text-hf-text-2">Acesso já criado{p.login ? ` (login ${p.login})` : ""}.</p>}
      {res ? (
        <div className="space-y-2 rounded-xl bg-hf-elevated p-3">
          <p className="text-sm text-hf-text">Login: <b className="font-mono">{res.login}</b> · Senha: <b className="font-mono">{res.senha}</b></p>
          <p className="text-xs text-hf-muted">A senha não aparece de novo. Entregue ao paciente agora.</p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => navigator.clipboard?.writeText(texto)}>Copiar</Botao>
            {fone && <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text">Enviar pelo WhatsApp</a>}
          </div>
        </div>
      ) : <Botao onClick={gerar} disabled={ocupado}>{ocupado ? "Gerando…" : p.auth_user_id ? "Gerar senha nova" : "Criar acesso ao portal"}</Botao>}
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
    </Secao>
  );
}

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
      <AcessoDoPaciente p={p} />
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

function Aniversariantes() {
  const [lista, setLista] = useState([]);
  const hoje = hojeLocal();
  useEffect(() => { fetchComNascimento().then((r) => setLista(aniversariantes(r.data, hoje.slice(5, 7)))); }, [hoje]);
  if (!lista.length) return null;
  return (
    <Secao titulo={`Aniversariantes do mês (${lista.length})`}>
      <ul className="divide-y divide-hf-border">{lista.map((p) => {
        const fone = String(p.telefone || "").replace(/\D/g, ""); const dia = String(p.nascimento).slice(8, 10);
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span><b className="tabular-nums">{dia}/{hoje.slice(5, 7)}</b> {p.nome}{dia === hoje.slice(8, 10) ? <span className="ml-1 rounded-full bg-hf-accent/15 px-2 py-0.5 text-[11px] font-bold">hoje</span> : null}</span>
            {fone && p.aceita_whatsapp ? <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(textoDeAniversario(p))}`} target="_blank" rel="noreferrer" className="min-h-[40px] rounded-xl border border-hf-border px-3 py-2 font-semibold">Parabenizar</a> : <span className="text-xs text-hf-muted">{fone ? "não autorizou mensagens" : "sem telefone"}</span>}
          </li>
        );
      })}</ul>
    </Secao>
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
      <Aniversariantes />
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
