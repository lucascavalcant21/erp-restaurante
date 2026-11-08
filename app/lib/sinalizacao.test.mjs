// Regras da Sinalização Digital (TVs). Rode: node --test app/lib/sinalizacao.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  gerarCodigo, normalizarCodigo, formatarCodigo, ALFABETO_CODIGO,
  validarEnvio, orientacaoPorMedida, duracaoDaMidia,
  normalizarItem, validarPlaylist, normalizarConteudo,
  validarProgramacao, regraVale, resolverConteudo,
  statusDaTela, resumoDasTelas, rotuloSemContato,
  paginasDoCardapio, montarRoteiro, midiasUsadas, formatarPreco, ONLINE_MS,
} from "./sinalizacao.mjs";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";
const P2 = "44444444-4444-4444-8444-444444444444";
const M1 = "55555555-5555-4555-8555-555555555555";
const M2 = "66666666-6666-4666-8666-666666666666";

// Horário de Brasília (UTC-3, sem horário de verão).
const em = (iso) => new Date(`${iso}-03:00`);

test("código de pareamento: 4 números, digitado com ou sem espaço", () => {
  const c = gerarCodigo((n) => Uint8Array.from({ length: n }, (_, i) => i * 37 + 3));
  assert.match(c, /^\d{4}$/);
  assert.equal(ALFABETO_CODIGO, "0123456789");
  assert.equal(normalizarCodigo(" 12 34 "), "1234");
  assert.equal(normalizarCodigo("1-2-3-4"), "1234");
  assert.equal(normalizarCodigo("123"), "", "curto demais");
  assert.equal(normalizarCodigo("12345"), "", "longo demais");
  assert.equal(normalizarCodigo("12a4"), "", "letra não");
  assert.equal(formatarCodigo("0420"), "0 4 2 0");
});

test("envio: só formato que a TV toca e dentro do limite do plano", () => {
  assert.equal(validarEnvio({ nome: "Baião", mime: "image/png", tamanho: 1000 }).tipo, "imagem");
  assert.equal(validarEnvio({ mime: "video/mp4", tamanho: 1000 }).ext, "mp4");
  assert.equal(validarEnvio({ mime: "video/webm", tamanho: 1000 }).ok, false);
  assert.equal(validarEnvio({ mime: "image/gif", tamanho: 1000 }).ok, false);
  assert.equal(validarEnvio({ mime: "video/mp4", tamanho: 60 * 1024 * 1024 }).ok, false);
  assert.match(validarEnvio({ mime: "image/jpeg", tamanho: 26 * 1024 * 1024 }).erro, /25 MB/);
  assert.equal(validarEnvio({ mime: "image/jpeg", tamanho: 0 }).ok, false);
  assert.equal(validarEnvio({ mime: "image/jpeg", tamanho: 5 }).nome, "Imagem");
});

test("orientação pela medida e duração de cada mídia", () => {
  assert.equal(orientacaoPorMedida(1080, 1920), "vertical");
  assert.equal(orientacaoPorMedida(1920, 1080), "horizontal");
  assert.equal(orientacaoPorMedida(null, null), "horizontal");
  assert.equal(duracaoDaMidia({ tipo: "imagem" }), 10);
  assert.equal(duracaoDaMidia({ tipo: "imagem" }, 1), 3, "mínimo de 3 s");
  assert.equal(duracaoDaMidia({ tipo: "video", duracao_seg: 14.2 }), 15, "vídeo usa a duração real");
  assert.equal(duracaoDaMidia({ tipo: "video", duracao_seg: 14.2 }, 8), 8, "a playlist pode cortar");
});

