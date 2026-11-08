import test from "node:test";
import assert from "node:assert/strict";
import {
  alturasDasBarras, analiseDoEvento, analiseDoPrato, custoOperacional, faturamentoContraFixos,
  fatiasDeCusto, maioresPor, pontosDeEquilibrio,
} from "./painel-gerencial.mjs";

test("custo operacional: dia, hora e minuto", () => {
  // R$ 14.920 no mês, 26 dias, 9 h por dia
  const c = custoOperacional({ custoMes: 14920, diasMes: 26, horasDia: 9 });
  assert.equal(c.ok, true);
  assert.equal(c.dia, 573.85);
  assert.equal(c.hora, 63.76);
  assert.equal(c.minuto, 1.06);
  assert.deepEqual(c.faltando, []);
});

test("custo operacional sem horas: só o dia, e diz o que falta", () => {
  const c = custoOperacional({ custoMes: "3.000,00", diasMes: 25 });
  assert.equal(c.ok, true);
  assert.equal(c.dia, 120);
  assert.equal(c.hora, null);
  assert.deepEqual(c.faltando, ["horas de operação por dia"]);
});

test("custo operacional sem custo ou sem dias: nada é inventado", () => {
  assert.equal(custoOperacional({ custoMes: null, diasMes: 26 }).ok, false);
  assert.equal(custoOperacional({ custoMes: 0, diasMes: 26 }).dia, null);
  assert.deepEqual(custoOperacional({ custoMes: 1000 }).faltando, ["dias de operação no mês"]);
});

test("ponto de equilíbrio sem e com lucro", () => {
  // fixos 14.920; cada venda deixa 12,21 de contribuição; ticket 27,21; meta 3,60 por venda
  const p = pontosDeEquilibrio({ custoFixoMes: 14920, contribuicao: 12.21, ticket: 27.21, lucroMetaPorUnidade: 3.6, diasMes: 26 });
  assert.equal(p.ok, true);
  assert.equal(p.sem.unidadesMes, 1222); // 14920 / 12,21 = 1221,9 → 1222
  assert.equal(p.sem.unidadesDia, 47);
  assert.equal(p.sem.faturamentoMes, 33250.62);
  assert.equal(p.com.unidadesMes, 1733); // 14920 / (12,21 − 3,60) = 1732,9 → 1733
  assert.equal(p.com.lucroMetaPorUnidade, 3.6);
});

test("ponto de equilíbrio: contribuição negativa ou meta inalcançável", () => {
  assert.equal(pontosDeEquilibrio({ custoFixoMes: 1000, contribuicao: -2 }).ok, false);
  const p = pontosDeEquilibrio({ custoFixoMes: 1000, contribuicao: 5, lucroMetaPorUnidade: 6 });
  assert.equal(p.ok, true);
  assert.equal(p.com, null);
  assert.match(p.motivoCom, /não é alcançável/);
  const semMeta = pontosDeEquilibrio({ custoFixoMes: 1000, contribuicao: 5 });
  assert.equal(semMeta.com, null);
  assert.match(semMeta.motivoCom, /Defina a meta/);
});

test("ponto de equilíbrio sem dados: diz o que falta", () => {
  const p = pontosDeEquilibrio({ custoFixoMes: null, contribuicao: null });
  assert.equal(p.ok, false);
  assert.match(p.motivo, /equipe e custos fixos/);
  assert.match(p.motivo, /preço e custo/);
});

test("faturamento × custos fixos: resultado pela contribuição e barras na mesma escala", () => {
  const r = faturamentoContraFixos({ faturamento: 6222, contribuicao: 1395, custosFixos: 14920 });
  assert.equal(r.resultado, -13525);
  assert.equal(r.larguraFixos, 100);
  assert.equal(r.larguraFaturamento, 41.7);
  assert.equal(r.coberturaPct, 9.35);
  const semVenda = faturamentoContraFixos({ faturamento: null, custosFixos: 1000 });
  assert.equal(semVenda.resultado, null);
  assert.deepEqual(semVenda.faltando, ["faturamento", "custos variáveis das vendas"]);
});

test("fatias da rosca: ordem, percentuais que fecham 100% e Outros", () => {
  const { total, fatias } = fatiasDeCusto([
    { nome: "Equipe", valor: 6565 }, { nome: "Aluguel", valor: 4476 }, { nome: "Energia", valor: 1343 },
    { nome: "Internet", valor: 150 }, { nome: "Contador", valor: 900 }, { nome: "Gás", valor: 1486 }, { nome: "Vazio", valor: 0 },
  ], { maximo: 5 });
  assert.equal(total, 14920);
  assert.deepEqual(fatias.map((f) => f.rotulo), ["Equipe", "Aluguel", "Gás", "Energia", "Outros"]);
  assert.equal(fatias[4].valor, 1050);
  assert.equal(fatias[4].agrupadas, 2);
  assert.equal(Math.round(fatias.reduce((t, f) => t + f.pct, 0) * 10) / 10, 100);
  assert.deepEqual(fatiasDeCusto([]).fatias, []);
});

test("maiores e alturas das barras", () => {
  const itens = [{ n: "a", v: 10 }, { n: "b", v: null }, { n: "c", v: 43.82 }, { n: "d", v: -2 }];
  assert.deepEqual(maioresPor(itens, "v", 2).map((i) => i.n), ["c", "a"]);
  assert.deepEqual(alturasDasBarras([43.82, 21.91, 0, null]), [100, 50, 4, 0]);
});

test("análise do prato a partir da linha do cardápio", () => {
  const linha = { id: "m-1", nome: "Combinado", ficha: { imagem: "x.jpg" }, lucro: 14.28, lucroPct: 26, cmvPct: 37.7,
    sim: { com: { valido: true, preco: 54.9, custo: 26.97, margemContribuicao: 27.93, lucro: 14.28, cmo: 8, fixos: 5.65 } } };
  const a = analiseDoPrato(linha);
  assert.equal(a.venda, 54.9);
  assert.equal(a.contribuicao, 27.93);
  assert.equal(a.margemContribuicaoPct, 50.87);
  assert.equal(a.lucro, 14.28);
  assert.equal(a.foto, "x.jpg");
  assert.equal(analiseDoPrato({ semPreco: true }), null);
});

test("análise do evento a partir do resumo do orçamento", () => {
  const e = { id: 1, nome: "Casamento", data_evento: "2026-11-20", funil_status: "Confirmado",
    operacao_detalhes: { resumo: { receita: 20000, lucro: 4000, cmv: 7000, equipe: 3000, extras: 2000, taxas: 1500, prolabore: 2500, meta_lucro: 5000 } } };
  const a = analiseDoEvento(e);
  assert.equal(a.custo, 12000);
  assert.equal(a.contribuicao, 6500);
  assert.equal(a.margemContribuicaoPct, 32.5);
  assert.equal(a.lucroPct, 20);
  assert.equal(a.etapa, "CONFIRMADO");
  assert.equal(analiseDoEvento({ operacao_detalhes: {} }), null);
  // resumo antigo, sem composição: lucro sim, custo não (nada presumido)
  const antigo = analiseDoEvento({ id: 2, operacao_detalhes: { resumo: { receita: 1000, lucro: 100 } } });
  assert.equal(antigo.custo, null);
  assert.equal(antigo.lucro, 100);
});
