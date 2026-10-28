// CARDÁPIO DIGITAL — VISUAL (seção 9L da spec em docs/cardapio-digital).
//
// Fonte única das cores, sombras e cantos do cardápio novo (tablet, QR,
// delivery, KDS e painel). O CSS dos componentes
// (components/cardapio-digital/ui/ui.module.css) só usa as variáveis que saem
// daqui: nenhum componente escreve cor solta.
//
// Regras (9L e 9M):
//   - cor principal: verde escuro #14532D; a loja pode trocar, mas a cor dela
//     precisa de contraste >= 4,5 com o branco (é fundo de botão e cor de
//     preço). Sem isso, volta para a padrão;
//   - fundo escuro -> texto branco, sempre (trava em cardapio-visual.test.mjs);
//   - neutros só em cinza; o preto #1A1A1A só como texto em fundo claro;
//   - com a cor padrão, os valores são exatamente os do protótipo; com outra
//     cor, as variações (escura, clara, degradê do banner) saem por mistura;
//   - a palavra DESCONTO vai em maiúsculas, negrito e um pouco maior, em todos
//     os idiomas.
//
// Ajustes de contraste em relação ao protótipo (9L pede 4,5:1 em todo texto):
//   - rótulo pequeno do banner ("PARA QUEM É DA CASA"): #BFDCC9 dava 4,26:1 no
//     canto claro do degradê; virou #CBE3D3 (4,61:1);
//   - etiqueta amarela sobre a faixa da foto ("ESPECIAL DA CASA"): #F5C26B dava
//     3,67:1 com foto clara atrás da faixa; virou #FFDC80 (4,52:1 no pior caso).

import { contraste, limparCor, misturar } from "./cardapio-digital.mjs";

export const COR_PRINCIPAL_PADRAO = "#14532D";
export const BRANCO = "#FFFFFF";
export const CONTRASTE_MINIMO = 4.5;

// Variações da cor padrão, como no protótipo.
const PRINCIPAL_PADRAO = Object.freeze({
  principal: "#14532D",
  principalEscura: "#0F3D22",
  principalClara: "#EAF4EE",
  principalClaraBorda: "#BFDCC9",
  principalLeve: "#F4FAF6",
  degradeInicio: "#1D6E40",
  degradeFim: "#0C331C",
  bannerRotulo: "#CBE3D3",
  bannerTexto: "#D7EBDD",
  bannerTitulo: "#E4F0E7",
});

// Neutros e cores de estado (não mudam com a cor da loja).
export const NEUTROS = Object.freeze({
  branco: BRANCO,
  texto: "#1A1A1A",
  textoForte: "#3A3A3A",
  textoMedio: "#444444",
  textoSecundario: "#5C5C5C",
  textoSuave: "#6B6B6B",
  riscado: "#767676",
  fundoLateral: "#F7F7F7",
  fundoCinza: "#F5F5F5",
  fundoTela: "#F2F2F2",
  fundoSegmentado: "#EFEFEF",
  borda: "#E3E3E3",
  bordaCard: "#EEEEEE",
  bordaForte: "#DADADA",
  divisoria: "#EDEDED",
  fotoVazia: "#D4D4D4",
  fotoVaziaEscura: "#4D4D4D",
  cinzaEscuro: "#4A4A4A",
  bannerMidia: "#5A5A5A",
  faixaFoto: "rgba(55,55,55,.78)",
  textoSobreFaixa: "#E5E5E5",
  pontoSobreFaixa: "#666666",
  pontoInativo: "#CFCFCF",
  pimentaApagada: "#B0B0B0",
  okFundo: "#E9F4EC",
  okTexto: "#1E6B3A",
  okBorda: "#C9DDCD",
  alertaFundo: "#FFF4DC",
  alertaTexto: "#7A5300",
  alertaBorda: "#F2DDA6",
  pimentaFundo: "#FDE7E8",
  pimentaTexto: "#B4231C",
  pimentaCaixa: "#FDEFEF",
  pimentaForte: "#A1161C",
  pimentaCor: "#C8262B",
  pimentaTalo: "#1E6B3A",
  neutroSeloFundo: "#E3E3E3",
  neutroSeloTexto: "#333333",
  badge: "#C8262B",
  estadoPronto: "#1E7A45",
  estadoPreparo: "#A86500",
  aberto: "#1E7A45",
  abertoPonto: "#1E9A55",
  etiquetaEspecial: "#FFDC80",
  carrinhoFundo: "#FFF8E1",
  carrinhoCabecalho: "#FFF0C2",
  carrinhoBorda: "#F2DDA6",
  carrinhoTexto: "#13261A",
});

