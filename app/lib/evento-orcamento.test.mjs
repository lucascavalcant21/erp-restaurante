// Orçamento do evento em etapas. Rode com: node --test app/lib/evento-orcamento.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  orcamentoVazio, orcamentoDoEvento, custoDaFichaExclusiva, itensDoOrcamento, resumoDoOrcamento,
  pendenciasDoOrcamento, cardapioParaCliente, textoDoOrcamento, listaDeComprasDoOrcamento, camposDoEventoParaGravar, secaoDoItem,
  custoDaPessoa, realizadoDoEvento, historicoDoCliente, conflitosDeEquipe, sugestoesDeEquipe, indicadoresDoFunil, modeloDoOrcamento, aplicarModelo, copiaDoOrcamento,
  bancoSemOrcamento, erroDeColunaDeEventos, mensagemErroEvento, MSG_BANCO_EVENTOS,
} from "./evento-orcamento.mjs";
import { custoPorcaoDaFicha } from "./evento-financeiro.mjs";

const carne = { id: "carne", nome: "Carne de sol", unidade_medida: "kg", preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 };
const prato = { id: "prato", nome_receita: "Carne de sol", rendimento_porcoes: 1, rendimento_unidade: "porcao",
  fichas_ingredientes: [{ insumos: carne, quantidade: 0.2, fator_correcao: 0 }] };
const FICHAS = [prato];

// Drink exclusivo: 50 ml de cachaça (garrafa 1 L a R$ 30) + 1 limão (R$ 0,50 un, aproveitamento 50%).
const caipirinha = {
  id: "c1", secao: "bar", origem: "exclusiva", nome: "Caipirinha", por_pessoa: 2,
  ingredientes: [
    { id: "a", nome: "Cachaça", preco_embalagem: 30, tamanho_embalagem: 1, unidade_embalagem: "L", quantidade: 50, unidade_uso: "ml", aproveitamento_pct: 100 },
    { id: "b", nome: "Limão", preco_embalagem: 0.5, tamanho_embalagem: 1, unidade_embalagem: "un", quantidade: 1, unidade_uso: "un", aproveitamento_pct: 50 },
  ],
};

function orcBase() {
  const o = orcamentoVazio({ imposto_pct: 6, taxa_cartao_pct: 3, margem_alvo_pct: 20 });
  o.tipo = "buffet";
  o.cardapio = [{ id: "p1", secao: "buffet", origem: "ficha", ficha_id: "prato", nome: "Carne de sol", por_pessoa: 0.5 }, caipirinha];
  o.equipe = [{ id: "e1", area: "Salão", nome: "Ana", quantidade: 2, valor: 150 }, { id: "e2", area: "Cozinha", nome: "João", quantidade: 1, valor: 200 }];
  o.extras = [{ id: "x1", categoria: "decoracao", descricao: "Flores", valor: 400 }, { id: "x2", categoria: "musica", descricao: "DJ", valor: 600 }];
  o.cliente.convidados = 100;
  o.financeiro.preco_por_pessoa = 80;
  o.financeiro.prolabore = { modo: "pct", valor: 5 };
  o.financeiro.comissoes = [{ id: "k1", nome: "Cerimonialista", modo: "valor", valor: 300 }];
  return o;
}

test("ficha exclusiva: embalagem ÷ tamanho × quantidade ÷ aproveitamento, convertendo L→ml", () => {
  const c = custoDaFichaExclusiva(caipirinha.ingredientes);
  // cachaça 30/1000 × 50 = 1,50 ; limão 0,50 × 1 ÷ 0,5 = 1,00
  assert.ok(Math.abs(c.custoPorcao - 2.5) < 1e-9);
  assert.deepEqual(c.problemas, []);
  const errado = custoDaFichaExclusiva([{ nome: "Açúcar", preco_embalagem: 5, tamanho_embalagem: 1, unidade_embalagem: "kg", quantidade: 10, unidade_uso: "ml" }]);
  assert.equal(errado.custoPorcao, 0);
  assert.match(errado.problemas[0], /não combinam/);
});

test("custo por pessoa de cada produto = custo da porção × porções por pessoa", () => {
  const itens = itensDoOrcamento(orcBase(), FICHAS);
  const cp = custoPorcaoDaFicha(prato, FICHAS);
  assert.ok(Math.abs(itens[0].custoPorPessoa - cp * 0.5) < 1e-9);
  assert.ok(Math.abs(itens[1].custoPorPessoa - 5) < 1e-9); // 2 caipirinhas × 2,50
});

