"use client";

// Peças do editor do cardápio (painel do dono), na paleta hf-* do Héfisto.

import { useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Info, Loader2, Trash2 } from "lucide-react";
import { enviarArquivoCardapio, LIMITE_IMAGEM_MB, LIMITE_VIDEO_MB } from "../../../lib/cardapio-editor";

export const inputCls = "w-full min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none transition focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

export function Secao({ titulo, subtitulo, direita, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5 ${className}`}>
      {(titulo || direita) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-bold text-hf-text">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-xs text-hf-muted">{subtitulo}</p>}
          </div>
          {direita}
        </div>
      )}
      {children}
    </section>
  );
}

export function Campo({ rotulo, dica, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-hf-text-2">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-hf-muted">{dica}</span>}
    </label>
  );
}

export function Botao({ children, variante = "primario", className = "", ...rest }) {
  const v = variante === "secundario"
    ? "border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"
    : variante === "perigo" ? "border border-hf-danger/30 bg-hf-surface text-hf-danger hover:bg-hf-danger/5"
      : variante === "texto" ? "text-hf-accent hover:bg-hf-accent/5"
        : "bg-hf-accent text-hf-accent-fg hover:brightness-110";
  return (
    <button type="button" className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Alternar({ ativo, onChange, rotulo, dica }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} onClick={() => onChange(!ativo)}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-1 text-left">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-hf-text">{rotulo}</span>
        {dica && <span className="block text-xs text-hf-muted">{dica}</span>}
      </span>
      <span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${ativo ? "bg-hf-accent" : "bg-hf-border-strong"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${ativo ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Aviso({ tipo = "info", children, className = "" }) {
  const alerta = tipo === "alerta";
  const Icone = alerta ? AlertTriangle : Info;
  return (
    <div className={`flex gap-2 rounded-xl border px-3 py-2.5 text-sm ${alerta ? "border-hf-warning/30 bg-hf-warning/5 text-hf-text" : "border-hf-border bg-hf-elevated/60 text-hf-text-2"} ${className}`}>
      <Icone size={16} className={`mt-0.5 flex-shrink-0 ${alerta ? "text-hf-warning" : "text-hf-muted"}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Chip({ ativo, children, ...rest }) {
  return (
    <button type="button" aria-pressed={ativo}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${ativo ? "border-hf-accent bg-hf-accent/10 text-hf-accent" : "border-hf-border bg-hf-surface text-hf-text-2 hover:text-hf-text"}`} {...rest}>
      {children}
    </button>
  );
}

/** Cor: o quadradinho do sistema e o código ao lado (#9a3412). */
export function CampoCor({ rotulo, valor, onChange, dica }) {
  const [texto, setTexto] = useState(valor);
  const [ultimo, setUltimo] = useState(valor);
  if (ultimo !== valor) { setUltimo(valor); setTexto(valor); }
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <span className="flex items-center gap-2">
        <input type="color" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={`${rotulo}: escolher`}
          className="h-11 w-14 flex-shrink-0 cursor-pointer rounded-xl border border-hf-border bg-hf-surface p-1" />
        <input className={`${inputCls} font-mono uppercase`} value={texto} maxLength={7} aria-label={`${rotulo}: código`}
          onChange={(e) => { const t = e.target.value.trim(); setTexto(t); if (/^#[0-9a-fA-F]{6}$/.test(t)) onChange(t.toLowerCase()); }} />
      </span>
    </Campo>
  );
}

/**
 * Enviar foto (ou vídeo, quando `aceitaVideo`). Mostra o que já está lá,
 * troca e remove. O arquivo vai para o armazenamento na hora; o endereço só
 * fica valendo no cardápio quando o dono salvar.
 */
export function Envio({ rotulo, url, onEnviado, onRemover, unidadeId, pasta, aceitaVideo = false, ehVideo = false, compacto = false }) {
  const campo = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    const r = await enviarArquivoCardapio(unidadeId, arquivo, pasta);
    setEnviando(false);
    if (r.erro) { setErro(r.erro); return; }
    if (r.video && !aceitaVideo) { setErro("Aqui vai só foto."); return; }
    onEnviado(r.url, r.video);
  };
  const aceita = aceitaVideo ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/gif";
  return (
    <div className="min-w-0">
      {rotulo && <span className="mb-1 block text-xs font-semibold text-hf-text-2">{rotulo}</span>}
      <div className="flex flex-wrap items-center gap-2">
        {url ? (
          ehVideo
            ? <video src={url} muted playsInline className={`${compacto ? "h-14 w-20" : "h-20 w-32"} rounded-lg border border-hf-border bg-hf-elevated object-cover`} />
            : <img src={url} alt="" className={`${compacto ? "h-14 w-14" : "h-20 w-20"} rounded-lg border border-hf-border bg-hf-elevated object-cover`} />
        ) : null}
        <input ref={campo} type="file" accept={aceita} className="hidden" onChange={escolher} />
        <Botao variante="secundario" onClick={() => campo.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {enviando ? "Enviando…" : url ? "Trocar" : aceitaVideo ? "Foto ou vídeo" : "Escolher foto"}
        </Botao>
        {url && onRemover ? <Botao variante="texto" onClick={onRemover} aria-label="Remover"><Trash2 size={16} /> Remover</Botao> : null}
      </div>
      {erro ? <p className="mt-1 text-xs font-semibold text-hf-danger">{erro}</p> : null}
      {!url && !erro ? <p className="mt-1 text-[11px] text-hf-muted">Foto até {LIMITE_IMAGEM_MB} MB{aceitaVideo ? `; vídeo MP4 ou WEBM até ${LIMITE_VIDEO_MB} MB (curto e sem som funciona melhor)` : ""}.</p> : null}
    </div>
  );
}

/** Subir/descer um item numa lista (seções, abertura, promoções). */
export function mover(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}
