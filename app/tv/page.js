"use client";

// PLAYER DA TV — Sinalização digital do Héfisto (pedido do dono, 07/11/2026).
//
// Abra este endereço no navegador da TV, do TV Box ou do Fire Stick:
//   app.hefisto.com.br/tv
// 1. A TV mostra um código de 4 números.
// 2. No painel (Cardápio → Sinalização digital → Parear TV), digite o código.
// 3. Pronto: a TV toca o que o painel mandar e pergunta de novo a cada 30 s.
//
// Sem internet a TV continua tocando o último roteiro: as mídias ficam no
// cache do navegador (Cache API "hefisto-tv-midias"), e o roteiro no
// localStorage. Tela vertical num aparelho que só sai na horizontal (TV Box
// num totem em pé) é girada aqui, sem mexer na configuração do aparelho.

import { useCallback, useEffect, useRef, useState } from "react";

const API = "/api/public/sinalizacao/tv";
const CHAVE_SEGREDO = "hefisto_tv_segredo";
const CHAVE_ROTEIRO = "hefisto_tv_roteiro";
const CACHE_MIDIAS = "hefisto-tv-midias";
const INTERVALO_PAREADA = 15 * 1000;
const INTERVALO_CODIGO = 4 * 1000;
const SHA_LOCAL = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "";

const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem storage: segue */ } };

// Realce das fotos na TV (pedido do dono, 07/11/2026: "mais bonita, mais nítida,
// mais viva"): cores um pouco mais vivas, contraste leve e nitidez suave.
// Só na exibição: o arquivo original no acervo não muda. Vídeo fica de fora
// (filtro em vídeo pesa na TV).
const REALCE = "saturate(1.15) contrast(1.06) brightness(1.02) url(#hefisto-nitidez)";

function FiltroNitidez() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="hefisto-nitidez" colorInterpolationFilters="sRGB">
        <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0" />
      </filter>
    </svg>
  );
}

const preco = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