test("DRE do evento: receita, taxas, CMV, equipe, extras, comissões, pró-labore e lucro limpo fecham", () => {
  const r = resumoDoOrcamento(orcBase(), FICHAS);
  const cp = custoPorcaoDaFicha(prato, FICHAS);
  assert.equal(r.receita, 8000);
  assert.equal(r.equipe, 500);
  assert.equal(r.extras, 1000);
  assert.equal(r.imposto, 480);
  assert.equal(r.maquininha, 240);
  assert.equal(r.cmvBebida, 500);
  assert.equal(r.cmvComida, Math.round(cp * 0.5 * 100 * 100) / 100);
  assert.equal(r.prolabore, 400);
  assert.equal(r.comissoesTotal, 300);
  const esperado = Math.round((8000 - 480 - 240 - r.cmv - 500 - 1000 - 300 - 400) * 100) / 100;
  assert.equal(r.lucro, esperado);
  const l = Object.fromEntries(r.dre.map((x) => [x.id, x]));
  assert.equal(l.lucro.valor, r.lucro);
  assert.equal(l.equipe.pct, 6.25);
  assert.equal(l.receita.porPessoa, 80);
  assert.ok(l.extra_decoracao && l.extra_musica && !l.extra_aluguel);
  assert.equal(r.custoTotalPorPessoa + r.lucroPorPessoa, 80);
});

test("preço sugerido por pessoa bate a meta de lucro; preço mínimo zera o lucro", () => {
  const o = orcBase();
  const r = resumoDoOrcamento(o, FICHAS);
  assert.ok(r.precoSugeridoPorPessoa > r.precoMinimoPorPessoa);
  // Cobrando o sugerido, o lucro limpo fica na meta (ou acima, pelo arredondamento para cima).
  o.financeiro.preco_por_pessoa = r.precoSugeridoPorPessoa;
  const r2 = resumoDoOrcamento(o, FICHAS);
  assert.ok(r2.lucroPct >= 20 - 0.01, `lucro ${r2.lucroPct}%`);
  assert.equal(r2.meta.atingida, true);
  o.financeiro.preco_por_pessoa = r.precoMinimoPorPessoa;
  const r3 = resumoDoOrcamento(o, FICHAS);
  assert.ok(Math.abs(r3.lucro) < 2, `lucro no mínimo ${r3.lucro}`);
});

test("migração: evento antigo vira orçamento sem perder pratos, equipe, aluguel e valor", () => {
  const ev = { capacidade: 50, valor_contratado: 5000, custo_aluguel_espaco: 300, taxa_imposto_pct: 8, nome: "Aniversário", cliente_nome: "Maria",
    cardapio_itens: [{ id: "i1", ficha_id: "prato", nome: "Carne de sol", quantidade_servida: 25, departamento: "cozinha", custo_porcao: 9 }] };
  const o = orcamentoDoEvento(ev, { imposto_pct: 6 }, [{ id: "q1", nome: "Pedro", funcao: "Garçom", custo: 120, area: "salao" }]);
  assert.equal(o.cardapio[0].por_pessoa, 0.5);
  assert.equal(o.equipe[0].area, "Salão");
  assert.equal(o.equipe[0].valor, 120);
  assert.equal(o.extras[0].valor, 300);
  assert.equal(o.financeiro.imposto_pct, 8);
  assert.equal(o.financeiro.preco_por_pessoa, 100);
  assert.equal(o.cliente.cliente_nome, "Maria");
  // Já salvo: as colunas do evento mandam nos dados do cliente.
  const salvo = orcamentoDoEvento({ ...ev, capacidade: 60, operacao_detalhes: { orcamento: { ...o, tipo: "alacarte" } } }, {});
  assert.equal(salvo.tipo, "alacarte");
  assert.equal(salvo.cliente.convidados, 60);
});

test("trocar o tipo do evento leva o item para uma seção válida", () => {
  assert.equal(secaoDoItem({ secao: "buffet" }, "alacarte"), "entrada");
  assert.equal(secaoDoItem({ secao: "bar" }, "alacarte"), "bar");
  assert.equal(secaoDoItem({ secao: "principal" }, "unico"), "unico");
});

