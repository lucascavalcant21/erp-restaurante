import Link from "next/link";
import Icone from "./Icone";
import s from "./ui.module.css";

// Botões do cardápio digital (9L):
//   principal  — verde, sombra verde, brilho no topo e leve degradê;
//                `plano` tira sombra e degradê (o "Adicionar" pequeno do card);
//   secundario — branco, borda cinza, sombra curta;
//   contorno   — branco com borda escura de 2 px ("Não, obrigado · quero só pedir");
//   clara      — verde bem claro com texto verde escuro ("Menu degustação");
//   fantasma   — sem fundo, texto cinza escuro ("Nossa história" no menu);
//   texto      — só o texto na cor principal;
//   sobreBanner— pílula branca em cima do banner verde ("Quero →").
// `tamanho` é a altura do protótipo (36, 40, 44, 48, 52, 54, 56 ou 64); o canto
// e a fonte acompanham. `valor` vai à direita ("Adicionar ao pedido  R$ 40,00").
// `alinhar="inicio"` encosta ícone e texto à esquerda (itens do menu lateral).

const VARIANTES = { principal: s.principal, secundario: s.secundario, contorno: s.contorno, clara: s.clara, fantasma: s.fantasma, texto: s.textoLink, sobreBanner: s.sobreBanner };
const ALTURAS = { 36: s.a36, 40: s.a40, 44: s.a44, 48: s.a48, 52: s.a52, 54: s.a54, 56: s.a56, 64: s.a64 };

function elemento(href, as) {
  if (as) return as;
  if (!href) return "button";
  return href.startsWith("/") ? Link : "a";
}

export default function Botao({
  variante = "principal", tamanho = 48, larguraTotal = false, plano = false, alinhar, valor, icone, tamanhoIcone, iconeDireita,
  href, as, className = "", style, children, ...resto
}) {
  const Tag = elemento(href, as);
  const classes = [
    s.botao, s.pressiona, VARIANTES[variante] || s.principal, variante !== "texto" ? ALTURAS[tamanho] || s.a48 : "",
    larguraTotal ? s.larguraTotal : "", alinhar === "inicio" ? s.inicio : "", valor != null ? s.comValor : "", className,
  ].filter(Boolean).join(" ");
  const extra = Tag === "button" ? { type: resto.type || "button" } : { href };
  const estilo = plano ? { boxShadow: "none", backgroundImage: "none", ...style } : style;
  return (
    <Tag className={classes} style={estilo} {...extra} {...resto}>
      {valor != null ? (
        <>
          <span>{children}</span>
          <span className={s.valor}>{valor}</span>
        </>
      ) : (
        <>
          {icone ? <Icone nome={icone} tamanho={tamanhoIcone || (tamanho >= 52 ? 20 : 18)} /> : null}
          <span className={s.rotuloBotao}>{children}</span>
          {iconeDireita ? <Icone nome={iconeDireita} tamanho={16} traco={2.6} /> : null}
        </>
      )}
    </Tag>
  );
}

/** Voltar e fechar: redondos, brancos, com borda e sombra. `rotulo` é obrigatório (leitor de tela). */
export function BotaoRedondo({ tipo = "fechar", rotulo, sobreFoto = false, icone, href, as, className = "", ...resto }) {
  const Tag = elemento(href, as);
  const extra = Tag === "button" ? { type: "button" } : { href };
  const nome = icone || (tipo === "voltar" ? "voltar" : "fechar");
  return (
    <Tag aria-label={rotulo} className={`${s.redondo} ${s.pressiona} ${sobreFoto ? s.redondoSobreFoto : ""} ${className}`} {...extra} {...resto}>
      <Icone nome={nome} tamanho={sobreFoto ? 18 : 20} />
    </Tag>
  );
}
