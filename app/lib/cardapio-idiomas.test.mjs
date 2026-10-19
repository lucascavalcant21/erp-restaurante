// Idiomas do cardápio (pt, en, es, fr, it, zh, ja, ko): nenhuma chave faltando,
// as mesmas {variáveis} em todos, nada esquecido em português, e a conversa
// entendendo e respondendo em cada língua. Rode: node --test app/lib/cardapio-idiomas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  IDS_IDIOMAS, _UI, CHAVES_UI, TEXTOS_PADRAO, RESPOSTAS, SELOS_T, INTENCOES_T, SAUDACOES, DIAS_T, HORAS_T, LIGACOES_DIAS, ROTULO_PROMO_T,
  detectarIdioma, t, traduzirAlergeno,
} from "./cardapio-idiomas.mjs";
import {
  montarCardapioPublico, localizarCardapio, entenderMensagem, responderConversa, aberturaDaConversa, aplicarNome, saudacao,
  formatarPreco, quandoVale, rotuloDaPromocao, taxaDeEntrega, totalDoCarrinho, normalizarConfigCardapio,
  camposParaTraduzir, lerTraducao, comTraducao, progressoDaTraducao,
} from "./cardapio-digital.mjs";

const OITO = ["pt", "en", "es", "fr", "it", "zh", "ja", "ko"];
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const colchetes = (s) => (String(s).match(/\[[^\]]*\]/g) || []).length;
// Palavras que são iguais em vários idiomas e por isso podem repetir o português.
const IGUAIS_OK = new Set(["whatsapp", "total", "subtotal", "tempo_entrega", "mesa", "idioma", "troco_placeholder", "itens_um", "conversa"]);

test("os oito idiomas, nesta ordem", () => {
  assert.deepEqual(IDS_IDIOMAS, OITO);
});

test("interface: toda chave existe em todo idioma, com as mesmas {variáveis} e sem texto vazio", () => {
  for (const idioma of OITO) {
    const ui = _UI[idioma];
    assert.deepEqual(Object.keys(ui).sort(), [...CHAVES_UI].sort(), `chaves de ${idioma}`);
    for (const k of CHAVES_UI) {
      assert.ok(String(ui[k]).trim(), `${idioma}.${k} vazio`);
      assert.equal(vars(ui[k]), vars(_UI.pt[k]), `${idioma}.${k}: variáveis diferentes do português`);
    }
  }
});

test("interface: nenhum idioma ficou com frase em português esquecida", () => {
  // espanhol e italiano dividem muitas palavras com o português ("Ver pedido", "Pedido mínimo"): ficam de fora
  for (const idioma of ["en", "fr", "zh", "ja", "ko"]) {
    const iguais = CHAVES_UI.filter((k) => !IGUAIS_OK.has(k) && _UI[idioma][k] === _UI.pt[k] && /[a-zà-ú]{4,}/i.test(_UI.pt[k]));
    // es/it/fr compartilham algumas palavras com o português (ex.: "Promoción"): só acusa frase inteira idêntica
    assert.deepEqual(iguais.filter((k) => _UI.pt[k].split(" ").length > 1), [], `${idioma} igual ao português`);
  }
});

test("chinês, japonês e coreano estão escritos nas suas próprias letras", () => {
  const ESCRITA = { zh: /[\u4e00-\u9fff]/, ja: /[\u3040-\u30ff\u4e00-\u9fff]/, ko: /[\uac00-\ud7af]/ };
  for (const [idioma, re] of Object.entries(ESCRITA)) {
    const semEscrita = CHAVES_UI.filter((k) => !["whatsapp", "tempo_entrega", "whatsapp_placeholder", "troco_placeholder"].includes(k) && !re.test(_UI[idioma][k]));
    assert.deepEqual(semEscrita, [], `${idioma}: textos sem a escrita do idioma`);
  }
  // japonês com kana (não só kanji, que seria chinês) e chinês sem kana
  assert.ok(Object.values(_UI.ja).filter((v) => /[\u3040-\u309f]/.test(v)).length > 100, "japonês tem hiragana");
  assert.ok(!Object.values(_UI.zh).some((v) => /[\u3040-\u30ff]/.test(v)), "chinês sem kana");
  assert.ok(!Object.values(_UI.zh).some((v) => /[們這過來說時國們]/.test(v)), "chinês simplificado, não tradicional");
});

