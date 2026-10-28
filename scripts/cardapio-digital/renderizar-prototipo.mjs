// RENDERIZADOR DOS PROTÓTIPOS DO CARDÁPIO DIGITAL (docs/cardapio-digital/telas)
//
// Os .dc.html do design precisam de um runtime (support.js) que não veio no
// pacote. Aqui fica o mínimo para desenhar a tela no estado inicial e servir de
// print de referência:
//   - `{{caminho}}` vira o valor (texto escapado; true/false viram "true"/"false");
//   - `<sc-for list="{{lista}}" as="x">` repete o miolo para cada item;
//   - `<sc-if value="{{cond}}">` mostra o miolo se o valor for verdadeiro;
//   - onClick/onChange somem; checked/disabled/selected viram atributo booleano;
//   - os valores saem do `renderVals()` da própria tela, com as props padrão
//     de `data-props` (dá para trocar props e estado para ver outros estados).
//
// Só serve para o print de comparação: não é o app.

import { pathToFileURL } from "node:url";
import path from "node:path";

// Imagens que o protótipo referencia por hash (/_blob/...) e o arquivo em assets/.
export const BLOBS = {
  "82a4ffcb84e1d86249bac575f13b0a4d": "tacaca.jpg",
  f81a6e902a1163304ed6b8152c7ecba1: "degustacao-referencia.jpg",
  eb1a657e8147c4bb9ba876d3ec8d8e70: "wifi-qr.svg",
};

const escapar = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function lerPrototipo(html) {
  const helmet = (html.match(/<helmet>([\s\S]*?)<\/helmet>/) || [])[1] || "";
  const xdc = (html.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [])[1] || "";
  const corpo = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();
  const script = html.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
  const definicoes = script ? JSON.parse(script[1]) : {};
  const props = {};
  for (const [k, d] of Object.entries(definicoes)) if (!k.startsWith("$") && d && "default" in d) props[k] = d.default;
  return { helmet, corpo, props, preview: definicoes.$preview || null, codigo: script ? script[2] : "" };
}

/** Roda o renderVals() da tela com props e estado escolhidos. */
export function avaliarValores(codigo, props = {}, estado = null) {
  class DCLogic {
    constructor() { this.props = {}; this.state = null; }
    setState() {}
  }
  const Componente = new Function("DCLogic", `${codigo}\nreturn Component;`)(DCLogic);
  const c = new Componente();
  c.props = props;
  c.state = estado;
  return c.renderVals();
}

export function resolver(caminho, escopo) {
  const p = caminho.trim();
  if (p === "true") return true;
  if (p === "false") return false;
  return p.split(".").reduce((v, k) => (v == null ? undefined : v[k]), escopo);
}

function interpolar(trecho, escopo) {
  return trecho
    .replace(/\s+on[A-Z]\w*="\{\{[^}]*\}\}"/g, "")
    .replace(/\s+(checked|disabled|selected)="\{\{([^}]*)\}\}"/g, (_, attr, c) => (resolver(c, escopo) ? ` ${attr}` : ""))
    .replace(/\{\{([^}]*)\}\}/g, (_, c) => {
      const v = resolver(c, escopo);
      return v == null ? "" : escapar(v);
    });
}

// Acha o fechamento do bloco que abre em `inicio`, contando aninhamento do mesmo tipo.
function fechamento(tpl, tag, inicio) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = inicio;
  let nivel = 0;
  for (let m = re.exec(tpl); m; m = re.exec(tpl)) {
    nivel += m[0].startsWith("</") ? -1 : 1;
    if (nivel === 0) return m.index;
  }
  throw new Error(`<${tag}> sem fechamento`);
}

export function renderizarTemplate(tpl, escopo) {
  let saida = "";
  let resto = tpl;
  for (;;) {
    const m = resto.match(/<(sc-for|sc-if)\b([^>]*)>/);
    if (!m) return saida + interpolar(resto, escopo);
    saida += interpolar(resto.slice(0, m.index), escopo);
    const tag = m[1];
    const fim = fechamento(resto, tag, m.index);
    const miolo = resto.slice(m.index + m[0].length, fim);
    const attr = (nome) => (m[2].match(new RegExp(`${nome}="\\{\\{([^}]*)\\}\\}"`)) || [])[1];
    if (tag === "sc-for") {
      const nome = (m[2].match(/as="([^"]+)"/) || [])[1];
      const lista = resolver(attr("list"), escopo) || [];
      for (const item of lista) saida += renderizarTemplate(miolo, { ...escopo, [nome]: item });
    } else if (resolver(attr("value"), escopo)) {
      saida += renderizarTemplate(miolo, escopo);
    }
    resto = resto.slice(fim + `</${tag}>`.length);
  }
}

/** HTML estático completo da tela, com as imagens apontando para `assets`. */
export function renderizarPrototipo(html, { props = {}, estado = null, assets = null } = {}) {
  const p = lerPrototipo(html);
  const valores = avaliarValores(p.codigo, { ...p.props, ...props }, estado);
  let corpo = renderizarTemplate(p.corpo, valores);
  corpo = corpo.replace(/\/_blob\/([a-f0-9]{32})/g, (orig, hash) =>
    assets && BLOBS[hash] ? pathToFileURL(path.join(assets, BLOBS[hash])).href : orig);
  return {
    html: `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n${p.helmet}\n</head>\n<body>\n${corpo}\n</body>\n</html>\n`,
    preview: p.preview,
  };
}
