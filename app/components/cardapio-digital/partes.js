"use client";

// Peças do cardápio digital: foto, preço, selos, prato (lista e cartão),
// banner de abertura, folha (detalhe, pedido, idiomas) e aviso rápido. Tudo
// recebe o cardápio já montado e no idioma do cliente — nada aqui calcula
// preço nem traduz conteúdo.

import { useEffect, useRef, useState } from "react";
import { Plus, X, Play, ChevronRight, Stamp } from "lucide-react";
import { formatarPreco, rotuloSelo } from "../../lib/cardapio-digital.mjs";
import { t } from "../../lib/cardapio-idiomas.mjs";
import s from "./cardapio.module.css";

/** Foto que não carregou (link quebrado, sem internet) some — nunca ícone quebrado. */
export function Foto({ src, alt = "", fallback = null, ...resto }) {
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [src]);
  if (!src || erro) return fallback;
  return <img src={src} alt={alt} decoding="async" onError={() => setErro(true)} {...resto} />;
}

export function Preco({ produto, idioma }) {
  return (
    <>
      {produto.preco_original ? <span className={s.precoAntigo} aria-label={t(idioma, "antes_preco", { valor: formatarPreco(produto.preco_original, idioma) })}>{formatarPreco(produto.preco_original, idioma)}</span> : null}
      <span className={s.preco}>{formatarPreco(produto.preco, idioma)}</span>
    </>
  );
}

export function Selos({ produto, promocao, idioma, cartoes = [] }) {
  if (!produto.selos.length && !promocao && !cartoes.length) return null;
  return (
    <span className={s.selos}>
      {promocao ? <span className={`${s.selo} ${s.seloPromo}`}>{promocao.rotulo || promocao.titulo}</span> : null}
      {cartoes.map((c) => (
        <span key={c.id} className={`${s.selo} ${s.seloFid}`} title={t(idioma, "fid_selo_prato", { cartao: c.nome })}>
          <Stamp size={12} aria-hidden="true" /> {c.nome}
        </span>
      ))}
      {produto.selos.map((id) => <span key={id} className={s.selo}>{rotuloSelo(id, idioma)}</span>)}
    </span>
  );
}

function Nome({ produto }) {
  return (
    <>
      <span className={s.itemNome}>{produto.nome}</span>
      {produto.nome_original ? <span className={s.nomeOriginal} lang="pt-BR">{produto.nome_original}</span> : null}
    </>
  );
}

function BotaoMais({ produto, qtd, onAdicionar, idioma, comTexto }) {
  return (
    <button type="button" className={`${s.mais} ${comTexto ? s.maisTexto : ""}`} data-qtd={qtd || 0} onClick={() => onAdicionar(produto.id)}
      aria-label={qtd ? t(idioma, "mais_prato", { prato: produto.nome, n: qtd }) : t(idioma, "adicionar_prato", { prato: produto.nome })}>
      {qtd ? <span key={qtd} className={s.maisQtd}>{qtd}</span> : <Plus size={20} strokeWidth={2.2} aria-hidden="true" />}
      {comTexto ? <span className={s.maisRotulo}>{t(idioma, "adicionar")}</span> : null}
    </button>
  );
}

// Prato em lista. No delivery a foto fica à direita com o "+" em cima dela;
// na mesa (tablet) vira cartão: foto à esquerda, texto, botão "Adicionar".
export function ItemLista({ produto, promocao, qtd, onAbrir, onAdicionar, podePedir, idioma, comTexto, cartoes }) {
  const [semFoto, setSemFoto] = useState(false);
  const temFoto = Boolean(produto.imagem_url) && !semFoto;
  return (
    <li className={`${s.item} ${temFoto ? s.temFoto : ""}`}>
      <button type="button" className={s.itemAbrir} onClick={() => onAbrir(produto.id)}>
        <Nome produto={produto} />
        {produto.descricao ? <span className={s.itemDescricao}>{produto.descricao}</span> : null}
        <span className={s.itemRodape}><Preco produto={produto} idioma={idioma} /><Selos produto={produto} promocao={promocao} idioma={idioma} cartoes={cartoes} /></span>
      </button>
      <span className={s.itemLado}>
        {temFoto ? <img src={produto.imagem_url} className={s.itemFoto} loading="lazy" decoding="async" alt="" onClick={() => onAbrir(produto.id)} onError={() => setSemFoto(true)} /> : null}
        {podePedir ? <BotaoMais produto={produto} qtd={qtd} onAdicionar={onAdicionar} idioma={idioma} comTexto={comTexto} /> : null}
      </span>
    </li>
  );
}

