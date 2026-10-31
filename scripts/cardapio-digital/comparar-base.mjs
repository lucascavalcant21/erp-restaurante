// COMPARAÇÃO DA BASE VISUAL (Etapa 1) COM O PROTÓTIPO
//
//   node scripts/cardapio-digital/comparar-base.mjs --assets <pasta assets> --saida <pasta> [--url http://localhost:3002]
//
// Para cada amostra da vitrine (/dev/cardapio-ui, data-amostra=...) tira o
// print do mesmo pedaço no protótipo e no app, e gera protótipo | app |
// diferença, com a % de pixels diferentes. Os dois com "reduzir movimento".

import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { abrir, comparar, fotografarElemento, prepararPrototipo } from "./print-prototipo.mjs";

export const AMOSTRAS = [
  ["recomendacoes", "Main", 'a[href="TabletRecomenda.dc.html"]'],
  ["categorias", "Main", 'nav[aria-label="Categorias"]'],
  ["lateral-botoes", "Main", "aside > div:last-child"],
  ["banner-tablet", "Main", 'a[aria-label^="Cadastre-se"]'],
  ["destaque-midia", "Main", 'section[aria-label="Destaque da casa"]'],
  ["agora-tablet", "Main", 'section[aria-label="Promoções do momento"]'],
  ["card-prato-tablet", "Main", 'a[aria-label="Ver Picanha na brasa"]'],
  ["redondo", "TabletDetalhe", 'a[aria-label="Fechar"]', 0, '[data-amostra="redondo"] a[aria-label="Fechar"]'],
  ["selos", "TabletDetalhe", '[role="list"]'],
  ["pimenta", "TabletDetalhe", '[role="list"] + div > div'],
  ["rodape-detalhe", "TabletDetalhe", 'div:has(> [aria-label="Onde vai consumir"])'],
  ["botao-entrar", "TabletEntrar", 'a[href="Main.dc.html"]', 0],
  ["botao-recusar", "TabletEntrar", 'a[href="Main.dc.html"]', 1],
  ["banner-celular", "DeliveryInicio", 'a[aria-label^="Cadastre-se"]', 0, '[data-amostra="banner-celular"] > a'],
  ["segmentado-delivery", "DeliveryInicio", '[aria-label="Tipo de pedido"]'],
  ["agora-celular", "DeliveryInicio", 'section[aria-label="Agora na casa"]'],
  ["chips-delivery", "DeliveryInicio", 'div:has(> a[href="DeliveryRecomenda.dc.html"])'],
  ["card-prato-celular", "DeliveryInicio", 'section[aria-label="Grelhados"] > a'],
  ["nav-celular", "DeliveryInicio", 'nav[aria-label="Navegação"]'],
];

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith("--") ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const saida = path.resolve(args.saida || "prints-base");
const base = args.url || "http://localhost:3002";
const so = args.so ? new Set(args.so.split(",")) : null;
fs.mkdirSync(saida, { recursive: true });

const navegador = await puppeteer.launch({ headless: true });
try {
  const app = await abrir(navegador, `${base}/dev/cardapio-ui`, { largura: 1440, altura: 900 });
  // O aviso do modo de desenvolvimento do Next fica por cima das amostras.
  await app.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
  const paginas = new Map();
  const linhas = [];
  for (const [id, tela, seletor, indice = 0, seletorApp] of AMOSTRAS) {
    if (so && !so.has(id)) continue;
    if (!paginas.has(tela)) {
      const p = prepararPrototipo(tela, { assets: args.assets ? path.resolve(args.assets) : null, saida });
      paginas.set(tela, await abrir(navegador, p.url, { largura: p.largura, altura: p.altura }));
    }
    const a = await fotografarElemento(paginas.get(tela), seletor, indice, path.join(saida, `${id}.prototipo.png`));
    const b = await fotografarElemento(app, seletorApp || `[data-amostra="${id}"] > *`, 0, path.join(saida, `${id}.app.png`));
    const r = await comparar(navegador, a, b, path.join(saida, `${id}.comparacao.png`));
    linhas.push(`${id.padEnd(22)} ${r.pct.toFixed(2).padStart(6)}%  ${r.w}×${r.h}`);
  }
  console.log(linhas.join("\n"));
} finally {
  await navegador.close();
}
