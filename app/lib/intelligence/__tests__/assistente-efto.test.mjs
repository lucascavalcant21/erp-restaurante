// Assistente Efto — entrada em lote com local pelo setor, conferência de
// recebimento, pontualidade, ficha técnica pela conversa (com cadastro do
// ingrediente que falta), custo de X gramas e lucro a um preço.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { dividirEmItens } from "../commands/lote.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { paramsDoComando, lerCadastro, lerIngredientes, lerQuantidade, lerRendimento, lerPreco, aplicarResposta } from "../actions/criar-ficha.mjs";
import { avaliarPontualidade, divergenciaRecebimento, minutosNoFuso } from "../metrics/assistente.mjs";
import { localDoSetor } from "../actions/registrar-entrada.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao, PICANHA, EST_COZINHA, HOJE } from "./fixtures.mjs";

const A = "loja-a";
const EST_BAR = "e0000000-0000-4000-8000-0000000000ba";
const XAROPE = "a0000000-0000-4000-8000-0000000000c1";
const TOMATE = "a0000000-0000-4000-8000-0000000000c2";
const SAL = "a0000000-0000-4000-8000-0000000000c3";
const ALHO = "a0000000-0000-4000-8000-0000000000c4";

function tabelas() {
  const t = tabelasPadrao();
  t.estoques.push({ id: EST_BAR, unidade_id: A, nome: "Bar", status: "ativo" }, { id: "e0000000-0000-4000-8000-0000000000bb", unidade_id: A, nome: "Pré-preparos da Cozinha", status: "ativo" });
  t.insumos.push(
    { id: XAROPE, unidade_id: A, nome: "Xarope de guaraná", unidade_medida: "l", departamento: "bar", tamanho_embalagem: 1, custo_compra: 20, custo_unitario: 20, preco_normalizado: 20 },
    { id: TOMATE, unidade_id: A, nome: "Tomate", unidade_medida: "kg", departamento: "cozinha", tamanho_embalagem: 1, custo_compra: 10, custo_unitario: 10, preco_normalizado: 10 },
    { id: SAL, unidade_id: A, nome: "Sal Fino", unidade_medida: "kg", departamento: "cozinha", tamanho_embalagem: 1, custo_compra: 4, custo_unitario: 4, preco_normalizado: 4 },
    { id: ALHO, unidade_id: A, nome: "Alho", unidade_medida: "kg", departamento: "cozinha", tamanho_embalagem: 1, custo_compra: 30, custo_unitario: 30, preco_normalizado: 30 },
  );
  // picanha também está nos pré-preparos: a entrada vai para a Cozinha (setor do cadastro)
  t.estoque_itens.push({ unidade_id: A, estoque_id: "e0000000-0000-4000-8000-0000000000bb", insumo_id: PICANHA, quantidade_atual: 1 });
  t.colaboradores.push(
    { id: "co4", unidade_id: A, nome: "Duda", cargo: "Garçom", area_escala: "Salão", status: "ativo", dias_trabalho: "3", horario_entrada: "14:00", horario_saida: "22:00" },
    { id: "co5", unidade_id: A, nome: "Eva", cargo: "Caixa", area_escala: "Salão", status: "ativo", dias_trabalho: "3", horario_entrada: "10:00", horario_saida: "18:00" },
  );
  t.registro_ponto = [
    { unidade_id: A, colaborador_id: "co2", data_referencia: HOJE, hora_entrada: "2026-10-07T12:02:30Z" }, // 09:02 em SP
    { unidade_id: A, colaborador_id: "co5", data_referencia: HOJE, hora_entrada: "2026-10-07T12:55:00Z" }, // 09:55
    { unidade_id: "loja-b", colaborador_id: "cob", data_referencia: HOJE, hora_entrada: "2026-10-07T11:00:00Z" },
  ];
  // compra em rascunho com 2 kg de picanha pedidos
  t.vw_compras.push({ id: "c9", unidade_id: A, data_compra: HOJE, status: "rascunho", valor_itens: 130, valor_total: 130, fornecedor_id: null, created_at: `${HOJE}T10:00:00Z` });
  t.compras_itens.push({ id: "i9", unidade_id: A, compra_id: "c9", insumo_id: PICANHA, quantidade_embalagens: 2, quantidade_pedida_embalagens: 2, conteudo_por_embalagem: 1000, quantidade_base: 2000, unidade_base: "g", valor_total: 130 });
  return t;
}