export function ItemCartao({ produto, promocao, qtd, onAbrir, onAdicionar, podePedir, idioma, comTexto, cartoes }) {
  return (
    <li className={s.cartao}>
      <Foto src={produto.imagem_url} className={s.cartaoFoto} loading="lazy" onClick={() => onAbrir(produto.id)} alt="" />
      <button type="button" className={s.itemAbrir} onClick={() => onAbrir(produto.id)}>
        <Nome produto={produto} />
        {produto.descricao ? <span className={s.itemDescricao}>{produto.descricao}</span> : null}
        <Selos produto={produto} promocao={promocao} idioma={idioma} cartoes={cartoes} />
      </button>
      <span className={s.cartaoRodape}>
        <span className={s.itemRodape} style={{ marginTop: 0 }}><Preco produto={produto} idioma={idioma} /></span>
        {podePedir ? <BotaoMais produto={produto} qtd={qtd} onAdicionar={onAdicionar} idioma={idioma} comTexto={comTexto} /> : null}
      </span>
    </li>
  );
}

export function Miniatura({ produto, onAbrir, idioma, icone = null }) {
  return (
    <button type="button" className={s.miniatura} onClick={() => onAbrir(produto.id)}>
      <Foto src={produto.imagem_url} className={s.miniaturaFoto} loading="lazy" fallback={<span className={s.miniaturaSemFoto}>{icone ? <span className={s.miniaturaIcone}>{icone}</span> : null}<span>{produto.nome}</span></span>} />
      {produto.imagem_url ? <span className={s.miniaturaNome}>{produto.nome}</span> : null}
      <span className={s.itemRodape} style={{ marginTop: 0 }}><Preco produto={produto} idioma={idioma} /></span>
    </button>
  );
}