test("proposta do cliente: produtos por seção e valor por pessoa, sem nenhum custo", () => {
  const o = orcBase();
  o.cliente = { ...o.cliente, cliente_nome: "Maria Souza", nome_evento: "Aniversário 30", data_evento: "2026-11-20", forma_pagamento: "PIX" };
  const r = resumoDoOrcamento(o, FICHAS);
  const g = cardapioParaCliente(o);
  assert.deepEqual(g.map((x) => x.rotulo), ["Buffet", "Bar e drinks"]);
  const t = textoDoOrcamento(o, r, { casa: "Héfisto" });
  assert.match(t, /Olá, Maria!/);
  assert.match(t, /Valor por pessoa: R\$ 80,00/);
  assert.match(t, /Total para 100 pessoas: R\$ 8\.000,00/);
  assert.match(t, /20\/11\/2026/);
  assert.doesNotMatch(t, /custo|CMV|lucro|Cachaça/i);
});

test("lista de compras junta fichas do sistema e ingredientes exclusivos", () => {
  const l = listaDeComprasDoOrcamento(orcBase(), FICHAS);
  const porNome = Object.fromEntries(l.itens.map((x) => [x.nome, x]));
  // carne: 0,5 porção × 100 pessoas × 0,2 kg = 10 kg líquidos → bruto com 15% de perda
  assert.ok(porNome["Carne de sol"].quantidade > 10);
  assert.equal(porNome["Cachaça"].quantidade, 10000); // 50 ml × 2 × 100
  assert.equal(porNome["Cachaça"].custo, 300);
  assert.equal(porNome["Limão"].quantidade, 400); // 1 × 2 × 100 ÷ 50%
});

test("pendências e gravação", () => {
  const o = orcBase();
  const r = resumoDoOrcamento(o, FICHAS);
  const p = pendenciasDoOrcamento(o, r, { hojeIso: "2026-10-01", etapa: "NOVO CONTATO" });
  assert.ok(p.includes("Nome do cliente não informado."));
  assert.ok(p.includes("Data do evento não definida."));
  const campos = camposDoEventoParaGravar(o, r, { utensilios_bar: "x" });
  assert.equal(campos.operacao_detalhes.utensilios_bar, "x");
  assert.equal(campos.operacao_detalhes.orcamento.tipo, "buffet");
  assert.equal(campos.valor_contratado, 8000);
  assert.equal(campos.capacidade, 100);
  assert.equal("data_evento" in campos, false);
  const semPreco = { ...o, financeiro: { ...o.financeiro, preco_por_pessoa: "" }, cliente: { ...o.cliente, convidados: 0 } };
  const c2 = camposDoEventoParaGravar(semPreco, resumoDoOrcamento(semPreco, FICHAS), {});
  assert.equal("valor_contratado" in c2, false);
  assert.equal("capacidade" in c2, false);
});

test("crianças: pagam % do adulto e comem uma fração; desconto sai da receita", () => {
  const o = orcBase();
  o.cliente.criancas = 20; // 80 adultos + 20 crianças
  o.financeiro.preco_crianca = { modo: "pct", valor: 50 };
  o.financeiro.consumo_crianca_pct = 50;
  o.financeiro.desconto = { modo: "valor", valor: 200 };
  const r = resumoDoOrcamento(o, FICHAS);
  assert.equal(r.adultos, 80);
  assert.equal(r.pessoasConsumo, 90);
  assert.equal(r.precoCrianca, 40);
  assert.equal(r.receitaBruta, 80 * 80 + 20 * 40);
  assert.equal(r.receita, 7200 - 200);
  assert.equal(r.cmvBebida, 450); // 5,00 por pessoa × 90 pessoas-equivalentes
  const l = Object.fromEntries(r.dre.map((x) => [x.id, x]));
  assert.equal(l.desconto.valor, 200);
  // Cobrando o sugerido (com crianças e desconto), a meta fecha.
  o.financeiro.preco_por_pessoa = r.precoSugeridoPorPessoa;
  const r2 = resumoDoOrcamento(o, FICHAS);
  assert.ok(r2.lucroPct >= 20 - 0.01, `lucro ${r2.lucroPct}%`);
  assert.ok(r2.lucroPct < 20.5);
  assert.ok(Number.isInteger(r.precoSugeridoRedondo) && r.precoSugeridoRedondo >= r.precoSugeridoPorPessoa);
});