test("textos padrão, respostas, selos, intenções, dias e horários completos nos oito", () => {
  for (const idioma of OITO) {
    assert.deepEqual(Object.keys(TEXTOS_PADRAO[idioma]).sort(), Object.keys(TEXTOS_PADRAO.pt).sort(), idioma);
    for (const [k, v] of Object.entries(TEXTOS_PADRAO[idioma])) {
      assert.equal(vars(v.replace(/[[\]]/g, "")), vars(TEXTOS_PADRAO.pt[k].replace(/[[\]]/g, "")), `${idioma}.${k}`);
      if (idioma !== "pt" && /\{nome\}/.test(v)) assert.equal(colchetes(v), 1, `${idioma}.${k}: o nome fica entre colchetes (some sem nome)`);
    }
    assert.deepEqual(Object.keys(RESPOSTAS[idioma]).sort(), Object.keys(RESPOSTAS.pt).sort(), idioma);
    for (const [k, v] of Object.entries(RESPOSTAS[idioma])) assert.equal(vars(v), vars(RESPOSTAS.pt[k]), `${idioma}.${k}`);
    for (const s of Object.values(SELOS_T)) assert.ok(s[idioma], `selo em ${idioma}`);
    for (const i of Object.values(INTENCOES_T)) assert.ok(i.rotulo[idioma], `intenção em ${idioma}`);
    assert.equal(SAUDACOES[idioma].length, 3);
    assert.equal(DIAS_T[idioma].length, 7);
    assert.ok(HORAS_T[idioma] && LIGACOES_DIAS[idioma] && ROTULO_PROMO_T[idioma]);
  }
});

test("idioma do aparelho: zh-TW, ja-JP, ko-KR, fr-CA, it-IT; desconhecido vira português", () => {
  assert.equal(detectarIdioma(["zh-TW", "en"]), "zh");
  assert.equal(detectarIdioma(["ja-JP"]), "ja");
  assert.equal(detectarIdioma(["ko-KR"]), "ko");
  assert.equal(detectarIdioma(["fr-CA"]), "fr");
  assert.equal(detectarIdioma(["it-IT"]), "it");
  assert.equal(detectarIdioma(["de-DE", "es-AR"]), "es");
  assert.equal(detectarIdioma(["de-DE"]), "pt");
  assert.equal(t("ja", "mesa", { mesa: 4 }), "テーブル 4");
  assert.equal(t("ko", "mesa", { mesa: 4 }), "4번 테이블");
  assert.equal(t("zh", "mesa", { mesa: 4 }), "4号桌");
});

test("alergênicos da ficha nos oito idiomas; o que não é da lista fica como a cozinha escreveu", () => {
  assert.equal(traduzirAlergeno("Glúten", "ja"), "小麦（グルテン）");
  assert.equal(traduzirAlergeno("Crustáceos", "ko"), "갑각류");
  assert.equal(traduzirAlergeno("leite", "en"), "Milk");
  assert.equal(traduzirAlergeno("Amendoim", "zh"), "花生");
  assert.equal(traduzirAlergeno("Ovos", "fr"), "Œufs");
  assert.equal(traduzirAlergeno("Castanhas", "it"), "Frutta a guscio");
  assert.equal(traduzirAlergeno("Pimenta biquinho", "ja"), "Pimenta biquinho");
});

test("preço no formato de cada idioma, sempre em real", () => {
  assert.equal(formatarPreco(29.9, "pt"), "R$ 29,90");
  assert.equal(formatarPreco(29.9, "en"), "R$29.90");
  assert.equal(formatarPreco(29.9, "es"), "R$ 29,90");
  assert.equal(formatarPreco(29.9, "ja"), "R$29.90");
  assert.match(formatarPreco(29.9, "fr"), /^29,90 R\$$/);
  assert.match(formatarPreco(12345.6, "it"), /^12\.345,60 R\$$/);
  assert.equal(formatarPreco(29.9, "it").includes("BRL"), false, "sempre o símbolo R$, nunca BRL");
});