test("playlist: itens válidos, cardápio com padrões e limites", () => {
  assert.equal(normalizarItem({ tipo: "midia", midia_id: "x" }), null);
  const c = normalizarItem({ tipo: "cardapio", por_pagina: 50, categoria_ids: ["a", "a", ""] });
  assert.deepEqual([c.titulo, c.por_pagina, c.categoria_ids, c.duracao_seg], ["Cardápio", 12, ["a"], 15]);
  assert.equal(validarPlaylist({ nome: "", itens: [] }).ok, false);
  assert.equal(validarPlaylist({ nome: "Almoço", itens: [{ tipo: "x" }] }).ok, false);
  const ok = validarPlaylist({ nome: "  Almoço  ", orientacao: "vertical", itens: [{ tipo: "midia", midia_id: M1 }, { tipo: "cardapio" }] });
  assert.equal(ok.playlist.nome, "Almoço");
  assert.equal(ok.playlist.orientacao, "vertical");
  assert.equal(ok.playlist.itens.length, 2);
  assert.equal(validarPlaylist({ nome: "a", orientacao: "diagonal", itens: [{ tipo: "cardapio" }] }).playlist.orientacao, "horizontal");
});

test("conteúdo fixo: playlist ou arte só, com id válido", () => {
  assert.deepEqual(normalizarConteudo({ tipo: "midia", id: M1 }), { tipo: "midia", id: M1 });
  assert.equal(normalizarConteudo({ tipo: "midia", id: "1" }), null);
  assert.equal(normalizarConteudo({ tipo: "url", id: M1 }), null);
});

test("programação: validação de horário, datas e prioridade", () => {
  const base = { nome: "Almoço", playlist_id: P1 };
  assert.equal(validarProgramacao({ ...base, playlist_id: "x" }).ok, false);
  assert.equal(validarProgramacao({ ...base, hora_inicio: "11:00" }).ok, false, "só início");
  assert.equal(validarProgramacao({ ...base, hora_inicio: "25:00", hora_fim: "26:00" }).ok, false);
  const igual = validarProgramacao({ ...base, hora_inicio: "11:00", hora_fim: "11:00" });
  assert.deepEqual([igual.ok, igual.regra.hora_inicio, igual.regra.hora_fim], [true, null, null], "horários iguais = dia inteiro");
  assert.equal(validarProgramacao({ ...base, data_inicio: "2026-11-10", data_fim: "2026-11-01" }).ok, false);
  const r = validarProgramacao({ ...base, dias_semana: [5, 1, 1, 9], prioridade: 5000, tela_ids: [T1, "x"] }).regra;
  assert.deepEqual(r.dias_semana, [1, 5]);
  assert.equal(r.prioridade, 999);
  assert.deepEqual(r.tela_ids, [T1]);
  assert.equal(r.ativa, true);
});

test("regra vale: dia da semana, horário, datas e telas", () => {
  const almoco = { ativa: true, tela_ids: [], dias_semana: [1, 2, 3, 4, 5], hora_inicio: "11:00", hora_fim: "15:00" };
  // 09/11/2026 é segunda.
  assert.equal(regraVale(almoco, T1, em("2026-11-09T12:00:00")), true);
  assert.equal(regraVale(almoco, T1, em("2026-11-09T15:00:00")), false, "fim é exclusivo");
  assert.equal(regraVale(almoco, T1, em("2026-11-08T12:00:00")), false, "domingo");
  assert.equal(regraVale({ ...almoco, tela_ids: [T2] }, T1, em("2026-11-09T12:00:00")), false, "outra TV");
  assert.equal(regraVale({ ...almoco, ativa: false }, T1, em("2026-11-09T12:00:00")), false);
  const natal = { ativa: true, data_inicio: "2026-12-25", data_fim: "2026-12-25" };
  assert.equal(regraVale(natal, T1, em("2026-12-25T23:59:00")), true);
  assert.equal(regraVale(natal, T1, em("2026-12-26T00:00:00")), false);
});

