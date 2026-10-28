import { Inter, Outfit } from "next/font/google";
import { variaveisCss } from "../../../lib/cardapio-visual.mjs";
import s from "./ui.module.css";

// Raiz visual do cardápio digital: fontes (Outfit nos títulos, Inter no texto)
// e as variáveis --cd-* da cor da loja (cardapio-visual.mjs). Tudo que usa os
// componentes de ./ui precisa estar dentro dele.

const fonteTitulo = Outfit({ subsets: ["latin"], display: "swap", variable: "--cd-fonte-titulo" });
const fonteTexto = Inter({ subsets: ["latin"], display: "swap", variable: "--cd-fonte-texto" });

export default function TemaCardapio({ cor, as: Tag = "div", className = "", style, children, ...resto }) {
  return (
    <Tag
      className={`${fonteTitulo.variable} ${fonteTexto.variable} ${s.tema} ${className}`}
      style={{ ...variaveisCss(cor), ...style }}
      {...resto}
    >
      {children}
    </Tag>
  );
}
