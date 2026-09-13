// Testes de navegação. Rode com: node app/lib/navegacao.test.mjs
//
// O sistema tem TRÊS listas de links escritas à mão que ninguém consegue
// manter em sincronia: o menu lateral (app/dashboard/layout.js), o hub de
// módulos (app/dashboard/modulo/[modulo]/page.js) e o catálogo de permissões.
// Quando uma rota é renomeada — aconteceu com o Ponto de Equilíbrio, que virou
// Pizza do Lucro — as três continuam apontando para o endereço antigo, e o
// link só é descoberto quando alguém clica e cai numa tela em branco.
//
// Aqui não se testa regra de negócio: testa-se que todo link aponta para uma
// tela que existe no disco.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_MODULES } from "./permissions-catalog.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

// ── Todas as rotas que existem de fato ────────────────────────────────────
// As dinâmicas viram expressão: /dashboard/rh/espelho/[id] casa com
// /dashboard/rh/espelho/qualquer-coisa.
const estaticas = new Set();
const dinamicas = [];
(function varrer(dir, rota) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho, `${rota}/${nome}`);
    else if (nome === "page.js") {
      if (rota.includes("[")) dinamicas.push(new RegExp(`^${rota.replace(/\[[^\]]+\]/g, "[^/]+")}$`));
      else estaticas.add(rota);
    }
  }
})("app", "");

const existe = (rota) => estaticas.has(rota) || dinamicas.some((re) => re.test(rota));

conferir("a varredura achou as telas", estaticas.size > 100, "true");
conferir("e achou as rotas com parametro", dinamicas.length > 0, "true");

// ── Os links de cada lista ────────────────────────────────────────────────
const hrefsDe = (arquivo) =>
  [...readFileSync(arquivo, "utf8").matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);

const listas = [
  ["menu lateral", hrefsDe("app/dashboard/layout.js")],
  ["hub de modulos", hrefsDe("app/dashboard/modulo/[modulo]/page.js")],
  ["catalogo de permissoes", PERMISSION_MODULES.flatMap((m) => m.pages.map((p) => p.route))],
];

for (const [nome, links] of listas) {
  // Só links internos: o menu também aponta para /vagas e páginas públicas,
  // que vivem fora de app/dashboard mas continuam sendo telas do projeto.
  const internos = [...new Set(links)].filter((h) => h.startsWith("/"));
  const quebrados = internos.filter((h) => !existe(h.split("?")[0]));
  conferir(
    `${nome}: ${internos.length} links, nenhum apontando para tela inexistente${quebrados.length ? ` (${quebrados.join(", ")})` : ""}`,
    quebrados.length, 0);
}

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
