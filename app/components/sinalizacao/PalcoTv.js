"use client";

// PALCO DA TV — o que a TV mostra (Sinalização digital). Usado pelo player
// (/tv) e pela prévia do painel ("Ver como fica na TV"): os dois rodam o
// mesmo código, então a prévia é fiel ao que vai para a TV.
//
// Os tamanhos usam unidades de contêiner (cqh/cqw): o palco e cada lado
// são contêineres, e tudo se ajusta ao espaço real — TV inteira, girada,
// dividida ou a telinha da prévia.

import { useCallback, useEffect, useRef, useState } from "react";
import { ajusteAutomatico, transicaoDaTroca } from "../../lib/sinalizacao.mjs";

// Realce das fotos na TV (pedido do dono, 07/11/2026: "mais bonita, mais nítida,
// mais viva"): cores um pouco mais vivas, contraste leve e nitidez suave.
// Só na exibição: o arquivo original no acervo não muda. Vídeo fica de fora
// (filtro em vídeo pesa na TV).
export const REALCE = "saturate(1.15) contrast(1.06) brightness(1.02) url(#hefisto-nitidez)";

export function FiltroNitidez() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="hefisto-nitidez" colorInterpolationFilters="sRGB">
        <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0" />
      </filter>
    </svg>
  );
}