export const SOMBRAS = Object.freeze({
  card: "0 1px 2px rgba(16,24,20,.05), 0 6px 18px rgba(16,24,20,.07)",
  cardElevado: "0 1px 2px rgba(16,24,20,.06), 0 8px 20px rgba(16,24,20,.09)",
  secundario: "0 1px 2px rgba(16,24,20,.06), 0 3px 10px rgba(16,24,20,.07), inset 0 -1px 0 rgba(16,24,20,.04)",
  sobreBanner: "0 4px 12px rgba(0,0,0,.18)",
  flutuante: "0 10px 30px rgba(0,0,0,.14)",
  segmentado: "0 1px 3px rgba(0,0,0,.12)",
  sacola: "0 6px 18px rgba(0,0,0,.18)",
  barraInferior: "0 -6px 18px rgba(16,24,20,.06)",
});

export const RAIOS = Object.freeze({ p: "10px", m: "12px", g: "14px", gg: "18px", banner: "20px", tela: "22px", pilula: "999px" });

// A palavra DESCONTO em cada idioma do cardápio (9M): sempre em maiúsculas.
export const PALAVRA_DESCONTO = Object.freeze({
  pt: "DESCONTO", en: "DISCOUNT", es: "DESCUENTO", it: "SCONTO", fr: "RÉDUCTION", zh: "折扣", ja: "割引", ko: "할인",
});
export const palavraDesconto = (idioma = "pt") => PALAVRA_DESCONTO[idioma] || PALAVRA_DESCONTO.pt;

// A faixa é translúcida: o pior caso é uma foto branca atrás dela.
export const FAIXA_SOBRE_FOTO_CLARA = misturar("#373737", BRANCO, 0.22);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;

// Clareia (rumo ao branco) até o texto atingir o contraste mínimo sobre o fundo.
function legivelSobre(cor, fundo) {
  let c = cor;
  for (let t = 0.1; contraste(c, fundo) < CONTRASTE_MINIMO && t <= 1; t += 0.1) c = misturar(cor, BRANCO, t);
  return c;
}

/**
 * Cor principal que a tela vai usar. Cor inválida ou sem contraste com o
 * branco volta para a padrão (`ajustada` avisa o painel).
 */
export function corPrincipalSegura(cor) {
  const limpa = limparCor(cor, null);
  if (!limpa) return { cor: COR_PRINCIPAL_PADRAO, ajustada: cor != null && cor !== "" };
  if (contraste(limpa, BRANCO) < CONTRASTE_MINIMO) return { cor: COR_PRINCIPAL_PADRAO, ajustada: true };
  return { cor: limpa.toUpperCase(), ajustada: false };
}

/** Variações da cor principal (escura, clara, degradê e textos do banner). */
export function variacoesDaPrincipal(cor) {
  const { cor: c } = corPrincipalSegura(cor);
  if (c === COR_PRINCIPAL_PADRAO) return { ...PRINCIPAL_PADRAO };
  const degradeInicio = misturar(c, BRANCO, 0.12);
  return {
    principal: c,
    principalEscura: misturar(c, "#000000", 0.25),
    principalClara: misturar(c, BRANCO, 0.9),
    principalClaraBorda: misturar(c, BRANCO, 0.7),
    principalLeve: misturar(c, BRANCO, 0.95),
    degradeInicio: contraste(degradeInicio, BRANCO) >= CONTRASTE_MINIMO ? degradeInicio : c,
    degradeFim: misturar(c, "#000000", 0.4),
    bannerRotulo: legivelSobre(misturar(c, BRANCO, 0.78), degradeInicio),
    bannerTexto: legivelSobre(misturar(c, BRANCO, 0.82), degradeInicio),
    bannerTitulo: legivelSobre(misturar(c, BRANCO, 0.88), degradeInicio),
  };
}

