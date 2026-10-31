// Painel → Editar produto: mídias, grupos de complementos, horário e o formulário.
import test from "node:test";
import assert from "node:assert/strict";
import { itemNoHorario, montarCardapioPublico, normalizarConfigCardapio, normalizarGrupos, normalizarMidias, regraDoGrupo } from "./cardapio-digital.mjs";
import { errosDoFormulario, formularioDoProduto, itemDoFormulario, traducoesDoProduto, usosDosGrupos } from "./cardapio-painel.mjs";

const AGORA = new Date("2026-10-28T15:00:00Z"); // quarta, 12h em SP
const produto = { id: "p1", nome_produto: "PICANHA", preco_venda: 89.9, categoria: "Grelhados", ficha_id: "f1", imagem_url: "" };
const ficha = { id: "f1", nome_comercial: "Picanha na brasa", descricao_comercial: "300 g", categoria: "Grelhados", ativo: true, tempo_preparo: 25 };

test("mídias: só https, até 3 fotos e 1 vídeo, capa é a primeira foto", () => {
  const m = normalizarMidias([
    { tipo: "foto", url: "http://x/a.jpg" }, { tipo: "foto", url: "https://x/1.jpg" }, { tipo: "video", url: "https://x/v.mp4", poster: "javascript:x" },
    { tipo: "video", url: "https://x/v2.mp4" }, { tipo: "foto", url: "https://x/2.jpg" }, { tipo: "foto", url: "https://x/3.jpg" }, { tipo: "foto", url: "https://x/4.jpg" },
  ]);
  assert.deepEqual(m.map((x) => x.url), ["https://x/1.jpg", "https://x/v.mp4", "https://x/2.jpg", "https://x/3.jpg"]);
  assert.equal(m[1].poster, undefined);
  const c = montarCardapioPublico({ produtos: [{ ...produto, ficha }], config: { itens: { p1: { midias: m } } }, agora: AGORA });
  assert.equal(c.produtos[0].imagem_url, "https://x/1.jpg");
});

test("grupos: limites, retirar sem custo, regra e usos", () => {
  const [a, b] = normalizarGrupos([
    { id: "ponto", nome: "Ponto da carne", min: 1, max: 1, opcoes: [{ nome: "Mal passado" }, { nome: "Ao ponto" }] },
    { id: "tirar", nome: "Retirar", tipo: "retirar", min: 2, max: 2, opcoes: [{ nome: "Sem cebola", preco: 3 }] },
    { nome: "" },
  ]);
  assert.equal(regraDoGrupo(a), "Obrigatório · escolher 1");
  assert.equal(b.min, 0);
  assert.equal(b.opcoes[0].preco, 0);
  assert.equal(regraDoGrupo(b), "Opcional · sem custo");
  assert.equal(regraDoGrupo({ tipo: "adicional", min: 0, max: 2 }), "Opcional · até 2");
  assert.deepEqual(usosDosGrupos({ itens: { p1: { grupos: ["ponto", "tirar"] }, p2: { grupos: ["ponto"] } } }), { ponto: 2, tirar: 1 });
  assert.equal(normalizarConfigCardapio({ grupos: [{ nome: "X", opcoes: [{ nome: "a", preco: -5 }] }] }).grupos[0].opcoes[0].preco, 0);
});

test("horário do prato: só aparece no dia e na hora marcados", () => {
  const happy = { horario: { dias_semana: [1, 2, 3, 4, 5], hora_inicio: "17:00", hora_fim: "20:00" } };
  assert.equal(itemNoHorario(happy, AGORA), false, "quarta 12h: fora");
  assert.equal(itemNoHorario(happy, new Date("2026-10-28T21:00:00Z")), true, "quarta 18h: dentro");
  assert.equal(itemNoHorario({}, AGORA), true);
  const c = montarCardapioPublico({ produtos: [{ ...produto, ficha }], config: { itens: { p1: happy } }, agora: AGORA });
  assert.equal(c.produtos.length, 0);
});

test("formulário: lê a ficha e a vitrine e volta para o item sem perder o resto", () => {
  const config = { itens: { p1: { canais_ocultos: ["delivery"], ordem: 3, selos: ["da_casa"] } } };
  const f = formularioDoProduto({ produto, ficha, config, categorias: [{ id: "cat-grelhados", nome: "Grelhados" }], agora: AGORA });
  assert.equal(f.nome, "Picanha na brasa");
  assert.equal(f.tempo, "25");
  assert.deepEqual(f.canais, { tablet: true, qr: true, delivery: false });
  assert.equal(f.horario.modo, "sempre");
  const novo = itemDoFormulario(config.itens.p1, { ...f, canais: { tablet: true, qr: false, delivery: true }, esgotado: true, grupos: ["ponto"] },
    { temFicha: true, categoriaOriginal: f.categoria_id }, AGORA);
  assert.deepEqual(novo, { ordem: 3, selos: ["da_casa"], canais_ocultos: ["qr"], esgotado_dia: "2026-10-28", grupos: ["ponto"] });
  assert.deepEqual(errosDoFormulario({ ...f, tempo: "0" }, { temFicha: true }), ["Tempo de preparo: de 1 a 600 minutos."]);
  assert.deepEqual(errosDoFormulario({ ...f, horario: { modo: "horario", dias_semana: [], hora_inicio: "", hora_fim: "" } }, { temFicha: true }).length, 1);
});

test("traduções do prato por idioma", () => {
  const config = { traducoes: { en: { produtos: { p1: { nome: "Picanha", descricao: "300 g" } } }, es: { produtos: { p1: { nome: "Picaña" } } } } };
  const t = Object.fromEntries(traducoesDoProduto(config, { id: "p1", temDescricao: true }).map((x) => [x.idioma, x.rotulo]));
  assert.equal(t.en, "Traduzida");
  assert.equal(t.es, "Falta a descrição");
  assert.equal(t.ko, "Sem tradução");
});

test("foto da Montagem: só com nome igual e sem foto própria", async () => {
  const { aplicarFotosDaMontagem } = await import("./cardapio-digital.mjs");
  const montagens = [
    { nome: "Tacacá", foto_url: "https://x/tacaca.png" },
    { nome: "Arroz Paraense", foto_url: "https://x/arroz.png" },
    { nome: "Executivo de Carne de Sol", foto_url: "javascript:alert(1)" },
  ];
  const produtos = [
    { id: "1", nome_produto: "TACACA" },
    { id: "2", nome_produto: "Arroz", ficha_id: "f2" },
    { id: "3", nome_produto: "Tacacá grande" },
    { id: "4", nome_produto: "Tacacá", imagem_url: "https://x/propria.jpg" },
    { id: "5", nome_produto: "Tacacá", ficha_id: "f5" },
    { id: "6", nome_produto: "Executivo de Carne de Sol" },
  ];
  const r = aplicarFotosDaMontagem(produtos, { fichas: [{ id: "f2", nome_receita: "Arroz paraense" }, { id: "f5" }], fichasComFoto: ["f5"], montagens });
  assert.deepEqual(r.map((p) => p.imagem_url || ""), ["https://x/tacaca.png", "https://x/arroz.png", "", "https://x/propria.jpg", "", ""]);
  assert.equal(aplicarFotosDaMontagem(produtos, {}), produtos);
});
