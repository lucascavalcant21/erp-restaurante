// Base visual do cardápio digital (9L e 9M): cor da loja, contraste e a trava
// "fundo escuro sempre com texto branco" sobre o CSS dos componentes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contraste } from "./cardapio-digital.mjs";
import { IDS_IDIOMAS } from "./cardapio-idiomas.mjs";
import {
  COR_PRINCIPAL_PADRAO, CONTRASTE_MINIMO, PALAVRA_DESCONTO, carrosselAnda, corPrincipalSegura, duracaoDoCarrossel,
  palavraDesconto, paresDeTexto, variacoesDaPrincipal, variaveisCss,
} from "./cardapio-visual.mjs";

const CSS = readFileSync(new URL("../components/cardapio-digital/ui/ui.module.css", import.meta.url), "utf8");
// O painel segue as mesmas travas (cor só por variável, fundo escuro com texto branco).
const CSS_PAINEL = readFileSync(new URL("../components/cardapio-digital/painel/painel.module.css", import.meta.url), "utf8");
const CSS_DELIVERY = readFileSync(new URL("../components/cardapio-digital/delivery/delivery.module.css", import.meta.url), "utf8");
const CSS_TABLET = readFileSync(new URL("../components/cardapio-digital/tablet/tablet.module.css", import.meta.url), "utf8");
const CSS_ESCOLHAS = readFileSync(new URL("../components/cardapio-digital/ui/escolhas.module.css", import.meta.url), "utf8");
const CSS_DETALHE = readFileSync(new URL("../components/cardapio-digital/tablet/detalhe.module.css", import.meta.url), "utf8");
const TODOS_CSS = [CSS, CSS_PAINEL, CSS_DELIVERY, CSS_TABLET, CSS_ESCOLHAS, CSS_DETALHE].join(String.fromCharCode(10));

test("cor padrão: os valores são os do protótipo", () => {
  const p = variacoesDaPrincipal(undefined);
  assert.equal(p.principal, "#14532D");
  assert.equal(p.principalEscura, "#0F3D22");
  assert.equal(p.principalClara, "#EAF4EE");
  assert.equal(p.degradeInicio, "#1D6E40");
  assert.equal(p.degradeFim, "#0C331C");
  assert.deepEqual(variacoesDaPrincipal("#14532d"), p, "minúscula também é a padrão");
});

test("cor da loja: aceita se tiver contraste com o branco, senão volta para a padrão", () => {
  assert.deepEqual(corPrincipalSegura("#1F5FBF"), { cor: "#1F5FBF", ajustada: false });
  assert.deepEqual(corPrincipalSegura("#f5c26b"), { cor: COR_PRINCIPAL_PADRAO, ajustada: true }, "amarelo some com texto branco");
  assert.deepEqual(corPrincipalSegura("verde"), { cor: COR_PRINCIPAL_PADRAO, ajustada: true });
  assert.deepEqual(corPrincipalSegura(""), { cor: COR_PRINCIPAL_PADRAO, ajustada: false });
  assert.deepEqual(corPrincipalSegura(null), { cor: COR_PRINCIPAL_PADRAO, ajustada: false });
});

for (const cor of [COR_PRINCIPAL_PADRAO, "#0F3D2E", "#1E6B45", "#1F5FBF", "#7C2D12", "#5B21B6"]) {
  test(`contraste mínimo 4,5:1 em todo texto (cor da loja ${cor})`, () => {
    const fracos = paresDeTexto(cor)
      .map(([nome, texto, fundo]) => [nome, contraste(texto, fundo).toFixed(2)])
      .filter(([, c]) => Number(c) < CONTRASTE_MINIMO);
    assert.deepEqual(fracos, []);
  });
}

test("variáveis CSS: todas com --cd-, sem valor vazio, com as sombras da cor da loja", () => {
  const v = variaveisCss("#1F5FBF");
  for (const [k, val] of Object.entries(v)) {
    assert.match(k, /^--cd-[a-z0-9-]+$/);
    assert.ok(String(val).length > 0, k);
  }
  assert.equal(v["--cd-principal"], "#1F5FBF");
  assert.match(v["--cd-sombra-principal"], /rgba\(31,95,191,\.22\)/);
  assert.equal(variaveisCss()["--cd-sombra-principal"], "0 1px 2px rgba(15,61,34,.28), 0 6px 14px rgba(20,83,45,.22), inset 0 1px 0 rgba(255,255,255,.14)");
});

