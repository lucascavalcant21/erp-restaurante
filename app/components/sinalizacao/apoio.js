"use client";

// Peças pequenas do painel da Sinalização digital (TVs).

import { fetchComSessao } from "../../lib/api-sessao";
import { supabase } from "../../lib/supabase";
import { MonitorPlay, Utensils } from "lucide-react";

export async function chamar(unidadeId, acao, dados = {}) {
  const r = await fetchComSessao("/api/sinalizacao", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unidadeId, acao, ...dados }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.erro || "Não foi possível concluir. Tente de novo.");
  return j;
}

export async function lerPainel(unidadeId) {
  const r = await fetchComSessao(`/api/sinalizacao?unidadeId=${encodeURIComponent(unidadeId)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (j.semTabelas) return { semTabelas: true, erro: j.erro };
  if (!r.ok || !j.ok) throw new Error(j.erro || "Não foi possível carregar a Sinalização digital.");
  return j;
}

/** Medidas e duração do arquivo, lidas no navegador antes de enviar. */
export function medirArquivo(arquivo) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const fim = (r) => { URL.revokeObjectURL(url); resolve(r); };
    if (arquivo.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => fim({ largura: v.videoWidth || null, altura: v.videoHeight || null, duracao_seg: Number.isFinite(v.duration) ? v.duration : null });
      v.onerror = () => fim({});
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => fim({ largura: img.naturalWidth || null, altura: img.naturalHeight || null });
      img.onerror = () => fim({});
      img.src = url;
    }
  });
}

/** Envio em 3 passos: endereço assinado → arquivo direto ao Storage → registro no acervo. */
export async function enviarArquivo(unidadeId, arquivo) {
  const base = { nome: arquivo.name.replace(/\.[^.]+$/, "").slice(0, 80), mime: arquivo.type, tamanho: arquivo.size };
  const medidas = await medirArquivo(arquivo);
  const prep = await chamar(unidadeId, "preparar_envio", base);
  const { error } = await supabase.storage.from("sinalizacao").uploadToSignedUrl(prep.caminho, prep.token, arquivo, { contentType: arquivo.type });
  if (error) throw new Error("O arquivo não subiu. Confira a internet e tente de novo.");
  return chamar(unidadeId, "registrar_midia", { ...base, ...medidas, caminho: prep.caminho });
}

export const tamanhoLegivel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const segundos = (s) => (s == null ? "" : s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** Miniatura de uma mídia (ou do cardápio) no formato da tela. */
export function Miniatura({ midia, cardapio = false, orientacao = "horizontal", className = "" }) {
  const proporcao = orientacao === "vertical" ? "aspect-[9/16]" : "aspect-video";
  return (
    <div className={`relative overflow-hidden rounded-xl bg-hf-elevated ${proporcao} ${className}`}>
      {midia?.url && midia.tipo === "imagem" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={midia.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      )}
      {midia?.url && midia.tipo === "video" && (
        <video src={`${midia.url}#t=1`} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" />
      )}
      {!midia?.url && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-hf-muted">
          {cardapio ? <Utensils size={22} /> : <MonitorPlay size={22} />}
          <span className="text-[11px] font-medium">{cardapio ? "Cardápio do Héfisto" : "Sem conteúdo"}</span>
        </div>
      )}
    </div>
  );
}

export function Selo({ children, tom = "neutro" }) {
  const cls = {
    neutro: "bg-hf-elevated text-hf-text-2",
    ok: "bg-hf-success/10 text-hf-success",
    aviso: "bg-hf-warning/15 text-hf-warning",
    perigo: "bg-hf-danger/10 text-hf-danger",
    destaque: "bg-hf-accent/20 text-hf-accent",
  }[tom];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
