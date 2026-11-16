// "Jhon, vamos montar uma marmita" (dono, 16/11/2026). TESTADO EM MOCK: a
// conversa inteira com banco em memória, do pedido até a prévia e o executor.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMarmita, paramsDoComando, lerTaxas, lerLucro, lerDuasQuantidades, lerBebida } from "../actions/criar-marmita.mjs";

const U = "11111111-1111-4111-8111-111111111111";
const I_FRANGO = "aaaaaaaa-0000-4000-8000-000000000001";
const I_BATATA = "aaaaaaaa-0000-4000-8000-000000000002";
const I_ARROZ = "aaaaaaaa-0000-4000-8000-000000000003";
const I_POTE = "aaaaaaaa-0000-4000-8000-000000000004";
const INSUMOS = [
  { id: I_FRANGO, nome: "Filé de frango", unidade_medida: "kg", custo_unitario: 24, custo_compra: 24, tamanho_embalagem: 1, departamento: "cozinha" },
  { id: I_BATATA, nome: "Batata frita congelada", unidade_medida: "kg", custo_unitario: 12, custo_compra: 24, tamanho_embalagem: 2, departamento: "cozinha" },
  { id: I_ARROZ, nome: "Arroz agulhinha", unidade_medida: "kg", custo_unitario: 6, custo_compra: 30, tamanho_embalagem: 5, departamento: "cozinha" },
  { id: I_POTE, nome: "Pote 750 ml", unidade_medida: "un", custo_unitario: 0.9, custo_compra: 90, tamanho_embalagem: 100, departamento: "embalagens" },
];
function dbeFalso() {
  const t = {
    insumos: INSUMOS, fichas_tecnicas: [], fichas_ingredientes: [],
    marmitaria_configuracoes: [{ canais: [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12, taxa_pagamento_pct: 3.2 }], tributos_pct: null, margem_lucro_alvo_pct: null,
      rateio: { regime: "mei", marmitas_mes: 1000, cmo_mes: 6000, custos_fixos: [{ nome: "Aluguel", valor: 2000 }] } }],
  };
  const q = (n) => { const r = { data: t[n] || [], error: null }; const o = { select: () => o, eq: () => o, gte: () => o, lte: () => o, limit: () => o, in: () => o, order: () => o, then: (f, g) => Promise.resolve(r).then(f, g) }; return o; };
  return { from: q, consultas: [] };
}

async function conversar(texto, respostas) {
  let params = { ...Object.fromEntries(criarMarmita.campos.map((c) => [c, null])), ...paramsDoComando(texto) };
  const perguntas = [];
  for (let passo = 0; passo < 60; passo++) {
    const v = criarMarmita.paramsSchema.parse(params);
    assert.ok(v.ok, `params inválidos no passo ${passo}: ${JSON.stringify(v)}`);
    const prep = await criarMarmita.preparar({ dbe: dbeFalso(), escopo: { unidadeId: U } }, v.valor);
    if (prep.erro) throw new Error(prep.erro);
    if (prep.pronto) return { prep, perguntas };
    const { persistir, ...f } = prep.faltando;
    perguntas.push(f.texto);
    params = { ...params, ...persistir };
    const tipo = persistir.pendente.tipo;
    const resp = respostas[tipo];
    assert.ok(resp !== undefined, `sem resposta para "${tipo}": ${f.texto}`);
    const valor = typeof resp === "function" ? resp(f) : Array.isArray(resp) ? resp.shift() : resp;
    params = criarMarmita.aplicarResposta(params, "resposta", valor);
  }
  throw new Error("conversa não terminou");
}

test("leitores: taxas, lucro, duas medidas e bebida", () => {
  assert.deepEqual(lerTaxas("12% de comissão e 3,2% de pagamento"), { comissao: 12, pagamento: 3.2 });
  assert.deepEqual(lerTaxas("só 15%"), { comissao: 15, pagamento: 0 });
  assert.deepEqual(lerLucro("R$ 5"), { reais: 5 });
  assert.deepEqual(lerLucro("15%"), { pct: 15 });
  assert.deepEqual(lerDuasQuantidades("150 g de frango e 30 g de empanado").map((x) => x.quantidade), [150, 30]);
  assert.deepEqual(lerBebida("Coca lata 350 ml, 12 por 30,00"), { nome: "Coca lata 350 ml", novo: { tamanho: 12, unidade: "un", preco: 30 } });
  assert.equal(paramsDoComando("Vamos montar uma marmita, o nome vai ser Frango empanado com fritas").nome, "Frango empanado com fritas");
});

