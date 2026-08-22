// Testes do volume da embalagem. Rode com: node app/lib/volume-embalagem.test.mjs

import { volumeDaEmbalagem, ehUnidadeDeContagem } from "./volume-embalagem.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)})`}`);
}

// ── Os dois casos que motivaram o módulo ───────────────────────────────────
conferir("Absolut de 1 L aparece",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "L" }), "1 L");
conferir("agua com gas em fardo de 12 nao vira volume",
  volumeDaEmbalagem({ tamanho_embalagem: 12, unidade_medida: "garrafa" }), "");

// ── Volumes e pesos normais ────────────────────────────────────────────────
conferir("garrafa de 750 ml", volumeDaEmbalagem({ tamanho_embalagem: 750, unidade_medida: "ml" }), "750 ml");
conferir("lata de 350 ml", volumeDaEmbalagem({ tamanho_embalagem: 350, unidade_medida: "ml" }), "350 ml");
conferir("saco de 5 kg", volumeDaEmbalagem({ tamanho_embalagem: 5, unidade_medida: "kg" }), "5 kg");
conferir("meio quilo com virgula", volumeDaEmbalagem({ tamanho_embalagem: 0.5, unidade_medida: "kg" }), "0,5 kg");

// ── Unidades de contagem, em varias formas ────────────────────────────────
for (const un of ["un", "un.", "UN", "unidade", "Unidades", "garrafas", "lata", "caixa", "CX", "pacote", "fardo", "dúzia", "peça"]) {
  conferir(`"${un}" e contagem`, ehUnidadeDeContagem(un), "true");
}
for (const un of ["ml", "L", "kg", "g", "litro"]) {
  conferir(`"${un}" nao e contagem`, ehUnidadeDeContagem(un), "false");
}

// ── Cadastro incompleto não inventa nada ──────────────────────────────────
conferir("sem tamanho", volumeDaEmbalagem({ unidade_medida: "ml" }), "");
conferir("sem unidade", volumeDaEmbalagem({ tamanho_embalagem: 750 }), "");
conferir("tamanho zero", volumeDaEmbalagem({ tamanho_embalagem: 0, unidade_medida: "ml" }), "");
conferir("tamanho negativo", volumeDaEmbalagem({ tamanho_embalagem: -5, unidade_medida: "ml" }), "");
conferir("item nulo", volumeDaEmbalagem(null), "");

// ── Também lê do insumo aninhado (item de estoque com join) ───────────────
conferir("le do insumo aninhado",
  volumeDaEmbalagem({ insumo: { tamanho_embalagem: 1, unidade_medida: "L" } }), "1 L");

// ── Pre-preparo da ficha tecnica: nao vem em embalagem ────────────────────
// Ao migrar da ficha, o item nasce com tamanho 1 e a MESMA unidade nos dois
// campos. Item comprado tem os dois diferentes.
conferir("molho da ficha (1 l / l) nao mostra volume",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "l", unidade_comercial: "l" }), "");
conferir("xarope da ficha (1 un / un) nao mostra volume",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "un", unidade_comercial: "un" }), "");
conferir("Absolut (1 L / garrafa) continua mostrando",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "L", unidade_comercial: "garrafa" }), "1 L");
// Omissao nao e granel: cadastro sem unidade comercial nao pode apagar o
// volume de uma garrafa de 1 L.
conferir("sem unidade comercial ainda mostra o volume",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "kg" }), "1 kg");
conferir("categoria de pre-preparo esconde, mesmo com unidades diferentes",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "l", unidade_comercial: "garrafa", categoria: "Pre-preparos" }), "");
conferir("xarope do bar tambem",
  volumeDaEmbalagem({ tamanho_embalagem: 1, unidade_medida: "ml", categoria: "Xaropes e pre-preparos" }), "");
conferir("granel so vale com tamanho 1: 5 kg a granel ainda mostra",
  volumeDaEmbalagem({ tamanho_embalagem: 5, unidade_medida: "kg", unidade_comercial: "kg" }), "5 kg");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
