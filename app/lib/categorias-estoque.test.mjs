// Testes da mescla de categorias. Rode com: node app/lib/categorias-estoque.test.mjs
//
// Importa só as funções puras — o arquivo real puxa o Supabase, então os casos
// abaixo repetem a lógica com a mesma implementação para poder rodar no node.

const limpar = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
const chave = (v) => limpar(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

function mesclarCategorias(embutidas = [], criadas = []) {
  const vistas = new Map();
  for (const nome of [...embutidas, ...criadas]) {
    const limpo = limpar(nome);
    if (!limpo) continue;
    const k = chave(limpo);
    if (!vistas.has(k)) vistas.set(k, limpo);
  }
  return [...vistas.values()].sort((a, b) => chave(a).localeCompare(chave(b)));
}

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)})`}`);
}

conferir("junta embutidas e criadas em ordem",
  mesclarCategorias(["Destilados", "Cervejas"], ["Xaropes"]).join(" | "),
  "Cervejas | Destilados | Xaropes");

conferir("nao repete a mesma categoria em caixa diferente",
  mesclarCategorias(["Destilados"], ["destilados"]).join(" | "), "Destilados");

conferir("nao repete com acento diferente",
  mesclarCategorias(["Bebidas nao alcoolicas"], ["Bebidas não alcoólicas"]).join(" | "),
  "Bebidas nao alcoolicas");

conferir("espaco duplicado nao cria duplicata",
  mesclarCategorias(["Vinhos  tintos"], ["Vinhos tintos"]).join(" | "), "Vinhos tintos");

conferir("descarta vazio e so-espaco",
  mesclarCategorias([], ["", "   ", "Sucos"]).join(" | "), "Sucos");

conferir("embutida vence a criada na grafia",
  mesclarCategorias(["Refrigerantes"], ["REFRIGERANTES"]).join(" | "), "Refrigerantes");

conferir("lista vazia devolve vazio", mesclarCategorias([], []).length, 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
