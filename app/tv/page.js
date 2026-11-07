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
const INTERVALO_PAREADA = 30 * 1000;
const INTERVALO_CODIGO = 4 * 1000;
const SHA_LOCAL = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "";

const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem storage: segue */ } };

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
    <div className="flex h-full w-full flex-col bg-[#14110d] text-[#f6efe2]" style={{ padding: vertical ? "calc(var(--alt) * 6) calc(var(--larg) * 6)" : "calc(var(--alt) * 5) calc(var(--larg) * 5)" }}>
      <div className="flex items-end justify-between gap-6 border-b border-[#c9a24d]/40 pb-[calc(var(--alt)*2.5)]">
        <div className="min-w-0">
          <p className="truncate font-semibold uppercase tracking-[0.2em] text-[#c9a24d]" style={{ fontSize: vertical ? "calc(var(--larg) * 2.6)" : "calc(var(--alt) * 2.2)" }}>{pagina?.titulo}</p>
          <h1 className={`font-bold leading-tight ${vertical ? "" : "truncate"}`} style={{ fontSize: vertical ? "calc(var(--larg) * 7)" : "calc(var(--alt) * 6)" }}>{pagina?.categoria}</h1>
        </div>
        {loja && <p className="shrink-0 font-medium text-[#f6efe2]/60" style={{ fontSize: vertical ? "calc(var(--larg) * 2.6)" : "calc(var(--alt) * 2.2)" }}>{loja}</p>}
      </div>
      <ul className="mt-[calc(var(--alt)*3)] flex flex-1 flex-col justify-evenly">
        {itens.map((p, i) => (
          <li key={i} className="flex items-baseline gap-[calc(var(--larg)*2)]">
            <div className="min-w-0 max-w-[68%]">
              <p className="truncate font-semibold" style={{ fontSize: vertical ? "calc(var(--larg) * 4.4)" : "calc(var(--alt) * 3.8)" }}>{p.nome}</p>
              {p.descricao && <p className="truncate text-[#f6efe2]/60" style={{ fontSize: vertical ? "calc(var(--larg) * 2.6)" : "calc(var(--alt) * 2.2)" }}>{p.descricao}</p>}
            </div>
            <span className="mx-[calc(var(--larg)*1)] hidden flex-1 border-b-2 border-dotted border-[#f6efe2]/20 sm:block" aria-hidden />
            <div className="shrink-0 text-right">
              {p.preco_original && <p className="text-[#f6efe2]/50 line-through" style={{ fontSize: vertical ? "calc(var(--larg) * 2.6)" : "calc(var(--alt) * 2.2)" }}>{preco(p.preco_original)}</p>}
              <p className="font-bold tabular-nums text-[#e6c06a]" style={{ fontSize: vertical ? "calc(var(--larg) * 5)" : "calc(var(--alt) * 4.2)" }}>{preco(p.preco)}</p>
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={slide.chave} src={src} alt="" className="h-full w-full bg-black object-contain" onError={aoTerminar} />;
}

// ─── página ──────────────────────────────────────────────────────────────────
export default function PlayerTv() {
  const [estado, setEstado] = useState({ fase: "iniciando" });
  const [roteiro, setRoteiro] = useState([]);
  const [indice, setIndice] = useState(0);
  const [girar, setGirar] = useState(false);
  const segredoRef = useRef(null);
  const assinaturaRef = useRef(null);
  const pendenteRef = useRef(null); // roteiro novo, aplicado no fim do slide atual
  const roteiroRef = useRef([]);
  const indiceRef = useRef(0);
  const [cursor, setCursor] = useState(false);

  roteiroRef.current = roteiro;
  indiceRef.current = indice;

  const aplicarRoteiro = useCallback((novo) => {
    setRoteiro(novo);
    setIndice(0);
    limparCache(new Set(novo.map((s) => s.chave)));
    // Já baixa tudo em segundo plano: a próxima mídia entra sem tela preta.
    novo.forEach((s) => { if (s.url) midiaLocal(s); });
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
      const atual = roteiroRef.current[indiceRef.current];
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
        if (!roteiroRef.current.length || roteiroRef.current.length === 1) aplicarRoteiro(r.roteiro);
        else pendenteRef.current = r.roteiro;
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

  const proximo = useCallback(() => {
    if (pendenteRef.current) {
      const novo = pendenteRef.current;
      pendenteRef.current = null;
      aplicarRoteiro(novo);
      return;
    }
    setIndice((i) => (roteiroRef.current.length ? (i + 1) % roteiroRef.current.length : 0));
  }, [aplicarRoteiro]);

  // Tempo de cada slide (o vídeo avança sozinho no fim; o tempo é a rede de segurança).
  const slide = roteiro[indice] || null;
  useEffect(() => {
    if (!slide) return undefined;
    const extra = slide.tipo === "video" ? 5 : 0;
    const t = setTimeout(proximo, (slide.duracao_seg + extra) * 1000);
    return () => clearTimeout(t);
  }, [slide, indice, proximo]);

  // Roteiro de um slide só (uma arte fixa): troca quando chega roteiro novo.
  useEffect(() => {
    if (roteiro.length !== 1) return undefined;
    const t = setInterval(() => { if (pendenteRef.current) proximo(); }, 2000);
    return () => clearInterval(t);
  }, [roteiro.length, proximo]);

  const vertical = estado.tela?.orientacao === "vertical";
  // --alt / --larg = 1% da altura / largura do PALCO (girado ou não): o
  // cardápio vertical num TV Box horizontal sai com o tamanho certo.
  const palco = girar
    ? { position: "fixed", top: "50%", left: "50%", width: "100vh", height: "100vw", transform: "translate(-50%, -50%) rotate(90deg)", "--alt": "1vw", "--larg": "1vh" }
    : { position: "fixed", inset: 0, "--alt": "1vh", "--larg": "1vw" };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white" style={{ cursor: cursor ? "default" : "none" }}>
      <div style={palco}>
        {estado.fase === "pareada" && slide && !estado.pausada && (
          slide.tipo === "cardapio"
            ? <SlideCardapio pagina={slide.pagina} loja={estado.loja} vertical={vertical} />
            : <Midia slide={slide} aoTerminar={proximo} />
        )}
        {estado.fase === "pareada" && (!slide || estado.pausada) && (
          <Espera titulo={estado.tela?.nome || "Tela"} texto={estado.pausada ? "Tela pausada no painel." : "Conectada. Escolha o conteúdo no painel do Héfisto."} />
        )}
        {estado.fase === "codigo" && <Codigo codigo={estado.codigo} />}
        {estado.fase === "iniciando" && <Espera titulo="Héfisto TV" texto="Conectando…" />}
        {estado.fase === "sem_rede" && <Espera titulo="Sem internet" texto="Confira o Wi-Fi da TV. Tentando de novo a cada 30 segundos." />}
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-[calc(var(--alt)*4)] bg-[#111] px-[calc(var(--larg)*6)] text-center">
      <p className="font-semibold uppercase tracking-[0.25em] text-[#c9a24d]" style={{ fontSize: "calc(var(--alt) * 2.4)" }}>Héfisto TV</p>
      <p className="text-white/80" style={{ fontSize: "calc(var(--alt) * 3)" }}>No painel do Héfisto, abra <b>Cardápio → Sinalização digital → Parear TV</b> e digite:</p>
      <p className="font-bold tracking-[0.3em] text-white tabular-nums" style={{ fontSize: "calc(var(--alt) * 16)", lineHeight: 1 }} data-codigo={c}>
        {c.split("").join(" ")}
      </p>
      <p className="text-white/50" style={{ fontSize: "calc(var(--alt) * 2.2)" }}>O código muda a cada 30 minutos. Pressione OK no controle para tela cheia.</p>
    </div>
  );
}

function Espera({ titulo, texto }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[calc(var(--alt)*2)] bg-[#111] px-[calc(var(--larg)*6)] text-center">
      <p className="font-semibold uppercase tracking-[0.25em] text-[#c9a24d]" style={{ fontSize: "calc(var(--alt) * 2.4)" }}>Héfisto TV</p>
      <p className="font-bold text-white" style={{ fontSize: "calc(var(--alt) * 5)" }}>{titulo}</p>
      <p className="text-white/60" style={{ fontSize: "calc(var(--alt) * 2.6)" }}>{texto}</p>
    </div>
  );
}
