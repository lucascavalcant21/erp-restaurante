// Testes do "o que falta". Rode com: node app/lib/lacunas-custo.test.mjs
//
// O caso que deu origem a isto: um produto do cardápio sem ficha ligada não
// entra na conta do CMV — sem erro, sem aviso. O painel mostra a média dos
// que entraram e ninguém sabe quantos ficaram de fora.

import { lacunasDoCusto, fichasDoProduto } from "./lacunas-custo.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}

const insumoOk = { id: "i1", nome: "Tomate", custo_unitario: 8.5 };
const insumoSemPreco = { id: "i2", nome: "Sal grosso", custo_unitario: 0, custo_compra: 0 };

const FICHAS = [
  { id: "f1", nome_receita: "Moqueca", departamento: "cozinha", rendimento_porcoes: 4,
    fichas_ingredientes: [{ quantidade: 500, insumos: insumoOk }] },
  { id: "f2", nome_receita: "Molho base", departamento: "cozinha", rendimento_porcoes: 10,
    fichas_ingredientes: [{ quantidade: 200, insumos: insumoSemPreco }] },
  { id: "f3", nome_receita: "Farofa", departamento: "cozinha", rendimento_porcoes: 0,
    fichas_ingredientes: [{ quantidade: 300, insumos: insumoOk }] },
  { id: "f4", nome_receita: "Sobremesa nova", departamento: "cozinha", rendimento_porcoes: 2,
    fichas_ingredientes: [] },
  // Produto pronto: vendido como vem do fornecedor, nao exige ingredientes.
  { id: "f5", nome_receita: "Água 500ml", departamento: "bar", rendimento_porcoes: 1,
    produto_pronto: true, fichas_ingredientes: [] },
];

const PRODUTOS = [
  { id: "p1", nome_produto: "Moqueca", preco_venda: 58, ficha_id: "f1" },
  { id: "p2", nome_produto: "Farofa", preco_venda: 12, composicao: [{ ficha_id: "f3", qtd: 1 }] },
  // Com preco e SEM ficha: e este que some da conta do CMV.
  { id: "p3", nome_produto: "Bobó de Camarão", preco_venda: 72 },
  { id: "p4", nome_produto: "Caipirinha", preco_venda: 22 },
  // Ligado a uma ficha que nao existe mais: parece configurado e custa zero.
  { id: "p5", nome_produto: "Prato antigo", preco_venda: 40, ficha_id: "f-apagada" },
  // Tem ficha e nao tem preco: da para custear, nao da para saber a margem.
  { id: "p6", nome_produto: "Água 500ml", preco_venda: 0, ficha_id: "f5" },
];

const r = lacunasDoCusto({ fichas: FICHAS, produtos: PRODUTOS });

// ── O buraco silencioso ───────────────────────────────────────────────────
conferir("acha os produtos com preco e sem ficha", r.produtosSemFicha.length, 2);
conferir("nomeia quem ficou de fora",
  r.produtosSemFicha.map((p) => p.nome).sort().join(", "), "Bobó de Camarão, Caipirinha");
conferir("acha o produto apontando para ficha apagada", r.produtosComFichaQuebrada.length, 1);
conferir("...e diz qual", r.produtosComFichaQuebrada[0].nome, "Prato antigo");

// ── Cobertura: o numero que diz se a media vale ──────────────────────────
// 5 produtos com preco; 2 sem ficha e 1 com ficha quebrada ficam fora.
conferir("cobertura: total com preco", r.cobertura.total, 5);
conferir("cobertura: quantos entram na conta", r.cobertura.cobertos, 2);
conferir("cobertura: percentual", Math.round(r.cobertura.pct), 40);

// ── Fichas ────────────────────────────────────────────────────────────────
conferir("acha a ficha sem ingrediente", r.fichasSemIngrediente.length, 1);
conferir("...e e a Sobremesa nova", r.fichasSemIngrediente[0].nome, "Sobremesa nova");
// Produto pronto SEM ingrediente nao e pendencia: o formulario diz que ele nao
// exige receita. Cobrar isso encheria a lista de alarme falso.
conferir("produto pronto sem ingrediente nao vira pendencia",
  r.fichasSemIngrediente.some((f) => f.nome === "Água 500ml"), "false");
conferir("acha a ficha sem rendimento", r.fichasSemRendimento.length, 1);
conferir("...e e a Farofa", r.fichasSemRendimento[0].nome, "Farofa");

// ── Insumos ───────────────────────────────────────────────────────────────
conferir("acha o insumo sem preco", r.ingredientesSemPreco.length, 1);
conferir("...com o nome e em quantas fichas entra",
  `${r.ingredientesSemPreco[0].nome}/${r.ingredientesSemPreco[0].fichas}`, "Sal grosso/1");

// Ordena pelo que conserta mais pratos de uma vez.
const muitasFichas = lacunasDoCusto({
  fichas: [
    { id: "a", nome_receita: "A", rendimento_porcoes: 1, fichas_ingredientes: [{ insumos: insumoSemPreco }] },
    { id: "b", nome_receita: "B", rendimento_porcoes: 1, fichas_ingredientes: [{ insumos: insumoSemPreco }] },
    { id: "c", nome_receita: "C", rendimento_porcoes: 1, fichas_ingredientes: [{ insumos: { id: "i9", nome: "Outro", custo_unitario: 0 } }] },
  ],
  produtos: [],
});
conferir("o insumo que trava mais fichas vem primeiro",
  muitasFichas.ingredientesSemPreco[0].nome, "Sal grosso");
conferir("...com a contagem certa", muitasFichas.ingredientesSemPreco[0].fichas, 2);

// ── Produto com ficha e sem preco ────────────────────────────────────────
conferir("acha o produto sem preco de venda", r.produtosSemPreco.length, 1);
conferir("...e e a agua", r.produtosSemPreco[0].nome, "Água 500ml");

// ── As duas formas de ligar produto a ficha ──────────────────────────────
conferir("composicao liga", fichasDoProduto({ composicao: [{ ficha_id: "x" }, { ficha_id: "y" }] }).join(","), "x,y");
conferir("ficha_id liga", fichasDoProduto({ ficha_id: "z" }).join(","), "z");
conferir("composicao vazia cai no ficha_id", fichasDoProduto({ composicao: [], ficha_id: "z" }).join(","), "z");
conferir("sem nenhum dos dois nao liga", fichasDoProduto({}).length, 0);

// ── Casa vazia nao inventa pendencia ─────────────────────────────────────
const vazio = lacunasDoCusto({});
conferir("sem dados nao acusa nada", vazio.pendencias, 0);
conferir("sem dados a cobertura nao vira NaN", vazio.cobertura.pct, 0);
conferir("sem argumento nao quebra", lacunasDoCusto().pendencias, 0);

// ── Casa em ordem: a lista some ──────────────────────────────────────────
const ok = lacunasDoCusto({
  fichas: [{ id: "f1", nome_receita: "Moqueca", rendimento_porcoes: 4, fichas_ingredientes: [{ insumos: insumoOk }] }],
  produtos: [{ id: "p1", nome_produto: "Moqueca", preco_venda: 58, ficha_id: "f1" }],
});
conferir("casa em ordem: zero pendencias", ok.pendencias, 0);
conferir("casa em ordem: cobertura de 100%", ok.cobertura.pct, 100);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
