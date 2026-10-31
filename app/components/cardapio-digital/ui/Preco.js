import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import s from "./ui.module.css";

// Preço do cardápio: o atual em destaque e, havendo promoção, o de antes
// riscado em cima. `prefixo` para "a partir de" (preço que depende de escolha).
// Valor em reais (número); quem formata é formatarPreco, no idioma da tela.
// `fonteTexto` usa a fonte do texto (Inter) em vez da dos títulos (lista do celular).
export default function Preco({ valor, de, prefixo, tamanho = 17, peso = 600, principal = false, fonteTexto = false, idioma = "pt", className = "" }) {
  if (valor == null) return null;
  const atual = `${prefixo ? `${prefixo} ` : ""}${formatarPreco(valor, idioma)}`;
  return (
    <span className={`${s.preco} ${principal ? s.precoPrincipal : ""} ${fonteTexto ? s.precoTexto : ""} ${className}`}>
      {de != null && Number(de) > Number(valor) ? <span className={s.precoDe}>{formatarPreco(de, idioma)}</span> : null}
      <span style={{ fontSize: tamanho, fontWeight: peso }}>{atual}</span>
    </span>
  );
}
