// Cardápio digital: tema, promoções, montagem a partir da ficha técnica,
// nome do cliente e conversa. Rode: node --test app/lib/cardapio-digital.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarConfigCardapio, normalizarTema, coresDoTema, contraste, limparUrl, normalizarBanner,
  promocaoVigente, promocoesVigentes, precoEfetivo, errosDaPromocao, quandoVale, rotuloDaPromocao, textoDias,
  categoriasEfetivas, montarCardapioPublico, filtrosDisponiveis, filtrarProdutos,
  saudacao, primeiroNome, aplicarNome, entenderMensagem, responderConversa, aberturaDaConversa,
  sugestaoParaCarrinho, totalDoCarrinho, conferirCarrinho, partesNoFuso,
} from "./cardapio-digital.mjs";

// Sábado, 17/10/2026, 18:30 em São Paulo (21:30 UTC).
const SAB_1830 = new Date("2026-10-17T21:30:00Z");
// Segunda, 19/10/2026, 23:30 em São Paulo.
const SEG_2330 = new Date("2026-10-20T02:30:00Z");

const ficha = (extra = {}) => ({ nome_comercial: "", descricao_comercial: "", categoria: "", ativo: true, status: "ativa", alergenicos: [], ...extra });
const PRODUTOS = [
  { id: "p1", nome_produto: "Maniçoba", preco_venda: 89, categoria: "Pratos Principais", departamento: "cozinha",
    ficha: ficha({ nome_comercial: "Maniçoba paraense", descricao_comercial: "Folha de mandioca cozida por sete dias.", categoria: "Prato principal 1 pessoa", alergenicos: ["Carne suína"], imagem_url: "/api/public/cardapio/u1/foto/p1" }) },
  { id: "p2", nome_produto: "Peixe frito", preco_venda: 120, categoria: "Pratos Principais", departamento: "cozinha", ficha: ficha({ categoria: "Prato principal 1 pessoa" }) },
  { id: "p3", nome_produto: "Caipirinha de cupuaçu", preco_venda: 28, categoria: "Drinks", departamento: "bar", ficha: ficha({ categoria: "Drinks" }) },
  { id: "p4", nome_produto: "Água sem gás", preco_venda: 6, categoria: "Drinks", departamento: "bar", ficha: null },
  { id: "p5", nome_produto: "Açaí 400ml", preco_venda: 34, categoria: "Sobremesas", departamento: "cozinha", ficha: ficha({ categoria: "Sobremesas" }) },
  { id: "p6", nome_produto: "Café", preco_venda: 0, categoria: "Pratos Principais", ficha: null },
  { id: "p7", nome_produto: "Prato antigo", preco_venda: 50, categoria: "Pratos Principais", ficha: ficha({ ativo: false }) },
  { id: "p8", nome_produto: "Escondido", preco_venda: 40, categoria: "Pratos Principais", ficha: null },
];

const CONFIG = {
  itens: {
    p1: { destaque: true, selos: ["da_casa", "serve_2"], harmoniza: "Cachaça de jambu" },
    p3: { selos: ["vegano"] },
    p8: { oculto: true },
  },
  promocoes: [
    { id: "happy", titulo: "Happy hour", tipo: "desconto", desconto_pct: 20, produto_ids: ["p3"], dias_semana: [1, 2, 3, 4, 5, 6], hora_inicio: "18:00", hora_fim: "20:00" },
    { id: "domingo", titulo: "Domingo da maniçoba", tipo: "preco", preco_promocional: 69.9, produto_ids: ["p1"], dias_semana: [0] },
  ],
};

// ─── limpeza ────────────────────────────────────────────────────────────────

test("configuração ruim volta ao padrão sem quebrar", () => {
  for (const lixo of [null, undefined, 42, "x", [], { tema: "x", categorias: "y", itens: [1], promocoes: {} }]) {
    const c = normalizarConfigCardapio(lixo);
    assert.equal(c.tema.fonte, "classica");
    assert.deepEqual(c.categorias, []);
    assert.deepEqual(c.itens, {});
    assert.deepEqual(c.promocoes, []);
    assert.equal(c.conversa.ativa, true);
  }
});

