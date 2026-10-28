import { carrosselAnda, duracaoDoCarrossel } from "../../../lib/cardapio-visual.mjs";
import Card from "./Card";
import { Etiqueta } from "./Chip";
import Preco from "./Preco";
import s from "./ui.module.css";

// Carrossel "Agora na casa" (9C.2, 3.5): promoções e pratos do momento passando
// sozinhos, sem parar. Para quando o cliente toca (ou foca pelo teclado) e dá
// para arrastar com o dedo. A lista vai duas vezes para emendar sem pulo; a
// cópia é escondida do leitor de tela e some com "reduzir movimento" (aí o
// carrossel fica parado e rolável). Com menos de 3 cards não anda.
//
// `variante`: "tablet" (card deitado de 300 px) ou "celular" (card em pé de
// 168 px com foto). `sangria`: o carrossel encosta na borda da tela,
// atravessando o respiro lateral da página (20 px no tablet, 16 no celular).

const LARGURA = { tablet: 312, celular: 180 };

export default function CarrosselAgora({
  titulo = "Agora na casa", nota, link, itens = [], variante = "tablet", sangria, idioma = "pt", className = "",
}) {
  if (!itens.length) return null;
  const celular = variante === "celular";
  const borda = sangria ?? (celular ? 16 : 20);
  const anda = carrosselAnda(itens.length);
  const caixa = celular
    ? { margin: `0 -${borda}px`, padding: `6px 0 16px ${borda}px` }
    : { margin: `-6px -${borda}px -14px`, padding: `6px 0 14px ${borda}px` };
  const cartao = (item, i, copia) => (
    <CardAgora key={`${copia ? "c" : "o"}${item.id ?? i}`} {...item} variante={variante} idioma={idioma} copia={copia} />
  );
  return (
    <section aria-label={titulo} className={`${s.secao} ${className}`} style={celular ? { gap: 6 } : undefined}>
      <div className={s.secaoCabecalho}>
        <h2 className={s.secaoTitulo}>{titulo}</h2>
        {link ? <a href={link.href} className={s.secaoLink}>{link.rotulo}</a> : nota ? <span className={s.secaoNota}>{nota}</span> : null}
      </div>
      <div className={s.trilhoCaixa} style={caixa}>
        <div
          className={`${s.trilho} ${anda ? s.trilhoAnda : ""}`}
          style={anda ? { "--cd-trilho-duracao": `${duracaoDoCarrossel(itens.length, LARGURA[variante] || 312)}s` } : undefined}
        >
          {itens.map((it, i) => cartao(it, i, false))}
          {anda ? itens.map((it, i) => cartao(it, i, true)) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Um card do carrossel. `detalhe` pode ser texto ou nó (ex.: "R$ 10 de" +
 * <PalavraDesconto />). No celular, `preco` e `de` (riscado) em reais.
 */
export function CardAgora({ variante = "tablet", etiqueta, titulo, detalhe, foto, preco, de, href = "#", copia = false, idioma = "pt" }) {
  const extraCopia = copia ? { "aria-hidden": true, tabIndex: -1, className: s.copiaDoTrilho } : {};
  if (variante === "celular") {
    return (
      <Card href={href} elevado className={`${s.agoraCelular} ${extraCopia.className || ""}`} aria-hidden={extraCopia["aria-hidden"]} tabIndex={extraCopia.tabIndex}>
        <div className={s.agoraFoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {foto ? <img className={s.fotoImagem} src={foto} alt={titulo} /> : null}
          {etiqueta ? <Etiqueta tipo="sobreFoto">{etiqueta}</Etiqueta> : null}
        </div>
        <div className={s.agoraCorpo}>
          <span className={s.agoraTitulo}>{titulo}</span>
          <span className={s.agoraLinha}>
            <Preco valor={preco} de={de} tamanho={16} peso={700} principal idioma={idioma} />
            <span aria-hidden="true" className={s.mais}>+</span>
          </span>
        </div>
      </Card>
    );
  }
  return (
    <Card href={href} className={`${s.agoraTablet} ${extraCopia.className || ""}`} aria-hidden={extraCopia["aria-hidden"]} tabIndex={extraCopia.tabIndex}>
      <div className={s.agoraFoto}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {foto ? <img className={s.fotoImagem} src={foto} alt="" /> : null}
      </div>
      <div className={s.agoraTextos}>
        {etiqueta ? <span className={s.agoraEtiqueta}>{etiqueta}</span> : null}
        <span className={s.agoraTitulo}>{titulo}</span>
        {detalhe ? <span className={s.agoraDetalhe}>{detalhe}</span> : null}
      </div>
    </Card>
  );
}