test("promoção: rótulo e horário em cada língua", () => {
  const p = { titulo: "x", tipo: "desconto", desconto_pct: 20, dias_semana: [1, 2, 3, 4, 5], hora_inicio: "18:00", hora_fim: "20:30", data_fim: "2026-10-31" };
  assert.equal(quandoVale(p, "pt"), "Seg a Sex · das 18h às 20h30 · até 31/10");
  assert.equal(quandoVale(p, "en"), "Mon–Fri · 18:00–20:30 · until Oct 31");
  assert.equal(quandoVale(p, "es"), "Lun a Vie · de 18:00 a 20:30 · hasta el 31/10");
  assert.equal(quandoVale(p, "fr"), "Lun–Ven · de 18:00 à 20:30 · jusqu'au 31/10");
  assert.equal(quandoVale(p, "it"), "Lun–Ven · dalle 18:00 alle 20:30 · fino al 31/10");
  assert.equal(quandoVale(p, "zh"), "周一至周五 · 18:00–20:30 · 截至10月31日");
  assert.equal(quandoVale(p, "ja"), "月〜金曜 · 18:00〜20:30 · 10月31日まで");
  assert.equal(quandoVale(p, "ko"), "월~금요일 · 18:00~20:30 · 10월 31일까지");
  assert.equal(quandoVale({ titulo: "x", dias_semana: [6] }, "ja"), "土曜");
  assert.equal(rotuloDaPromocao(p, "zh"), "8折");
  assert.equal(rotuloDaPromocao({ ...p, desconto_pct: 15 }, "zh"), "8.5折");
  assert.equal(rotuloDaPromocao(p, "ja"), "20%オフ");
  assert.equal(rotuloDaPromocao(p, "ko"), "20% 할인");
  assert.equal(rotuloDaPromocao({ titulo: "x", tipo: "preco", preco_promocional: 29.9 }, "en"), "now R$29.90");
});

test("saudação e nome: certo com e sem nome em cada idioma", () => {
  const noite = new Date("2026-10-17T22:00:00Z"); // 19h em São Paulo
  const esperado = {
    pt: ["Boa noite, Ana! Que bom te ver de novo.", "Boa noite! Que bom te ver de novo."],
    en: ["Good evening, Ana! Good to see you again.", "Good evening! Good to see you again."],
    es: ["¡Buenas noches, Ana! Qué gusto verte de nuevo.", "¡Buenas noches! Qué gusto verte de nuevo."],
    fr: ["Bonsoir, Ana ! Ravis de vous revoir.", "Bonsoir ! Ravis de vous revoir."],
    it: ["Buonasera, Ana! Che bello rivederti.", "Buonasera! Che bello rivederti."],
    zh: ["晚上好，Ana！欢迎再次光临。", "晚上好！欢迎再次光临。"],
    ja: ["こんばんは、Anaさん！またのご来店ありがとうございます。", "こんばんは！またのご来店ありがとうございます。"],
    ko: ["안녕하세요, Ana님! 다시 찾아주셔서 반가워요.", "안녕하세요! 다시 찾아주셔서 반가워요."],
  };
  for (const [idioma, [com, sem]] of Object.entries(esperado)) {
    const s = saudacao(noite, undefined, idioma);
    assert.equal(aplicarNome(TEXTOS_PADRAO[idioma].voltou, { nome: "ana", saudacao: s }), com, idioma);
    assert.equal(aplicarNome(TEXTOS_PADRAO[idioma].voltou, { saudacao: s }), sem, idioma);
  }
  assert.equal(aplicarNome(TEXTOS_PADRAO.ja.pedido_enviado, {}), "ご注文を承りました。ただいまスタッフが確認しております。");
  assert.equal(aplicarNome(TEXTOS_PADRAO.ko.pedido_enviado, { nome: "Min" }), "Min님, 주문이 접수되었어요. 지금 직원이 확인하고 있어요.");
});