test("só https entra como imagem; javascript:, data: e http ficam de fora", () => {
  assert.equal(limparUrl("javascript:alert(1)"), "");
  assert.equal(limparUrl("data:image/png;base64,AAA"), "");
  assert.equal(limparUrl("http://exemplo.com/a.png"), "");
  assert.equal(limparUrl("//evil.com/a.png"), "");
  assert.equal(limparUrl("https://x.supabase.co/storage/v1/object/public/anexos/a.jpg"), "https://x.supabase.co/storage/v1/object/public/anexos/a.jpg");
  assert.equal(limparUrl("/api/public/cardapio/u/foto/p1"), "/api/public/cardapio/u/foto/p1");
});

test("cor inválida volta ao padrão e texto ilegível é corrigido", () => {
  const t = normalizarTema({ cor_primaria: "vermelho", cor_fundo: "#FAFAFA", cor_texto: "#ffffff", cor_cartao: "#fff" });
  assert.match(t.cor_primaria, /^#[0-9a-f]{6}$/);
  assert.equal(t.cor_fundo, "#fafafa");
  assert.ok(contraste(t.cor_texto, t.cor_fundo) >= 4.5, "texto branco em fundo branco foi trocado");
  assert.ok(contraste(t.cor_texto, t.cor_cartao) >= 4.5);
  const escuro = normalizarTema({ cor_fundo: "#1b1814", cor_texto: "#222222", cor_cartao: "#25211b" });
  assert.ok(contraste(escuro.cor_texto, escuro.cor_fundo) >= 4.5, "fundo escuro com texto escuro também é corrigido");
  const cores = coresDoTema({ cor_primaria: "#fef3c7", cor_cartao: "#ffffff", cor_texto: "#111111", cor_fundo: "#ffffff" });
  assert.equal(cores.destaque, "#111111", "preço não sai em amarelo-claro no cartão branco");
  assert.equal(cores.sobre_primaria, "#1c1917");
});

test("banner aceita foto e vídeo, sem url fica de fora e tem limite", () => {
  const b = normalizarBanner([
    { tipo: "video", url: "https://x.co/v.mp4", poster_url: "https://x.co/p.jpg", titulo: "Brasa", acao: { tipo: "categoria", id: "cat-drinks" } },
    { tipo: "imagem", url: "javascript:x" },
    { tipo: "qualquer", url: "https://x.co/a.jpg", acao: { tipo: "hackear", id: "1" } },
    ...Array.from({ length: 20 }, (_, i) => ({ url: `https://x.co/${i}.jpg` })),
  ]);
  assert.equal(b.length, 8);
  assert.deepEqual(b[0].acao, { tipo: "categoria", id: "cat-drinks" });
  assert.equal(b[0].tipo, "video");
  assert.equal(b[1].tipo, "imagem");
  assert.equal(b[1].acao, null);
});

// ─── promoções ──────────────────────────────────────────────────────────────

test("fuso de São Paulo: dia e hora do restaurante, não do servidor", () => {
  assert.deepEqual(partesNoFuso(SAB_1830), { data: "2026-10-17", minutos: 18 * 60 + 30, dia: 6 });
});

test("promoção respeita dia, hora, datas e liga/desliga", () => {
  const happy = CONFIG.promocoes[0];
  assert.equal(promocaoVigente(happy, SAB_1830), true);
  assert.equal(promocaoVigente(happy, new Date("2026-10-17T23:30:00Z")), false, "20:30 já acabou");
  assert.equal(promocaoVigente(happy, new Date("2026-10-18T21:30:00Z")), false, "domingo não tem");
  assert.equal(promocaoVigente({ ...happy, ativa: false }, SAB_1830), false);
  assert.equal(promocaoVigente({ ...happy, data_fim: "2026-10-16" }, SAB_1830), false);
  assert.equal(promocaoVigente({ ...happy, data_inicio: "2026-10-18" }, SAB_1830), false);
  assert.equal(promocaoVigente({ titulo: "Sempre", tipo: "aviso" }, SAB_1830), true);
});

test("horário que vira a noite conta para o dia em que começou", () => {
  const madrugada = { titulo: "Madrugada", tipo: "aviso", dias_semana: [1], hora_inicio: "22:00", hora_fim: "02:00" };
  assert.equal(promocaoVigente(madrugada, SEG_2330), true, "segunda 23:30");
  assert.equal(promocaoVigente(madrugada, new Date("2026-10-20T04:30:00Z")), true, "terça 01:30 ainda é a noite de segunda");
  assert.equal(promocaoVigente(madrugada, new Date("2026-10-21T04:30:00Z")), false, "quarta 01:30 é a noite de terça");
});

test("preço efetivo: a promoção mais barata, nunca mais caro que o normal", () => {
  const vig = promocoesVigentes([
    { id: "a", titulo: "A", tipo: "desconto", desconto_pct: 10, produto_ids: ["x"] },
    { id: "b", titulo: "B", tipo: "preco", preco_promocional: 80, produto_ids: ["x"] },
    { id: "c", titulo: "C", tipo: "preco", preco_promocional: 150, produto_ids: ["x"] },
  ], SAB_1830);
  assert.deepEqual(precoEfetivo({ id: "x", preco_venda: 100 }, vig), { preco: 80, preco_original: 100, promocao_id: "b" });
  assert.deepEqual(precoEfetivo({ id: "y", preco_venda: 100 }, vig), { preco: 100, preco_original: null, promocao_id: null });
  assert.deepEqual(precoEfetivo({ id: "x", preco_venda: 33.33 }, [vig[0]]), { preco: 30, preco_original: 33.33, promocao_id: "a" });
});

test("promoção incompleta é apontada antes de salvar", () => {
  assert.deepEqual(errosDaPromocao({ tipo: "preco" }), ["Dê um nome à promoção.", "Escolha os pratos da promoção.", "Informe o preço especial."]);
  assert.deepEqual(errosDaPromocao({ titulo: "X", tipo: "desconto", desconto_pct: 95, produto_ids: ["p1"] }), ["O desconto vai de 1% a 90%."]);
  assert.deepEqual(errosDaPromocao({ titulo: "Aviso", tipo: "aviso" }), []);
});

test("texto de quando vale e rótulo", () => {
  assert.equal(textoDias([1, 2, 3, 4, 5]), "Seg a Sex");
  assert.equal(textoDias([0, 6]), "Sáb e Dom");
  assert.equal(textoDias([]), "");
  assert.equal(quandoVale({ titulo: "x", dias_semana: [1, 2, 3, 4, 5], hora_inicio: "18:00", hora_fim: "20:30", data_fim: "2026-10-31" }), "Seg a Sex · das 18h às 20h30 · até 31/10");
  assert.equal(rotuloDaPromocao({ titulo: "x", tipo: "desconto", desconto_pct: 20 }), "20% off");
  assert.equal(rotuloDaPromocao({ titulo: "x", tipo: "preco", preco_promocional: 69.9 }), "por R$ 69,90");
});

// ─── montagem a partir da ficha ─────────────────────────────────────────────

test("cardápio sai das fichas: nome comercial, descrição, alergênicos e categoria da ficha; preço do produto", () => {
  const c = montarCardapioPublico({ unidade: { nome: "Sel de Estrela", delivery_aberto: true, taxa_entrega: 10 }, produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  const p1 = c.produtos.find((p) => p.id === "p1");
  assert.equal(p1.nome, "Maniçoba paraense");
  assert.equal(p1.descricao, "Folha de mandioca cozida por sete dias.");
  assert.deepEqual(p1.alergenicos, ["Carne suína"]);
  assert.equal(p1.preco, 89);
  assert.equal(p1.imagem_url, "/api/public/cardapio/u1/foto/p1");
  assert.equal(p1.harmoniza, "Cachaça de jambu");
  assert.deepEqual(c.categorias.map((x) => x.nome), ["Prato principal 1 pessoa", "Drinks", "Sobremesas"]);
  assert.deepEqual(c.categorias.map((x) => x.papel), ["comida", "bebida", "sobremesa"]);
  assert.deepEqual(c.categorias[0].produto_ids, ["p1", "p2"], "destaque primeiro");
});

test("adicionais saem dos pratos para a seção Adicionais (destaque continua primeiro)", () => {
  const produtos = [
    { id: "a1", nome_produto: "Adicional - Arroz branco", preco_venda: 12, categoria: "Pratos Principais", ficha: null },
    { id: "a2", nome_produto: "Adicionais de molho", preco_venda: 5, categoria: "Pratos Principais", ficha: null },
    { id: "b1", nome_produto: "Moqueca", preco_venda: 90, categoria: "Pratos Principais", ficha: null },
    { id: "b2", nome_produto: "Arroz paraense", preco_venda: 55, categoria: "Pratos Principais", ficha: null },
  ];
  const c = montarCardapioPublico({ produtos, config: { itens: { a1: { destaque: true } } }, agora: SAB_1830 });
  assert.deepEqual(c.categorias[0].produto_ids, ["b2", "b1"]);
  assert.deepEqual(c.categorias.find((x) => x.id === "cat-adicionais").produto_ids, ["a1", "a2"]);
});

test("fora do cardápio: preço zero, ficha desativada e oculto pelo dono", () => {
  const c = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  const ids = c.produtos.map((p) => p.id);
  for (const fora of ["p6", "p7", "p8"]) assert.ok(!ids.includes(fora), fora);
  assert.ok(ids.includes("p4"), "produto sem ficha (água) aparece pela categoria do produto");
});

test("promoção do happy hour baixa o preço só no horário", () => {
  const sab = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  const cai = sab.produtos.find((p) => p.id === "p3");
  assert.deepEqual([cai.preco, cai.preco_original, cai.promocao_id], [22.4, 28, "happy"]);
  assert.deepEqual(sab.promocoes.map((p) => p.id), ["happy"]);
  assert.equal(sab.promocoes[0].quando, "Seg a Sáb · das 18h às 20h");
  const depois = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SEG_2330 });
  assert.equal(depois.produtos.find((p) => p.id === "p3").preco, 28);
  assert.deepEqual(depois.promocoes, []);
});

test("categorias do dono: ordem dele, oculta some, produto sem lugar vai para Outros", () => {
  const config = {
    ...CONFIG,
    categorias: [
      { id: "bar", nome: "Bar", papel: "bebida" },
      { id: "cozinha", nome: "Da cozinha", papel: "comida" },
      { id: "doces", nome: "Doces", papel: "sobremesa", visivel: false },
    ],
    itens: { ...CONFIG.itens, p1: { ...CONFIG.itens.p1, categoria_id: "cozinha" }, p2: { categoria_id: "cozinha" }, p3: { selos: ["vegano"], categoria_id: "bar" }, p5: { categoria_id: "doces" } },
  };
  const c = montarCardapioPublico({ produtos: PRODUTOS, config, agora: SEG_2330 });
  assert.deepEqual(c.categorias.map((x) => x.id), ["bar", "cozinha", "outros"]);
  assert.deepEqual(c.categorias.find((x) => x.id === "outros").produto_ids, ["p4"]);
  assert.ok(!c.produtos.some((p) => p.id === "p5"), "seção oculta tira os pratos dela");
  assert.equal(categoriasEfetivas(normalizarConfigCardapio(config), PRODUTOS).length, 3);
});

test("toque do banner para algo fora do ar vira banner sem toque", () => {
  const config = { ...CONFIG, banner: [
    { url: "https://x.co/a.jpg", acao: { tipo: "produto", id: "p8" } },
    { url: "https://x.co/b.jpg", acao: { tipo: "produto", id: "p1" } },
    { url: "https://x.co/c.mp4", tipo: "video", acao: { tipo: "promocao", id: "domingo" } },
  ] };
  const c = montarCardapioPublico({ produtos: PRODUTOS, config, agora: SAB_1830 });
  assert.deepEqual(c.banner.map((b) => b.acao), [null, { tipo: "produto", id: "p1" }, null]);
});

test("filtros só aparecem se têm prato", () => {
  const c = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  assert.deepEqual(c.filtros.map((f) => f.id), ["da_casa", "serve_2", "vegano"]);
  assert.deepEqual(filtrarProdutos(c.produtos, { selos: ["vegano"] }).map((p) => p.id), ["p3"]);
  assert.deepEqual(filtrarProdutos(c.produtos, { busca: "manicoba" }).map((p) => p.id), ["p1"]);
  assert.deepEqual(filtrosDisponiveis([]), []);
});

// ─── nome e conversa ────────────────────────────────────────────────────────

test("saudação pelo horário de São Paulo", () => {
  assert.equal(saudacao(new Date("2026-10-17T12:00:00Z")), "Bom dia");
  assert.equal(saudacao(new Date("2026-10-17T18:00:00Z")), "Boa tarde");
  assert.equal(saudacao(SAB_1830), "Boa noite");
  assert.equal(saudacao(new Date("2026-10-17T06:00:00Z")), "Boa noite", "3h da manhã");
});

test("nome do cliente: primeiro nome limpo; sem nome, a frase continua certa", () => {
  assert.equal(primeiroNome("  lUCAS cavalcante "), "Lucas");
  assert.equal(primeiroNome("josé-maria"), "José-Maria");
  assert.equal(primeiroNome("123 !!!"), "");
  assert.equal(primeiroNome("<b>Ana</b>"), "Ana");
  assert.equal(aplicarNome("{saudacao}, {nome}! Que bom ter você aqui.", { nome: "ana", saudacao: "Boa noite" }), "Boa noite, Ana! Que bom ter você aqui.");
  assert.equal(aplicarNome("{saudacao}, {nome}! Que bom ter você aqui.", { saudacao: "Boa noite" }), "Boa noite! Que bom ter você aqui.");
  assert.equal(aplicarNome("Pedido recebido, {nome}. A cozinha já foi avisada."), "Pedido recebido. A cozinha já foi avisada.");
  assert.equal(aplicarNome("{nome}, que tal uma bebida?"), "Que tal uma bebida?");
});

test("conversa entende pedido por prato, por intenção e diz quando não achou", () => {
  const c = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  assert.deepEqual(entenderMensagem("tem caipirinha?", c), { tipo: "busca", consulta: "tem caipirinha?", produto_ids: ["p3"] });
  assert.deepEqual(entenderMensagem("quero algo leve", c), { tipo: "intencao", id: "leve" });
  assert.deepEqual(entenderMensagem("o que tem pra beber", c), { tipo: "intencao", id: "bebida" });
  assert.deepEqual(entenderMensagem("sou celíaco", c), { tipo: "intencao", id: "restricao" });
  const nada = responderConversa(entenderMensagem("pizza de calabresa", c), c);
  assert.equal(nada.produto_ids.length, 0);
  assert.match(nada.texto, /Não achei nada/);
  assert.ok(nada.acoes.length > 0, "oferece outro caminho");
  assert.equal(entenderMensagem("   ", c), null);
});

test("conversa não inventa: sem marcação, diz que não tem a informação", () => {
  const vazio = montarCardapioPublico({ produtos: PRODUTOS, config: {}, agora: SEG_2330 });
  for (const id of ["sugestao", "leve", "vegetariano", "rapido", "compartilhar"]) {
    const r = responderConversa({ tipo: "intencao", id }, vazio);
    assert.deepEqual(r.produto_ids, [], id);
  }
  assert.match(responderConversa({ tipo: "intencao", id: "promocoes" }, vazio).texto, /não tem promoção/);
  const rest = responderConversa({ tipo: "intencao", id: "restricao" }, vazio);
  assert.match(rest.texto, /confirme com a equipe/);
});

test("conversa usa o que o dono marcou e chama pelo nome", () => {
  const c = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  const sug = responderConversa({ tipo: "intencao", id: "sugestao" }, c, { nome: "lucas" });
  assert.deepEqual(sug.produto_ids, ["p1"]);
  assert.match(sug.texto, /^Lucas, /);
  assert.deepEqual(responderConversa({ tipo: "intencao", id: "compartilhar" }, c).produto_ids, ["p1"]);
  assert.deepEqual(responderConversa({ tipo: "intencao", id: "bebida" }, c).produto_ids, ["p3", "p4"], "promoção na frente");
  const rest = responderConversa({ tipo: "intencao", id: "restricao" }, c);
  assert.deepEqual(rest.produto_ids, ["p3"]);
  assert.match(rest.texto, /confirme com a equipe/);
  const promo = responderConversa({ tipo: "intencao", id: "promocoes" }, c);
  assert.match(promo.texto, /Happy hour — 20% off — Seg a Sáb · das 18h às 20h/);
  const abre = aberturaDaConversa(c, { nome: "lucas", agora: SAB_1830 });
  assert.match(abre.texto, /^Boa noite, Lucas! /);
  assert.ok(abre.acoes.some((a) => a.id === "promocoes"), "só oferece promoções quando tem");
  assert.ok(!aberturaDaConversa(montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SEG_2330 })).acoes.some((a) => a.id === "promocoes"));
});

