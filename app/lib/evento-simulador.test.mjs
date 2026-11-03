// Simulador de evento: modalidades combinadas, resultado ao vivo e orçamento do evento.
import test from "node:test";
import assert from "node:assert/strict";
import { simulacaoVazia, normalizarSimulacao, calcularSimulacao, orcamentoDaSimulacao } from "./evento-simulador.mjs";
import { custoPorcaoDaFicha } from "./evento-financeiro.mjs";
import { resumoDoOrcamento, itensDoOrcamento } from "./evento-orcamento.mjs";

const ins = (id, preco) => ({ id, nome: id, unidade_medida: "kg", preco_normalizado: preco });
const ficha = (id, nome, insumo, qtdKg) => ({ id, nome_receita: nome, rendimento_porcoes: 1, rendimento_unidade: "porcao", fichas_ingredientes: [{ insumos: insumo, quantidade: qtdKg, fator_correcao: 0 }] });
const bolinho = ficha("bol", "Bolinho de carne", ins("carne", 40), 0.1);   // R$ 4,00 a porção
const arroz = ficha("arr", "Arroz paraense", ins("arroz", 20), 0.15);       // R$ 3,00
const caipi = ficha("cai", "Caipirinha", ins("cachaca", 30), 0.05);         // R$ 1,50
const semPreco = { id: "sp", nome_receita: "Pudim", rendimento_porcoes: 1, fichas_ingredientes: [] };
const FICHAS = [bolinho, arroz, caipi, semPreco];
const c = (f) => custoPorcaoDaFicha(f, FICHAS);

test("mesa montada: quantidade fechada não cresce com convidados; custo por convidado só divide", () => {
  const s = normalizarSimulacao({ convidados: "20", modalidades: { mesa: { ativa: true, itens: [{ ficha_id: "bol", quantidade: "35" }] } } });
  const r = calcularSimulacao(s, FICHAS);
  assert.equal(r.custoTotal, Math.round(c(bolinho) * 35 * 100) / 100);
  assert.equal(r.custoPorConvidado, Math.round((r.custoTotal / 20) * 100) / 100);
  const r40 = calcularSimulacao({ ...s, convidados: "40" }, FICHAS);
  assert.equal(r40.custoTotal, r.custoTotal, "mais convidados não redimensiona a mesa");
});

test("mesa + buffet + bar + equipe: cada uma com a sua conta, soma única, faturamento e saldo", () => {
  const s = normalizarSimulacao({
    convidados: "40", preco_por_pessoa: "80", outros_custos: "100",
    modalidades: {
      mesa: { ativa: true, itens: [{ ficha_id: "bol", quantidade: "50" }] },
      buffet: { ativa: true, itens: [{ ficha_id: "arr", por_pessoa: "0.5" }] },
      bar: { ativa: true, itens: [{ ficha_id: "cai", por_pessoa: "2" }] },
      equipe: { ativa: true, linhas: [{ funcao: "Garçom", quantidade: "2", valor: "150" }] },
    },
  });
  const r = calcularSimulacao(s, FICHAS);
  const esperado = { mesa: c(bolinho) * 50, buffet: c(arroz) * 0.5 * 40, bar: c(caipi) * 2 * 40, equipe: 300 };
  for (const p of r.partes) assert.equal(p.custo, Math.round(esperado[p.id] * 100) / 100, p.id);
  const total = Math.round((esperado.mesa + esperado.buffet + esperado.bar + 300 + 100) * 100) / 100;
  assert.equal(r.custoTotal, total);
  assert.equal(r.faturamento, 3200);
  assert.equal(r.saldo, Math.round((3200 - total) * 100) / 100);
  assert.equal(r.natureza, "SIMULAÇÃO");
});

test("modalidade desligada não entra; sem preço não inventa faturamento; ficha sem custo vira ESTIMATIVA", () => {
  const s = normalizarSimulacao({ convidados: "10", modalidades: { mesa: { ativa: true, itens: [{ ficha_id: "sp", quantidade: "10" }] }, buffet: { ativa: false, itens: [{ ficha_id: "arr", por_pessoa: "1" }] } } });
  const r = calcularSimulacao(s, FICHAS);
  assert.deepEqual(r.partes.map((p) => p.id), ["mesa"]);
  assert.equal(r.faturamento, null);
  assert.equal(r.saldo, null);
  assert.equal(r.semCusto, 1);
  assert.equal(r.natureza, "ESTIMATIVA");
});