// ─── cardápio localizado e conversa ─────────────────────────────────────────
const PRODUTOS = [
  { id: "p1", nome_produto: "Maniçoba paraense", preco_venda: 58, categoria: "Pratos", departamento: "cozinha", ficha: { alergenicos: ["Glúten", "Leite"], ativo: true, status: "ativa" } },
  { id: "p2", nome_produto: "Caipirinha de cupuaçu", preco_venda: 28, categoria: "Drinks", departamento: "bar", ficha: null },
  { id: "p3", nome_produto: "Pudim", preco_venda: 20, categoria: "Sobremesas", departamento: "cozinha", ficha: null },
  { id: "p4", nome_produto: "Escondido", preco_venda: 30, categoria: "Pratos", ficha: null },
];
const CONFIG = {
  itens: { p1: { destaque: true, selos: ["da_casa"] }, p2: { selos: ["vegano"] }, p4: { oculto: true } },
  promocoes: [{ id: "happy", titulo: "Happy hour", tipo: "desconto", desconto_pct: 20, produto_ids: ["p2"] }],
  traducoes: {
    zh: { produtos: { p1: { nome: "帕拉州木薯叶炖肉" }, p2: { nome: "古布阿苏卡琵莉亚鸡尾酒" }, p4: { nome: "隐藏的菜" } }, categorias: { "cat-drinks": { nome: "鸡尾酒" } }, promocoes: { happy: { titulo: "欢乐时光" } } },
    ja: { produtos: { p1: { nome: "マニソバ（パラー州の郷土料理）" } } },
    xx: { produtos: { p1: { nome: "invalido" } } },
  },
};
const base = () => montarCardapioPublico({ unidade: { nome: "Sel", taxa_entrega: 8 }, produtos: PRODUTOS, config: CONFIG, agora: new Date("2026-10-17T22:00:00Z") });

test("tradução de prato escondido não sai do servidor; idioma inventado é ignorado", () => {
  const c = base();
  assert.equal(c.traducoes.zh.produtos.p4, undefined);
  assert.equal(c.traducoes.xx, undefined);
  assert.deepEqual(c.idiomas, OITO);
  assert.deepEqual(normalizarConfigCardapio({ idiomas: ["ja", "xx", "en"] }).idiomas, ["pt", "en", "ja"]);
});

test("cardápio em chinês: nome traduzido com o original embaixo, alergênicos e promoção no idioma", () => {
  const zh = localizarCardapio(base(), "zh");
  const p1 = zh.produtos.find((p) => p.id === "p1");
  assert.equal(p1.nome, "帕拉州木薯叶炖肉");
  assert.equal(p1.nome_original, "Maniçoba paraense");
  assert.deepEqual(p1.alergenicos, ["麸质", "牛奶"]);
  const p3 = zh.produtos.find((p) => p.id === "p3");
  assert.equal(p3.nome, "Pudim", "sem tradução, fica o original (nunca inventado)");
  assert.equal(p3.nome_original, "");
  assert.equal(zh.categorias.find((c) => c.id === "cat-drinks").nome, "鸡尾酒");
  assert.equal(zh.promocoes[0].titulo, "欢乐时光");
  assert.equal(zh.promocoes[0].rotulo, "8折");
  assert.equal(zh.textos.pedir_nome, "请问怎么称呼您？");
  assert.equal(zh.filtros.find((f) => f.id === "vegano").rotulo, "纯素");
  assert.equal(localizarCardapio(base(), "de").idioma, "pt", "idioma fora da lista volta ao português");
  const soPt = montarCardapioPublico({ produtos: PRODUTOS, config: { ...CONFIG, idiomas: ["pt"] } });
  assert.equal(localizarCardapio(soPt, "ja").idioma, "pt", "idioma que o dono desligou não é oferecido");
});

