import { Inter, Outfit } from "next/font/google";
import { variaveisCss, variaveisDaLoja } from "../../../lib/cardapio-visual.mjs";
import s from "./ui.module.css";

// Raiz visual do cardápio digital: fontes (Outfit nos títulos, Inter no texto)
// e as variáveis --cd-* da cor da loja (cardapio-visual.mjs). Tudo que usa os
// componentes de ./ui precisa estar dentro dele.

const fonteTitulo = Outfit({ subsets: ["latin"], display: "swap", variable: "--cd-fonte-titulo" });
const fonteTexto = Inter({ subsets: ["latin"], display: "swap", variable: "--cd-fonte-texto" });

// `loja` = o tema do dono (cor de fundo, cor dos cartões, formato das fotos).
export default function TemaCardapio({ cor, loja, as: Tag = "div", className = "", style, children, ...resto }) {
  return (
    <Tag
      className={`${fonteTitulo.variable} ${fonteTexto.variable} ${s.tema} ${className}`}
      style={{ ...variaveisCss(cor), ...(loja ? variaveisDaLoja(loja) : {}), ...style }}
      {...resto}
    >
      {children}
    </Tag>
  );
}
