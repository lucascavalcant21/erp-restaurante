import test from "node:test";
import assert from "node:assert/strict";
import {
  obterBoasVindasConcierge,
  processarAcaoConcierge,
  responderPerguntaConcierge
} from "./server/concierge.mjs";

const PRODUTOS_TESTE = [
  {
    id: "p-1",
    nome_produto: "Pirarucu de Casaca com Farofa de Castanha",
    categoria: "Peixes Amazônicos",
    departamento: "cozinha",
    preco_venda: 89.9,
    descricao: "Lombo de pirarucu grelhado com banana-da-terra e farofa crocante.",
    harmonizacao: "Caipirinha de caju ou Vinho Branco Sauvignon Blanc",
    destaque: true
  },
  {
    id: "p-2",
    nome_produto: "Ancho Angus Grelhado",
    categoria: "Carnes Nobres",
    departamento: "cozinha",
    preco_venda: 98.0,
    descricao: "Corte nobre grelhado na brasa com chimichurri da casa e mousseline de mandioca.",
    harmonizacao: "Vinho Tinto Malbec ou Drink Old Fashioned",
    destaque: true
  },
  {
    id: "p-3",
    nome_produto: "Moqueca Amazônica de Tambaqui (2 pessoas)",
    categoria: "Para Compartilhar",
    departamento: "cozinha",
    preco_venda: 165.0,
    descricao: "Costela de tambaqui cozida em tucupi, leite de coco artesanal e pimentões.",
    harmonizacao: "Drink Cítrico de Maracujá ou Cerveja Artesanal",
    destaque: true
  },
  {
    id: "p-4",
    nome_produto: "Drink Selva Cítrica",
    categoria: "Drinks Autorais",
    departamento: "bar",
    preco_venda: 36.0,
    descricao: "Gin artesanal, infusão de capim-santo, limão cravo e xarope de maracujá.",
    destaque: true
  },
  {
    id: "p-5",
    nome_produto: "Mocktail Rio Negro (Sem Álcool)",
    categoria: "Bebidas Sem Álcool",
    departamento: "bar",
    preco_venda: 24.0,
    descricao: "Suco de amora silvestre, xarope de tangerina e água tônica artesanal.",
    destaque: false
  }
];

test("obterBoasVindasConcierge - estrutura multilíngue", () => {
  const pt = obterBoasVindasConcierge({ unidadeNome: "Seldeestrela", idioma: "pt" });
  assert.equal(pt.ok, true);
  assert.equal(pt.idioma, "pt");
  assert.match(pt.titulo, /Bem-vindo ao Seldeestrela/i);
  assert.ok(pt.botoes.length >= 6);
  assert.ok(pt.perguntasFrequentes.length >= 3);

  const en = obterBoasVindasConcierge({ unidadeNome: "Seldeestrela", idioma: "en" });
  assert.equal(en.idioma, "en");
  assert.match(en.titulo, /Welcome to Seldeestrela/i);

  const es = obterBoasVindasConcierge({ unidadeNome: "Seldeestrela", idioma: "es" });
  assert.equal(es.idioma, "es");
  assert.match(es.titulo, /Bienvenido a Seldeestrela/i);
});

test("processarAcaoConcierge - navegação por botões e estilos de drinks", () => {
  // 1. Drinks sem sub-opção abre sub-botões de estilos
  const drinksInicial = processarAcaoConcierge({
    acao: "drinks",
    produtos: PRODUTOS_TESTE,
    idioma: "pt"
  });
  assert.equal(drinksInicial.ok, true);
  assert.ok(drinksInicial.subBotoes.length >= 5);
  assert.ok(drinksInicial.subBotoes.some(b => b.id === "citrico"));

  // 2. Drinks com estilo cítrico
  const drinksCitrico = processarAcaoConcierge({
    acao: "drinks",
    subOpcao: "citrico",
    produtos: PRODUTOS_TESTE,
    idioma: "pt"
  });
  assert.equal(drinksCitrico.ok, true);
  assert.ok(drinksCitrico.produtos.some(p => p.nome_produto.includes("Selva Cítrica")));

  // 3. Peixes amazônicos
  const peixes = processarAcaoConcierge({
    acao: "peixes",
    produtos: PRODUTOS_TESTE,
    idioma: "pt"
  });
  assert.equal(peixes.ok, true);
  assert.ok(peixes.produtos.some(p => p.nome_produto.includes("Pirarucu")));

  // 4. Carnes nobres
  const carnes = processarAcaoConcierge({
    acao: "carnes",
    produtos: PRODUTOS_TESTE,
    idioma: "pt"
  });
  assert.equal(carnes.ok, true);
  assert.ok(carnes.produtos.some(p => p.nome_produto.includes("Ancho")));

  // 5. Compartilhar
  const compartilhar = processarAcaoConcierge({
    acao: "compartilhar",
    produtos: PRODUTOS_TESTE,
    idioma: "pt"
  });
  assert.equal(compartilhar.ok, true);
  assert.ok(compartilhar.produtos.some(p => p.nome_produto.includes("Moqueca")));
});

test("responderPerguntaConcierge - motor semântico sem alucinação", async () => {
  // Alérgenos / lactose
  const respAlergia = await responderPerguntaConcierge({
    pergunta: "Algum desses pratos tem lactose?",
    produtos: PRODUTOS_TESTE,
    unidadeNome: "Seldeestrela",
    idioma: "pt"
  });
  assert.equal(respAlergia.ok, true);
  assert.match(respAlergia.resposta, /lactose|leite/i);
  assert.ok(respAlergia.produtosRecomendados.length > 0);

  // Harmonização
  const respHarmonizacao = await responderPerguntaConcierge({
    pergunta: "Qual drink combina com peixe?",
    produtos: PRODUTOS_TESTE,
    unidadeNome: "Seldeestrela",
    idioma: "pt"
  });
  assert.equal(respHarmonizacao.ok, true);
  assert.match(respHarmonizacao.resposta, /cítricos|peixe/i);
  assert.ok(respHarmonizacao.produtosRecomendados.some(p => p.departamento === "bar"));

  // Orçamento
  const respOrcamento = await responderPerguntaConcierge({
    pergunta: "Quero um jantar para duas pessoas até R$ 200",
    produtos: PRODUTOS_TESTE,
    unidadeNome: "Seldeestrela",
    idioma: "pt"
  });
  assert.equal(respOrcamento.ok, true);
  assert.ok(respOrcamento.produtosRecomendados.length > 0);
  respOrcamento.produtosRecomendados.forEach(p => {
    assert.ok(p.preco_venda <= 170);
  });
});