test("sobra de segurança aumenta CMV e compras; gramas por pessoa viram porções", () => {
  const o = orcBase();
  o.sobra_pct = 10;
  const r = resumoDoOrcamento(o, FICHAS);
  assert.equal(r.cmvBebida, 550);
  const l = listaDeComprasDoOrcamento(o, FICHAS);
  assert.equal(l.itens.find((x) => x.nome === "Cachaça").quantidade, 11000);
  const g = orcBase();
  g.cardapio[0] = { ...g.cardapio[0], medida: "g", gramas_por_pessoa: 150 };
  const semPeso = resumoDoOrcamento(g, FICHAS).itens[0];
  assert.equal(semPeso.porPessoa, 0);
  assert.match(semPeso.problemas.join(), /peso da porção/);
  const comPeso = resumoDoOrcamento(g, [{ ...prato, peso_porcao_g: 300 }]).itens[0];
  assert.equal(comPeso.porPessoa, 0.5);
});

test("equipe por hora e conflitos de agenda", () => {
  assert.equal(custoDaPessoa({ quantidade: 2, modo: "hora", horas: 6, valor: 25 }), 300);
  assert.equal(custoDaPessoa({ quantidade: "", valor: 150 }), 150);
  const o = orcBase();
  o.cliente.data_evento = "2026-11-20";
  const outros = [{ id: "x", nome: "Casamento", data_evento: "2026-11-20", operacao_detalhes: { orcamento: { equipe: [{ nome: "ana " }] } } },
    { id: "y", nome: "Outro dia", data_evento: "2026-11-21", operacao_detalhes: { orcamento: { equipe: [{ nome: "João" }] } } }];
  assert.deepEqual(conflitosDeEquipe(o, outros).map((c) => c.nome), ["Ana"]);
  const sug = sugestoesDeEquipe(outros);
  assert.deepEqual(sug.map((x) => x.nome), ["ana", "João"]);
});

test("orçado × realizado: linha lançada substitui o orçado; recebido é só referência", () => {
  const o = orcBase();
  const r = resumoDoOrcamento(o, FICHAS);
  o.realizado = { equipe: "650", cmv_bebida: "420" };
  const x = realizadoDoEvento(o, r, { recebido: 8000 });
  const l = Object.fromEntries(x.linhas.map((y) => [y.id, y]));
  assert.equal(l.equipe.real, 650);
  assert.equal(l.equipe.diferenca, 150);
  assert.equal(l.cmv_bebida.diferenca, -80);
  assert.equal(l.receita.origem, "orcado");
  assert.equal(x.recebido, 8000);
  assert.equal(x.lancadas, 2);
  assert.equal(x.diferencaLucro, -70);
});

test("cliente: histórico pelo telefone; funil: conversão e lucro previsto", () => {
  const evs = [
    { id: "a", nome: "Aniv 29", cliente_telefone: "(81) 99999-1234", data_evento: "2025-11-20", valor_contratado: 5000, funil_status: "FINALIZADO", operacao_detalhes: { resumo: { lucro: 1000 } } },
    { id: "b", nome: "Atual", cliente_telefone: "81999991234", data_evento: "2026-11-20", valor_contratado: 8000, funil_status: "PROPOSTA ENVIADA" },
    { id: "c", nome: "Outro", cliente_telefone: "81911112222", data_evento: "2026-11-02", valor_contratado: 3000, funil_status: "CANCELADO" },
  ];
  assert.deepEqual(historicoDoCliente(evs, { cliente_telefone: "81 99999-1234" }, "b").map((e) => e.id), ["a"]);
  const f = indicadoresDoFunil(evs, "2026-11");
  assert.equal(f.eventos, 1);
  assert.equal(f.fechados, 0);
  assert.equal(f.conversao, 0);
  const todos = indicadoresDoFunil(evs, "");
  assert.equal(todos.fechados, 1);
  assert.equal(todos.lucro, 1000);
  assert.equal(Math.round(todos.conversao), 33);
});

