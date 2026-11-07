// Rode: node --test app/lib/impressao-modelos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { MODELO_PADRAO, brl, escposDasVias, htmlDasVias, linhasDaConta, linhasDaProducao, mesclarModelos, semAcento, textoDaVia } from "./impressao-modelos.mjs";

const agora = new Date(2026, 10, 7, 12, 30);
const ticket = {
  id: "abcd1234", origem: "Salão", identificacao: "Mesa 5", garcom: "Caio", cliente: null,
  itens: [
    { quantidade: 2, nome: "Tacacá", observacao: "sem jambu", pessoa: "Ana" },
    { quantidade: 1, nome: "Pato no tucupi", observacao: null, pessoa: null },
  ],
};

test("mesclarModelos: completa o que falta, limita textos e confere tipos", () => {
  const m = mesclarModelos({ cozinha: { titulo: "", tamanho: "gigante", copias: 9, mostrar: { garcom: false, inventado: true } }, casa: { nome: "x".repeat(100) } });
  assert.equal(m.cozinha.titulo, "COZINHA");
  assert.equal(m.cozinha.tamanho, "grande");
  assert.equal(m.cozinha.copias, 3);
  assert.equal(m.cozinha.mostrar.garcom, false);
  assert.equal(m.cozinha.mostrar.inventado, undefined);
  assert.equal(m.cozinha.mostrar.pessoa, true);
  assert.equal(m.casa.nome.length, 60);
  assert.deepEqual(mesclarModelos(null).recibo, MODELO_PADRAO.recibo);
});

test("via da cozinha: mesa, garçom, pessoa e observação em destaque", () => {
  const t = textoDaVia(linhasDaProducao("cozinha", ticket, {}, { agora }), { largura: "80mm" });
  assert.match(t, /COZINHA/);
  assert.match(t, /Mesa 5/);
  assert.match(t, /Salao - Garcom: Caio/);
  assert.match(t, /2x Tacaca/);
  assert.match(t, /Para: Ana/);
  assert.match(t, /OBS: sem jambu/);
  assert.match(t, /#ABCD/);
  const linhas = linhasDaProducao("cozinha", ticket, {}, { agora });
  assert.equal(linhas.find((l) => l.texto?.includes("OBS:")).invertido, true);
});

test("via do bar: modelo próprio, campos desligados somem, acréscimo no título", () => {
  const modelos = { bar: { titulo: "BAR DO SEL", cabecalho: "Prioridade", mostrar: { garcom: false, numero: false, hora: false, pessoa: false } } };
  const t = textoDaVia(linhasDaProducao("bar", { ...ticket, acrescimo: true }, modelos, { agora }), { largura: "58mm" });
  assert.match(t, /BAR DO SEL/);
  assert.match(t, /ACRESCIMO/);
  assert.match(t, /Prioridade/);
  assert.doesNotMatch(t, /Garcom/);
  assert.doesNotMatch(t, /Para: Ana/);
  assert.doesNotMatch(t, /#ABCD/);
  for (const linha of t.split("\n")) assert.ok(linha.length <= 32, `linha passou de 32 colunas: "${linha}"`);
});

test("conferência e recibo: casa, totais, por pessoa, pagamentos e aviso", () => {
  const dados = {
    tipo: "salao", mesa: 5, garcom: "Caio", data: agora,
    itens: [{ nome: "Tacacá", qtd: 2, tot: 70 }, { nome: "Suco de cupuaçu", qtd: 1, tot: 12 }],
    subtotal: 82, desconto: 2, taxa: 8, total: 88,
    porPessoa: [{ nome: "Ana", total: 44 }, { nome: "Bia", total: 44 }],
    recebidos: [{ forma: "dinheiro", valor: 50 }, { forma: "pix", valor: 38 }], troco: 0,
  };
  const modelos = { casa: { nome: "Sel de Estrela", documento: "00.000.000/0001-00", telefone: "(91) 0000-0000" } };
  const conf = textoDaVia(linhasDaConta("conferencia", dados, modelos));
  assert.match(conf, /Sel de Estrela/);
  assert.match(conf, /CNPJ 00\.000\.000\/0001-00/);
  assert.match(conf, /CONFERENCIA DE CONTA/);
  assert.match(conf, /Mesa 5/);
  assert.match(conf, /Taxa de servico +R\$ 8,00/);
  assert.match(conf, /Ana +R\$ 44,00/);
  assert.doesNotMatch(conf, /Pix/, "conferência não mostra pagamento");
  assert.match(conf, /NAO E DOCUMENTO FISCAL/);
  const rec = textoDaVia(linhasDaConta("recibo", dados, modelos));
  assert.match(rec, /Pix +R\$ 38,00/);
  assert.match(rec, /Obrigado pela preferencia!/);
  assert.doesNotMatch(rec, /Por pessoa/);
  for (const linha of rec.split("\n")) assert.ok(linha.length <= 48);
});

test("HTML: escapa o que veio do pedido e mantém acentos", () => {
  const h = htmlDasVias([linhasDaProducao("cozinha", { ...ticket, itens: [{ quantidade: 1, nome: "<b>Maniçoba</b>" }] }, {}, { agora })]);
  assert.match(h, /&lt;b&gt;Maniçoba&lt;\/b&gt;/);
  assert.doesNotMatch(h, /<b>Maniçoba/);
});

test("ESC/POS: inicia, sem acento, corta entre vias e respeita o corte desligado", () => {
  const vias = [linhasDaProducao("cozinha", ticket, {}, { agora }), linhasDaProducao("cozinha", ticket, {}, { agora })];
  const bytes = escposDasVias(vias, { largura: "80mm" });
  assert.deepEqual([...bytes.slice(0, 2)], [0x1b, 0x40]);
  const cortes = [...bytes].reduce((n, _, i, a) => n + (a[i] === 0x1d && a[i + 1] === 0x56 ? 1 : 0), 0);
  assert.equal(cortes, 2);
  assert.ok([...bytes].every((x) => x < 0x80), "só ASCII");
  const semCorte = escposDasVias([vias[0]], { cortar: false });
  assert.equal([...semCorte].some((x, i, a) => x === 0x1d && a[i + 1] === 0x56), false);
});

test("auxiliares: dinheiro e texto sem acento", () => {
  assert.equal(brl(1234.5), "R$ 1.234,50");
  assert.equal(brl(0), "R$ 0,00");
  assert.equal(semAcento("Ação, Maniçoba – ok · 1º"), "Acao, Manicoba - ok - 1o");
  assert.equal(semAcento("☕"), "?");
});