const kebab = (k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/**
 * Variáveis CSS do tema (vão no `style` da raiz do cardápio). Todas começam
 * com --cd- para não colidir com as do painel do ERP.
 */
export function variaveisCss(cor) {
  const p = variacoesDaPrincipal(cor);
  const vars = {};
  for (const [k, v] of Object.entries({ ...NEUTROS, ...p })) vars[`--cd-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(SOMBRAS)) vars[`--cd-sombra-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(RAIOS)) vars[`--cd-raio-${k}`] = v;
  vars["--cd-sombra-principal"] = `0 1px 2px ${rgba(p.principalEscura, ".28")}, 0 6px 14px ${rgba(p.principal, ".22")}, inset 0 1px 0 rgba(255,255,255,.14)`;
  vars["--cd-sombra-banner"] = `0 1px 2px ${rgba(p.degradeFim, ".2")}, 0 12px 28px ${rgba(p.degradeFim, ".28")}`;
  return vars;
}

/**
 * Pares texto/fundo do cardápio. A trava de contraste confere todos, com a cor
 * padrão e com cores de loja aceitas.
 */
export function paresDeTexto(cor) {
  const p = variacoesDaPrincipal(cor);
  const n = NEUTROS;
  return [
    ["texto principal no fundo branco", n.texto, n.branco],
    ["texto secundário no branco", n.textoSecundario, n.branco],
    ["texto secundário na lateral", n.textoSecundario, n.fundoLateral],
    ["contador da lateral", n.textoSuave, n.fundoLateral],
    ["categoria da lateral", n.textoForte, n.fundoLateral],
    ["preço riscado", n.riscado, n.branco],
    ["etiqueta neutra", n.textoMedio, n.branco],
    ["selo verde", n.okTexto, n.okFundo],
    ["selo amarelo", n.alertaTexto, n.alertaFundo],
    ["selo de pimenta", n.pimentaTexto, n.pimentaFundo],
    ["caixa de pimenta", n.pimentaForte, n.pimentaCaixa],
    ["selo neutro (1 / 2)", n.neutroSeloTexto, n.neutroSeloFundo],
    ["estado pronto", n.estadoPronto, n.branco],
    ["estado em preparação", n.estadoPreparo, n.branco],
    ["contador vermelho", n.branco, n.badge],
    ["chip escuro", n.branco, n.cinzaEscuro],
    ["texto branco da faixa sobre foto clara", n.branco, FAIXA_SOBRE_FOTO_CLARA],
    ["texto cinza claro da faixa sobre foto clara", n.textoSobreFaixa, FAIXA_SOBRE_FOTO_CLARA],
    ["etiqueta especial sobre a faixa com foto clara", n.etiquetaEspecial, FAIXA_SOBRE_FOTO_CLARA],
    ["aviso de mídia vazia", n.textoSobreFaixa, n.bannerMidia],
    ["carrinho amarelo", n.carrinhoTexto, n.carrinhoFundo],
    ["botão principal", n.branco, p.principal],
    ["preço na cor principal", p.principal, n.branco],
    ["link na cor principal sobre a seleção", p.principalEscura, p.principalClara],
    ["texto branco no degradê do banner", n.branco, p.degradeInicio],
    ["rótulo do banner", p.bannerRotulo, p.degradeInicio],
    ["texto do banner", p.bannerTexto, p.degradeInicio],
    ["título do banner", p.bannerTitulo, p.degradeInicio],
    ["etiqueta branca sobre foto", p.principal, n.branco],
  ];
}

// Duração do carrossel "Agora na casa": a mesma velocidade com 3 ou 30 cards.
export const PX_POR_SEGUNDO_CARROSSEL = 24;
export function duracaoDoCarrossel(qtdItens, larguraItem) {
  const n = Math.max(0, Number(qtdItens) || 0);
  return Math.max(12, Math.round((n * (Number(larguraItem) || 0)) / PX_POR_SEGUNDO_CARROSSEL));
}
/** O carrossel só anda sozinho com 3 cards ou mais (3.5 da spec). */
export const carrosselAnda = (qtdItens) => (Number(qtdItens) || 0) >= 3;