const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Banner de abertura: fotos e vídeos do dono, com toque que leva a algum lugar. */
// `segundos` em cada banner e `porVez` banners lado a lado (o dono escolhe na
// Abertura). No celular (tela estreita) passa um de cada vez.
export function Abertura({ slides, onAcao, previa, idioma, classe = "", segundos = 6, porVez = 1 }) {
  const trilho = useRef(null);
  const videos = useRef({});
  const [atual, setAtual] = useState(0);
  const [pausadoAte, setPausadoAte] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);
  const [tocando, setTocando] = useState({});
  const [estreita, setEstreita] = useState(false);
  useEffect(() => { setSemMovimento(reduzMovimento()); }, []);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 699px)");
    const ver = () => setEstreita(m.matches);
    ver();
    m.addEventListener?.("change", ver);
    return () => m.removeEventListener?.("change", ver);
  }, []);
  const juntos = estreita ? 1 : Math.max(1, Math.min(3, Math.round(porVez) || 1, slides.length || 1));
  const ultimo = Math.max(0, slides.length - juntos);
  const passo = (el) => el.clientWidth / juntos;

  const ir = (i) => {
    const el = trilho.current;
    if (!el) return;
    const n = i > ultimo ? 0 : i < 0 ? ultimo : i;
    el.scrollTo({ left: n * passo(el), behavior: semMovimento ? "auto" : "smooth" });
  };

  // Troca sozinha: foto a cada `segundos`; vídeo quando acaba. Para quando o cliente
  // mexe, quando a aba some e para quem pediu menos movimento.
  useEffect(() => {
    if (slides.length <= juntos || semMovimento) return;
    const slide = slides[atual];
    if (slide?.tipo === "video" && juntos === 1) return;
    const espera = Math.max(Math.max(2, segundos) * 1000, pausadoAte - Date.now());
    const tm = setTimeout(() => { if (!document.hidden) ir(atual + 1); }, espera);
    return () => clearTimeout(tm);
  }, [atual, slides, pausadoAte, semMovimento, segundos, juntos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Só o vídeo visível toca.
  useEffect(() => {
    slides.forEach((sl, i) => {
      const v = videos.current[sl.id];
      if (!v) return;
      if (i >= atual && i < atual + juntos && !semMovimento) { v.play?.().catch(() => {}); } else { v.pause?.(); }
    });
  }, [atual, slides, semMovimento, juntos]);

  const aoRolar = () => {
    const el = trilho.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / passo(el));
    if (i !== atual) setAtual(i);
  };

  // Girar o aparelho muda a largura: volta para o slide certo.
  useEffect(() => {
    const aoRedimensionar = () => { const el = trilho.current; if (el) el.scrollTo({ left: Math.min(atual, ultimo) * passo(el) }); };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [atual, juntos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slides.length) return null;
  const rotuloAcao = (a) => t(idioma, a.tipo === "produto" ? "ver_prato" : a.tipo === "promocao" ? "ver_promocao" : "ver_secao");
  return (
    <section className={`${s.abertura} ${classe}`} aria-roledescription="carousel" aria-label={t(idioma, "destaques_casa")}>
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
                  onPlay={() => setTocando((x) => ({ ...x, [sl.id]: true }))}
                  onPause={() => setTocando((x) => ({ ...x, [sl.id]: false }))}
                  onEnded={() => { if (slides.length > 1) ir(i + 1); }}
                  aria-label={sl.titulo || t(idioma, "tocar_video")}
                />
              ) : (
                <img src={sl.url} alt={sl.titulo || ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              )}
              {sl.titulo || sl.texto || sl.acao ? (
                <span className={s.slideTexto}>
                  {sl.titulo ? <span className={s.slideTitulo} style={{ display: "block" }}>{sl.titulo}</span> : null}
                  {sl.texto ? <span className={s.slideSub} style={{ display: "block" }}>{sl.texto}</span> : null}
                  {sl.acao ? <span className={s.slideAcao}>{rotuloAcao(sl.acao)} <ChevronRight size={16} aria-hidden="true" /></span> : null}
                </span>
              ) : null}
            </>
          );
          return sl.acao && !previa ? (
            <button key={sl.id} type="button" className={s.slide} style={juntos > 1 ? { flex: `0 0 calc(${100 / juntos}% - ${((juntos - 1) * 10) / juntos}px)`, marginRight: 10, borderRadius: 14, overflow: "hidden" } : undefined} data-ativo={i === atual ? "true" : undefined} onClick={() => onAcao(sl.acao)} aria-label={sl.titulo || rotuloAcao(sl.acao)}>
              {conteudo}
            </button>
          ) : (
            <div key={sl.id} className={s.slide} style={juntos > 1 ? { flex: `0 0 calc(${100 / juntos}% - ${((juntos - 1) * 10) / juntos}px)`, marginRight: 10, borderRadius: 14, overflow: "hidden" } : undefined} data-ativo={i === atual ? "true" : undefined}>{conteudo}</div>
          );
        })}
      </div>
      {slides[atual]?.tipo === "video" && (semMovimento || !tocando[slides[atual].id]) ? (
        <button type="button" className={s.tocarVideo} aria-label={t(idioma, "tocar_video")} onClick={() => videos.current[slides[atual].id]?.play?.().catch(() => {})}>
          <Play size={20} aria-hidden="true" />
        </button>
      ) : null}
      {slides.length > juntos ? (
        <div className={s.pontos}>
          {slides.slice(0, ultimo + 1).map((sl, i) => (
            <button key={sl.id} type="button" className={s.ponto} aria-label={t(idioma, "destaque_n", { i: i + 1, n: slides.length })}
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

export function Folha({ titulo, rotulo, onFechar, children, pe, classe = s.folha, semCabeca = false, idioma = "pt" }) {
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
            <button type="button" className={s.fechar} onClick={() => fechar.current?.()} aria-label={t(idioma, "fechar")}><X size={20} aria-hidden="true" /></button>
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
    const tm = setTimeout(onFechar, aviso.acao ? 5000 : 3000);
    return () => clearTimeout(tm);
  }, [aviso, onFechar]);
  if (!aviso) return null;
  return (
    <div className={s.toast} role="status" aria-live="polite">
      <span>{aviso.texto}</span>
      {aviso.acao ? <button type="button" onClick={() => { aviso.acao.fazer(); onFechar(); }}>{aviso.acao.rotulo}</button> : null}
    </div>
  );
}
