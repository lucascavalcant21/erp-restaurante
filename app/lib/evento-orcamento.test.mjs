// Orçamento do evento em etapas. Rode com: node --test app/lib/evento-orcamento.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  orcamentoVazio, orcamentoDoEvento, custoDaFichaExclusiva, itensDoOrcamento, resumoDoOrcamento,
  pendenciasDoOrcamento, cardapioParaCliente, textoDoOrcamento, listaDeComprasDoOrcamento, camposDoEventoParaGravar, secaoDoItem,
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