test("horário que vira a noite conta para o dia em que começou", () => {
  // Sexta (13/11/2026) 18:00–02:00.
  const rodizio = { ativa: true, dias_semana: [5], hora_inicio: "18:00", hora_fim: "02:00", data_inicio: "2026-11-13", data_fim: "2026-11-13" };
  assert.equal(regraVale(rodizio, T1, em("2026-11-13T19:00:00")), true);
  assert.equal(regraVale(rodizio, T1, em("2026-11-14T01:30:00")), true, "madrugada de sábado ainda é a sexta");
  assert.equal(regraVale(rodizio, T1, em("2026-11-14T02:00:00")), false);
  assert.equal(regraVale(rodizio, T1, em("2026-11-13T01:00:00")), false, "madrugada de sexta é a quinta");
});

test("resolver: prioridade maior vence; empate, a mais recente; senão o fixo; senão nada", () => {
  const tela = { id: T1, conteudo: { tipo: "midia", id: M1 } };
  const agora = em("2026-11-09T12:00:00");
  const geral = { id: "a", nome: "Semana", ativa: true, playlist_id: P1, prioridade: 100, updated_at: "2026-11-01T00:00:00Z" };
  const almoco = { id: "b", nome: "Almoço", ativa: true, playlist_id: P2, prioridade: 110, hora_inicio: "11:00", hora_fim: "15:00" };
  assert.deepEqual(resolverConteudo({ tela, programacoes: [geral, almoco], agora }).conteudo, { tipo: "playlist", id: P2 });
  const empate = { ...geral, id: "c", playlist_id: P2, updated_at: "2026-11-05T00:00:00Z" };
  assert.equal(resolverConteudo({ tela, programacoes: [geral, empate], agora }).regra.id, "c");
  const fixo = resolverConteudo({ tela, programacoes: [{ ...almoco, tela_ids: [T2] }], agora });
  assert.deepEqual([fixo.origem, fixo.conteudo], ["fixo", { tipo: "midia", id: M1 }]);
  assert.equal(resolverConteudo({ tela: { id: T1 }, programacoes: [], agora }).origem, "nenhum");
});

test("monitoramento: no ar, sem contato e aguardando", () => {
  const agora = Date.parse("2026-11-09T15:00:00Z");
  assert.equal(statusDaTela({ ultimo_contato: new Date(agora - 60000).toISOString() }, agora), "no_ar");
  assert.equal(statusDaTela({ ultimo_contato: new Date(agora - ONLINE_MS - 1).toISOString() }, agora), "sem_contato");
  assert.equal(statusDaTela({}, agora), "aguardando");
  assert.deepEqual(resumoDasTelas([{ ultimo_contato: new Date(agora).toISOString() }, {}], agora), { total: 2, no_ar: 1, sem_contato: 0, aguardando: 1 });
  assert.equal(rotuloSemContato("2026-09-20T23:24:00Z"), "Sem contato desde 20/09, 20:24");
  assert.equal(rotuloSemContato(null), "Nunca conectou");
});

const CARDAPIO = {
  categorias: [
    { id: "combos", nome: "Combos", produto_ids: ["c1"] },
    { id: "pratos", nome: "Pratos", produto_ids: ["p1", "p2", "p3", "p0"] },
    { id: "bebidas", nome: "Bebidas", produto_ids: ["b1"] },
  ],
  produtos: [
    { id: "p1", nome: "Baião arretado", descricao: "Arroz, feijão, queijo coalho", preco: 29.9, preco_original: 34.9 },
    { id: "p2", nome: "Carne de sol", descricao: "", preco: 59, preco_original: 59 },
    { id: "p3", nome: "Escondidinho", descricao: "", preco: 42 },
    { id: "p0", nome: "Sem preço", preco: 0 },
    { id: "b1", nome: "Coca-Cola", preco: 7 },
  ],
};

test("cardápio na TV: preço do sistema, páginas, sem prato sem preço e sem combos", () => {
  const pgs = paginasDoCardapio(CARDAPIO, { por_pagina: 3, titulo: "Almoço" });
  assert.deepEqual(pgs.map((p) => [p.categoria, p.itens.length]), [["Pratos", 3], ["Bebidas", 1]]);
  assert.equal(pgs[0].itens[0].preco_original, 34.9, "promoção mostra o preço de antes");
  assert.equal(pgs[0].itens[1].preco_original, null);
  assert.equal(paginasDoCardapio(CARDAPIO, { categoria_ids: ["bebidas"] }).length, 1);
  assert.equal(paginasDoCardapio(null, {}).length, 0);
  assert.equal(formatarPreco(1234.5), "R$ 1.234,50");
});