function rpcEntrada(chamadas) {
  return async (a, dados) => {
    chamadas.push(a);
    let item = dados.estoque_itens.find((i) => i.estoque_id === a.p_estoque_id && i.insumo_id === a.p_insumo_id && i.unidade_id === a.p_unidade_id);
    if (!item) { item = { unidade_id: a.p_unidade_id, estoque_id: a.p_estoque_id, insumo_id: a.p_insumo_id, quantidade_atual: 0 }; dados.estoque_itens.push(item); }
    const antes = item.quantidade_atual;
    item.quantidade_atual = Math.round((antes + a.p_quantidade) * 1000) / 1000;
    return { ok: true, idempotente: false, movimento_id: `mov-${chamadas.length}`, saldo_anterior: antes, saldo_posterior: item.quantidade_atual, unidade_medida: "kg" };
  };
}

async function montar() {
  const rpcChamadas = [];
  const deps = depsFalsas();
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelas(), { rpcs: { estoque_movimentar: rpcEntrada(rpcChamadas) } });
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  let n = 0;
  let conversa = null;
  const guardar = (r) => { if (r?.referencia) conversa = r.referencia; return r; };
  const pedir = async (texto) => guardar(await processarComando({ pedido: { texto, chave: `chave-efto-${++n}`, conversa }, ic, motor, servicoAcoes, store, nomeUsuario: "Lucas", correlationId: `c-${n}` }));
  const responder = async (acaoId, valor) => guardar(await processarComando({ pedido: { continuar: { acaoId, campo: "resposta", valor } }, ic, motor, servicoAcoes, store, correlationId: "c-r" }));
  const confirmar = async (acaoId) => guardar(await servicoAcoes.confirmar({ acaoId, correlationId: "c-ok" }));
  return { pedir, responder, confirmar, db, rpcChamadas, store };
}

// ── leitores puros ───────────────────────────────────────────────────────────
test("lote: uma frase com vários itens vira um pedido por item", () => {
  const l = dividirEmItens("Adicione 3 kg de picanha, 4 kg de xarope de guaraná");
  assert.equal(l.intencao, "estoque.registrar_entrada");
  assert.deepEqual(l.itens.map((i) => [i.interpretacao.produto, i.interpretacao.quantidade, i.interpretacao.unidade]), [["picanha", 3, "kg"], ["xarope de guarana", 4, "kg"]]);
  assert.equal(dividirEmItens("Adicione 3kg de picanha e 2,5 kg de alho").itens[1].interpretacao.quantidade, 2.5);
  assert.equal(dividirEmItens("Perdi 2 kg de picanha"), null);
  assert.equal(dividirEmItens("Quanto tenho de óleo, e de picanha?"), null);
});

test("local pelo setor do cadastro: cozinha → Cozinha, bar → Bar", () => {
  const est = [{ id: "1", nome: "Cozinha" }, { id: "2", nome: "Bar" }, { id: "3", nome: "Pré-preparos da Cozinha" }];
  assert.equal(localDoSetor(est, { departamento: "bar" }).id, "2");
  assert.equal(localDoSetor(est, { departamento: "cozinha" }).id, "1");
  assert.equal(localDoSetor(est, { departamento: null }), null);
});

test("leitores da ficha: quantidade, embalagem e preço, rendimento, preço de venda, lista", () => {
  assert.deepEqual(lerQuantidade("300 g"), { quantidade: 300, unidade: "g" });
  assert.deepEqual(lerQuantidade("2,5 kg"), { quantidade: 2.5, unidade: "kg" });
  assert.deepEqual(lerQuantidade("meio quilo"), { quantidade: 0.5, unidade: "kg" });
  assert.deepEqual(lerQuantidade("2"), { quantidade: 2, unidade: null });
  assert.deepEqual(lerCadastro("1 kg por 8,90"), { tamanho: 1, unidade: "kg", preco: 8.9 });
  assert.deepEqual(lerCadastro("pacote de 500 g a R$ 4,50"), { tamanho: 500, unidade: "g", preco: 4.5 });
  assert.deepEqual(lerCadastro("8,90 o quilo"), { tamanho: 1, unidade: "kg", preco: 8.9 });
  assert.equal(lerCadastro("não sei"), null);
  assert.deepEqual(lerRendimento("rendeu 3 quilos"), { rendimento: 3, unidade: "kg" });
  assert.deepEqual(lerRendimento("10 porções"), { rendimento: 10, unidade: "porcao" });
  assert.equal(lerRendimento("3"), null);
  assert.equal(lerPreco("R$ 49,90"), 49.9);
  assert.equal(lerPreco("depois"), 0);
  assert.deepEqual(lerIngredientes("tomate 2 kg, sal 20 g e pimenta do reino").map((x) => [x.termo, x.quantidade ?? null, x.unidade ?? null]), [["Tomate", 2, "kg"], ["Sal", 20, "g"], ["Pimenta do reino", null, null]]);
  assert.deepEqual(lerIngredientes("2 kg de molho de tomate").map((x) => x.termo), ["Molho de tomate"]);
});

