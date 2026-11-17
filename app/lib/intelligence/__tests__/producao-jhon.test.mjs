// Produção do dia pelo Jhon (HDEV-015): pedido → conta pelas fichas → prévia →
// plano do dia; e "quanto tenho pronto e quanto ganho". TESTADO EM MOCK
// (banco em memória; a função do plano é testada com SQL real em plano-dia-banco.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const A = "loja-a";
const u = (x) => ({ unidade_id: A, ...x });
const fi = (ficha_id, insumo_id, quantidade) => u({ ficha_id, insumo_id, subficha_id: null, quantidade, fator_correcao: 0 });
const sub = (ficha_id, subficha_id, quantidade) => u({ ficha_id, insumo_id: null, subficha_id, quantidade, fator_correcao: 0 });
const ins = (id, nome, unidade_medida, custo_unitario = 10, extra = {}) => u({ id, nome, unidade_medida, custo_unitario, tamanho_embalagem: 1, ...extra });

function tabelas() {
  const t = tabelasPadrao();
  t.fichas_tecnicas = [
    u({ id: "emp", nome_receita: "Frango empanado", departamento: "cozinha", eh_base: true, rendimento_porcoes: 10, rendimento_unidade: "un", ativo: true }),
    u({ id: "molho", nome_receita: "Molho de tomate da casa", departamento: "cozinha", eh_base: true, rendimento_porcoes: 5, rendimento_unidade: "kg", ativo: true }),
    u({ id: "parm", nome_receita: "Parmegiana", departamento: "cozinha", eh_base: true, rendimento_porcoes: 1, rendimento_unidade: "un", ativo: true }),
    u({ id: "limp", nome_receita: "Limpeza das fritadeiras", departamento: "limpeza", rendimento_porcoes: 1, rendimento_unidade: "vez", ativo: true }),
    u({ id: "m1", nome_receita: "Marmita parmegiana", departamento: "marmitaria", rendimento_porcoes: 1, ativo: true, status: "ativa" }),
  ];
  t.fichas_ingredientes = [
    fi("emp", "frango", 0.64), fi("emp", "farinha", 0.3), fi("emp", "leite", 0.2),
    fi("molho", "pote", 10), fi("molho", "alho", 0.1), fi("molho", "sal", 0.05), fi("molho", "acucar", 0.05),
    sub("parm", "emp", 1), sub("parm", "molho", 0.1), fi("parm", "queijo", 0.03),
    fi("limp", "oleo", 18), fi("limp", "sal", 0.5), fi("limp", "agua", 10),
    sub("m1", "emp", 1), sub("m1", "molho", 0.1),
  ];
  t.insumos = [
    ins("frango", "Filé de frango", "kg", 20), ins("farinha", "Farinha de rosca", "kg", 8), ins("leite", "Leite", "L", 5),
    ins("pote", "Molho de tomate (pote)", "un", 3), ins("alho", "Alho", "kg", 30), ins("sal", "Sal", "kg", 2), ins("acucar", "Açúcar", "kg", 4),
    ins("queijo", "Queijo muçarela", "kg", 35), ins("oleo", "Óleo de soja", "L", 8), ins("agua", "Água", "L", 0.01),
    ins("emp-est", "Frango empanado", "un", 2, { ficha_tecnica_id: "emp" }), ins("molho-est", "Molho de tomate da casa", "kg", 6, { ficha_tecnica_id: "molho" }),
    ins("bat80", "Batata porcionada 80 g", "un", 0.5), ins("batata", "Batata inglesa", "kg", 4),
  ];
  t.estoques = [u({ id: "e1", slug: "marmitaria", nome: "Produtos", status: "ativo" }), u({ id: "e2", slug: "producao-marmitaria", nome: "Produção", status: "ativo" }), u({ id: "e9", slug: "bar", nome: "Bar", status: "ativo" })];
  t.estoque_itens = [
    u({ estoque_id: "e1", insumo_id: "frango", quantidade_atual: 5 }), u({ estoque_id: "e2", insumo_id: "molho-est", quantidade_atual: 2 }),
    u({ estoque_id: "e2", insumo_id: "emp-est", quantidade_atual: 120 }), u({ estoque_id: "e1", insumo_id: "bat80", quantidade_atual: 300 }),
    u({ estoque_id: "e1", insumo_id: "batata", quantidade_atual: 12 }), u({ estoque_id: "e9", insumo_id: "frango", quantidade_atual: 999 }),
  ];
  t.marmitaria_configuracoes = [u({ canais: [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12 }], tributos_pct: 0, rateio: {} })];
  t.marmitaria_precificacao_canais = [u({ ficha_id: "m1", canal: "ifood", preco_venda: 29.9 })];
  t.marmitaria_fichas_embalagens = [];
  t.plano_dia = [];
  return t;
}

async function montar({ negar = [] } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const aprovados = [];
  const db = bancoFalso(tabelas(), { rpcs: { hefisto_aprovar_plano_dia: async (a) => { aprovados.push(a); return { ok: true, plano_id: "0f0f0f0f-0000-4000-8000-0000000000aa", tarefas: a.p_tarefas.length }; } } });
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  let n = 0;
  const pedir = (texto) => processarComando({ pedido: { chave: `chave-producao-${++n}`, texto }, ic, motor, servicoAcoes, store, correlationId: `c${n}` });
  return { pedir, confirmar: (acaoId) => servicoAcoes.confirmar({ acaoId, correlationId: "ok" }), aprovados };
}