test("conversa entende pedidos escritos nos oito idiomas", () => {
  const c = localizarCardapio(base(), "pt");
  const casos = [
    ["o que vocês recomendam?", "sugestao"], ["what do you recommend?", "sugestao"], ["¿qué me recomiendan?", "sugestao"],
    ["que nous conseillez-vous ?", "sugestao"], ["cosa ci consigliate?", "sugestao"], ["有什么推荐？", "sugestao"],
    ["おすすめは何ですか？", "sugestao"], ["추천 메뉴가 뭐예요?", "sugestao"],
    ["anything gluten free?", "restricao"], ["我对花生过敏", "restricao"], ["アレルギーがあります", "restricao"], ["알레르기가 있어요", "restricao"],
    ["tienen postres?", "doce"], ["avez-vous des desserts ?", "doce"], ["甜点有什么", "doce"], ["デザートはありますか", "doce"], ["디저트 있어요?", "doce"],
    ["qualcosa di leggero", "leve"], ["有什么喝的", "bebida"], ["飲み物は？", "bebida"], ["마실 거 있어요?", "bebida"],
    ["any deals today?", "promocoes"], ["今天有优惠吗", "promocoes"], ["오늘 할인 있나요", "promocoes"], ["je suis pressé", "rapido"],
  ];
  for (const [frase, intencao] of casos) {
    assert.deepEqual(entenderMensagem(frase, c), { tipo: "intencao", id: intencao }, frase);
  }
});

test("busca de prato pelo nome traduzido (chinês e japonês, sem espaços)", () => {
  const zh = localizarCardapio(base(), "zh");
  assert.deepEqual(entenderMensagem("有卡琵莉亚吗？", zh).produto_ids, ["p2"]);
  const ja = localizarCardapio(base(), "ja");
  assert.deepEqual(entenderMensagem("マニソバをください", ja).produto_ids, ["p1"]);
  assert.deepEqual(entenderMensagem("maniçoba", ja).produto_ids, ["p1"], "o nome original também acha");
});

test("respostas no idioma do cliente, chamando pelo nome do jeito de cada língua", () => {
  const ja = localizarCardapio(base(), "ja");
  const r1 = responderConversa({ tipo: "intencao", id: "sugestao" }, ja, { nome: "kenji" });
  assert.equal(r1.texto, "Kenjiさん、当店が自信をもっておすすめする料理です：");
  assert.deepEqual(r1.produto_ids, ["p1"]);
  const ko = localizarCardapio(base(), "ko");
  assert.equal(responderConversa({ tipo: "intencao", id: "sugestao" }, ko, { nome: "min" }).texto, "Min님, 저희 매장이 자신 있게 추천하는 메뉴예요:");
  const en = localizarCardapio(base(), "en");
  assert.equal(responderConversa({ tipo: "intencao", id: "sugestao" }, en, { nome: "john" }).texto, "John, these are the dishes we're proudest of:");
  const fr = localizarCardapio(base(), "fr");
  assert.match(responderConversa({ tipo: "intencao", id: "restricao" }, fr).texto, /vérifiez auprès de notre équipe/);
  const it = localizarCardapio(base(), "it");
  assert.equal(responderConversa({ tipo: "busca", consulta: "pizza", produto_ids: [] }, it).texto, "Non ho trovato nulla per «pizza» nel menù. Posso mostrarti:");
  const zh = localizarCardapio(base(), "zh");
  const ab = aberturaDaConversa(zh, { nome: "li", agora: new Date("2026-10-17T22:00:00Z") });
  assert.equal(ab.texto, "晚上好，Li！需要我帮您推荐吗？");
  assert.ok(ab.acoes.every((a) => /[\u4e00-\u9fff]/.test(a.rotulo)), "botões da conversa em chinês");
});