test("pedido de receita: nome e ingredientes saem da frase falada", () => {
  const p = paramsDoComando("Agora vamos montar uma receita na nossa ficha técnica. O nome dele vai ser molho de tomate, e ele vai tomate, sal, alho, pimenta do reino.");
  assert.equal(p.nome, "Molho de tomate");
  assert.equal(p.tipo, null);
  assert.deepEqual(p.itens.map((i) => i.termo), ["Tomate", "Sal", "Alho", "Pimenta do reino"]);
  const prato = paramsDoComando("Agora vamos montar um prato com essa base", { ficha: { id: "b0000000-0000-4000-8000-000000000001", nome: "Molho de tomate" } });
  assert.equal(prato.tipo, "prato");
  assert.equal(prato.fichaBaseId, "b0000000-0000-4000-8000-000000000001");
  assert.deepEqual(prato.itens.map((i) => i.termo), ["Molho de tomate"]);
  const semRef = paramsDoComando("montar um prato com essa base");
  assert.deepEqual(semRef.itens, []);
});

test("resposta ilegível vira aviso e a pergunta se repete", () => {
  const p = aplicarResposta({ itens: [{ termo: "Tomate" }], pendente: { tipo: "quantidade", indice: 0 } }, "resposta", "bastante");
  assert.equal(p.aviso, "Não entendi a quantidade.");
  const q = aplicarResposta({ itens: [{ termo: "Tomate" }], pendente: { tipo: "quantidade", indice: 0 } }, "resposta", "2 kg");
  assert.deepEqual([q.itens[0].quantidade, q.itens[0].unidade, q.aviso], [2, "kg", null]);
  const t = aplicarResposta({ itens: [{ termo: "Tomate" }, { termo: "Sal" }], pendente: { tipo: "cadastro", indice: 1 } }, "resposta", "tirar");
  assert.deepEqual(t.itens.map((x) => x.termo), ["Tomate"]);
});

test("pontualidade: minuto exato, tolerância indicada, ainda não chegou e mais tarde", () => {
  const fuso = "America/Sao_Paulo";
  const escala = { trabalham: [
    { id: "a", nome: "Ana", entrada: "15:40" }, { id: "b", nome: "Bruno", entrada: "09:00" },
    { id: "d", nome: "Duda", entrada: "14:00" }, { id: "e", nome: "Eva", entrada: "10:00" },
  ] };
  const registros = [{ colaborador_id: "b", hora_entrada: "2026-10-07T12:02:30Z" }, { colaborador_id: "e", hora_entrada: "2026-10-07T12:55:00Z" }, { colaborador_id: "x", hora_entrada: "2026-10-07T12:00:00Z" }];
  const av = avaliarPontualidade({ escala, registros, agoraMin: minutosNoFuso(AGORA, fuso), fuso });
  const por = Object.fromEntries(av.pessoas.map((p) => [p.nome, p]));
  assert.deepEqual([por.Bruno.situacao, por.Bruno.minutos, por.Bruno.tolerancia], ["atrasado", 2, true]);
  assert.deepEqual([por.Eva.situacao, por.Eva.minutos], ["no_horario", -5]);
  assert.deepEqual([por.Duda.situacao, por.Duda.minutos], ["nao_chegou", 60]);
  assert.equal(por.Ana.situacao, "ainda_nao_e_hora");
  assert.equal(av.foraDaEscala.length, 1);
  assert.deepEqual(divergenciaRecebimento(3, 2), { chegou: 3, pedido: 2, diferenca: 1, pct: 50, situacao: "a_mais" });
});