test("roteiro: mídia sem URL ou apagada some; cardápio vira páginas", () => {
  const midias = new Map([[M1, { id: M1, tipo: "video", nome: "Picanha", duracao_seg: 15, versao: 2 }]]);
  const urls = new Map([[M1, "https://x/assinada"]]);
  const itens = [{ tipo: "midia", midia_id: M1 }, { tipo: "midia", midia_id: M2 }, { tipo: "cardapio", por_pagina: 3 }];
  const r = montarRoteiro({ itens, midias, urls, cardapio: CARDAPIO });
  assert.deepEqual(r.map((s) => s.tipo), ["video", "cardapio", "cardapio"]);
  assert.equal(r[0].chave, `${M1}:2`);
  assert.equal(r[0].duracao_seg, 15);
  assert.equal(montarRoteiro({ itens, midias, urls, cardapio: null }).length, 1, "sem cardápio: só a mídia");
  assert.deepEqual(midiasUsadas(itens), [M1, M2]);
});

test("tela dividida: cada item num lado; todo lado precisa de conteúdo; o roteiro leva o lado", async () => {
  const { ladosDosItens } = await import("./sinalizacao.mjs");
  const ok = validarPlaylist({ nome: "Duas artes", itens: [
    { tipo: "midia", midia_id: M1, duracao_seg: 8, zona: 0 },
    { tipo: "midia", midia_id: M2, duracao_seg: 20, zona: 1 },
  ] });
  assert.equal(ok.ok, true);
  assert.equal(ladosDosItens(ok.playlist.itens), 2);
  assert.deepEqual(ok.playlist.itens.map((i) => [i.zona, i.duracao_seg]), [[0, 8], [1, 20]], "tempos diferentes em cada lado");
  const buraco = validarPlaylist({ nome: "x", itens: [{ tipo: "midia", midia_id: M1, zona: 0 }, { tipo: "midia", midia_id: M2, zona: 2 }] });
  assert.match(buraco.erro, /lado 2/);
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1, zona: 9 }).zona, 2, "no máximo 3 lados");
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1 }).zona, 0, "sem lado = tela inteira");
  const midias = new Map([[M1, { id: M1, tipo: "imagem", nome: "A" }], [M2, { id: M2, tipo: "imagem", nome: "B" }]]);
  const urls = new Map([[M1, "u1"], [M2, "u2"]]);
  const r = montarRoteiro({ itens: ok.playlist.itens, midias, urls });
  assert.deepEqual(r.map((s) => [s.nome, s.zona, s.duracao_seg]), [["A", 0, 8], ["B", 1, 20]]);
});

test("ajuste na TV: automático (padrão), inteira, preencher ou dividir; vale na playlist e na arte fixa", () => {
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1 }).ajuste, "auto");
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1, ajuste: "inteira" }).ajuste, "inteira", "quem escolheu Inteira continua com Inteira");
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1, ajuste: "dividir" }).ajuste, "dividir");
  assert.equal(normalizarItem({ tipo: "midia", midia_id: M1, ajuste: "esticar" }).ajuste, "auto", "valor desconhecido volta ao padrão");
  assert.deepEqual(normalizarConteudo({ tipo: "midia", id: M1, ajuste: "preencher" }), { tipo: "midia", id: M1, ajuste: "preencher" });
  assert.deepEqual(normalizarConteudo({ tipo: "midia", id: M1, ajuste: "inteira" }), { tipo: "midia", id: M1, ajuste: "inteira" });
  assert.deepEqual(normalizarConteudo({ tipo: "midia", id: M1, ajuste: "auto" }), { tipo: "midia", id: M1 });
  assert.deepEqual(normalizarConteudo({ tipo: "playlist", id: P1, ajuste: "dividir" }), { tipo: "playlist", id: P1 });
  const r = montarRoteiro({ itens: [{ tipo: "midia", midia_id: M1, ajuste: "preencher" }], midias: new Map([[M1, { id: M1, tipo: "imagem", nome: "A" }]]), urls: new Map([[M1, "u"]]) });
  assert.equal(r[0].ajuste, "preencher");
});