async function pedir(corpo, segredo) {
  const r = await fetch(API, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", ...(segredo ? { "x-tela-segredo": segredo } : {}) },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── cache das mídias ────────────────────────────────────────────────────────
const urlsLocais = new Map(); // chave → blob URL

async function midiaLocal(slide) {
  if (!slide?.url) return null;
  if (urlsLocais.has(slide.chave)) return urlsLocais.get(slide.chave);
  const pedidoCache = `/__tv-midia/${encodeURIComponent(slide.chave)}`;
  try {
    if (typeof caches !== "undefined") {
      const cache = await caches.open(CACHE_MIDIAS);
      let resp = await cache.match(pedidoCache);
      if (!resp) {
        const rede = await fetch(slide.url);
        if (!rede.ok) throw new Error("download");
        await cache.put(pedidoCache, rede.clone());
        resp = rede;
      }
      const url = URL.createObjectURL(await resp.blob());
      urlsLocais.set(slide.chave, url);
      return url;
    }
  } catch { /* sem cache: toca direto da rede */ }
  return slide.url;
}

async function limparCache(chavesVivas) {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(CACHE_MIDIAS);
    for (const req of await cache.keys()) {
      const chave = decodeURIComponent(new URL(req.url).pathname.replace("/__tv-midia/", ""));
      if (!chavesVivas.has(chave)) {
        await cache.delete(req);
        const u = urlsLocais.get(chave);
        if (u) { URL.revokeObjectURL(u); urlsLocais.delete(chave); }
      }
    }
  } catch { /* nada */ }
}

// ─── slides ──────────────────────────────────────────────────────────────────
function SlideCardapio({ pagina, loja, vertical }) {
  const itens = pagina?.itens || [];
  return (
    <div className="flex h-full w-full flex-col bg-[#14110d] text-[#f6efe2]" style={{ padding: vertical ? "calc(1cqh * 6) calc(1cqw * 6)" : "calc(1cqh * 5) calc(1cqw * 5)" }}>
      <div className="flex items-end justify-between gap-6 border-b border-[#c9a24d]/40 pb-[calc(1cqh*2.5)]">
        <div className="min-w-0">
          <p className="truncate font-semibold uppercase tracking-[0.2em] text-[#c9a24d]" style={{ fontSize: vertical ? "calc(1cqw * 2.6)" : "calc(1cqh * 2.2)" }}>{pagina?.titulo}</p>
          <h1 className={`font-bold leading-tight ${vertical ? "" : "truncate"}`} style={{ fontSize: vertical ? "calc(1cqw * 7)" : "calc(1cqh * 6)" }}>{pagina?.categoria}</h1>
        </div>
        {loja && <p className="shrink-0 font-medium text-[#f6efe2]/60" style={{ fontSize: vertical ? "calc(1cqw * 2.6)" : "calc(1cqh * 2.2)" }}>{loja}</p>}
      </div>
      <ul className="mt-[calc(1cqh*3)] flex flex-1 flex-col justify-evenly">
        {itens.map((p, i) => (
          <li key={i} className="flex items-baseline gap-[calc(1cqw*2)]">
            <div className="min-w-0 max-w-[68%]">
              <p className="truncate font-semibold" style={{ fontSize: vertical ? "calc(1cqw * 4.4)" : "calc(1cqh * 3.8)" }}>{p.nome}</p>
              {p.descricao && <p className="truncate text-[#f6efe2]/60" style={{ fontSize: vertical ? "calc(1cqw * 2.6)" : "calc(1cqh * 2.2)" }}>{p.descricao}</p>}
            </div>
            <span className="mx-[calc(1cqw*1)] hidden flex-1 border-b-2 border-dotted border-[#f6efe2]/20 sm:block" aria-hidden />
            <div className="shrink-0 text-right">
              {p.preco_original && <p className="text-[#f6efe2]/50 line-through" style={{ fontSize: vertical ? "calc(1cqw * 2.6)" : "calc(1cqh * 2.2)" }}>{preco(p.preco_original)}</p>}
              <p className="font-bold tabular-nums text-[#e6c06a]" style={{ fontSize: vertical ? "calc(1cqw * 5)" : "calc(1cqh * 4.2)" }}>{preco(p.preco)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Midia({ slide, aoTerminar }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vivo = true;
    setSrc(null);
    midiaLocal(slide).then((u) => { if (vivo) setSrc(u); });
    return () => { vivo = false; };
  }, [slide]);
  if (!src) return <div className="h-full w-full bg-black" />;
  if (slide.tipo === "video") {
    return (
      <video key={slide.chave} src={src} className="h-full w-full bg-black object-contain"
        autoPlay muted playsInline onEnded={aoTerminar} onError={aoTerminar} />
    );
  }
  // Arte que não tem o formato da tela (vertical numa TV deitada): em vez de
  // faixa preta, a própria arte ampliada e desfocada preenche o fundo.
  return (
    <div key={slide.chave} className="relative h-full w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="relative h-full w-full object-contain" style={{ filter: REALCE }} onError={aoTerminar} />
    </div>
  );
}

/**
 * Um lado da tela tocando a sua sequência, com os seus tempos. Tela inteira
 * = um lado só. `aoMostrar` conta ao painel o que está passando (lado 1).
 */
function Sequencia({ slides, loja, vertical, aoMostrar }) {
  const [indice, setIndice] = useState(0);
  const slide = slides.length ? slides[indice % slides.length] : null;
  const proximo = useCallback(() => setIndice((i) => (slides.length ? (i + 1) % slides.length : 0)), [slides.length]);
  useEffect(() => { aoMostrar?.(slide); }, [slide, aoMostrar]);
  // Tempo de cada slide (o vídeo avança sozinho no fim; o tempo é a rede de segurança).
  useEffect(() => {
    if (!slide || (slides.length < 2 && slide.tipo !== "video")) return undefined;
    const extra = slide.tipo === "video" ? 5 : 0;
    const t = setTimeout(proximo, (slide.duracao_seg + extra) * 1000);
    return () => clearTimeout(t);
  }, [slide, indice, proximo, slides.length]);
  if (!slide) return <div className="h-full w-full bg-black" />;
  return slide.tipo === "cardapio"
    ? <SlideCardapio pagina={slide.pagina} loja={loja} vertical={vertical} />
    : <Midia slide={slide} aoTerminar={proximo} />;
}

// ─── página ──────────────────────────────────────────────────────────────────
export default function PlayerTv() {
  const [estado, setEstado] = useState({ fase: "iniciando" });
  const [roteiro, setRoteiro] = useState([]);
  const [girar, setGirar] = useState(false);
  const segredoRef = useRef(null);
  const assinaturaRef = useRef(null);
  const atualRef = useRef(null); // o que passa no lado 1 agora (vai para o painel)
  const [cursor, setCursor] = useState(false);
  const aoMostrar = useCallback((sl) => { atualRef.current = sl; }, []);

  const aplicarRoteiro = useCallback((novo) => {
    setRoteiro(novo);
    limparCache(new Set(novo.map((sl) => sl.chave)));
    // Já baixa tudo em segundo plano: a próxima mídia entra sem tela preta.
    novo.forEach((sl) => { if (sl.url) midiaLocal(sl); });
  }, []);

  const consultar = useCallback(async () => {
    let segredo = segredoRef.current;
    try {
      if (!segredo) {
        const r = await pedir({ acao: "registrar" });
        segredo = r.segredo;
        segredoRef.current = segredo;
        gravar(CHAVE_SEGREDO, segredo);
        setEstado({ fase: "codigo", codigo: r.codigo });
        return INTERVALO_CODIGO;
      }
      const atual = atualRef.current;
      const r = await pedir({ acao: "conteudo", exibindo: atual ? { chave: atual.chave, nome: atual.nome, midia_id: atual.midia_id || null, tipo: atual.tipo } : null }, segredo);
      if (r.estado === "novo") {
        segredoRef.current = null;
        gravar(CHAVE_SEGREDO, null);
        gravar(CHAVE_ROTEIRO, null);
        assinaturaRef.current = null;
        setRoteiro([]);
        return 100;
      }
      if (r.estado === "aguardando") {
        setEstado({ fase: "codigo", codigo: r.codigo });
        return INTERVALO_CODIGO;
      }
      setEstado({ fase: "pareada", tela: r.tela, loja: r.loja, pausada: !!r.pausada, online: true });
      setGirar(r.tela?.orientacao === "vertical" && window.innerWidth > window.innerHeight);
      if (r.assinatura !== assinaturaRef.current) {
        assinaturaRef.current = r.assinatura;
        gravar(CHAVE_ROTEIRO, JSON.stringify({ tela: r.tela, loja: r.loja, roteiro: r.roteiro, assinatura: r.assinatura }));
        aplicarRoteiro(r.roteiro);
      }
      return r.intervalo_ms || INTERVALO_PAREADA;
    } catch {
      // Sem internet: segue tocando o que tem; mostra o aviso só se não tem nada.
      setEstado((e) => (e.fase === "pareada" ? { ...e, online: false } : { fase: "sem_rede" }));
      return INTERVALO_PAREADA;
    }
  }, [aplicarRoteiro]);

  // Início: segredo e último roteiro guardados (a TV liga sem internet e já toca).
  useEffect(() => {
    segredoRef.current = ler(CHAVE_SEGREDO);
    const salvo = ler(CHAVE_ROTEIRO);
    if (salvo && segredoRef.current) {
      try {
        const s = JSON.parse(salvo);
        assinaturaRef.current = s.assinatura;
        setEstado({ fase: "pareada", tela: s.tela, loja: s.loja, online: false });
        setGirar(s.tela?.orientacao === "vertical" && window.innerWidth > window.innerHeight);
        aplicarRoteiro(s.roteiro || []);
      } catch { /* roteiro corrompido: espera o servidor */ }
    }
    let timer;
    let vivo = true;
    const ciclo = async () => {
      const espera = await consultar();
      if (vivo) timer = setTimeout(ciclo, espera);
    };
    ciclo();
    return () => { vivo = false; clearTimeout(timer); };
  }, [consultar, aplicarRoteiro]);

  // Tela sempre acesa e versão nova do Héfisto aplicada sozinha.
  useEffect(() => {
    let trava = null;
    const pedirTrava = async () => { try { trava = await navigator.wakeLock?.request?.("screen"); } catch { /* sem suporte */ } };
    pedirTrava();
    const aoVoltar = () => { if (document.visibilityState === "visible") pedirTrava(); };
    document.addEventListener("visibilitychange", aoVoltar);
    const versao = setInterval(async () => {
      if (!SHA_LOCAL) return;
      try {
        const r = await fetch("/api/versao", { cache: "no-store" });
        const { sha } = await r.json();
        if (sha && sha !== "dev" && sha !== SHA_LOCAL) window.location.reload();
      } catch { /* sem rede */ }
    }, 30 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", aoVoltar); clearInterval(versao); trava?.release?.().catch(() => {}); };
  }, []);

  // Cursor some depois de 3 s parado; OK/Enter ou clique pede tela cheia.
  useEffect(() => {
    let t;
    const mexeu = () => { setCursor(true); clearTimeout(t); t = setTimeout(() => setCursor(false), 3000); };
    const telaCheia = (e) => {
      if (e.type === "keydown" && !["Enter", " ", "f", "F"].includes(e.key)) return;
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("mousemove", mexeu);
    window.addEventListener("keydown", telaCheia);
    window.addEventListener("click", telaCheia);
    const girou = () => {
      const salvo = ler(CHAVE_ROTEIRO);
      try { const s = JSON.parse(salvo || "{}"); setGirar(s.tela?.orientacao === "vertical" && window.innerWidth > window.innerHeight); } catch { /* nada */ }
    };
    window.addEventListener("resize", girou);
    return () => { window.removeEventListener("mousemove", mexeu); window.removeEventListener("keydown", telaCheia); window.removeEventListener("click", telaCheia); window.removeEventListener("resize", girou); clearTimeout(t); };
  }, []);

  // Lados da tela (tela dividida): cada lado com a sua sequência.
  const lados = roteiro.reduce((m, sl) => Math.max(m, (sl.zona ?? 0) + 1), 1);
  const porLado = Array.from({ length: lados }, (_, z) => roteiro.filter((sl) => (sl.zona ?? 0) === z));

  const vertical = estado.tela?.orientacao === "vertical";
  // O palco e cada lado são contêineres: os tamanhos (cqh/cqw) seguem o
  // espaço real, girado ou não, inteiro ou dividido.
  const palco = girar
    ? { position: "fixed", top: "50%", left: "50%", width: "100vh", height: "100vw", transform: "translate(-50%, -50%) rotate(90deg)", containerType: "size" }
    : { position: "fixed", inset: 0, containerType: "size" };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white" style={{ cursor: cursor ? "default" : "none" }}>
      <FiltroNitidez />
      <div style={palco}>
        {estado.fase === "pareada" && roteiro.length > 0 && !estado.pausada && (
          <div key={assinaturaRef.current || "r"} className="flex h-full w-full">
            {porLado.map((slides, z) => (
              <div key={z} className="relative h-full min-w-0 flex-1 overflow-hidden" style={{ containerType: "size" }}>
                <Sequencia slides={slides} loja={estado.loja} vertical={vertical || lados > 1} aoMostrar={z === 0 ? aoMostrar : undefined} />
              </div>
            ))}
          </div>
        )}
        {estado.fase === "pareada" && (!roteiro.length || estado.pausada) && (
          <Espera titulo={estado.tela?.nome || "Tela"} texto={estado.pausada ? "Tela pausada no painel." : "Conectada. Escolha o conteúdo no painel do Héfisto."} />
        )}
        {estado.fase === "codigo" && <Codigo codigo={estado.codigo} />}
        {estado.fase === "iniciando" && <Espera titulo="Héfisto TV" texto="Conectando…" />}
        {estado.fase === "sem_rede" && <Espera titulo="Sem internet" texto="Confira o Wi-Fi da TV. Tentando de novo a cada 15 segundos." />}
      </div>
      {estado.fase === "pareada" && estado.online === false && (
        <span className="pointer-events-none fixed bottom-3 right-3 h-3 w-3 rounded-full bg-amber-500/80" title="Sem internet: tocando o último conteúdo" />
      )}
    </main>
  );
}

function Codigo({ codigo }) {
  const c = String(codigo || "");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[calc(1cqh*4)] bg-[#111] px-[calc(1cqw*6)] text-center">
      <p className="font-semibold uppercase tracking-[0.25em] text-[#c9a24d]" style={{ fontSize: "calc(1cqh * 2.4)" }}>Héfisto TV</p>
      <p className="text-white/80" style={{ fontSize: "calc(1cqh * 3)" }}>No painel do Héfisto, abra <b>Cardápio → Sinalização digital → Parear TV</b> e digite:</p>
      <p className="font-bold tracking-[0.3em] text-white tabular-nums" style={{ fontSize: "calc(1cqh * 16)", lineHeight: 1 }} data-codigo={c}>
        {c.split("").join(" ")}
      </p>
      <p className="text-white/50" style={{ fontSize: "calc(1cqh * 2.2)" }}>O código muda a cada 30 minutos. Pressione OK no controle para tela cheia.</p>
    </div>
  );
}

function Espera({ titulo, texto }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[calc(1cqh*2)] bg-[#111] px-[calc(1cqw*6)] text-center">
      <p className="font-semibold uppercase tracking-[0.25em] text-[#c9a24d]" style={{ fontSize: "calc(1cqh * 2.4)" }}>Héfisto TV</p>
      <p className="font-bold text-white" style={{ fontSize: "calc(1cqh * 5)" }}>{titulo}</p>
      <p className="text-white/60" style={{ fontSize: "calc(1cqh * 2.6)" }}>{texto}</p>
    </div>
  );
}
