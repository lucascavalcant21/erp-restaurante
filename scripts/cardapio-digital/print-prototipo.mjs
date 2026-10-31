// PRINT DE REFERÊNCIA E COMPARAÇÃO DO CARDÁPIO DIGITAL
//
//   Protótipo:  node scripts/cardapio-digital/print-prototipo.mjs --assets <pasta> --saida <pasta> Main TabletDetalhe
//   App:        node scripts/cardapio-digital/print-prototipo.mjs --url http://localhost:3002/... --nome Main --saida <pasta>
//   Comparar:   node scripts/cardapio-digital/print-prototipo.mjs --comparar <prototipo.png> <app.png> --nome Main --saida <pasta>
//
// O tamanho do print é o da prancheta em telas/canvas.json (ou --largura/--altura).
// Por padrão o print sai com "reduzir movimento" ligado, para as animações não
// mudarem o resultado; --movimento tira isso. --props e --estado (JSON) trocam
// as props e o estado da tela do protótipo.
// A comparação gera uma imagem com protótipo | app | diferença e diz a % de
// pixels diferentes (só para guiar o ajuste fino; o olho decide).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { renderizarPrototipo } from "./renderizar-prototipo.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TELAS = path.resolve(AQUI, "../../docs/cardapio-digital/telas");

function argumentos(argv) {
  const a = { nomes: [], comparar: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--comparar") { a.comparar = [argv[++i], argv[++i]]; continue; }
    if (v === "--movimento") { a.movimento = true; continue; }
    if (v.startsWith("--")) { a[v.slice(2)] = argv[++i]; continue; }
    a.nomes.push(v.replace(/\.dc\.html$/, ""));
  }
  return a;
}

export function prancheta(nome) {
  const canvas = JSON.parse(fs.readFileSync(path.join(TELAS, "canvas.json"), "utf8"));
  const b = canvas.boards[`${nome}.dc.html`];
  return b ? { largura: b.w, altura: b.h, cheia: b.expand === "fill" } : null;
}

export async function abrir(navegador, url, { largura, altura, movimento }) {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
  if (!movimento) await pagina.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await pagina.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await pagina.evaluate(() => document.fonts.ready);
  return pagina;
}

export async function fotografar(navegador, url, { largura, altura, cheia, movimento, saida }) {
  const pagina = await abrir(navegador, url, { largura, altura, movimento });
  await pagina.screenshot({ path: saida, fullPage: !!cheia });
  await pagina.close();
  return saida;
}

/** Print só de um elemento (o n-ésimo que casa com o seletor). */
export async function fotografarElemento(pagina, seletor, indice, saida) {
  // Aba em segundo plano não desenha (o print do elemento espera o quadro).
  await pagina.bringToFront();
  const els = await pagina.$$(seletor);
  const el = els[indice || 0];
  if (!el) throw new Error(`nada casa com ${seletor} [${indice || 0}]`);
  // O que está solto por cima do elemento (sacola, barra fixa) sai do print.
  const escondidos = await el.evaluate((alvo) => {
    const r = alvo.getBoundingClientRect();
    const fora = [];
    for (const e of document.querySelectorAll("body *")) {
      if (e === alvo || e.contains(alvo) || alvo.contains(e)) continue;
      const p = getComputedStyle(e).position;
      if (p !== "absolute" && p !== "fixed") continue;
      const q = e.getBoundingClientRect();
      if (q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom && e.style.visibility !== "hidden") {
        e.dataset.escondidoPrint = "1";
        e.style.visibility = "hidden";
        fora.push(1);
      }
    }
    return fora.length;
  });
  await el.screenshot({ path: saida });
  if (escondidos) await el.evaluate(() => document.querySelectorAll("[data-escondido-print]").forEach((e) => { e.style.visibility = ""; delete e.dataset.escondidoPrint; }));
  return saida;
}