test("continuar para precificação: o orçamento do evento dá o mesmo custo de comida e bebida", () => {
  const s = normalizarSimulacao({
    nome: "Confraternização", convidados: "40", preco_por_pessoa: "80", outros_custos: "100",
    modalidades: {
      mesa: { ativa: true, itens: [{ ficha_id: "bol", quantidade: "50" }] },
      buffet: { ativa: true, itens: [{ ficha_id: "arr", por_pessoa: "0.5" }] },
      bar: { ativa: true, itens: [{ ficha_id: "cai", por_pessoa: "2" }] },
      equipe: { ativa: true, linhas: [{ funcao: "Garçom", quantidade: "2", valor: "150" }] },
    },
  });
  const orc = orcamentoDaSimulacao(s, FICHAS);
  assert.equal(orc.cliente.convidados, 40);
  assert.equal(orc.cliente.nome_evento, "Confraternização");
  assert.equal(orc.financeiro.preco_por_pessoa, 80);
  assert.deepEqual(orc.cardapio.map((i) => [i.secao, i.medida || "pp"]), [["buffet", "total"], ["buffet", "pp"], ["bar", "pp"]]);
  assert.equal(orc.equipe.length, 1);
  assert.equal(orc.extras[0].valor, "100");
  const itens = itensDoOrcamento(orc, FICHAS);
  const custoComida = itens.reduce((t, i) => t + (i.emTotal ? i.custoTotalFixo : i.custoPorPessoa * 40), 0);
  const sim = calcularSimulacao(s, FICHAS);
  const custoSim = sim.partes.filter((p) => p.id !== "equipe").reduce((t, p) => t + p.custo, 0);
  assert.equal(Math.round(custoComida * 100) / 100, Math.round(custoSim * 100) / 100);
  const r = resumoDoOrcamento(orc, FICHAS);
  assert.ok(r, "o resumo do orçamento roda com o que veio do simulador");
});

test("simulação vazia começa com a mesa montada ligada", () => {
  assert.equal(simulacaoVazia().modalidades.mesa.ativa, true);
  assert.equal(normalizarSimulacao({ modalidades: {} }).modalidades.mesa.ativa, true);
  assert.equal(normalizarSimulacao({ modalidades: { mesa: { ativa: false } } }).modalidades.mesa.ativa, false);
});

// ── prato próprio na mesa montada ────────────────────────────────────────────
import { ingredienteDoInsumo, pratoProprioVazio } from "./evento-simulador.mjs";

test("prato próprio: ingrediente do cadastro (preço do produto) + ingrediente digitado; segue para o evento", () => {
  const carneCad = { id: "carne", nome: "Carne moída", unidade_medida: "kg", preco_normalizado: 40 };
  const ingCad = { ...ingredienteDoInsumo(carneCad), quantidade: "100", unidade_uso: "g" };           // 0,1 kg × 40 = R$ 4,00
  assert.deepEqual([ingCad.insumo_id, ingCad.preco_embalagem, ingCad.tamanho_embalagem, ingCad.unidade_embalagem], ["carne", "40", "1", "kg"]);
  const proprio = { nome: "Massa caseira", preco_embalagem: "10", tamanho_embalagem: "1", unidade_embalagem: "kg", quantidade: "50", unidade_uso: "g", aproveitamento_pct: 100 }; // R$ 0,50
  const prato = { ...pratoProprioVazio(), nome: "Pastel de carne", quantidade: "30", ingredientes: [ingCad, proprio] };
  const s = normalizarSimulacao({ convidados: "20", modalidades: { mesa: { ativa: true, itens: [prato, { ficha_id: "bol", quantidade: "10" }] } } });
  const r = calcularSimulacao(s, FICHAS);
  const linha = r.partes[0].linhas[0];
  assert.equal(linha.nome, "Pastel de carne");
  assert.equal(linha.custoPorcao, 4.5);
  assert.equal(linha.custo, 135, "30 pastéis × R$ 4,50");
  const orc = orcamentoDaSimulacao(s, FICHAS);
  assert.equal(orc.cardapio[0].origem, "exclusiva");
  assert.equal(orc.cardapio[0].medida, "total");
  const it = itensDoOrcamento(orc, FICHAS)[0];
  assert.equal(Math.round(it.custoTotalFixo * 100) / 100, 135, "o evento recebe o mesmo custo do prato próprio");
});
