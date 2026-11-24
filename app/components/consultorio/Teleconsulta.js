"use client";

// Sala e convite da teleconsulta (agenda) e o vídeo dentro do atendimento.

import { useEffect, useState } from "react";
import { Copy, ExternalLink, MessageCircle, Video } from "lucide-react";
import { useConsultorio } from "./contexto";
import { Aviso, Botao, Campo, inputCls } from "../marmitaria/ui";
import { criarSala, fetchTeleconsultas, salvarSalaManual } from "../../lib/consultorio/dados";
import { conviteWhatsApp, gerarCodigo, linkDoPaciente, salaEmbutida, termoEmUso } from "../../lib/consultorio/teleconsulta.mjs";

export const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export function SeloAceite({ tele }) {
  if (!tele) return null;
  return tele.aceite
    ? <span className="inline-flex rounded-full bg-hf-success/10 px-2 py-0.5 text-[11px] font-bold text-hf-success">Termo aceito {dataHora(tele.aceite.aceito_em)}</span>
    : <span className="inline-flex rounded-full bg-hf-warning/10 px-2 py-0.5 text-[11px] font-bold text-hf-text">Termo ainda não aceito</span>;
}

/** Painel da agenda: cria a sala, mostra o convite do paciente e o aceite. */
export function SalaDaConsulta({ consulta, paciente, onMudou }) {
  const { config } = useConsultorio();
  const [tele, setTele] = useState(undefined);
  const [colar, setColar] = useState(false);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = () => fetchTeleconsultas([consulta.id]).then((r) => setTele(r.data[0] || null));
  useEffect(() => { carregar(); }, [consulta.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const termo = termoEmUso(config);
  const convite = tele ? linkDoPaciente(typeof window !== "undefined" ? window.location.origin : "", tele.codigo) : "";
  const fone = String(paciente?.telefone || "").replace(/\D/g, "");

  async function criar() {
    setOcupado(true); setMsg(null);
    const r = await criarSala(consulta.id, termo);
    setOcupado(false);
    if (r.semChave) { setColar(true); setMsg({ tipo: "info", texto: "A criação automática ainda não está ligada (falta a chave do Whereby). Cole o link de uma sala criada no Whereby." }); return; }
    if (r.error) return setMsg({ tipo: "alerta", texto: r.error });
    await carregar(); onMudou?.();
  }
  async function guardarLink() {
    if (!/^https:\/\//.test(link.trim())) return setMsg({ tipo: "alerta", texto: "Cole o link completo da sala (começa com https://)." });
    setOcupado(true);
    const r = await salvarSalaManual({ consultaId: consulta.id, salaUrl: link.trim(), codigo: gerarCodigo(), termo, existente: !!tele });
    setOcupado(false);
    if (r.error) return setMsg({ tipo: "alerta", texto: r.error });
    setColar(false); setLink(""); setMsg(null); await carregar(); onMudou?.();
  }

  if (tele === undefined) return <p className="text-sm text-hf-muted">Abrindo a teleconsulta…</p>;
  return (
    <div className="space-y-3 rounded-xl bg-hf-elevated p-3">
      {!tele ? (
        <div className="flex flex-wrap gap-2">
          <Botao onClick={criar} disabled={ocupado}><Video size={16} /> {ocupado ? "Criando…" : "Criar sala da teleconsulta"}</Botao>
          <Botao variante="secundario" onClick={() => setColar(true)}>Colar link de sala</Botao>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2"><SeloAceite tele={tele} /><span className="text-xs text-hf-muted">Sala {tele.provedor === "whereby" ? "Whereby" : "por link"}</span></div>
          <Campo rotulo="Link do paciente (com o termo)"><input className={inputCls} readOnly value={convite} onFocus={(e) => e.target.select()} /></Campo>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={async () => { try { await navigator.clipboard.writeText(convite); setMsg({ tipo: "info", texto: "Link copiado." }); } catch { setMsg({ tipo: "alerta", texto: "Copie o link acima." }); } }}><Copy size={15} /> Copiar</Botao>
            {fone && <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(conviteWhatsApp({ paciente, inicio: consulta.inicio, link: convite }))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text"><MessageCircle size={15} /> Enviar pelo WhatsApp</a>}
            <button type="button" onClick={() => setColar(true)} className="min-h-[44px] text-sm font-semibold text-hf-accent">Trocar a sala</button>
          </div>
        </>
      )}
      {colar && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Link da sala" className="min-w-0 flex-1"><input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://seu-consultorio.whereby.com/…" /></Campo>
          <Botao onClick={guardarLink} disabled={ocupado}>Guardar</Botao>
        </div>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}

/** Vídeo dentro do atendimento (lado do médico). */
export function VideoDoMedico({ consulta, nomeMedico = "" }) {
  const [tele, setTele] = useState(undefined);
  useEffect(() => { fetchTeleconsultas([consulta.id]).then((r) => setTele(r.data[0] || null)); }, [consulta.id]);
  if (tele === undefined) return <p className="text-sm text-hf-muted">Abrindo a sala…</p>;
  if (!tele) return <Aviso tipo="alerta">Esta teleconsulta ainda não tem sala. Crie na Agenda.</Aviso>;
  const url = salaEmbutida(tele.sala_medico_url || tele.sala_url, { nome: nomeMedico });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><SeloAceite tele={tele} />
        {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-hf-accent"><ExternalLink size={15} /> Abrir em outra aba</a>}</div>
      {!tele.aceite && <Aviso tipo="alerta">O paciente ainda não aceitou o termo de telemedicina pelo link. O aceite é obrigatório antes do atendimento.</Aviso>}
      {url && <iframe title="Sala da teleconsulta" src={url} allow="camera; microphone; fullscreen; speaker; display-capture; autoplay" className="h-[60vh] min-h-[360px] w-full rounded-xl border border-hf-border bg-black" />}
    </div>
  );
}