/** Grava o HTML estático da tela do protótipo e devolve o endereço file://. */
export function prepararPrototipo(nome, { assets, saida, props = {}, estado = null }) {
  const html = fs.readFileSync(path.join(TELAS, `${nome}.dc.html`), "utf8");
  const r = renderizarPrototipo(html, { props, estado, assets });
  const arq = path.join(saida, `${nome}.prototipo.html`);
  fs.writeFileSync(arq, r.html);
  return { url: pathToFileURL(arq).href, ...(prancheta(nome) || { largura: r.preview?.width || 1280, altura: r.preview?.height || 800 }) };
}

export async function comparar(navegador, a, b, saida) {
  const dado = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
  const pagina = await navegador.newPage();
  await pagina.setContent("<body style='margin:0;background:#888'></body>");
  const r = await pagina.evaluate(async (srcA, srcB) => {
    const carregar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([carregar(srcA), carregar(srcB)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const ler = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
    const da = ler(ia), db = ler(ib);
    const c = document.createElement("canvas"); c.width = w * 3 + 32; c.height = h; const x = c.getContext("2d");
    x.fillStyle = "#888"; x.fillRect(0, 0, c.width, h);
    x.drawImage(ia, 0, 0); x.drawImage(ib, w + 16, 0);
    const diff = x.createImageData(w, h); let difs = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
      const cinza = 255 - (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12;
      if (d > 24) { difs++; diff.data.set([229, 72, 77, 255], i); } else diff.data.set([cinza, cinza, cinza, 255], i);
    }
    x.putImageData(diff, w * 2 + 32, 0);
    return { png: c.toDataURL("image/png"), pct: (100 * difs) / (w * h), w, h };
  }, dado(a), dado(b));
  fs.writeFileSync(saida, Buffer.from(r.png.split(",")[1], "base64"));
  await pagina.close();
  return r;
}

async function principal() {
  const a = argumentos(process.argv.slice(2));
  const saida = path.resolve(a.saida || ".");
  fs.mkdirSync(saida, { recursive: true });
  const navegador = await puppeteer.launch({ headless: true });
  try {
    if (a.comparar) {
      const r = await comparar(navegador, a.comparar[0], a.comparar[1], path.join(saida, `${a.nome || "tela"}.comparacao.png`));
      console.log(`${a.nome || "tela"}: ${r.pct.toFixed(2)}% dos pixels diferentes (${r.w}×${r.h})`);
      return;
    }
    if (a.url) {
      const base = prancheta(a.nome) || {};
      const largura = Number(a.largura) || base.largura || 1280;
      const altura = Number(a.altura) || base.altura || 800;
      const f = await fotografar(navegador, a.url, { largura, altura, cheia: base.cheia, movimento: a.movimento, saida: path.join(saida, `${a.nome || "app"}.app.png`) });
      console.log(f);
      return;
    }
    for (const nome of a.nomes) {
      const html = fs.readFileSync(path.join(TELAS, `${nome}.dc.html`), "utf8");
      const r = renderizarPrototipo(html, {
        props: a.props ? JSON.parse(a.props) : {},
        estado: a.estado ? JSON.parse(a.estado) : null,
        assets: a.assets ? path.resolve(a.assets) : null,
      });
      const arqHtml = path.join(saida, `${nome}.prototipo.html`);
      fs.writeFileSync(arqHtml, r.html);
      const base = prancheta(nome) || {};
      const largura = Number(a.largura) || base.largura || r.preview?.width || 1280;
      const altura = Number(a.altura) || base.altura || r.preview?.height || 800;
      const f = await fotografar(navegador, pathToFileURL(arqHtml).href, { largura, altura, cheia: base.cheia, movimento: a.movimento, saida: path.join(saida, `${nome}.prototipo.png`) });
      console.log(f);
    }
  } finally {
    await navegador.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  principal().catch((e) => { console.error(e); process.exit(1); });
}
