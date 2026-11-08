"use client";

// Peças pequenas do painel da Sinalização digital (TVs).

import { fetchComSessao } from "../../lib/api-sessao";
import { supabase } from "../../lib/supabase";
import { useCallback, useEffect, useState } from "react";
import { MonitorPlay, RefreshCw, Utensils } from "lucide-react";
import { Palco, FiltroNitidez } from "./PalcoTv";
import { mimeParaEnvio, codecDoVideo, arquivoComTipo, ERRO_HEVC } from "../../lib/sinalizacao.mjs";

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
  // .mov do iPhone com H.264 = mesmo vídeo do MP4: sobe como video/mp4. HEVC: avisa.
  const mime = mimeParaEnvio(arquivo.name, arquivo.type);
  if (mime === "video/mp4" && codecDoVideo(new Uint8Array(await arquivo.arrayBuffer())) === "hevc") throw new Error(ERRO_HEVC);
  const base = { nome: arquivo.name.replace(/\.[^.]+$/, "").slice(0, 80), mime, tamanho: arquivo.size };
  const medidas = await medirArquivo(arquivo);
  const prep = await chamar(unidadeId, "preparar_envio", base);
  const { error } = await supabase.storage.from("sinalizacao").uploadToSignedUrl(prep.caminho, prep.token, arquivoComTipo(arquivo, mime), { contentType: mime });
  if (error) throw new Error("O arquivo não subiu. Confira a internet e tente de novo.");
  return chamar(unidadeId, "registrar_midia", { ...base, ...medidas, caminho: prep.caminho });
}

export const tamanhoLegivel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const segundos = (s) => (s == null ? "" : s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** Miniatura de uma mídia (ou do cardápio) no formato da tela. */
export function Miniatura({ midia, cardapio = false, orientacao = "horizontal", className = "", proporcao: forcada }) {
  const proporcao = forcada || (orientacao === "vertical" ? "aspect-[9/16]" : "aspect-video");
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

// ─── Prévia: "Ver como fica na TV" ───────────────────────────────────────────

export const AJUSTES_TV = [
  ["auto", "Automático (recomendado)"],
  ["inteira", "Inteira"],
  ["preencher", "Preencher"],
  ["dividir", "Dividir em 2"],
];
/** Transições entre slides, com os nomes do PowerPoint. */
export const TRANSICOES_TV = [
  ["esmaecer", "Esmaecer"],
  ["empurrar", "Empurrar"],
  ["cobrir", "Cobrir"],
  ["revelar", "Revelar"],
  ["dividir", "Dividir"],
  ["forma", "Forma (círculo)"],
  ["persianas", "Persianas"],
  ["cubo", "Cubo"],
  ["zoom", "Zoom"],
  ["aleatoria", "Aleatória"],
  ["nenhuma", "Nenhuma (corte seco)"],
];
export const VELOCIDADES_TV = [
  ["rapida", "Rápida (0,5 s)"],
  ["media", "Média (0,9 s)"],
  ["lenta", "Lenta (1,5 s)"],
];

export const AJUDA_AJUSTE = {
  auto: "Foto deitada numa TV deitada enche a tela toda (corta um pouco em cima e embaixo). Foto em pé fica inteira, com o fundo desfocado.",
  inteira: "A arte toda, com o fundo preenchido pela própria arte desfocada.",
  preencher: "Enche a tela sem desfocar; corta as sobras (em cima e embaixo).",
  dividir: "Metade de cima à esquerda e metade de baixo à direita: enche a TV deitada sem desfocar. Em vídeo vale como Preencher.",
};

/**
 * Uma TV pequena no painel, rodando o MESMO palco da TV de verdade (lados,
 * tempos, ajuste, realce e cardápio com preço). `itens` (playlist em edição)
 * ou `conteudo` (arte/playlist escolhida em Trocar conteúdo).
 */
export function PreviaTv({ unidadeId, itens, conteudo, orientacao = "horizontal" }) {
  const [aberta, setAberta] = useState(false);
  const [estado, setEstado] = useState({ carregando: false, roteiro: [], loja: null, erro: "", chave: 0 });
  const pedido = JSON.stringify({ itens: itens || null, conteudo: conteudo || null });

  const montar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: "" }));
    try {
      const r = await chamar(unidadeId, "previa", JSON.parse(pedido));
      setEstado((e) => ({ carregando: false, roteiro: r.roteiro || [], loja: r.loja, erro: "", chave: e.chave + 1 }));
    } catch (err) {
      setEstado((e) => ({ ...e, carregando: false, erro: err.message }));
    }
  }, [unidadeId, pedido]);

  // Mudou a playlist com a prévia aberta: refaz depois de uma pausa curta.
  useEffect(() => {
    if (!aberta) return undefined;
    const t = setTimeout(montar, 600);
    return () => clearTimeout(t);
  }, [aberta, montar]);

  const vertical = orientacao === "vertical";
  return (
    <div className="mb-4">
      <button type="button" onClick={() => setAberta((a) => !a)} className="erp-btn erp-btn-ghost !min-h-11 w-full text-sm">
        <MonitorPlay size={16} /> {aberta ? "Fechar prévia" : "Ver como fica na TV"}
      </button>
      {aberta && (
        <div className="mt-2 rounded-2xl bg-hf-menu p-2.5">
          <div className={`relative mx-auto overflow-hidden rounded-lg bg-black ${vertical ? "aspect-[9/16] max-h-[420px]" : "aspect-video w-full"}`}
            style={{ containerType: "size", ...(vertical ? { height: "min(420px, 70vh)" } : {}) }}>
            <FiltroNitidez />
            {estado.roteiro.length > 0 && <Palco roteiro={estado.roteiro} loja={estado.loja} vertical={vertical} chave={`p${estado.chave}`} />}
            {!estado.roteiro.length && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/60">
                {estado.carregando ? "Montando a prévia…" : estado.erro || "Nada para mostrar ainda. Adicione uma arte ou o cardápio."}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-white/60">Prévia com os mesmos tempos, lados, ajuste e realce da TV.</p>
            <button type="button" onClick={montar} className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white/80">
              <RefreshCw size={13} /> Recomeçar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