// ── conversa completa ────────────────────────────────────────────────────────
test("Adicione 3 kg de picanha, 4 kg de xarope: pergunta a origem uma vez e separa cozinha e bar", async () => {
  const { pedir, confirmar, rpcChamadas } = await montar();
  const r1 = await pedir("Adicione 3 kg de picanha, 4 kg de xarope de guaraná");
  assert.equal(r1.tipo, "pergunta");
  assert.match(r1.texto, /Entendi 2 itens/);
  const rec = r1.pergunta.opcoes.find((o) => o.id === "recebimento");
  const r2 = await pedir(rec.comando);
  assert.equal(r2.tipo, "lote");
  assert.equal(r2.itens.length, 2);
  const [pic, xar] = r2.itens;
  assert.equal(pic.tipo, "confirmacao");
  assert.equal(pic.confirmacao.linhas.find((l) => l.rotulo === "Local").valor, "Cozinha");
  // xarope é controlado em litro: "4 kg" não vira litro sem perguntar
  assert.equal(xar.tipo, "pergunta");
  assert.match(xar.texto, /Xarope de guaraná é controlado em L\/ml/);
  const ok = await confirmar(pic.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao");
  assert.equal(rpcChamadas[0].p_estoque_id, EST_COZINHA);
  // com a unidade certa o xarope vai para o Bar
  const r3 = await pedir("Recebi 3 kg de picanha e 4 litros de xarope de guaraná");
  const x2 = r3.itens[1];
  assert.equal(x2.tipo, "confirmacao");
  assert.equal(x2.confirmacao.linhas.find((l) => l.rotulo === "Local").valor, "Bar");
});

test("Chegou 3 kg de picanha, era para pedir 2: diferença e pedido em aberto", async () => {
  const { pedir } = await montar();
  const r = await pedir("Chegou 3 kg de picanha, só que era para pedir 2");
  assert.equal(r.interpretacao.intencao, "compras.conferir_recebimento");
  assert.match(r.texto, /Chegou 3 kg de Picanha, mas o pedido era 2 kg: veio 1 kg a mais \(\+50%\)/);
  assert.match(r.texto, /1 pedido\(s\) em aberto com Picanha: 2 kg/);
  assert.ok(r.acoes.some((a) => a.comando === "Dei entrada por recebimento de 3 kg de Picanha"));
});

test("Quanto tenho de óleo? continua respondendo pelo saldo", async () => {
  const { pedir } = await montar();
  const r = await pedir("Quanto é que eu tenho no estoque de óleo?");
  assert.equal(r.interpretacao.intencao, "estoque.saldo_produto");
  assert.match(r.texto, /Óleo de soja/);
});

test("Meus funcionários chegaram no horário? atrasado 2 min, ainda não chegou, no horário", async () => {
  const { pedir } = await montar();
  const r = await pedir("Meus funcionários todos chegaram no horário?");
  assert.equal(r.interpretacao.intencao, "rh.pontualidade");
  assert.match(r.texto, /^Não\./);
  assert.match(r.texto, /Atrasado: Bruno 2 min \(entrou 09:02, entrada 09:00\) — dentro da tolerância/);
  assert.match(r.texto, /Ainda não chegou: Duda \(entrada 14:00, 60 min de atraso até agora\)/);
  assert.match(r.texto, /No horário: Eva/);
  assert.match(r.texto, /Entram mais tarde: Ana às 15:40/);
  assert.ok(!JSON.stringify(r).includes("Zé da empresa B"));
});

test("ficha pela conversa: cadastra o que falta, custo, 200 g, base → prato com preço e lucro", async () => {
  const { pedir, responder, confirmar, db } = await montar();
  let r = await pedir("Agora vamos montar uma receita na nossa ficha técnica. O nome dele vai ser molho de tomate, e ele vai tomate, sal, alho, pimenta do reino.");
  assert.equal(r.interpretacao.intencao, "fichas.criar");
  const acao = r.pergunta.acaoId;
  assert.match(r.texto, /Quanto de Tomate vai em a receita|Quanto de Tomate vai/);
  r = await responder(acao, "3 kg");
  assert.match(r.texto, /Quanto de Sal Fino/);
  r = await responder(acao, "30 g");
  assert.match(r.texto, /Quanto de Alho/);
  r = await responder(acao, "100 g");
  assert.match(r.texto, /"Pimenta do reino" não está cadastrado/);
  r = await responder(acao, "custa muito");
  assert.match(r.texto, /^Não entendi a embalagem e o preço\./);
  r = await responder(acao, "1 kg por 50 reais");
  assert.match(r.texto, /Quanto de Pimenta do reino/);
  r = await responder(acao, "10 g");
  // 3 kg × 10 + 0,03 × 4 + 0,1 × 30 + 0,01 × 50 = 30 + 0,12 + 3 + 0,5 = 33,62
  assert.match(r.texto, /Custo dos ingredientes: R\$\s?33,62/);
  r = await responder(acao, "rendeu 3 quilos");
  assert.match(r.texto, /Rendeu 3 kg e custou R\$\s?33,62\. Isso é uma base/);
  r = await responder(acao, "base");
  assert.equal(r.tipo, "confirmacao");
  const linhas = Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  assert.equal(linhas["Custo por kg"].replace(/\s/g, " "), "R$ 11,21");
  assert.match(linhas["Cadastrar ingrediente"], /Pimenta do reino: 1 kg por R\$\s?50,00/);
  r = await confirmar(r.confirmacao.acaoId);
  assert.equal(r.tipo, "resultado_acao");
  assert.match(r.texto, /^Base criada\. Molho de tomate custa R\$\s?33,62 e rende 3 kg/);
  const ficha = db.dados.fichas_tecnicas.find((f) => f.nome_receita === "Molho de tomate");
  assert.ok(ficha && ficha.eh_base === true && ficha.unidade_id === A && ficha.rendimento_unidade === "kg");
  const novo = db.dados.insumos.find((i) => i.nome === "Pimenta do reino");
  assert.ok(novo && novo.unidade_id === A && novo.preco_normalizado === 50 && novo.departamento === "cozinha");
  assert.equal(db.dados.fichas_ingredientes.filter((i) => i.ficha_id === ficha.id).length, 4);
  assert.ok(db.dados.fichas_ingredientes.some((i) => i.ficha_id === ficha.id && i.insumo_id === novo.id && i.quantidade === 0.01));

  // "qual é o valor de 200 gramas dessa porção?" usa a ficha recém-criada
  r = await pedir("Qual é o valor de 200 gramas dessa porção?");
  assert.equal(r.interpretacao.intencao, "fichas.custo_quantidade");
  assert.match(r.texto, /^200 g de Molho de tomate custam R\$\s?2,24\./);

  // prato com a base
  r = await pedir("Agora vamos montar um prato com essa base");
  assert.equal(r.interpretacao.intencao, "fichas.criar");
  const prato = r.pergunta.acaoId;
  assert.match(r.texto, /nome do prato/);
  r = await responder(prato, "Espaguete ao sugo");
  assert.match(r.texto, /Quanto de Molho de tomate vai em o prato/);
  r = await responder(prato, "200 g");
  assert.match(r.texto, /Vai mais algum ingrediente além de Molho de tomate/);
  r = await responder(prato, "não");
  assert.match(r.texto, /Custo dos ingredientes: R\$\s?2,24/);
  r = await responder(prato, "1 porção");
  assert.match(r.texto, /O custo por porção é R\$\s?2,24\. Por quanto vai vender a porção/);
  r = await responder(prato, "R$ 50");
  const lp = Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  assert.match(lp["Lucro bruto por venda"], /R\$\s?47,76/);
  r = await confirmar(r.confirmacao.acaoId);
  assert.match(r.texto, /^Prato criado\. Espaguete ao sugo/);
  const fp = db.dados.fichas_tecnicas.find((f) => f.nome_receita === "Espaguete ao sugo");
  assert.ok(fp.eh_base === false && fp.preco_venda === 50);
  assert.ok(db.dados.fichas_ingredientes.some((i) => i.ficha_id === fp.id && i.subficha_id === ficha.id && Math.abs(i.quantidade - 0.2) < 1e-9));

  // lucro a outro preço
  r = await pedir("E se eu vender esse prato por 30 reais?");
  assert.equal(r.interpretacao.intencao, "fichas.lucro_preco");
  assert.match(r.texto, /Vendendo Espaguete ao sugo por R\$\s?30,00, com custo de R\$\s?2,24 por venda, o lucro bruto é R\$\s?27,76/);
});

test("ficha pela conversa respeita a permissão de criar ficha", async () => {
  const deps = depsFalsas({ negar: ["fichas.recipes.create", "cozinha.recipes.create", "bar.recipes.create"] });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const db = bancoFalso(tabelas());
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, relogio: () => AGORA });
  const r = await processarComando({ pedido: { texto: "Criar uma receita de molho com tomate", chave: "chave-negada-1" }, ic, motor, servicoAcoes, store, correlationId: "x" });
  assert.equal(r.tipo, "bloqueado");
  assert.ok(!db.dados.fichas_tecnicas.some((f) => /molho/i.test(f.nome_receita)));
});
