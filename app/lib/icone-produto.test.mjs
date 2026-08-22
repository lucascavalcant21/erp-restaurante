// Testes do ícone do produto. Rode com: node app/lib/icone-produto.test.mjs

import { iconeDoProduto, ICONES_USADOS } from "./icone-produto.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${obtido}, esperado ${esperado})`}`);
}
const icone = (nome, dep = "", categoria = "") => iconeDoProduto({ nome, categoria }, dep);

// ── Bar: marcas e tipos ────────────────────────────────────────────────────
conferir("Heineken", icone("Heineken"), "Beer");
conferir("Cerveja generica", icone("Cerveja Pilsen 600ml"), "Beer");
conferir("Absolut", icone("Absolut"), "Martini");
conferir("Cachaca de jambu", icone("Cachaça de jambu G"), "Martini");
conferir("Gin", icone("Gin"), "Martini");
conferir("Licor 43", icone("Licor 43"), "Martini");
conferir("Coca cola", icone("Coca cola"), "CupSoda");
conferir("Agua com gas", icone("Água com gás"), "GlassWater");
conferir("Polpa de goiaba", icone("Polpa de goiaba"), "Citrus");
conferir("Vinho tinto", icone("Vinho tinto seco"), "Wine");
conferir("Gelo", icone("Gelo em cubos"), "Snowflake");
conferir("Xarope", icone("Xarope de gengibre"), "FlaskConical");

// ── Cozinha ────────────────────────────────────────────────────────────────
conferir("Creme de leite vai para laticinio, nao para creme/sopa",
  icone("Creme de leite"), "Milk");
conferir("Picanha", icone("Picanha"), "Beef");
conferir("Peito de frango", icone("Peito de frango"), "Drumstick");
conferir("Camarao", icone("Camarão cinza"), "Fish");
conferir("Bacon", icone("Bacon em cubos"), "Ham");
conferir("Ovo", icone("Ovos brancos"), "Egg");
conferir("Farinha de trigo", icone("Farinha de trigo"), "Wheat");
conferir("Tomate", icone("Tomate italiano"), "Salad");
conferir("Batata", icone("Batata inglesa"), "Carrot");
conferir("Feijao", icone("Feijão carioca"), "Bean");
conferir("Molho de moqueca", icone("Molho de moqueca"), "Soup");
conferir("Limao", icone("Limão taiti"), "Citrus");
conferir("Acucar", icone("Açúcar refinado"), "Candy");

// ── Sem acento e com caixa diferente ──────────────────────────────────────
conferir("acucar sem acento", icone("acucar refinado"), "Candy");
conferir("HEINEKEN em maiuscula", icone("HEINEKEN"), "Beer");
conferir("Camarao sem acento", icone("Camarao"), "Fish");

// ── Cai para a categoria quando o nome nao diz nada ───────────────────────
conferir("nome generico usa a categoria", icone("Item 42", "", "Destilados"), "Martini");
conferir("categoria de limpeza", icone("Produto X", "", "Limpeza"), "Package");

// ── Cai para o departamento quando nem a categoria diz ────────────────────
conferir("padrao do bar", icone("Item 42", "bar"), "GlassWater");
conferir("padrao da cozinha", icone("Item 42", "cozinha"), "Utensils");
conferir("sem nada e Package", icone("Item 42"), "Package");
conferir("item nulo nao quebra", iconeDoProduto(null), "Package");

// ── A lista exportada tem de cobrir tudo que as regras devolvem ───────────
const usados = new Set(ICONES_USADOS);
const amostras = ["Heineken", "Absolut", "Coca cola", "Picanha", "Molho", "Item 42"];
for (const nome of amostras) {
  conferir(`"${nome}" devolve icone que esta na lista exportada`,
    usados.has(icone(nome, "cozinha")), "true");
}

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