export const preco = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export function SlideCardapio({ pagina, loja, vertical }) {
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

function Midia({ slide, aoTerminar, carregar }) {
  const [src, setSrc] = useState(null);
  // Automático: começa como "inteira" e decide pela medida real da arte e da área.
  const [decidido, setDecidido] = useState(null);
  const caixa = useRef(null);
  useEffect(() => {
    let vivo = true;
    setSrc(null);
    setDecidido(null);
    Promise.resolve(carregar ? carregar(slide) : slide.url).then((u) => { if (vivo) setSrc(u); });
    return () => { vivo = false; };
  }, [slide, carregar]);
  const medir = useCallback((largura, altura) => {
    const area = caixa.current;
    if (area) setDecidido(ajusteAutomatico(largura, altura, area.clientWidth, area.clientHeight));
  }, []);
  // Carregando: transparente, para a transição não piscar preto por cima do slide anterior.
  if (!src) return <div className="h-full w-full" />;
  const pedido = slide.ajuste || "auto";
  const ajuste = pedido === "auto" ? decidido || "inteira" : pedido;
  if (slide.tipo === "video") {
    // Vídeo: inteira ou preencher (dividir em dois tocaria o vídeo duas vezes: pesa na TV).
    return (
      <div ref={caixa} className="h-full w-full bg-black">
        <video key={slide.chave} src={src} className={`h-full w-full bg-black ${ajuste === "inteira" ? "object-contain" : "object-cover"}`}
          autoPlay muted playsInline onEnded={aoTerminar} onError={aoTerminar}
          onLoadedMetadata={(e) => medir(e.currentTarget.videoWidth, e.currentTarget.videoHeight)} />
      </div>
    );
  }
  if (ajuste === "dividir") {
    // Metade de cima à esquerda, metade de baixo à direita: a foto em pé vira
    // duas e enche a TV deitada sem nada desfocado.
    return (
      <div key={slide.chave} className="flex h-full w-full bg-black">
        {["top", "bottom"].map((lado) => (
          <div key={lado} className="relative h-full min-w-0 flex-1 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute left-0 h-[200%] w-full object-cover"
              style={{ filter: REALCE, top: lado === "top" ? 0 : "auto", bottom: lado === "bottom" ? 0 : "auto", objectPosition: `center ${lado}` }}
              onError={aoTerminar} />
          </div>
        ))}
      </div>
    );
  }
  // Inteira: a arte toda; o fundo é a própria arte ampliada e desfocada (sem faixa preta).
  // Preencher: a mesma foto cobrindo a área toda, sem fundo.
  const cheia = ajuste === "preencher";
  return (
    <div ref={caixa} key={slide.chave} className="relative h-full w-full overflow-hidden bg-black">
      {!cheia && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`relative h-full w-full ${cheia ? "object-cover" : "object-contain"}`} style={{ filter: REALCE }}
        onError={aoTerminar} onLoad={(e) => medir(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />
    </div>
  );
}

/**
 * Animações das transições (o slide que ENTRA traz o efeito, como no
 * PowerPoint). "entra" anima a camada nova; "sai", a que está indo embora.
 * Tudo em transform/opacity/clip-path/mask: a GPU da TV dá conta.
 */
const ANIMACOES = {
  esmaecer: { entra: "hf-tr-esmaecer" },
  empurrar: { entra: "hf-tr-entra-direita", sai: "hf-tr-sai-esquerda" },
  cobrir: { entra: "hf-tr-entra-direita" },
  revelar: { entra: "hf-tr-revelar" },
  dividir: { entra: "hf-tr-dividir" },
  forma: { entra: "hf-tr-forma" },
  persianas: { entra: "hf-tr-persianas" },
  cubo: { entra: "hf-tr-cubo-entra", sai: "hf-tr-cubo-sai", palco3d: true },
  zoom: { entra: "hf-tr-zoom-entra", sai: "hf-tr-zoom-sai" },
};

const CSS_TRANSICOES = `
@property --hf-persiana { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
@keyframes hf-tr-esmaecer { from { opacity: 0 } to { opacity: 1 } }
@keyframes hf-tr-entra-direita { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes hf-tr-sai-esquerda { from { transform: translateX(0) } to { transform: translateX(-100%) } }
@keyframes hf-tr-revelar { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes hf-tr-dividir { from { clip-path: inset(0 50% 0 50%) } to { clip-path: inset(0 0 0 0) } }
@keyframes hf-tr-forma { from { clip-path: circle(0% at 50% 50%) } to { clip-path: circle(75% at 50% 50%) } }
@keyframes hf-tr-persianas { from { --hf-persiana: 0% } to { --hf-persiana: 10% } }
@keyframes hf-tr-cubo-entra {
  from { transform: translateZ(-50cqw) rotateY(90deg) translateZ(50cqw) }
  to { transform: translateZ(-50cqw) rotateY(0deg) translateZ(50cqw) } }
@keyframes hf-tr-cubo-sai {
  from { transform: translateZ(-50cqw) rotateY(0deg) translateZ(50cqw) }
  to { transform: translateZ(-50cqw) rotateY(-90deg) translateZ(50cqw) } }
@keyframes hf-tr-zoom-entra { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
@keyframes hf-tr-zoom-sai { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.25) } }
.hf-tr-persianas {
  -webkit-mask-image: repeating-linear-gradient(to right, #000 0 var(--hf-persiana), transparent var(--hf-persiana) 10%);
  mask-image: repeating-linear-gradient(to right, #000 0 var(--hf-persiana), transparent var(--hf-persiana) 10%);
}
`;

/** As animações das transições (uma vez por palco; repetir não faz mal). */
export function EstilosTransicao() {
  return <style>{CSS_TRANSICOES}</style>;
}

function conteudoDoSlide(slide, { loja, vertical, carregar, aoTerminar }) {
  return slide.tipo === "cardapio"
    ? <SlideCardapio pagina={slide.pagina} loja={loja} vertical={vertical} />
    : <Midia slide={slide} aoTerminar={aoTerminar} carregar={carregar} />;
}

/**
 * Um lado da tela tocando a sua sequência, com os seus tempos. Tela inteira
 * = um lado só. `aoMostrar` conta ao painel o que está passando (lado 1).
 * Na troca ficam duas camadas: a que sai (mesmo elemento, sem recarregar a
 * foto nem reiniciar o vídeo) e a que entra, com a transição do slide novo.
 */
export function Sequencia({ slides, loja, vertical, aoMostrar, carregar }) {
  const total = slides.length;
  const [camadas, setCamadas] = useState([{ id: 0, i: 0, efeito: "nenhuma", ms: 0 }]);
  const atual = camadas[camadas.length - 1];
  const slide = total ? slides[atual.i % total] : null;
  const proximo = useCallback(() => setCamadas((cs) => {
    if (!total) return cs;
    const cur = cs[cs.length - 1];
    const i = (cur.i + 1) % total;
    // Um slide só (vídeo em repetição): recomeça sem transição.
    const { efeito, ms } = total > 1 ? transicaoDaTroca(slides[i]) : { efeito: "nenhuma", ms: 0 };
    const nova = { id: cur.id + 1, i, efeito, ms };
    return ms > 0 ? [cur, nova] : [nova];
  }), [slides, total]);
  useEffect(() => { aoMostrar?.(slide); }, [slide, aoMostrar]);
  // Fim da transição: a camada que saiu é descartada.
  useEffect(() => {
    if (camadas.length < 2) return undefined;
    const t = setTimeout(() => setCamadas((cs) => cs.slice(-1)), atual.ms + 80);
    return () => clearTimeout(t);
  }, [camadas.length, atual.id, atual.ms]);
  // Tempo de cada slide (o vídeo avança sozinho no fim; o tempo é a rede de segurança).
  useEffect(() => {
    if (!slide || (total < 2 && slide.tipo !== "video")) return undefined;
    const extra = slide.tipo === "video" ? 5 : 0;
    const t = setTimeout(proximo, (slide.duracao_seg + extra) * 1000);
    return () => clearTimeout(t);
  }, [slide, atual.id, proximo, total]);
  if (!slide) return <div className="h-full w-full bg-black" />;
  const anim = camadas.length > 1 ? ANIMACOES[atual.efeito] || {} : {};
  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={anim.palco3d ? { perspective: "150cqw" } : undefined}>
      {camadas.map((c, k) => {
        const entrando = k === camadas.length - 1;
        const nome = entrando ? anim.entra : anim.sai;
        const estilo = {
          zIndex: entrando ? 2 : 1,
          ...(nome ? { animation: `${nome} ${atual.ms}ms cubic-bezier(.4,0,.2,1) both` } : {}),
          ...(anim.palco3d ? { backfaceVisibility: "hidden" } : {}),
        };
        return (
          <div key={c.id} className={`absolute inset-0 ${nome === "hf-tr-persianas" ? nome : ""}`} style={estilo}>
            {conteudoDoSlide(slides[c.i % total], { loja, vertical, carregar, aoTerminar: entrando ? proximo : undefined })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * O palco inteiro: divide em lados (tela dividida) e cada lado toca a sua
 * sequência. `carregar(slide)` devolve a URL a usar (a TV usa o cache local;
 * a prévia usa a URL assinada direto).
 */
export function Palco({ roteiro = [], loja = null, vertical = false, carregar, aoMostrar, chave }) {
  const lados = roteiro.reduce((m, sl) => Math.max(m, (sl.zona ?? 0) + 1), 1);
  const porLado = Array.from({ length: lados }, (_, z) => roteiro.filter((sl) => (sl.zona ?? 0) === z));
  return (
    <div key={chave || "palco"} className="flex h-full w-full">
      <EstilosTransicao />
      {porLado.map((slides, z) => (
        <div key={z} className="relative h-full min-w-0 flex-1 overflow-hidden" style={{ containerType: "size" }}>
          <Sequencia slides={slides} loja={loja} vertical={vertical || lados > 1} aoMostrar={z === 0 ? aoMostrar : undefined} carregar={carregar} />
        </div>
      ))}
    </div>
  );
}

/**
 * Miniatura animada do efeito (como a prévia do PowerPoint ao escolher a
 * transição): dois cartões trocando com o efeito e a velocidade escolhidos.
 */
export function DemoTransicao({ transicao, velocidade, className = "" }) {
  const [passo, setPasso] = useState({ n: 0, efeito: "nenhuma", ms: 0 });
  useEffect(() => {
    const trocar = () => setPasso((p) => ({ n: p.n + 1, ...transicaoDaTroca({ transicao, velocidade }) }));
    trocar();
    const t = setInterval(trocar, 2200);
    return () => clearInterval(t);
  }, [transicao, velocidade]);
  const anim = ANIMACOES[passo.efeito] || {};
  const cartoes = [passo.n - 1, passo.n];
  const cor = (n) => (n % 2 ? "from-amber-500 to-rose-600" : "from-sky-500 to-emerald-600");
  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg bg-black ${className}`} style={{ containerType: "size", ...(anim.palco3d ? { perspective: "150cqw" } : {}) }} aria-hidden>
      <EstilosTransicao />
      {cartoes.map((n, k) => {
        const entrando = k === 1;
        const nome = entrando ? anim.entra : anim.sai;
        return (
          <div key={n} className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br text-[18cqh] font-black text-white ${cor(n)} ${nome === "hf-tr-persianas" ? nome : ""}`}
            style={{ zIndex: entrando ? 2 : 1, ...(nome ? { animation: `${nome} ${passo.ms}ms cubic-bezier(.4,0,.2,1) both` } : {}), ...(anim.palco3d ? { backfaceVisibility: "hidden" } : {}) }}>
            {n % 2 ? "B" : "A"}
          </div>
        );
      })}
    </div>
  );
}
