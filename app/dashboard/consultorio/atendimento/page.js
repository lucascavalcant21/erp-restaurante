"use client";

// Atendimento (médico): a fila de quem chegou, o resumo da última consulta
// (motivo, diagnóstico, conduta, exames, medicação) e a ficha de hoje com o
// retorno. A ficha só o médico que escreveu vê (regra no banco); abrir fica
// registrado. É ficha de apoio: o prontuário oficial continua onde está.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConsultorio } from "../../../components/consultorio/contexto";
import { SeloStatus, dataBR, hojeLocal, hora, inicioDoDiaIso, mascaraFone, somarDiasLocal } from "../../../components/consultorio/partes";
import { Aviso, Botao, Campo, Secao, inputCls } from "../../../components/marmitaria/ui";
import { filaDoMedico, idade, retornosEsquecidos } from "../../../lib/consultorio/agenda.mjs";
import { fetchConsultas, fetchConsultasDesde, fetchPacientesPorId, fetchRetornos, fichasDoPaciente, salvarConsulta, salvarFicha } from "../../../lib/consultorio/dados";

const area = `${inputCls} min-h-[84px] py-2 leading-relaxed`;
const VAZIA = { queixa: "", anotacoes: "", diagnostico: "", cid: "", conduta: "", exames: "", medicacao: "", retorno_dias: "" };

function UltimaConsulta({ f }) {
  if (!f) return <p className="text-sm text-hf-text-2">Primeira consulta registrada aqui: nenhuma ficha anterior sua para este paciente.</p>;
  const linha = (r, v) => (v ? <p className="text-sm"><b className="text-hf-text">{r}:</b> <span className="text-hf-text-2">{v}</span></p> : null);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-hf-muted">Última consulta: {dataBR(f.criado_em)}{f.retorno_dias ? ` · retorno pedido em ${f.retorno_dias} dias` : ""}</p>
      {linha("Motivo", f.queixa)}{linha("Diagnóstico", [f.diagnostico, f.cid && `(CID ${f.cid})`].filter(Boolean).join(" "))}
      {linha("Conduta", f.conduta)}{linha("Exames", f.exames)}{linha("Medicação", f.medicacao)}{linha("Anotações", f.anotacoes)}
    </div>
  );
}