test("delivery: grátis acima de X e pedido mínimo (a mesma conta do servidor)", () => {
  const c = montarCardapioPublico({ unidade: { taxa_entrega: 8 }, produtos: PRODUTOS, config: { entrega: { pedido_minimo: "40", gratis_acima: "100,00", tempo_min: 50, tempo_max: 30 } } });
  assert.deepEqual(c.entrega, { pedido_minimo: 40, gratis_acima: 100, tempo_min: 30, tempo_max: 50 });
  assert.deepEqual(taxaDeEntrega(30, c), { taxa: 8, falta_minimo: 10, falta_gratis: 70 });
  assert.deepEqual(taxaDeEntrega(100, c), { taxa: 0, falta_minimo: 0, falta_gratis: 0 });
  assert.deepEqual(taxaDeEntrega(30, c, "qrcode"), { taxa: 0, falta_minimo: 0, falta_gratis: 0 }, "mesa não tem taxa nem mínimo");
  assert.equal(totalDoCarrinho([{ id: "p1", quantidade: 2 }], c, { tipo: "delivery" }).total, 116);
});

test("editor de traduções: o que traduzir, gravar, ler e o progresso por idioma", () => {
  const config = normalizarConfigCardapio({
    textos: { apresentacao: "Cozinha paraense", rodape: "" },
    promocoes: [{ id: "happy", titulo: "Happy hour", texto: "", tipo: "aviso" }],
    banner: [{ id: "b1", tipo: "imagem", url: "https://x.test/a.jpg", titulo: "Noite de maniçoba", texto: "Toda sexta" }],
  });
  const produtos = [{ id: "p1", nome: "Maniçoba", descricao: "Folha de mandioca cozida", harmoniza: "" }, { id: "p2", nome: "Água", descricao: "" }];
  const categorias = [{ id: "pratos", nome: "Pratos", descricao: "", visivel: true }, { id: "oculta", nome: "Escondida", visivel: false }];
  const campos = camposParaTraduzir({ config, produtos, categorias });
  const chaves = campos.map((c) => `${c.grupo}.${c.id}.${c.campo}`);
  assert.deepEqual(chaves, [
    "textos.apresentacao.apresentacao", "categorias.pratos.nome",
    "produtos.p1.nome", "produtos.p1.descricao", "produtos.p2.nome",
    "promocoes.happy.titulo", "banner.b1.titulo", "banner.b1.texto",
  ], "só campos com texto no original; seção escondida e rodapé vazio ficam de fora");
  assert.equal(campos.find((c) => c.grupo === "produtos" && c.campo === "descricao").max, 280);

  let c2 = comTraducao(config, "en", campos[2], "Maniçoba (cassava leaf stew)");
  c2 = comTraducao(c2, "en", campos[0], "Amazonian cuisine");
  c2 = comTraducao(c2, "en", { grupo: "conversa", id: "intro", campo: "intro" }, "Want a hand choosing?");
  c2 = comTraducao(c2, "ja", campos[4], "水");
  assert.equal(comTraducao(config, "pt", campos[2], "x"), config, "português é o original: não se traduz");
  assert.equal(lerTraducao(c2.traducoes, "en", campos[2]), "Maniçoba (cassava leaf stew)");
  assert.equal(lerTraducao(c2.traducoes, "en", campos[3]), "");
  assert.equal(config.traducoes.en, undefined, "a configuração original não muda");

  const pEn = progressoDaTraducao(campos, c2.traducoes, "en");
  assert.equal(pEn.feitos, 2);
  assert.equal(pEn.total, 8);
  assert.deepEqual(pEn.porGrupo.produtos, { feitos: 1, total: 3 });
  assert.equal(progressoDaTraducao(campos, c2.traducoes, "ja").feitos, 1);

  // O que foi gravado chega ao cliente no idioma dele (e sobrevive à limpeza da configuração).
  const salvo = normalizarConfigCardapio(c2);
  const cardapio = montarCardapioPublico({ unidade: { nome: "Casa" }, produtos: [{ id: "p1", nome_produto: "Maniçoba", preco_venda: 50, categoria: "Pratos", ficha: null }], config: salvo });
  const en = localizarCardapio(cardapio, "en");
  assert.equal(en.produtos[0].nome, "Maniçoba (cassava leaf stew)");
  assert.equal(en.produtos[0].nome_original, "Maniçoba");
  assert.equal(en.textos.apresentacao, "Amazonian cuisine");
  assert.equal(en.conversa.intro, "Want a hand choosing?");
});