const linhasDe = (r) => Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));

test("300 empanados, 150 parmegianas e limpeza: a conta na prévia e o plano na ordem", async () => {
  const { pedir, confirmar, aprovados } = await montar();
  const r = await pedir("Jhon, amanhã precisamos produzir 300 filés de frango empanado. Com esses 300, 150 vão ser parmegianas. Amanhã é dia de limpar as fritadeiras.");
  assert.equal(r.tipo, "confirmacao", JSON.stringify(r).slice(0, 600));
  const l = linhasDe(r);
  assert.match(l.Para, /^amanhã \(\d\d\/\d\d\)$/);
  assert.equal(l["300 Frango empanado"], "Filé de frango 19,2 kg · Farinha de rosca 9 kg · Leite 6 L");
  assert.match(l["150 Parmegiana"], /Frango empanado 150 un · Molho de tomate da casa 15 kg · Queijo muçarela 4,5 kg/);
  assert.match(l["Fabricar Molho de tomate da casa"], /^13 kg \(precisa 15 kg, tem 2 kg\): Molho de tomate \(pote\) 26 un · Alho 0,26 kg · Sal 0,13 kg · Açúcar 0,13 kg$/);
  assert.equal(l["Limpar as fritadeiras"], "Óleo de soja 18 L · Sal 0,5 kg · Água 10 L");
  assert.match(l["Falta no estoque"], /Filé de frango 14,2 kg/, "tem 5 kg na marmitaria; o frango do bar não conta");
  assert.equal(aprovados.length, 0, "nada gravado antes de confirmar");
  const ok = await confirmar(r.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao", ok.texto);
  assert.equal(aprovados.length, 1);
  assert.equal(aprovados[0].p_unidade, A);
  assert.deepEqual(aprovados[0].p_tarefas.map((t) => [t.titulo, t.tipo, t.quantidade]), [
    ["Fabricar Molho de tomate da casa", "producao", 13],
    ["Produzir Frango empanado", "producao", 300],
    ["Produzir Parmegiana", "producao", 150],
    ["Limpar as fritadeiras", "limpeza", 1],
  ]);
  assert.match(ok.texto, /programada: 4 tarefa/);
});

test("sem ficha para o que foi pedido: DADOS INSUFICIENTES, nada inventado", async () => {
  const { pedir } = await montar();
  const r = await pedir("amanhã precisamos produzir 50 coxinhas");
  assert.match(r.texto, /DADOS INSUFICIENTES/);
  assert.match(r.texto, /coxinhas/);
});

test("só quem aprova o plano programa a produção", async () => {
  const { pedir } = await montar({ negar: ["dashboard.intelligence.settings"] });
  const r = await pedir("amanhã precisamos produzir 300 filés de frango empanado");
  assert.equal(r.tipo, "bloqueado");
});

test("estoque pronto: empanado, molho, batata porcionada e não porcionada, e o lucro vendendo o empanado", async () => {
  const { pedir } = await montar();
  const r = await pedir("Jhon, mostra para mim quanto eu tenho de frango empanado no estoque, se eu vender quanto vou ganhar, e batata porcionada");
  assert.equal(r.interpretacao.intencao, "marmitaria.estoque_pronto");
  assert.match(r.texto, /Frango empanado: 120 un\. Dá 120 Marmita parmegiana no iFood; vendendo tudo, lucro de R\$/);
  assert.match(r.texto, /Batata porcionada 80 g: 300 un/);
  assert.match(r.texto, /Batata inglesa: 12 kg/);
  assert.equal(r.natureza, "ESTIMATIVA");
});

test("qual app dá mais lucro: cada marmita em cada app (ESTIMATIVA), sem preço fica fora", async () => {
  const deps = depsFalsas();
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const t = tabelas();
  t.marmitaria_configuracoes = [u({ canais: [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 27 }, { id: "99food", nome: "99Food", ativo: true, comissao_pct: 12 }, { id: "balcao", nome: "Balcão", ativo: true, comissao_pct: 0 }], tributos_pct: 0, rateio: {} })];
  t.marmitaria_precificacao_canais = [u({ ficha_id: "m1", canal: "ifood", preco_venda: 32 }), u({ ficha_id: "m1", canal: "99food", preco_venda: 30 })];
  const db = bancoFalso(t);
  const dbe = criarDbEscopado(db, ic.escopo);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador: criarVerificador(ctx, deps), agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador: criarVerificador(ctx, deps), relogio: () => AGORA });
  const r = await processarComando({ pedido: { chave: "chave-apps-0001", texto: "qual app dá mais lucro?" }, ic, motor, servicoAcoes, store, correlationId: "x" });
  assert.equal(r.interpretacao.intencao, "marmitaria.comparar_apps");
  assert.match(r.texto, /^99Food é o app que mais deixa lucro em 1 de 1 marmitas/);
  assert.match(r.texto, /1 marmita\(s\) estão sem preço em algum app/);
  const linha = r.blocos[0].itens[0];
  assert.match(linha.detalhe, /iFood: R\$\s?[\d,]+ · 99Food: R\$\s?[\d,]+ · Balcão: sem preço/);
  assert.equal(r.natureza, "ESTIMATIVA");
});