test("modelos e cópia: sem cliente, ids novos, mantém cardápio e preço", () => {
  const o = orcBase();
  o.cliente.cliente_nome = "Maria";
  const m = modeloDoOrcamento(o, "Buffet 100");
  assert.equal(m.orcamento.cliente, undefined);
  assert.notEqual(m.orcamento.cardapio[0].id, o.cardapio[0].id);
  const novo = aplicarModelo({ ...orcamentoVazio({}), cliente: { ...orcamentoVazio({}).cliente, cliente_nome: "José" } }, m);
  assert.equal(novo.cliente.cliente_nome, "José");
  assert.equal(novo.cardapio.length, 2);
  assert.equal(novo.financeiro.preco_por_pessoa, 80);
  const c = copiaDoOrcamento({ ...o, cliente: { ...o.cliente, nome_evento: "Aniv", data_evento: "2026-11-20" }, realizado: { equipe: 1 } });
  assert.equal(c.cliente.data_evento, "");
  assert.equal(c.cliente.nome_evento, "Cópia de Aniv");
  assert.deepEqual(c.realizado, {});
});

test("banco sem a EVENTOS-ORC-1: detecta pela linha lida e traduz o erro do PostgREST", () => {
  assert.equal(bancoSemOrcamento({ id: "e", nome: "x" }), true);
  assert.equal(bancoSemOrcamento({ id: "e", nome: "x", operacao_detalhes: null }), false);
  assert.equal(bancoSemOrcamento(null), false);
  assert.equal(erroDeColunaDeEventos("Could not find the 'operacao_detalhes' column of 'eventos' in the schema cache"), true);
  assert.equal(erroDeColunaDeEventos("Could not find the 'historico_pagamentos' column of 'eventos' in the schema cache"), true);
  assert.equal(erroDeColunaDeEventos("column eventos.hora_inicio does not exist"), true);
  assert.equal(erroDeColunaDeEventos("new row violates row-level security policy"), false);
  assert.equal(mensagemErroEvento("column eventos.hora_inicio does not exist"), MSG_BANCO_EVENTOS);
  assert.equal(mensagemErroEvento("Failed to fetch"), "Failed to fetch");
});

test("o que está incluso na proposta: equipe por função e serviços, sem valores", async () => {
  const { incluidoNaProposta } = await import("./evento-orcamento.mjs");
  const o = orcBase();
  o.equipe = [{ funcao: "Garçom", quantidade: 3, valor: 150 }, { funcao: "Garçom", quantidade: 1, valor: 150 }, { area: "Cozinha", quantidade: "", valor: 200 }];
  const r = incluidoNaProposta(o);
  assert.deepEqual(r.equipe, ["Garçom × 4", "Cozinha × 1"]);
  assert.deepEqual(r.servicos, ["Flores", "DJ"]);
  assert.ok(!JSON.stringify(r).includes("150"));
});

test("quantidade fechada: 2 bolos em fatias de 50 g, 30 sanduíches; custo total ÷ pessoas", async () => {
  const { resumoDoOrcamento, itensDoOrcamento } = await import("./evento-orcamento.mjs");
  const orc = {
    tipo: "buffet", sobra_pct: 10, cliente: { convidados: 40, criancas: 0 },
    cardapio: [
      { id: "b", secao: "buffet", origem: "exclusiva", nome: "Bolo", medida: "total", quantidade_total: "2", fatia_g: "50", peso_porcao_g: "1000",
        ingredientes: [{ nome: "Bolo pronto", quantidade: "1", unidade_uso: "un", tamanho_embalagem: "1", unidade_embalagem: "un", preco_embalagem: "30" }] },
      { id: "s", secao: "buffet", origem: "exclusiva", nome: "Sanduíche", medida: "total", quantidade_total: "30",
        ingredientes: [{ nome: "Sanduíche", quantidade: "1", unidade_uso: "un", tamanho_embalagem: "1", unidade_embalagem: "un", preco_embalagem: "1,333333" }] },
    ],
    financeiro: { preco_por_pessoa: 35 },
  };
  const [bolo] = itensDoOrcamento(orc, []);
  assert.equal(bolo.fatias, 40);
  const r = resumoDoOrcamento(orc, []);
  // 2 × 30 + 30 × 1,33 = 100 (sem sobra: a quantidade é a decidida)
  assert.equal(Math.round(r.cmv), 100);
  assert.equal(Math.round(r.cmvPorPessoa * 100) / 100, 2.5);
  assert.equal(r.receita, 1400);
});

