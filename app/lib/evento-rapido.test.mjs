// Orçamento rápido por pessoa. Rode com: node --test app/lib/evento-rapido.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { catalogoDeFichas, filtrarCatalogo, orcamentoDoRapido } from "./evento-rapido.mjs";
import { resumoDoOrcamento, itensDoOrcamento } from "./evento-orcamento.mjs";
import { custoPorcaoDaFicha } from "./evento-financeiro.mjs";

const carne = { id: "carne", nome: "Carne de sol", unidade_medida: "kg", preco_normalizado: 39.9, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 };
const prato = { id: "prato", nome_receita: "Carne de sol", categoria: "Prato principal", departamento: "cozinha", rendimento_porcoes: 1, rendimento_unidade: "porcao",
  fichas_ingredientes: [{ insumos: carne, quantidade: 0.2, fator_correcao: 0 }] };
const molho = { id: "molho", nome_receita: "Molho base", eh_base: true, departamento: "cozinha" };
const drink = { id: "drink", nome_receita: "Caipirinha", departamento: "bar", categoria: "Drinks" };
const velho = { id: "velho", nome_receita: "Prato antigo", departamento: "cozinha", ativo: false };
const semCat = { id: "sc", nome_receita: "Açaí", departamento: "cozinha" };
const FICHAS = [prato, molho, drink, velho, semCat];

test("catálogo: cozinha e bar por categoria, sem pré-preparo nem inativa; ficha sem custo = null", () => {
  const c = catalogoDeFichas(FICHAS);
  assert.equal(c.total, 3);
  assert.deepEqual(c.cozinha.map((g) => g.categoria), ["Prato principal", "Outros"]);
  assert.deepEqual(c.bar.map((g) => g.categoria), ["Drinks"]);
  const carneItem = c.cozinha[0].itens[0];
  assert.equal(carneItem.custoPorcao, custoPorcaoDaFicha(prato, FICHAS));
  assert.ok(carneItem.custoPorcao > 0);
  assert.equal(c.bar[0].itens[0].custoPorcao, null);
});

test("busca sem acento e filtro de categoria", () => {
  const c = catalogoDeFichas(FICHAS);
  assert.equal(filtrarCatalogo(c.cozinha, { busca: "acai" })[0].itens[0].nome, "Açaí");
  assert.equal(filtrarCatalogo(c.cozinha, { categoria: "Outros" }).length, 1);
  assert.equal(filtrarCatalogo(c.cozinha, { busca: "xyz" }).length, 0);
});

test("orçamento rápido vira o orçamento do evento: mesmas contas da tela completa", () => {
  const orc = orcamentoDoRapido({
    convidados: 100, criancas: 0, equipe: "500", extras: 1000, meta_lucro_pct: 20, preco_por_pessoa: 80,
    itens: [{ ficha_id: "prato", nome: "Carne de sol", setor: "cozinha", por_pessoa: 0.5 }, { ficha_id: "drink", nome: "Caipirinha", setor: "bar", por_pessoa: 2 }],
    cliente: { cliente_nome: "Ana", data_evento: "2026-12-10" },
  }, { imposto_pct: 6, taxa_cartao_pct: 3, margem_alvo_pct: 15 });
  assert.equal(orc.tipo, "buffet");
  assert.deepEqual(orc.cardapio.map((i) => i.secao), ["buffet", "bar"]);
  assert.equal(orc.equipe[0].valor, 500);
  assert.equal(orc.extras[0].valor, 1000);
  assert.equal(orc.financeiro.meta_lucro_pct, 20);
  assert.equal(orc.cliente.convidados, 100);
  assert.equal(orc.cliente.cliente_nome, "Ana");
  const r = resumoDoOrcamento(orc, FICHAS);
  const cmvPP = custoPorcaoDaFicha(prato, FICHAS) * 0.5;
  assert.equal(r.cmvPorPessoa, Math.round(cmvPP * 100) / 100);
  assert.equal(r.receita, 8000);
  assert.ok(r.precoSugeridoPorPessoa > 0);
  // drink sem ficha completa: aparece como sem custo (não inventa)
  assert.deepEqual(r.semCusto, ["Caipirinha"]);
  assert.equal(itensDoOrcamento(orc, FICHAS)[1].semCusto, true);
});

test("sem equipe e extras: não cria linha vazia; crianças nunca passam dos convidados", () => {
  const orc = orcamentoDoRapido({ convidados: 10, criancas: 30, itens: [] });
  assert.deepEqual(orc.equipe, []);
  assert.deepEqual(orc.extras, []);
  assert.equal(orc.cliente.criancas, 10);
});

test("adicionais em categoria própria, depois das outras", () => {
  const c = catalogoDeFichas([...FICHAS, { id: "ad", nome_receita: "Adicional - Arroz", departamento: "cozinha", categoria: "Prato principal" }]);
  assert.deepEqual(c.cozinha.map((g) => g.categoria), ["Prato principal", "Outros", "Adicionais"]);
});

test("pesquisa pelo insumo: acha a ficha que leva o ingrediente e diz qual", () => {
  const c = catalogoDeFichas(FICHAS);
  const g = filtrarCatalogo(c.cozinha, { busca: "carne de sol" });
  assert.equal(g[0].itens[0].nome, "Carne de sol");
  const pelo = filtrarCatalogo(catalogoDeFichas([{ ...prato, nome_receita: "Escondidinho" }]).cozinha, { busca: "carne" });
  assert.equal(pelo[0].itens[0].nome, "Escondidinho");
  assert.equal(pelo[0].itens[0].peloInsumo, "Carne de sol");
});