function Atender({ c, paciente, onFim }) {
  const [fichas, setFichas] = useState(null);
  const [f, setF] = useState({ ...VAZIA, queixa: c.motivo || "" });
  const [verTodas, setVerTodas] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { fichasDoPaciente(c.paciente_id).then((r) => { if (r.error) setErro(r.error); setFichas(r.data || []); }); }, [c.paciente_id]);
  const mudar = (m) => setF((x) => ({ ...x, ...m }));

  async function finalizar() {
    setErro(null); setSalvando(true);
    const dias = Number(String(f.retorno_dias).replace(",", "."));
    const r = await salvarFicha({ paciente_id: c.paciente_id, consulta_id: c.id, queixa: f.queixa || null, anotacoes: f.anotacoes || null, diagnostico: f.diagnostico || null,
      cid: f.cid ? f.cid.toUpperCase().trim() : null, conduta: f.conduta || null, exames: f.exames || null, medicacao: f.medicacao || null, retorno_dias: dias > 0 ? Math.round(dias) : null });
    if (r.error) { setSalvando(false); return setErro(/duplicate|unique/i.test(r.error) ? "Esta consulta já tem ficha." : r.error); }
    const k = await salvarConsulta({ id: c.id, status: "atendida", atendimento_fim: new Date().toISOString() });
    setSalvando(false);
    if (k.error) return setErro(`Ficha salva, mas a consulta não foi marcada como atendida: ${k.error}`);
    onFim();
  }

  return (
    <Secao titulo={paciente?.nome || "Paciente"} subtitulo={[paciente?.nascimento ? `${idade(paciente.nascimento, hojeLocal())} anos` : null, paciente?.telefone ? mascaraFone(paciente.telefone) : null, c.motivo ? `Motivo: ${c.motivo}` : null].filter(Boolean).join(" · ")}
      direita={<Botao variante="secundario" onClick={() => onFim(true)}>Voltar à fila</Botao>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-hf-elevated p-3">{fichas === null ? <p className="text-sm text-hf-muted">Abrindo as fichas…</p> : <UltimaConsulta f={fichas[0]} />}
          {fichas?.length > 1 && <button type="button" onClick={() => setVerTodas(!verTodas)} className="mt-2 min-h-[40px] text-sm font-semibold text-hf-accent">{verTodas ? "Esconder" : `Ver as ${fichas.length - 1} anteriores`}</button>}
          {verTodas && <div className="mt-2 space-y-3 border-t border-hf-border pt-3">{fichas.slice(1).map((x) => <UltimaConsulta key={x.id} f={x} />)}</div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Motivo / queixa" className="sm:col-span-2"><textarea className={area} rows={2} value={f.queixa} onChange={(e) => mudar({ queixa: e.target.value })} /></Campo>
          <Campo rotulo="História e exame físico" className="sm:col-span-2"><textarea className={area} rows={3} value={f.anotacoes} onChange={(e) => mudar({ anotacoes: e.target.value })} /></Campo>
          <Campo rotulo="Diagnóstico"><input className={inputCls} value={f.diagnostico} onChange={(e) => mudar({ diagnostico: e.target.value })} /></Campo>
          <Campo rotulo="CID (opcional)"><input className={inputCls} value={f.cid} onChange={(e) => mudar({ cid: e.target.value })} placeholder="Ex.: M54.5" /></Campo>
          <Campo rotulo="Conduta" className="sm:col-span-2"><textarea className={area} rows={2} value={f.conduta} onChange={(e) => mudar({ conduta: e.target.value })} /></Campo>
          <Campo rotulo="Exames pedidos"><textarea className={area} rows={2} value={f.exames} onChange={(e) => mudar({ exames: e.target.value })} /></Campo>
          <Campo rotulo="Medicação"><textarea className={area} rows={2} value={f.medicacao} onChange={(e) => mudar({ medicacao: e.target.value })} /></Campo>
          <Campo rotulo="Retorno em (dias)" dica="Vazio: sem retorno.">
            <div className="flex flex-wrap gap-2">
              {[7, 15, 30, 60, 90].map((d) => <button key={d} type="button" onClick={() => mudar({ retorno_dias: String(d) })} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${String(f.retorno_dias) === String(d) ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border text-hf-text-2"}`}>{d}</button>)}
              <input className={`${inputCls} w-24`} inputMode="numeric" value={f.retorno_dias} onChange={(e) => mudar({ retorno_dias: e.target.value.replace(/\D/g, "") })} aria-label="Retorno em dias" />
            </div>
          </Campo>
        </div>
        <p className="text-xs text-hf-muted">Ficha de apoio ao retorno: só você vê, e quem abre fica registrado. O prontuário oficial continua onde está.</p>
        {erro && <Aviso tipo="alerta">{erro}</Aviso>}
        <Botao onClick={finalizar} disabled={salvando} className="min-h-[48px] w-full sm:w-auto">{salvando ? "Salvando…" : "Finalizar atendimento"}</Botao>
      </div>
    </Secao>
  );
}

export default function AtendimentoPage() {
  const { tipos } = useConsultorio();
  const hoje = hojeLocal();
  const [consultas, setConsultas] = useState([]);
  const [pacientes, setPacientes] = useState(new Map());
  const [aberta, setAberta] = useState(null);
  const [retornos, setRetornos] = useState([]);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    const r = await fetchConsultas(inicioDoDiaIso(hoje), inicioDoDiaIso(somarDiasLocal(hoje, 1)));
    const ret = await fetchRetornos();
    const desde = ret.data.reduce((m, f) => (String(f.criado_em) < m ? String(f.criado_em) : m), new Date().toISOString());
    const futuras = ret.data.length ? await fetchConsultasDesde(desde) : { data: [] };
    const ids = [...r.data.map((c) => c.paciente_id), ...ret.data.map((f) => f.paciente_id)];
    const p = await fetchPacientesPorId(ids);
    const mapa = new Map(p.data.map((x) => [x.id, x]));
    setConsultas(r.data); setPacientes(mapa);
    setRetornos(retornosEsquecidos({ fichas: ret.data, consultas: futuras.data, pacientes: mapa, hojeIso: hoje }));
    setErro([r.error, ret.error].filter(Boolean).join(" · ") || null);
  }, [hoje]);
  useEffect(() => { carregar(); }, [carregar]);

  const fila = useMemo(() => filaDoMedico(consultas), [consultas]);
  const proximas = consultas.filter((c) => ["agendada", "confirmada"].includes(c.status));
  const c = aberta ? consultas.find((x) => x.id === aberta) : null;

  async function chamar(x) {
    if (x.status === "chegou") await salvarConsulta({ id: x.id, status: "em_atendimento", atendimento_inicio: new Date().toISOString() });
    setAberta(x.id);
  }
  if (c) return <Atender c={c} paciente={pacientes.get(c.paciente_id)} onFim={() => { setAberta(null); carregar(); }} />;

  const vencidos = retornos.filter((r) => r.vencido);
  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <Secao titulo="Fila de hoje" subtitulo={fila.length ? `${fila.length} paciente(s) esperando` : "Ninguém esperando agora. Quando a secretária marcar a chegada, o paciente aparece aqui."}>
        <ul className="divide-y divide-hf-border">
          {fila.map((x) => {
            const p = pacientes.get(x.paciente_id);
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-14 text-base font-bold tabular-nums">{hora(x.inicio)}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-hf-text">{p?.nome || "Paciente"} <SeloStatus status={x.status} /></span>
                  <span className="block text-xs text-hf-text-2">{tipos.find((t) => t.id === x.tipo_id)?.nome || "Consulta"}{x.chegada_em ? ` · chegou às ${hora(x.chegada_em)}` : ""}{x.motivo ? ` · ${x.motivo}` : ""}</span></span>
                <Botao onClick={() => chamar(x)}>{x.status === "em_atendimento" ? "Continuar" : "Atender"}</Botao>
              </li>
            );
          })}
        </ul>
      </Secao>
      {proximas.length > 0 && (
        <Secao titulo="Ainda vão chegar">
          <ul className="divide-y divide-hf-border">{proximas.map((x) => <li key={x.id} className="flex items-center gap-3 py-2 text-sm"><span className="w-14 font-bold tabular-nums">{hora(x.inicio)}</span><span className="flex-1 text-hf-text">{pacientes.get(x.paciente_id)?.nome || "Paciente"}</span><SeloStatus status={x.status} /></li>)}</ul>
        </Secao>
      )}
      <Secao titulo="Retornos" subtitulo={vencidos.length ? `${vencidos.length} retorno(s) passaram da data sem consulta marcada` : "Os retornos que você pede aparecem aqui até o paciente marcar."}>
        {!retornos.length ? <p className="text-sm text-hf-text-2">Nenhum retorno pendente.</p> : (
          <ul className="divide-y divide-hf-border">
            {retornos.map((r) => (
              <li key={r.paciente_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-hf-text">{r.paciente?.nome || "Paciente"}{r.paciente?.telefone ? <span className="font-normal text-hf-muted"> · {mascaraFone(r.paciente.telefone)}</span> : null}</span>
                <span className={r.vencido ? "font-bold text-hf-danger" : "text-hf-text-2"}>{r.vencido ? `venceu em ${dataBR(r.retornoEm)} (${r.diasAtraso} dia(s))` : `retorno até ${dataBR(r.retornoEm)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