test("divisão do prato: 700 g em porções de 100 g; 1 porção dividida por pessoa", async () => {
  const { itensDoOrcamento, resumoDoOrcamento } = await import("./evento-orcamento.mjs");
  const orc = { tipo: "buffet", sobra_pct: 0, cliente: { convidados: 14 },
    cardapio: [{ id: "p", secao: "buffet", origem: "exclusiva", nome: "Peixe", peso_porcao_g: "700", fatia_g: "100", por_pessoa: "1",
      ingredientes: [{ nome: "Peixe", quantidade: "1", unidade_uso: "un", tamanho_embalagem: "1", unidade_embalagem: "un", preco_embalagem: "70" }] }],
    financeiro: {} };
  const [i] = itensDoOrcamento(orc, []);
  assert.equal(i.porcoesPorFicha, 7);
  assert.equal(Math.round(i.custoPorcaoDividida * 100) / 100, 10);
  assert.equal(Math.round(i.custoPorPessoa * 100) / 100, 10);
  // 14 pessoas × 1 porção de 100 g = 2 pratos = R$ 140
  assert.equal(Math.round(resumoDoOrcamento(orc, []).cmv), 140);
});

test("ticket por pessoa: mesa de R$ 100 para 50 pessoas = R$ 2 por pessoa, sem sobra", async () => {
  const { resumoDoOrcamento } = await import("./evento-orcamento.mjs");
  const ing = (preco) => [{ nome: "x", quantidade: "1", unidade_uso: "un", tamanho_embalagem: "1", unidade_embalagem: "un", preco_embalagem: String(preco) }];
  const orc = { tipo: "ticket", sobra_pct: 10, cliente: { convidados: 50 },
    cardapio: [
      { id: "a", secao: "lanche", origem: "exclusiva", nome: "Bolo", quantidade_total: "2", ingredientes: ing(30) },
      // item que veio do buffet (por pessoa) passa a contar pela quantidade da mesa
      { id: "b", secao: "lanche", origem: "exclusiva", nome: "Suco", medida: "porcao", por_pessoa: "1", quantidade_total: "4", ingredientes: ing(10) },
    ], financeiro: {} };
  const r = resumoDoOrcamento(orc, []);
  assert.equal(Math.round(r.cmv), 100);
  assert.equal(r.cmvPorPessoa, 2);
});

test("bases do cardápio: salva comidas ou bebidas e aplica em outro evento", async () => {
  const { baseDoCardapio, aplicarBase, itensParaBase, orcamentoVazio } = await import("./evento-orcamento.mjs");
  const orc = { ...orcamentoVazio(), tipo: "buffet", cardapio: [
    { id: "a", secao: "buffet", nome: "Arroz", por_pessoa: "0,5" },
    { id: "b", secao: "buffet", nome: "Frango", por_pessoa: "1" },
    { id: "c", secao: "bar", nome: "Suco", por_pessoa: "1" },
  ] };
  assert.equal(itensParaBase(orc, "bebidas").length, 1);
  const buffet = baseDoCardapio(orc, { nome: "Buffet da casa", tipo: "buffet" });
  assert.equal(buffet.itens.length, 2);
  assert.notEqual(buffet.itens[0].id, "a");
  const bebidas = baseDoCardapio(orc, { nome: "", tipo: "bebidas" });
  assert.equal(bebidas.nome, "Bebidas base");

  // Evento ticket: as comidas vão para "Comidas" em quantidade fechada.
  const ticket = { ...orcamentoVazio(), tipo: "ticket", cardapio: [{ id: "x", secao: "bar", nome: "Café" }] };
  const t1 = aplicarBase(ticket, buffet);
  assert.equal(t1.cardapio.length, 3);
  assert.deepEqual(t1.cardapio.slice(1).map((i) => [i.secao, i.medida]), [["lanche", "total"], ["lanche", "total"]]);
  // Substituir bebidas troca só o bar.
  const t2 = aplicarBase(t1, bebidas, { substituir: true });
  assert.deepEqual(t2.cardapio.map((i) => i.nome), ["Arroz", "Frango", "Suco"]);
  // Aplicar duas vezes não repete ids.
  const t3 = aplicarBase(t2, bebidas);
  assert.equal(new Set(t3.cardapio.map((i) => i.id)).size, t3.cardapio.length);
});
