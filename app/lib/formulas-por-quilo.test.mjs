import test from "node:test";
import assert from "node:assert/strict";
import { normalizarFormulas, conferirFormula, calcularFormula, textoQuantidade, interpretarFormula, buscarFormulas, respostaDaFormula, lerComandoFormula } from "./formulas-por-quilo.mjs";

const SALVO = {
  salmouras: [
    { id: "s1", nome: "Salmoura de peixe", categoria: "peixe", produtos: ["Filé de pirarucu empanado", "Isca de peixe"], secoes: [{ titulo: "Salmoura", itens: [{ nome: "Água", qtd: 1, unidade: "l" }, { nome: "Sal", qtd: 50, unidade: "g" }, { nome: "Açúcar", qtd: "12,5", unidade: "g" }] }], tempo: "2 horas na geladeira" },
    { id: "s2", nome: "Salmoura de frango", categoria: "frango", produtos: "Sobrecoxa, Filé de frango", secoes: [{ itens: [{ nome: "Água", qtd: 1000, unidade: "ml" }, { nome: "Sal", qtd: 60, unidade: "g" }] }] },
    { id: "s3", nome: "Salmoura de frango com ervas", categoria: "frango", produtos: [], secoes: [{ itens: [{ nome: "Água", qtd: 1, unidade: "l" }, { nome: "Sal", qtd: 55, unidade: "g" }] }] },
  ],
  empanados: [
    { id: "e1", nome: "Empanado panko", referencia: "Farinha panko", produtos: ["Filé de pirarucu empanado", "Camarão empanado"], secoes: [
      { titulo: "Farinha temperada", itens: [{ nome: "Sal", qtd: 15, unidade: "g" }, { nome: "Páprica", qtd: 10, unidade: "g" }] },
      { titulo: "Massinha", itens: [{ nome: "Farinha de trigo", qtd: 500, unidade: "g" }, { nome: "Sal", qtd: 8, unidade: "g" }, { nome: "Ovos", qtd: 6, unidade: "un" }] },
    ] },
  ],
};

test("normaliza e ordena; produtos podem vir em texto", () => {
  const f = normalizarFormulas(SALVO);
  assert.deepEqual(f.salmouras.map((x) => x.id), ["s2", "s3", "s1"]);
  assert.deepEqual(f.salmouras[0].produtos, ["Sobrecoxa", "Filé de frango"]);
  assert.equal(f.empanados[0].referencia, "Farinha panko");
  assert.equal(f.salmouras[2].secoes[0].itens[2].qtd, 12.5);
  assert.deepEqual(normalizarFormulas(null), { versao: 1, salmouras: [], empanados: [] });
});

test("confere antes de salvar", () => {
  assert.deepEqual(conferirFormula({ nome: "Nova", tipo: "salmoura", secoes: [{ itens: [{ nome: "Sal", qtd: 50 }] }] }), []);
  assert.ok(conferirFormula({ nome: "", secoes: [{ itens: [{ nome: "Sal", qtd: 50 }] }] }).length);
  assert.ok(conferirFormula({ nome: "X", secoes: [] }).length);
  assert.match(conferirFormula({ nome: "X", secoes: [{ itens: [{ nome: "Sal" }] }] }).join(" "), /Falta a quantidade de: Sal/);
  assert.ok(conferirFormula({ id: "z", nome: "salmoura de PEIXE", secoes: [{ itens: [{ nome: "Sal", qtd: 1 }] }] }, SALVO.salmouras).some((e) => e.includes("Já tem")));
});

test("calcula: multiplica pelo kg e mostra em g/ml", () => {
  const f = normalizarFormulas(SALVO);
  const r = calcularFormula(f.salmouras[2], "3,5");
  assert.equal(r.fator, 3.5);
  assert.deepEqual(r.secoes[0].itens.map((i) => i.texto), ["3.500 ml (3,5 L)", "175 g", "44 g"]);
  const e = calcularFormula(f.empanados[0], 0.5);
  assert.deepEqual(e.secoes.map((s) => s.titulo), ["Farinha temperada", "Massinha"]);
  assert.deepEqual(e.secoes[1].itens.map((i) => i.texto), ["250 g", "4 g", "3 un"]);
  assert.ok(calcularFormula(f.salmouras[0], "").erro);
  assert.equal(textoQuantidade(1234, "g"), "1.235 g (1,24 kg)");
  assert.equal(textoQuantidade(2, "colher (sopa)"), "2 colher (sopa)");
});

test("entende o pedido", () => {
  assert.deepEqual(interpretarFormula("salmoura"), { tipo: "salmoura", categoria: null, termo: null, kg: null });
  assert.equal(interpretarFormula("Salmoura de frango").categoria, "frango");
  assert.equal(interpretarFormula("qual a salmoura do filé de pirarucu empanado?").termo, "file pirarucu");
  assert.equal(interpretarFormula("salmoura para 3 kg de frango").kg, 3);
  assert.equal(interpretarFormula("salmoura para 3 kg de frango").categoria, "frango");
  assert.equal(interpretarFormula("empanado").tipo, "empanado");
  assert.equal(interpretarFormula("empanado do camarão").termo, "camarao");
  assert.equal(interpretarFormula("como faz arroz"), null);
});

test("busca pelo nome ou pelo produto que usa", () => {
  const f = normalizarFormulas(SALVO);
  assert.deepEqual(buscarFormulas(f.salmouras, "file pirarucu").map((x) => x.id), ["s1"]);
  assert.deepEqual(buscarFormulas(f.salmouras, "sobrecoxa").map((x) => x.id), ["s2"]);
  assert.deepEqual(buscarFormulas(f.empanados, "camarao").map((x) => x.id), ["e1"]);
});

test("assistente: salmoura → tipo → qual → cartão; direto pelo produto", () => {
  const cache = { fichas: [], formulas: SALVO };
  const r1 = respostaDaFormula("salmoura", cache);
  assert.equal(r1.pergunta.texto, "Salmoura para quê?");
  assert.deepEqual(r1.pergunta.opcoes.map((o) => o.rotulo), ["Frango (2)", "Peixe (1)"]);
  const r2 = respostaDaFormula(r1.pergunta.opcoes[0].comando, cache);
  assert.equal(r2.pergunta.texto, "Qual?");
  assert.equal(r2.pergunta.opcoes.length, 2);
  assert.equal(lerComandoFormula(r2.pergunta.opcoes[0].comando).id, "s2");
  const r3 = respostaDaFormula(r2.pergunta.opcoes[0].comando, cache);
  assert.equal(r3.blocos[0].tipo, "formula");
  assert.equal(r3.blocos[0].formula.nome, "Salmoura de frango");

  const direto = respostaDaFormula("Qual é a salmoura do filé de pirarucu empanado?", cache);
  assert.equal(direto.blocos[0].formula.id, "s1");
  assert.equal(respostaDaFormula("salmoura de peixe", cache).blocos[0].formula.id, "s1");
  assert.equal(respostaDaFormula("salmoura para 2 kg de frango", { formulas: SALVO }).pergunta.opcoes.length, 2);

  const emp = respostaDaFormula("empanado do filé de pirarucu", cache);
  assert.equal(emp.blocos[0].formula.id, "e1");
  assert.equal(respostaDaFormula("empanado", cache).blocos[0].formula.id, "e1");

  assert.match(respostaDaFormula("salmoura", { formulas: {} }).texto, /Nenhuma salmoura cadastrada/);
  assert.match(respostaDaFormula("salmoura do tambaqui", cache).texto, /Não achei salmoura para "tambaqui"/);
  assert.equal(respostaDaFormula("arroz", cache), null);
});
