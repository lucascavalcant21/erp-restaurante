"use client";

// Teleconsulta: página do paciente, sem login (dono, 21/11/2026). Ele lê o
// termo de telemedicina, aceita (fica registrado) e entra na sala. O link da
// sala só vem do banco depois do aceite.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { salaEmbutida } from "../../lib/consultorio/teleconsulta.mjs";

export default function TeleconsultaPaciente() {
  const { codigo } = useParams() || {};
  const [convite, setConvite] = useState(null);
  const [erro, setErro] = useState(null);
  const [li, setLi] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [sala, setSala] = useState(null);

  useEffect(() => {
    if (!isSupabaseReady() || !codigo) { setErro("Convite inválido."); return; }
    supabase.rpc("cons_convite_teleconsulta", { p_codigo: String(codigo) }).then(({ data, error }) => {
      if (error || !data?.ok) { setErro(data?.erro || "Convite inválido ou expirado."); return; }
      setConvite(data);
      if (data.sala_url) setSala(data.sala_url);
    });
  }, [codigo]);

  async function aceitar() {
    setEntrando(true);
    const { data, error } = await supabase.rpc("cons_aceitar_termo", { p_codigo: String(codigo), p_navegador: navigator.userAgent });
    setEntrando(false);
    if (error || !data?.ok) { setErro(data?.erro || "Não foi possível registrar o aceite. Tente de novo."); return; }
    setSala(data.sala_url);
  }

  const quando = convite ? new Date(convite.inicio).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  const url = sala ? salaEmbutida(sala, { nome: convite?.primeiro_nome || "" }) : null;
  return (
    <main className="min-h-screen bg-hf-bg px-4 py-6 text-hf-text">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Teleconsulta</h1>
        {erro && <p className="rounded-xl border border-hf-danger/30 bg-hf-danger/5 p-4 text-sm font-semibold">{erro}</p>}
        {!erro && !convite && <p className="text-sm text-hf-muted">Abrindo o convite…</p>}
        {convite && !sala && (
          <section className="space-y-4 rounded-2xl border border-hf-border bg-hf-surface p-5">
            <p className="text-base">Olá, <b>{convite.primeiro_nome}</b>! Sua consulta é <b>{quando}</b>.</p>
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-line rounded-xl bg-hf-elevated p-4 text-sm leading-relaxed">{convite.termo_texto}</div>
            <label className="flex min-h-[44px] items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={li} onChange={(e) => setLi(e.target.checked)} />
              <span>Li o termo acima e concordo com a teleconsulta e com a transmissão das minhas imagens e dados para este atendimento.</span>
            </label>
            <button type="button" disabled={!li || entrando} onClick={aceitar} className="h-12 w-full rounded-xl bg-hf-menu px-4 text-base font-bold text-white disabled:opacity-50">
              {entrando ? "Registrando…" : "Aceito e quero entrar na sala"}
            </button>
            <p className="text-xs text-hf-muted">O vídeo não é gravado. Seu aceite fica registrado no seu prontuário. Use fone de ouvido e fique em um lugar reservado.</p>
          </section>
        )}
        {url && (
          <section className="space-y-2">
            <p className="text-sm">Termo aceito. Permita o uso da câmera e do microfone quando o navegador pedir. <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir a sala em outra aba</a></p>
            <iframe title="Sala da teleconsulta" src={url} allow="camera; microphone; fullscreen; speaker; display-capture; autoplay" className="h-[75vh] min-h-[420px] w-full rounded-xl border border-hf-border bg-black" />
          </section>
        )}
      </div>
    </main>
  );
}
