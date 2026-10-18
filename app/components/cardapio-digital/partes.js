"use client";

// Peças do cardápio digital: preço, selos, prato (lista e cartão), banner de
// abertura, folha (detalhe, pedido) e aviso rápido. Tudo recebe o cardápio já
// montado (app/lib/cardapio-digital.mjs) — nada aqui calcula preço.

import { useEffect, useRef, useState } from "react";
import { Plus, X, Play, ChevronRight } from "lucide-react";
import { SELOS, formatarPreco } from "../../lib/cardapio-digital.mjs";
import s from "./cardapio.module.css";

const ROTULO_SELO = Object.fromEntries(SELOS.map((x) => [x.id, x.rotulo]));

/** Foto que não carregou (link quebrado, sem internet) some — nunca ícone quebrado. */
export function Foto({ src, alt = "", fallback = null, ...resto }) {
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [src]);
  if (!src || erro) return fallback;
  return <img src={src} alt={alt} decoding="async" onError={() => setErro(true)} {...resto} />;
}

export function Preco({ produto }) {
  return (
    <>
      <span className={s.preco}>{formatarPreco(produto.preco)}</span>
      {produto.preco_original ? <span className={s.precoAntigo} aria-label={`antes ${formatarPreco(produto.preco_original)}`}>{formatarPreco(produto.preco_original)}</span> : null}
    </>
  );
}

export function Selos({ produto, promocao }) {
  if (!produto.selos.length && !promocao) return null;
  return (
    <span className={s.selos}>
      {promocao ? <span className={`${s.selo} ${s.seloPromo}`}>{promocao.rotulo || promocao.titulo}</span> : null}
      {produto.selos.map((id) => <span key={id} className={s.selo}>{ROTULO_SELO[id] || id}</span>)}
    </span>
  );
}

function BotaoMais({ produto, qtd, onAdicionar }) {
  return (
    <button type="button" className={s.mais} data-qtd={qtd || 0} onClick={() => onAdicionar(produto.id)}
      aria-label={qtd ? `Mais um ${produto.nome} (${qtd} no pedido)` : `Adicionar ${produto.nome}`}>
      {qtd ? qtd : <Plus size={20} strokeWidth={2.2} aria-hidden="true" />}
    </button>
  );
}

export function ItemLista({ produto, promocao, qtd, onAbrir, onAdicionar, podePedir }) {
  return (
    <li className={s.item}>
      <button type="button" className={s.itemAbrir} onClick={() => onAbrir(produto.id)}>
        <span className={s.itemNome}>{produto.nome}</span>
        {produto.descricao ? <span className={s.itemDescricao}>{produto.descricao}</span> : null}
        <span className={s.itemRodape}><Preco produto={produto} /><Selos produto={produto} promocao={promocao} /></span>
      </button>
      <span className={s.itemLado}>
        <Foto src={produto.imagem_url} className={s.itemFoto} loading="lazy" onClick={() => onAbrir(produto.id)} />
        {podePedir ? <BotaoMais produto={produto} qtd={qtd} onAdicionar={onAdicionar} /> : null}
      </span>
    </li>
  );
}

export function ItemCartao({ produto, promocao, qtd, onAbrir, onAdicionar, podePedir }) {
  return (
    <li className={s.cartao}>
      <Foto src={produto.imagem_url} className={s.cartaoFoto} loading="lazy" onClick={() => onAbrir(produto.id)} />
      <button type="button" className={s.itemAbrir} onClick={() => onAbrir(produto.id)}>
        <span className={s.itemNome}>{produto.nome}</span>
        {produto.descricao ? <span className={s.itemDescricao}>{produto.descricao}</span> : null}
        <Selos produto={produto} promocao={promocao} />
      </button>
      <span className={s.cartaoRodape}>
        <span className={s.itemRodape} style={{ marginTop: 0 }}><Preco produto={produto} /></span>
        {podePedir ? <BotaoMais produto={produto} qtd={qtd} onAdicionar={onAdicionar} /> : null}
      </span>
    </li>
  );
}

export function Miniatura({ produto, onAbrir }) {
  return (
    <button type="button" className={s.miniatura} onClick={() => onAbrir(produto.id)}>
      <Foto src={produto.imagem_url} className={s.miniaturaFoto} loading="lazy" fallback={<span className={s.miniaturaSemFoto}>{produto.nome}</span>} />
      {produto.imagem_url ? <span className={s.miniaturaNome}>{produto.nome}</span> : null}
      <span className={s.itemRodape} style={{ marginTop: 0 }}><Preco produto={produto} /></span>
    </button>
  );
}