test("horário de funcionamento: fora do horário a tela apaga; atravessa a meia-noite; dias", async () => {
  const { normalizarHorario, dentroDoHorario } = await import("./sinalizacao.mjs");
  assert.equal(normalizarHorario(null), null);
  assert.equal(normalizarHorario({ inicio: "10:00", fim: "10:00" }), null, "iguais = sempre ligada");
  assert.equal(normalizarHorario({ inicio: "25:00", fim: "10:00" }), null);
  assert.deepEqual(normalizarHorario({ inicio: "10:00", fim: "23:00", dias: [0, 1, 2, 3, 4, 5, 6] }), { inicio: "10:00", fim: "23:00", dias: [] });
  const loja = { inicio: "10:00", fim: "23:00" };
  assert.equal(dentroDoHorario(loja, em("2026-11-09T12:00:00")), true);
  assert.equal(dentroDoHorario(loja, em("2026-11-09T23:30:00")), false);
  assert.equal(dentroDoHorario(loja, em("2026-11-09T09:59:00")), false);
  assert.equal(dentroDoHorario(null, em("2026-11-09T03:00:00")), true, "sem horário: sempre");
  const noite = { inicio: "18:00", fim: "02:00", dias: [5] }; // sexta à noite
  assert.equal(dentroDoHorario(noite, em("2026-11-14T01:00:00")), true, "madrugada de sábado ainda é a sexta");
  assert.equal(dentroDoHorario(noite, em("2026-11-13T12:00:00")), false);
});

test("vídeo do iPhone: .mov sobe como MP4; HEVC é avisado", async () => {
  const { mimeParaEnvio, codecDoVideo } = await import("./sinalizacao.mjs");
  assert.equal(mimeParaEnvio("IMG_1234.MOV", "video/quicktime"), "video/mp4");
  assert.equal(mimeParaEnvio("IMG_1234.mov", ""), "video/mp4");
  assert.equal(mimeParaEnvio("a.jpg", "image/jpeg"), "image/jpeg");
  assert.equal(validarEnvio({ mime: mimeParaEnvio("v.mov", "video/quicktime"), tamanho: 1000 }).ok, true);
  const comCodec = (fourcc) => new Uint8Array([0, 0, 0, 0x20, 0x73, 0x74, 0x73, 0x64, ...Buffer.from(fourcc), 0, 1]);
  assert.equal(codecDoVideo(comCodec("avc1")), "h264");
  assert.equal(codecDoVideo(comCodec("hvc1")), "hevc");
  assert.equal(codecDoVideo(comCodec("hev1")), "hevc");
  assert.equal(codecDoVideo(new Uint8Array([1, 2, 3])), "desconhecido");
});

test("o .mov sobe marcado como MP4 (o Storage confere a marca do próprio arquivo), com os mesmos bytes", async () => {
  const { arquivoComTipo } = await import("./sinalizacao.mjs");
  const mov = new File([new Uint8Array([1, 2, 3, 4])], "IMG_1.MOV", { type: "video/quicktime" });
  const mp4 = arquivoComTipo(mov, "video/mp4");
  assert.equal(mp4.type, "video/mp4");
  assert.equal(mp4.name, "IMG_1.mp4");
  assert.deepEqual([...new Uint8Array(await mp4.arrayBuffer())], [1, 2, 3, 4]);
  // A biblioteca do Supabase manda o arquivo num formulário: a parte vai com a marca do arquivo.
  const form = new FormData();
  form.append("", mp4);
  assert.equal(form.get("").type, "video/mp4");
  const foto = new File([new Uint8Array([9])], "a.jpg", { type: "image/jpeg" });
  assert.equal(arquivoComTipo(foto, "image/jpeg"), foto, "foto não muda");
});

