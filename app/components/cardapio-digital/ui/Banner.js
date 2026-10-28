"use client";

import Link from "next/link";
import { palavraDesconto } from "../../../lib/cardapio-visual.mjs";
import Icone from "./Icone";
import useMovimentoReduzido from "./useMovimentoReduzido";
import s from "./ui.module.css";

// Banners do cardápio digital.
//   BannerVerde     — degradê verde com círculos que flutuam devagar e um brilho
//                     que passa (9L). Os enfeites param com "reduzir movimento".
//   ConviteDesconto — o convite "Cadastre-se e ganhe 10% de DESCONTO", no jeito
//                     do tablet (deitado, 92 px) ou do celular (136 px).
//   BannerMidia     — foto ou vídeo da casa com a faixa cinza por cima (texto
//                     branco) e os pontinhos do carrossel.

export function BannerVerde({ href, as, className = "", style, children, ...resto }) {
  const Tag = as || (href ? (href.startsWith("/") ? Link : "a") : "div");
  return (
    <Tag className={`${s.banner} ${href || resto.onClick ? s.pressiona : ""} ${className}`} style={style} {...(href ? { href } : {})} {...resto}>
      <span aria-hidden="true" className={s.enfeites}>
        <span className={s.anelA} />
        <span className={s.anelB} />
        <span className={s.anelC} />
        <span className={s.reflexo} />
      </span>
      {children}
    </Tag>
  );
}

/**
 * Convite do cadastro. Os textos vêm da configuração da fidelidade (percentual
 * e regra de pontos); aqui só o desenho. `layout`: "tablet" ou "celular".
 */
export function ConviteDesconto({
  layout = "tablet", percentual, rotulo = "PARA QUEM É DA CASA", titulo = "Cadastre-se e ganhe", texto, acao = "Quero",
  idioma = "pt", href, onClick, rotuloAcessivel, className = "",
}) {
  const desconto = idioma === "pt" ? `DE ${palavraDesconto(idioma)}` : palavraDesconto(idioma);
  const celular = layout === "celular";
  return (
    <BannerVerde
      href={href}
      onClick={onClick}
      aria-label={rotuloAcessivel}
      className={`${celular ? s.conviteCelular : s.conviteTablet} ${className}`}
    >
      {celular ? (
        <div className={s.conviteChamada}>
          <span className={s.conviteRotulo}>{rotulo}</span>
          <span className={s.conviteTitulo}>{titulo}</span>
          <span className={s.conviteValor}>
            <span className={s.convitePct}>{percentual}</span>
            <span className={s.conviteDesconto}>{desconto}</span>
          </span>
          {texto ? <span className={s.conviteTexto}>{texto}</span> : null}
        </div>
      ) : (
        <>
          <span className={s.conviteChamada}>
            <span className={s.conviteRotulo}>{rotulo}</span>
            <span className={s.conviteTitulo}>{titulo}</span>
          </span>
          <span className={s.conviteValor}>
            <span className={s.convitePct}>{percentual}</span>
            <span className={s.conviteDesconto}>{desconto}</span>
          </span>
          <span className={s.conviteTexto}>{texto}</span>
        </>
      )}
      <span className={s.conviteAcao}>
        {acao}
        <Icone nome="seta" tamanho={celular ? 14 : 16} traco={2.6} />
      </span>
    </BannerVerde>
  );
}

/**
 * Foto ou vídeo em destaque (vídeo sem som, em loop). Com "reduzir movimento"
 * o vídeo não toca sozinho: fica o pôster. Sem mídia, mostra o espaço cinza
 * com o aviso `vazio` (o painel avisa que falta foto).
 */
export function BannerMidia({
  etiqueta, titulo, texto, midia, altura = 180, total = 0, atual = 0, vazio = "Sem foto ou vídeo", zoomLento = true,
  rotulo = "Destaque da casa", className = "",
}) {
  const reduzido = useMovimentoReduzido();
  return (
    <section aria-label={rotulo} className={`${s.midia} ${className}`} style={{ height: altura }}>
      {midia?.tipo === "video" ? (
        <video
          className={s.midiaConteudo}
          src={midia.url}
          poster={midia.poster || undefined}
          muted
          loop
          playsInline
          autoPlay={!reduzido}
          preload="metadata"
        />
      ) : midia?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`${s.midiaConteudo} ${zoomLento ? s.zoomLento : ""}`} src={midia.url} alt={midia.alt || ""} />
      ) : (
        <div className={`${s.midiaVazia} ${zoomLento ? s.zoomLento : ""}`}>
          <Icone nome="video" tamanho={44} traco={1.5} />
          {vazio}
        </div>
      )}
      {titulo || etiqueta || texto ? (
        <div className={s.faixa}>
          <div className={s.faixaTextos}>
            {etiqueta ? <span className={s.faixaEtiqueta}>{etiqueta}</span> : null}
            {titulo ? <span className={s.faixaTitulo}>{titulo}</span> : null}
            {texto ? <span className={s.faixaTexto}>{texto}</span> : null}
          </div>
          {total > 1 ? <Pontos total={total} atual={atual} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Pontinhos de "onde estou" no carrossel (o atual é maior e verde). */
export function Pontos({ total, atual = 0, claro = false, centro = false }) {
  return (
    <div className={`${s.pontos} ${centro ? s.pontosCentro : ""}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`${s.ponto} ${claro ? s.pontoClaro : ""} ${i === atual ? s.pontoAtivo : ""}`} />
      ))}
    </div>
  );
}
