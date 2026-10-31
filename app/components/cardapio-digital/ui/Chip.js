import Link from "next/link";
import Icone from "./Icone";
import s from "./ui.module.css";

function elemento(href, as) {
  if (as) return as;
  if (!href) return "button";
  return href.startsWith("/") ? Link : "a";
}

// Chip (filtro, categoria em faixa, restrição). Selecionado = fundo escuro com
// texto branco: `corSelecionado` "escuro" (cinza #4A4A4A, categorias do
// delivery) ou "principal" (verde, restrições). `claro` = verde claro com borda
// ("Me ajuda a escolher"). Botão de alternar ganha aria-pressed.
export default function Chip({
  selecionado = false, corSelecionado = "escuro", claro = false, icone, href, as, onClick,
  className = "", children, ...resto
}) {
  const Tag = elemento(href, as);
  const sel = selecionado ? (corSelecionado === "principal" ? s.chipPrincipal : s.chipEscuro) : "";
  const extra = Tag === "button" ? { type: "button", "aria-pressed": selecionado } : { href, "aria-current": selecionado ? "true" : undefined };
  return (
    <Tag className={`${s.chip} ${s.pressiona} ${claro ? s.chipClaro : ""} ${sel} ${className}`} onClick={onClick} {...extra} {...resto}>
      {icone ? <Icone nome={icone} tamanho={15} /> : null}
      {children}
    </Tag>
  );
}

/** Categoria do menu lateral do tablet: nome + quantidade de pratos. */
export function ChipCategoria({ ativa = false, contador, href, as, onClick, className = "", children, ...resto }) {
  const Tag = elemento(href, as);
  const extra = Tag === "button" ? { type: "button" } : { href };
  return (
    <Tag className={`${s.categoria} ${ativa ? s.categoriaAtiva : ""} ${className}`} aria-current={ativa ? "true" : undefined} onClick={onClick} {...extra} {...resto}>
      {children}
      {contador != null ? <span className={s.categoriaContador}>{contador}</span> : null}
    </Tag>
  );
}

const ETIQUETAS = { neutra: s.etiqueta, sobreFoto: s.etiquetaSobreFoto, destaque: s.etiquetaDestaque, branca: s.etiquetaBranca };

/** Etiqueta sem ação: "Glúten" no card, "HAPPY HOUR" sobre a foto, "Mais pedido da casa". */
export function Etiqueta({ tipo = "neutra", className = "", children, ...resto }) {
  return <span className={`${ETIQUETAS[tipo] || s.etiqueta} ${className}`} {...resto}>{children}</span>;
}