test("Automático: foto deitada enche a TV deitada; foto em pé fica inteira; medida faltando não arrisca corte", async () => {
  const { ajusteAutomatico } = await import("./sinalizacao.mjs");
  assert.equal(ajusteAutomatico(4032, 3024, 1920, 1080), "preencher", "foto deitada do iPhone (4:3) na TV 16:9");
  assert.equal(ajusteAutomatico(6000, 4000, 1920, 1080), "preencher", "foto de câmera (3:2)");
  assert.equal(ajusteAutomatico(1920, 1080, 1920, 1080), "preencher", "arte no tamanho certo");
  assert.equal(ajusteAutomatico(3024, 4032, 1920, 1080), "inteira", "foto em pé na TV deitada");
  assert.equal(ajusteAutomatico(1080, 1920, 1920, 1080), "inteira", "story 9:16 na TV deitada");
  assert.equal(ajusteAutomatico(3024, 4032, 960, 1080), "preencher", "foto em pé num lado da tela dividida em 2");
  assert.equal(ajusteAutomatico(1080, 1080, 1920, 1080), "inteira", "quadrada cortaria 44%");
  assert.equal(ajusteAutomatico(0, 0, 1920, 1080), "inteira");
  assert.equal(ajusteAutomatico(4032, 3024, 0, 0), "inteira");
});

test("transições como no PowerPoint: padrão esmaecer/média, valores inválidos voltam ao padrão, e vão para o roteiro", async () => {
  const { transicaoDaTroca, TRANSICOES, VELOCIDADES } = await import("./sinalizacao.mjs");
  const padrao = normalizarItem({ tipo: "midia", midia_id: M1 });
  assert.equal(padrao.transicao, "esmaecer");
  assert.equal(padrao.velocidade, "media");
  const cubo = normalizarItem({ tipo: "midia", midia_id: M1, transicao: "cubo", velocidade: "lenta" });
  assert.deepEqual([cubo.transicao, cubo.velocidade], ["cubo", "lenta"]);
  const ruim = normalizarItem({ tipo: "midia", midia_id: M1, transicao: "explodir", velocidade: "turbo" });
  assert.deepEqual([ruim.transicao, ruim.velocidade], ["esmaecer", "media"]);
  const card = normalizarItem({ tipo: "cardapio", transicao: "persianas", velocidade: "rapida" });
  assert.deepEqual([card.transicao, card.velocidade], ["persianas", "rapida"]);

  const r = montarRoteiro({ itens: [{ tipo: "midia", midia_id: M1, transicao: "empurrar", velocidade: "rapida" }], midias: new Map([[M1, { id: M1, tipo: "imagem", nome: "A" }]]), urls: new Map([[M1, "u"]]) });
  assert.deepEqual([r[0].transicao, r[0].velocidade], ["empurrar", "rapida"]);

  assert.deepEqual(transicaoDaTroca({ transicao: "zoom", velocidade: "lenta" }), { efeito: "zoom", ms: VELOCIDADES.lenta });
  assert.deepEqual(transicaoDaTroca({ transicao: "nenhuma", velocidade: "lenta" }), { efeito: "nenhuma", ms: 0 });
  assert.deepEqual(transicaoDaTroca({}), { efeito: "esmaecer", ms: VELOCIDADES.media }, "slide antigo, sem campo: esmaecer");
  // Aleatória sorteia entre os efeitos de verdade (nunca "aleatoria" nem "nenhuma").
  const sorteados = new Set([0, 0.2, 0.5, 0.8, 0.999].map((x) => transicaoDaTroca({ transicao: "aleatoria" }, () => x).efeito));
  for (const e of sorteados) assert.ok(TRANSICOES.includes(e) && e !== "aleatoria" && e !== "nenhuma", e);
  assert.ok(sorteados.size >= 4);
});