const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Banner de abertura: fotos e vídeos do dono, com toque que leva a algum lugar. */
export function Abertura({ slides, onAcao, previa }) {
  const trilho = useRef(null);
  const videos = useRef({});
  const [atual, setAtual] = useState(0);
  const [pausadoAte, setPausadoAte] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);
  const [tocando, setTocando] = useState({});
  useEffect(() => { setSemMovimento(reduzMovimento()); }, []);

  const ir = (i) => {
    const el = trilho.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: semMovimento ? "auto" : "smooth" });
  };

  // Troca sozinha: foto a cada 6 s; vídeo quando acaba. Para quando o cliente
  // mexe, quando a aba some e para quem pediu menos movimento.
  useEffect(() => {
    if (slides.length < 2 || semMovimento) return;
    const slide = slides[atual];
    if (slide?.tipo === "video") return;
    const espera = Math.max(6000, pausadoAte - Date.now());
    const t = setTimeout(() => { if (!document.hidden) ir(atual + 1); }, espera);
    return () => clearTimeout(t);
  }, [atual, slides, pausadoAte, semMovimento]); // eslint-disable-line react-hooks/exhaustive-deps

  // Só o vídeo visível toca.
  useEffect(() => {
    slides.forEach((sl, i) => {
      const v = videos.current[sl.id];
      if (!v) return;
      if (i === atual && !semMovimento) { v.play?.().catch(() => {}); } else { v.pause?.(); }
    });
  }, [atual, slides, semMovimento]);

  const aoRolar = () => {
    const el = trilho.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== atual) setAtual(i);
  };

  // Girar o aparelho muda a largura: volta para o slide certo.
  useEffect(() => {
    const aoRedimensionar = () => { const el = trilho.current; if (el) el.scrollTo({ left: atual * el.clientWidth }); };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [atual]);

  if (!slides.length) return null;
  return (
    <section className={s.abertura} aria-roledescription="carrossel" aria-label="Destaques da casa">
      <div className={s.slides} ref={trilho} onScroll={aoRolar} onPointerDown={() => setPausadoAte(Date.now() + 10000)}>
        {slides.map((sl, i) => {
          const conteudo = (
            <>
              {sl.tipo === "video" ? (
                <video
                  ref={(el) => { videos.current[sl.id] = el; }}
                  src={sl.url}
                  poster={sl.poster_url || undefined}
                  muted
                  playsInline
                  preload={i === 0 ? "auto" : "metadata"}
                  loop={slides.length === 1}
                  onPlay={() => setTocando((t) => ({ ...t, [sl.id]: true }))}
                  onPause={() => setTocando((t) => ({ ...t, [sl.id]: false }))}
                  onEnded={() => { if (slides.length > 1) ir(i + 1); }}
                  aria-label={sl.titulo || "Vídeo da casa"}
                />
              ) : (
                <img src={sl.url} alt={sl.titulo || ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              )}
              {sl.titulo || sl.texto || sl.acao ? (
                <span className={s.slideTexto}>
                  {sl.titulo ? <span className={s.slideTitulo} style={{ display: "block" }}>{sl.titulo}</span> : null}
                  {sl.texto ? <span className={s.slideSub} style={{ display: "block" }}>{sl.texto}</span> : null}
                  {sl.acao ? <span className={s.slideAcao}>{sl.acao.tipo === "produto" ? "Ver o prato" : sl.acao.tipo === "promocao" ? "Ver a promoção" : "Ver a seção"} <ChevronRight size={16} aria-hidden="true" /></span> : null}
                </span>
              ) : null}
            </>
          );
          return sl.acao && !previa ? (
            <button key={sl.id} type="button" className={s.slide} onClick={() => onAcao(sl.acao)} aria-label={sl.titulo || "Abrir destaque"}>
              {conteudo}
            </button>
          ) : (
            <div key={sl.id} className={s.slide}>{conteudo}</div>
          );
        })}
      </div>
      {slides[atual]?.tipo === "video" && (semMovimento || !tocando[slides[atual].id]) ? (
        <button type="button" className={s.tocarVideo} aria-label="Tocar vídeo" onClick={() => videos.current[slides[atual].id]?.play?.().catch(() => {})}>
          <Play size={20} aria-hidden="true" />
        </button>
      ) : null}
      {slides.length > 1 ? (
        <div className={s.pontos}>
          {slides.map((sl, i) => (
            <button key={sl.id} type="button" className={s.ponto} aria-label={`Destaque ${i + 1} de ${slides.length}`}
              aria-current={i === atual ? "true" : undefined} onClick={() => { setPausadoAte(Date.now() + 10000); ir(i); }} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// Uma folha aberta trava a rolagem do fundo; várias (detalhe por cima da
// conversa) contam juntas.
let travas = 0;
export function travar() { travas++; document.body.style.overflow = "hidden"; }
export function soltar() { travas = Math.max(0, travas - 1); if (!travas) document.body.style.overflow = ""; }

export function Folha({ titulo, rotulo, onFechar, children, pe, classe = s.folha, semCabeca = false }) {
  const caixa = useRef(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    const anterior = document.activeElement;
    const tecla = (e) => { if (e.key === "Escape") fechar.current?.(); };
    document.addEventListener("keydown", tecla);
    travar();
    caixa.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", tecla);
      soltar();
      anterior?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <>
      <div className={s.veu} onClick={() => fechar.current?.()} aria-hidden="true" />
      <div className={classe} role="dialog" aria-modal="true" aria-label={rotulo || titulo} ref={caixa} tabIndex={-1}>
        {semCabeca ? null : (
          <div className={s.folhaCabeca}>
            <h2>{titulo}</h2>
            <button type="button" className={s.fechar} onClick={() => fechar.current?.()} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
          </div>
        )}
        {children}
        {pe ? <div className={s.folhaPe}>{pe}</div> : null}
      </div>
    </>
  );
}

export function Aviso({ aviso, onFechar }) {
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(onFechar, aviso.acao ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [aviso, onFechar]);
  if (!aviso) return null;
  return (
    <div className={s.toast} role="status" aria-live="polite">
      <span>{aviso.texto}</span>
      {aviso.acao ? <button type="button" onClick={() => { aviso.acao.fazer(); onFechar(); }}>{aviso.acao.rotulo}</button> : null}
    </div>
  );
}
