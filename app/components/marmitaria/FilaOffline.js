"use client";

// Aviso de "sem internet" e do que está esperando para ir ao sistema (dono,
// 21/11/2026). Mostra a fila do aparelho e deixa enviar na hora.

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { enviarFila, lerFila, offline, ouvirFila } from "../../lib/offline/fila.mjs";

const hora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function FilaOffline() {
  const { copiaDe, recarregar } = useMarmitaria();
  const [fila, setFila] = useState([]);
  const [semRede, setSemRede] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recusados, setRecusados] = useState([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setFila(lerFila()); setSemRede(offline());
    const parar = ouvirFila(setFila);
    const on = () => setSemRede(false), off = () => setSemRede(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { parar(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    try { const r = await enviarFila(); setRecusados(r.recusados || []); if (r.enviados) await recarregar(); } finally { setEnviando(false); }
  }

  if (!semRede && !fila.length && !copiaDe && !recusados.length) return null;
  return (
    <div className="rounded-2xl border border-hf-warning/50 bg-hf-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CloudOff size={16} className="shrink-0 text-hf-warning" />
        <span className="min-w-0 flex-1 font-semibold text-hf-text">
          {semRede ? "Sem internet." : copiaDe ? "Sem conexão com o sistema." : "Internet de volta."}
          {copiaDe ? ` Mostrando o que estava no aparelho em ${hora(copiaDe)}.` : ""}
          {fila.length ? ` ${fila.length} alteração(ões) esperando para enviar.` : semRede ? " O que você salvar fica no aparelho e vai quando a internet voltar." : ""}
        </span>
        {fila.length > 0 && <button type="button" onClick={() => setAberto(!aberto)} className="min-h-[40px] text-xs font-bold text-hf-accent">{aberto ? "Esconder" : "Ver"}</button>}
        {fila.length > 0 && !semRede && <button type="button" onClick={enviar} disabled={enviando} className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-hf-menu px-3 text-xs font-bold text-white"><RefreshCw size={13} className={enviando ? "animate-spin" : ""} /> Enviar agora</button>}
      </div>
      {aberto && fila.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-hf-text-2">{fila.map((i) => <li key={i.id}>• {i.rotulo || i.tipo} <span className="text-hf-muted">({hora(i.em)})</span></li>)}</ul>
      )}
      {recusados.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-hf-danger">{recusados.map((i) => <li key={i.id}>Não entrou: {i.rotulo || i.tipo}: {i.erro}</li>)}</ul>
      )}
    </div>
  );
}
