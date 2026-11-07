// Assistente Héfisto — compra pela foto da DANFE (purchase.fromInvoice).
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { tamanhoNaDescricao, lerConteudo, lerData, converter } from "../actions/lancar-nota.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao, PICANHA, EST_COZINHA, HOJE } from "./fixtures.mjs";

const A = "loja-a";
const EST_BAR = "e0000000-0000-4000-8000-0000000000ba";
const NOTA = {
  fornecedor: "FRIGORIFICO BOI BOM LTDA", cnpj: "12.345.678/0001-90", numero: "4521", serie: "1", data_emissao: HOJE,
  valor_total: 248.4, valor_frete: 0, valor_desconto: 0, vencimentos: [{ data: "2026-10-21", valor: 248.4 }],
  itens: [
    { codigo: "001", nome: "PICANHA", un: "KG", qtd: 2.5, valor_unitario: 66, preco: 165 },
    { codigo: "002", nome: "OLEO SOJA 900ML CX C/6", un: "CX", qtd: 1, valor_unitario: 48, preco: 48 },
    { codigo: "003", nome: "AGUA TONICA LATA 350ML", un: "UN", qtd: 12, valor_unitario: 2.95, preco: 35.4 },
  ],
};

function tabelas() {
  const t = tabelasPadrao();
  t.estoques.push({ id: EST_BAR, unidade_id: A, nome: "Bar", status: "ativo" });
  t.compras = [];
  t.compras_itens = t.compras_itens || [];
  t.contas_pagar_teste = [];
  return t;
}

async function montar({ negar = [] } = {}) {
  const chamadas = [];
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelas(), {
    rpcs: {
      compras_confirmar: async (a, dados) => {
        chamadas.push(a);
        const c = dados.compras.find((x) => x.id === a.p_compra_id);
        c.status = "confirmada";
        return { compra_id: c.id, status: "confirmada", conta_pagar_id: "cp-1", entradas_estoque: dados.compras_itens.filter((i) => i.compra_id === c.id).length };
      },
    },
  });
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  let n = 0;
  const pedir = (pedido) => processarComando({ pedido: { chave: `chave-nota-${++n}`, ...pedido }, ic, motor, servicoAcoes, store, correlationId: `c${n}` });
  const responder = (acaoId, valor) => processarComando({ pedido: { continuar: { acaoId, campo: "resposta", valor } }, ic, motor, servicoAcoes, store, correlationId: "r" });
  const confirmar = (acaoId, texto) => servicoAcoes.confirmar({ acaoId, confirmacaoTexto: texto, correlationId: "ok" });
  return { pedir, responder, confirmar, db, chamadas };
}

test("leitores: tamanho na descrição, conteúdo, data e conversão", () => {
  assert.deepEqual(tamanhoNaDescricao("OLEO SOJA 900ML CX C/6"), { porUnidade: { q: 900, u: "ml" }, pacote: 6 });
  assert.deepEqual(tamanhoNaDescricao("ARROZ 5KG"), { porUnidade: { q: 5, u: "kg" }, pacote: 1 });
  assert.equal(tamanhoNaDescricao("PICANHA"), null);
  assert.equal(lerConteudo("12 x 900 ml", "l"), 10.8);
  assert.equal(lerConteudo("5 kg", "g"), 5000);
  assert.equal(lerConteudo("24", "un"), 24);
  assert.equal(lerData("20/11", "2026-11-07"), "2026-11-20");
  assert.equal(lerData("hoje", "2026-11-07"), "2026-11-07");
  assert.equal(converter(2.5, "kg", "g"), 2500);
  assert.equal(converter(1, "kg", "l"), null);
});