test("toda variável usada no CSS existe no tema", () => {
  const definidas = new Set(Object.keys(variaveisCss()));
  const usadas = new Set([...TODOS_CSS.matchAll(/var\((--cd-[a-z0-9-]+)/g)].map((m) => m[1]));
  const externas = new Set(["--cd-fonte-titulo", "--cd-fonte-texto", "--cd-trilho-duracao"]);
  const faltando = [...usadas].filter((u) => !definidas.has(u) && !externas.has(u));
  assert.deepEqual(faltando, []);
});

test("o CSS dos componentes não tem cor solta em hexadecimal", () => {
  const semComentarios = TODOS_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.deepEqual(semComentarios.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
});

// Regra (9L): fundo escuro → texto branco, sempre. Toda regra que pinta o
// fundo com uma cor escura do tema precisa dizer `color: var(--cd-branco)`,
// a não ser que seja enfeite sem texto (comentário "sem-texto").
const FUNDOS_ESCUROS = ["principal", "principal-escura", "degrade-inicio", "degrade-fim", "cinza-escuro", "banner-midia", "faixa-foto", "badge", "foto-vazia-escura", "ponto-sobre-faixa"];
const ESCURO = new RegExp(`background(?:-color|-image)?\\s*:[^;]*var\\(--cd-(?:${FUNDOS_ESCUROS.join("|")})\\)`);

function regras(css) {
  const out = [];
  const limpo = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  for (const m of limpo.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) out.push({ seletor: m[1].trim(), corpo: m[2] });
  return out;
}

test("fundo escuro sempre com texto branco (trava do 9L)", () => {
  const erradas = regras(TODOS_CSS)
    .filter((r) => ESCURO.test(r.corpo) && !/sem-texto/.test(r.corpo))
    .filter((r) => !/(^|;|\s)color\s*:\s*var\(--cd-branco\)/.test(r.corpo))
    .map((r) => r.seletor.replace(/\s+/g, " "));
  assert.deepEqual(erradas, []);
});

test("a trava pega um fundo escuro sem texto branco", () => {
  const ruim = ".x { background: var(--cd-principal); color: var(--cd-texto); }";
  const r = regras(ruim).filter((x) => ESCURO.test(x.corpo) && !/color\s*:\s*var\(--cd-branco\)/.test(x.corpo));
  assert.equal(r.length, 1);
});

test("toda animação desliga com reduzir movimento", () => {
  const animadas = [...CSS.matchAll(/\.([A-Za-z]+)\s*\{[^}]*animation\s*:\s*(?!none)[^;]+;/g)].map((m) => m[1]);
  const bloco = (CSS.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/) || [])[1] || "";
  const faltando = animadas.filter((c) => !new RegExp(`\\.${c}\\b`).test(bloco));
  assert.ok(animadas.length >= 5, "achou as animações");
  assert.deepEqual(faltando, []);
});

test("DESCONTO em maiúsculas em todos os idiomas do cardápio (9M)", () => {
  for (const id of IDS_IDIOMAS) {
    const p = PALAVRA_DESCONTO[id];
    assert.ok(p, `falta ${id}`);
    assert.equal(p, p.toUpperCase());
    assert.doesNotMatch(p, /off/i);
  }
  assert.equal(palavraDesconto("xx"), "DESCONTO");
  assert.match(CSS, /\.desconto\s*\{[^}]*font-size:\s*1\.15em;[^}]*font-weight:\s*800/);
});

test("carrossel: anda com 3 cards ou mais, na mesma velocidade", () => {
  assert.equal(carrosselAnda(2), false);
  assert.equal(carrosselAnda(3), true);
  assert.equal(duracaoDoCarrossel(3, 312), 39);
  assert.equal(duracaoDoCarrossel(6, 312), 78);
  assert.equal(duracaoDoCarrossel(1, 100), 12, "nunca rápido demais");
});

test("aparência do dono: fundo escuro deixa todo texto legível; foto quadrada; padrão = protótipo", async () => {
  const { variaveisDaLoja, CONTRASTE_MINIMO } = await import("./cardapio-visual.mjs");
  const { contraste, normalizarCarrossel, normalizarTema } = await import("./cardapio-digital.mjs");
  const escuro = variaveisDaLoja(normalizarTema({ cor_fundo: "#121212", cor_cartao: "#1E1E1E", cor_texto: "#F5F5F5" }));
  for (const k of ["--cd-texto", "--cd-texto-forte", "--cd-texto-medio", "--cd-texto-secundario", "--cd-texto-suave", "--cd-riscado"]) {
    assert.ok(contraste(escuro[k], "#1E1E1E") >= CONTRASTE_MINIMO, `${k} no cartão escuro`);
  }
  const bege = variaveisDaLoja(normalizarTema({ cor_fundo: "#E9DCC3", formato_foto: "quadrada" }));
  assert.equal(bege["--cd-raio-foto"], "0px");
  assert.ok(contraste(bege["--cd-texto-secundario"], "#E9DCC3") >= CONTRASTE_MINIMO);
  assert.deepEqual(Object.keys(variaveisDaLoja(normalizarTema({}))).sort(), ["--cd-pagina", "--cd-raio-foto", "--cd-superficie"], "tema padrão não mexe nos textos");
  assert.ok(contraste(escuro["--cd-principal-legivel"], "#1E1E1E") >= CONTRASTE_MINIMO, "verde da casa legível no escuro");
  assert.deepEqual(normalizarCarrossel({ segundos: 99, por_vez: 7 }), { segundos: 20, por_vez: 3 });
  assert.deepEqual(normalizarCarrossel(), { segundos: 6, por_vez: 1 });
});
