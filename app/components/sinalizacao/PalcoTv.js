"use client";

// PALCO DA TV — o que a TV mostra (Sinalização digital). Usado pelo player
// (/tv) e pela prévia do painel ("Ver como fica na TV"): os dois rodam o
// mesmo código, então a prévia é fiel ao que vai para a TV.
//
// Os tamanhos usam unidades de contêiner (cqh/cqw): o palco e cada lado
// são contêineres, e tudo se ajusta ao espaço real — TV inteira, girada,
// dividida ou a telinha da prévia.

import { useCallback, useEffect, useState } from "react";

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
  useEffect(() => {
    let vivo = true;
    setSrc(null);
    Promise.resolve(carregar ? carregar(slide) : slide.url).then((u) => { if (vivo) setSrc(u); });
    return () => { vivo = false; };
  }, [slide, carregar]);
  if (!src) return <div className="h-full w-full bg-black" />;
  const ajuste = slide.ajuste || "inteira";
  if (slide.tipo === "video") {
    // Vídeo: inteira ou preencher (dividir em dois tocaria o vídeo duas vezes: pesa na TV).
    return (
      <video key={slide.chave} src={src} className={`h-full w-full bg-black ${ajuste === "inteira" ? "object-contain" : "object-cover"}`}
        autoPlay muted playsInline onEnded={aoTerminar} onError={aoTerminar} />
    );
  }
  if (ajuste === "preencher") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img key={slide.chave} src={src} alt="" className="h-full w-full bg-black object-cover" style={{ filter: REALCE }} onError={aoTerminar} />;
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
export function Sequencia({ slides, loja, vertical, aoMostrar, carregar }) {
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
    : <Midia slide={slide} aoTerminar={proximo} carregar={carregar} />;
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
      {porLado.map((slides, z) => (
        <div key={z} className="relative h-full min-w-0 flex-1 overflow-hidden" style={{ containerType: "size" }}>
          <Sequencia slides={slides} loja={loja} vertical={vertical || lados > 1} aoMostrar={z === 0 ? aoMostrar : undefined} carregar={carregar} />
        </div>
      ))}
    </div>
  );
}