test("foto da nota: confere, cadastra o que falta, prévia, CONFIRMAR e compra confirmada", async () => {
  const { pedir, responder, confirmar, db, chamadas } = await montar();
  let r = await pedir({ nota: NOTA });
  assert.equal(r.interpretacao.intencao, "compras.foto_nota");
  // picanha casa sozinha (kg); óleo: há "Óleo de soja" no cadastro → pergunta qual é
  assert.equal(r.tipo, "pergunta");
  assert.match(r.texto, /Item 2 da nota: "OLEO SOJA 900ML CX C\/6"/);
  const acao = r.pergunta.acaoId;
  const oleo = r.pergunta.opcoes.find((o) => /Óleo de soja/.test(o.rotulo));
  assert.ok(oleo, "oferece o Óleo de soja do cadastro");
  r = await responder(acao, oleo.id);
  // água tônica não existe: oferece cadastrar
  assert.match(r.texto, /Item 3 da nota: "AGUA TONICA LATA 350ML".*não está no cadastro/);
  r = await responder(acao, "novo");
  assert.match(r.texto, /é da Cozinha ou do Bar/);
  r = await responder(acao, "bar");
  // vencimento veio da nota → prévia
  assert.equal(r.tipo, "confirmacao");
  assert.equal(r.confirmacao.confirmacaoExplicita, true, "gera conta a pagar: exige CONFIRMAR");
  const l = Object.fromEntries(r.confirmacao.linhas.map((x) => [x.rotulo, x.valor]));
  assert.equal(l.Fornecedor, "FRIGORIFICO BOI BOM LTDA (novo)");
  assert.match(l.Picanha, /^2,5 kg · R\$\s?165,00 \(R\$\s?66,00\/kg\) · Cozinha$/);
  // 1 caixa × 6 × 900 ml; o cadastro do óleo é em L → 5,4 L
  assert.match(l["Óleo de soja"], /^5,4 L · R\$\s?48,00 \(R\$\s?8,89\/L\) · Cozinha$/);
  assert.match(l["Agua tonica lata 350ml (novo)"], /^4\.200 ml · R\$\s?35,40 .* · Bar$/);
  assert.match(l["Conta a pagar"], /R\$\s?248,40 · vence 21\/10\/2026/);
  assert.ok(!r.confirmacao.linhas.some((x) => x.rotulo === "Atenção"), "soma bate com o total");

  const ok = await confirmar(r.confirmacao.acaoId, "CONFIRMAR");
  assert.equal(ok.tipo, "resultado_acao");
  assert.match(ok.texto, /^Compra lançada/);
  const compra = db.dados.compras.find((c) => c.numero_documento === "4521");
  assert.ok(compra && compra.unidade_id === A && compra.status === "confirmada" && compra.data_vencimento === "2026-10-21");
  const forn = db.dados.fornecedores.find((f) => f.nome === "FRIGORIFICO BOI BOM LTDA");
  assert.equal(compra.fornecedor_id, forn.id);
  const novo = db.dados.insumos.find((i) => i.nome === "Agua tonica lata 350ml");
  assert.ok(novo && novo.departamento === "bar" && novo.unidade_medida === "ml" && novo.tamanho_embalagem === 350 && novo.unidade_id === A);
  assert.equal(novo.custo_compra, 2.95, "preço da lata pela nota");
  const itens = db.dados.compras_itens.filter((i) => i.compra_id === compra.id);
  assert.equal(itens.length, 3);
  const pic = itens.find((i) => i.insumo_id === PICANHA);
  assert.deepEqual([pic.quantidade_embalagens, pic.conteudo_por_embalagem, pic.unidade_base, pic.valor_total, pic.estoque_id], [2.5, 1000, "g", 165, EST_COZINHA]);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].p_data_vencimento, "2026-10-21");

  // a mesma nota de novo não é lançada
  const dup = await pedir({ nota: NOTA });
  assert.equal(dup.tipo, "erro_acao");
  assert.match(dup.texto, /A nota 4521 já foi lançada/);
});

test("total que não bate vira aviso; sem vencimento pergunta; item pode ficar de fora", async () => {
  const { pedir, responder } = await montar();
  const nota = { ...NOTA, numero: "999", valor_total: 300, vencimentos: [], itens: [NOTA.itens[0], { nome: "BRINDE", un: "UN", qtd: 1, preco: 0 }] };
  let r = await pedir({ nota });
  const acao = r.pergunta.acaoId;
  assert.match(r.texto, /"BRINDE"/);
  r = await responder(acao, "ignorar");
  assert.match(r.texto, /Quando vence o pagamento/);
  r = await responder(acao, "hoje");
  const l = r.confirmacao.linhas;
  assert.ok(l.some((x) => x.rotulo === "Fora do lançamento"));
  assert.ok(!l.some((x) => x.rotulo === "Atenção"), "com item fora, não compara com o total da nota");
  const r2 = await pedir({ nota: { ...NOTA, numero: "1000", valor_total: 300, vencimentos: [], itens: [NOTA.itens[0]] } });
  const a2 = r2.pergunta.acaoId;
  const r3 = await responder(a2, "20/10");
  assert.ok(r3.confirmacao.linhas.some((x) => x.rotulo === "Atenção" && /não bate com o total da nota/.test(x.valor)));
});

test("sem permissão de confirmar compras: bloqueado, nada gravado", async () => {
  const { pedir, db } = await montar({ negar: ["estoque.purchases.confirm"] });
  const r = await pedir({ nota: NOTA });
  assert.equal(r.tipo, "bloqueado");
  assert.equal(db.dados.compras.length, 0);
});
