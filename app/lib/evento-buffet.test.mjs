// Rode com: node --test app/lib/evento-buffet.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { orcamentoVazio, resumoDoOrcamento } from "./evento-orcamento.mjs";
import { producaoDoBuffet, equilibrioDoBuffet, sobrasDoBuffet } from "./evento-buffet.mjs";

// Arroz: porção de 100 g custa R$ 0,50 (R$ 5/kg); estrogonofe: porção de 150 g custa R$ 3,00 (R$ 20/kg).
const arroz = { id: "a", nome: "Arroz", secao: "buffet", origem: "exclusiva", por_pessoa: "1.5", peso_porcao_g: "100",
  ingredientes: [{ id: "i1", nome: "Arroz", preco_embalagem: 5, tamanho_embalagem: 1, unidade_embalagem: "kg", quantidade: 100, unidade_uso: "g", aproveitamento_pct: 100 }] };
const estrog = { id: "e", nome: "Estrogonofe", secao: "buffet", origem: "exclusiva", por_pessoa: "1", peso_porcao_g: "150",
  ingredientes: [{ id: "i2", nome: "Frango", preco_embalagem: 20, tamanho_embalagem: 1, unidade_embalagem: "kg", quantidade: 150, unidade_uso: "g", aproveitamento_pct: 100 }] };

function orc() {
  const o = orcamentoVazio({});
  o.tipo = "buffet";
  o.cardapio = [arroz, estrog];
  o.sobra_pct = 10;
  o.cliente.convidados = 100;
  o.equipe = [{ id: "q", funcao: "Garçom", quantidade: 4, valor: 150 }];
  o.extras = [{ id: "d", categoria: "decoracao", descricao: "Arranjos", valor: 400 }];
  o.financeiro.preco_por_pessoa = 30;
  o.financeiro.imposto_pct = 0; o.financeiro.maquininha_pct = 0;
  return o;
}

test("produção: gramas por pessoa × pessoas × (1 + sobra), sobra de segurança em peso e R$", () => {
  const r = resumoDoOrcamento(orc(), []);
  const p = producaoDoBuffet(r);
  const a = p.itens.find((i) => i.id === "a");
  assert.equal(a.porPessoaG, 150);
  assert.equal(a.produzirG, 16500);       // 150 g × 100 × 1,10
  assert.equal(a.sobraSegG, 1500);
  assert.equal(a.custo, 82.5);            // R$ 5/kg × 16,5 kg
  assert.equal(a.sobraSegValor, 7.5);
  assert.equal(a.custoKg, 5);
  assert.equal(p.comidaProduzirG, 16500 + 16500);
  assert.equal(p.comidaPorPessoaG, 330);
  assert.equal(p.sobraSegG, 3000);
  assert.equal(p.sobraSegValor, 37.5);    // 7,50 + 30,00
});

test("ponto de equilíbrio em convidados, pelo próprio orçamento", () => {
  const o = orc();
  const r = resumoDoOrcamento(o, []);
  // por convidado: preço 30 − custo (1,5×0,5 + 3) × 1,1 = 30 − 4,125 = 25,875; fixos 600 + 400 = 1000 → 39 convidados
  const e = equilibrioDoBuffet(o, [], r);
  assert.equal(e.pontoEquilibrio, 39);
  assert.equal(e.folga, 61);
  assert.ok(Math.abs(e.porConvidado - 25.875) < 0.01);
  assert.equal(e.situacao, "ok");
  const caro = orc(); caro.financeiro.preco_por_pessoa = 4;
  assert.equal(equilibrioDoBuffet(caro, []).pontoEquilibrio, null);
  const sem = orc(); sem.financeiro.preco_por_pessoa = 0;
  assert.equal(equilibrioDoBuffet(sem, []).situacao, "sem_dado");
});

test("sobras reais: peso, R$, % do produzido, consumo real por pessoa e ajuste", () => {
  const r = resumoDoOrcamento(orc(), []);
  const s = sobrasDoBuffet(producaoDoBuffet(r), { a: "4500", e: "" }, r.pessoasConsumo);
  const a = s.linhas.find((l) => l.id === "a");
  assert.equal(a.sobraG, 4500);
  assert.equal(a.sobraValor, 22.5);       // 4,5 kg × R$ 5
  assert.equal(a.sobraPct, 27.27);
  assert.equal(a.consumoPorPessoaG, 120); // (16.500 − 4.500) ÷ 100
  assert.equal(s.lancadas, 1);
  assert.equal(s.totalG, 4500);
  assert.equal(s.totalValor, 22.5);
  assert.deepEqual(s.ajustes.map((x) => [x.nome, x.de, x.para]), [["Arroz", 150, 120]]);
});