// ─── carrinho ───────────────────────────────────────────────────────────────

test("carrinho: sugere bebida, depois sobremesa, e nada quando já tem", () => {
  const c = montarCardapioPublico({ produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  assert.equal(sugestaoParaCarrinho([], c), null);
  const s1 = sugestaoParaCarrinho([{ id: "p1", quantidade: 1 }], c);
  assert.equal(s1.tipo, "bebida");
  assert.deepEqual(s1.produto_ids, ["p3", "p4"]);
  assert.equal(sugestaoParaCarrinho([{ id: "p1", quantidade: 1 }, { id: "p3", quantidade: 1 }], c).tipo, "sobremesa");
  assert.equal(sugestaoParaCarrinho([{ id: "p1", quantidade: 1 }, { id: "p3", quantidade: 1 }, { id: "p5", quantidade: 1 }], c), null);
});

test("total mostrado usa o preço do cardápio e a taxa só no delivery", () => {
  const c = montarCardapioPublico({ unidade: { taxa_entrega: 10 }, produtos: PRODUTOS, config: CONFIG, agora: SAB_1830 });
  const carrinho = [{ id: "p1", quantidade: 2 }, { id: "p3", quantidade: 1 }];
  const pick = ({ subtotal, taxa, total }) => ({ subtotal, taxa, total });
  assert.deepEqual(pick(totalDoCarrinho(carrinho, c, { tipo: "qrcode" })), { subtotal: 200.4, taxa: 0, total: 200.4 });
  assert.deepEqual(pick(totalDoCarrinho(carrinho, c, { tipo: "delivery" })), { subtotal: 200.4, taxa: 10, total: 210.4 });
  const { validos, removidos } = conferirCarrinho([...carrinho, { id: "p8", quantidade: 1 }], c);
  assert.deepEqual(validos.map((v) => v.id), ["p1", "p3"]);
  assert.deepEqual(removidos.map((v) => v.id), ["p8"]);
});

test("link do cardápio: mesa limpa e links antigos do Experience", async () => {
  const { limparMesa, caminhoDoCardapio } = await import("./cardapio-link.mjs");
  assert.equal(limparMesa("Mesa 12"), "12");
  assert.equal(limparMesa("mesa-7"), "7");
  assert.equal(limparMesa("<script>"), "script");
  assert.equal(limparMesa(""), "");
  assert.equal(caminhoDoCardapio("seldeestrela"), "/cardapio/seldeestrela");
  assert.equal(caminhoDoCardapio("seldeestrela", { mesa: "Mesa 4" }), "/cardapio/seldeestrela?mesa=4");
});

// ─── combos e posição (27/10/2026) ──────────────────────────────────────────

test("combo: vira item da seção Combos (primeira), com de/por; prato fora do ar tira o combo", async () => {
  const { errosDoCombo, normalizarCombos } = await import("./cardapio-digital.mjs");
  const config = { ...CONFIG, combos: [
    { id: "duo", nome: "Maniçoba + caipirinha", itens: [{ produto_id: "p1", quantidade: 1 }, { produto_id: "p3", quantidade: 1 }], preco: "99,90" },
    { id: "morto", nome: "Com prato escondido", itens: [{ produto_id: "p1" }, { produto_id: "p8" }], preco: 50 },
    { id: "sem-preco", nome: "Sem preço", itens: [{ produto_id: "p1" }, { produto_id: "p3" }] },
  ] };
  assert.deepEqual(errosDoCombo({ nome: "", itens: [{ produto_id: "p1" }] }), ["Dê um nome ao combo.", "Um combo tem pelo menos 2 itens.", "Informe o preço do combo."]);
  assert.equal(normalizarCombos(config.combos).length, 2);
  const c = montarCardapioPublico({ produtos: PRODUTOS, config, agora: SAB_1830 });
  assert.equal(c.categorias[0].id, "combos");
  assert.deepEqual(c.categorias[0].produto_ids, ["combo-duo"]);
  const duo = c.produtos.find((p) => p.id === "combo-duo");
  assert.equal(duo.preco, 99.9);
  // sábado 18:30: caipirinha no happy hour (28 → 22,40); separado = 89 + 22,40
  assert.equal(duo.preco_original, 111.4);
  assert.deepEqual(duo.combo.itens.map((i) => [i.produto_id, i.quantidade]), [["p1", 1], ["p3", 1]]);
  assert.match(duo.descricao, /1× Maniçoba paraense \+ 1× Caipirinha de cupuaçu/);
  assert.ok(!c.produtos.some((p) => p.id === "combo-morto"));
  assert.ok(!c.produtos.some((p) => "ordem" in p));
});

test("combo no pedido: uma linha por prato, valor repartido, soma exata", async () => {
  const { linhasDoCombo } = await import("./cardapio-digital.mjs");
  const combo = { preco: 50, combo: { itens: [{ produto_id: "a", quantidade: 1, preco: 30 }, { produto_id: "b", quantidade: 2, preco: 10 }] } };
  const l = linhasDoCombo(combo, 3);
  assert.equal(l.length, 9);
  assert.ok(l.every((x) => x.quantidade === 1));
  assert.equal(Math.round(l.reduce((t, x) => t + x.valor_unitario, 0) * 100), 15000);
  assert.equal(l[0].valor_unitario, 30);
  assert.equal(l[1].valor_unitario, 10);
});

test("posição: o dono manda na ordem da seção; sem posição, a regra de antes (destaque primeiro)", () => {
  const config = { itens: { p1: { destaque: true }, p2: { ordem: 1 } } };
  const c = montarCardapioPublico({ produtos: PRODUTOS, config, agora: SEG_2330 });
  const pratos = c.categorias.find((x) => x.produto_ids.includes("p1"));
  assert.deepEqual(pratos.produto_ids.slice(0, 2), ["p2", "p1"]);
});

test("adicionais ganham seção própria depois das comidas; o dono ainda pode mover", () => {
  const produtos = [
    ...PRODUTOS,
    { id: "ad1", nome_produto: "Adicional - Arroz branco", preco_venda: 12, categoria: "Pratos Principais", departamento: "cozinha", ficha: null },
    { id: "ad2", nome_produto: "Adicional - Jambu", preco_venda: 12, categoria: "Pratos Principais", departamento: "cozinha", ficha: null },
  ];
  const c = montarCardapioPublico({ produtos, config: {}, agora: SEG_2330 });
  const ids = c.categorias.map((x) => x.id);
  const ad = c.categorias.find((x) => x.id === "cat-adicionais");
  assert.deepEqual(ad.produto_ids.sort(), ["ad1", "ad2"]);
  assert.ok(!c.categorias.some((x) => x.id !== "cat-adicionais" && x.produto_ids.includes("ad1")));
  // depois das comidas, antes das bebidas
  assert.ok(ids.indexOf("cat-adicionais") < ids.findIndex((id) => /drink/.test(id)));
  // o dono escolheu outra seção para um deles
  const c2 = montarCardapioPublico({ produtos, config: { itens: { ad1: { categoria_id: "cat-pratos-principais" } } }, agora: SEG_2330 });
  assert.ok(c2.categorias.find((x) => x.id === "cat-pratos-principais").produto_ids.includes("ad1"));
  assert.deepEqual(c2.categorias.find((x) => x.id === "cat-adicionais").produto_ids, ["ad2"]);
});
