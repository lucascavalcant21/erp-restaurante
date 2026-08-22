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

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