test("a conversa do dono: 3 componentes, ficha do arroz, empanado, embalagem, app novo, preço, combo e montagem", async () => {
  const { prep, perguntas } = await conversar("Jhon, vamos montar uma marmita, o nome vai ser Frango empanado com fritas", {
    total: "3",
    componente: "batata frita, arroz branco, filé de frango empanado",
    escolha: (f) => (f.opcoes.some((o) => o.id === "ficha") && /arroz/i.test(f.texto) ? "ficha" : "comprado"),
    preco_compra: "1 kg por 9,00",
    sub_itens: "arroz 1 kg, óleo 30 ml, sal 20 g",
    sub_escolha: (f) => f.opcoes[0].id,
    sub_preco: ["900 ml por 8,10", "1 kg por 2,00"],
    sub_rendimento: "2,5 kg",
    empanado: "150 g de frango e 30 g de empanado",
    quantidade: ["120 g", "200 g"],
    embalagens: "pote, saco, adesivo",
    emb_preco: ["100 unidades por 10,00", "500 unidades por 25,00"],
    canal: "novo", canal_nome: "Keeta", canal_taxas: "10% de comissão e 3% de pagamento",
    lucro: "R$ 5",
    preco: (f) => "sim",
    combo: "sim", bebida: "Coca lata 350 ml, 12 por 30,00", bebida_preco: "6", combo_preco: "sim",
    montagem: "sim",
  });
  assert.ok(perguntas.some((t) => /quantos componentes/.test(t)));
  assert.ok(perguntas.some((t) => /montar a ficha do Arroz branco/i.test(t)));
  assert.ok(perguntas.some((t) => /gramas de Filé de frango e quantas de empanado/i.test(t)));
  assert.ok(perguntas.some((t) => /calculador/.test(t)));
  const pl = prep.pronto.payload;
  assert.equal(pl.unidade_id, U);
  assert.equal(pl.marmita.nome, "Frango empanado com fritas");
  assert.equal(pl.marmita.itens.length, 4); // batata, arroz (ficha), frango, empanado
  assert.equal(pl.subfichas[0].nome, "Arroz branco");
  assert.equal(pl.subfichas[0].rendimento, 2.5);
  assert.equal(pl.canalNovo.id, "keeta");
  assert.equal(pl.marmita.precos[0].canal, "keeta");
  assert.ok(pl.marmita.preco_venda > 0);
  assert.equal(pl.combo.bebida.nome, "Coca lata 350 ml");
  assert.ok(pl.combo.preco < pl.marmita.preco_venda + 6);
  assert.equal(pl.marmita.embalagens.length, 3);
  assert.ok(pl.etapas.length >= 4);
  // frango em kg no cadastro: 150 g → 0,15
  assert.ok(pl.marmita.itens.some((x) => x.insumo_id === I_FRANGO && x.quantidade === 0.15));
});

test("executor grava pela função da tela, na unidade da sessão, e troca as chaves dos novos", async () => {
  const { prep } = await conversar("vamos montar uma marmita, o nome vai ser Teste", {
    total: "1", componente: "filé de frango 150 g", embalagens: "nenhuma", canal: "ifood", lucro: "15%", preco: "sim", combo: "agora não", montagem: "Frango no pote; fechar",
  });
  const chamadas = [];
  const db = {
    rpc: async (nome, args) => { chamadas.push({ nome, args }); return nome === "marmitaria_salvar_ficha" ? { data: { id: "99999999-0000-4000-8000-000000000009", codigo: "M07" }, error: null } : { data: true, error: null }; },
    from: () => { const o = { select: () => o, eq: () => o, maybeSingle: async () => ({ data: null }), insert: () => o, update: () => o, single: async () => ({ data: { id: "x" } }) }; return o; },
  };
  const r = await criarMarmita.executar({ dbUsuario: db, escopo: { unidadeId: U } }, prep.pronto.payload);
  assert.equal(r.ok, true);
  const ficha = chamadas.find((c) => c.nome === "marmitaria_salvar_ficha");
  assert.equal(ficha.args.p_dados.unidade_id, U);
  assert.equal(ficha.args.p_dados.tipo, "marmita");
  const merge = chamadas.find((c) => c.nome === "merge_config_sistema_params");
  assert.deepEqual(merge.args.p_patch.marmitaria_processos["99999999-0000-4000-8000-000000000009"].etapas.map((e) => e.titulo), ["Frango no pote", "Fechar"]);
  const outra = await criarMarmita.executar({ dbUsuario: db, escopo: { unidadeId: "22222222-2222-4222-8222-222222222222" } }, prep.pronto.payload);
  assert.equal(outra.ok, false);
});
