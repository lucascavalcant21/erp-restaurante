import test from "node:test";
import assert from "node:assert/strict";
import { MODULOS } from "./treinamento-conteudo/index.mjs";
import {
  cenasDaAula, cenasDoPrato, cenasParaTocar, demonstracaoDaCena, normalizarCenasDaIA, faltasDoPrato, fichasDaEtapa, guiaDaFicha, guiaEscrito, mensagemDeErro,
  pendenciasDeFichas, progressoDaTrilha, resumirModulo, temPreencher,
} from "./treinamento-regras.mjs";

test("cenas: parágrafo vira cena, lista fica com seu título e lista longa é quebrada", () => {
  const cenas = cenasDaAula("Primeiro texto.\n\nLave as mãos:\n- ao chegar;\n- antes;\n- depois;\n- no banheiro;\n- no lixo;\n- ao voltar;\n- sempre\n\nFim.");
  assert.equal(cenas.length, 4);
  assert.equal(cenas[1].texto, "Lave as mãos:");
  assert.equal(cenas[1].itens.length, 5);
  assert.equal(cenas[2].itens.length, 2);
  assert.equal(cenas[3].fala, "Fim.");
  assert.ok(cenas[1].fala.includes("ao chegar"));
});

test("cenas: nenhuma parte do conteúdo real se perde e toda aula tem cena", () => {
  for (const a of MODULOS.flatMap((m) => m.aulas || [])) {
    const cenas = cenasDaAula(a.conteudo);
    assert.ok(cenas.length > 0, a.chave);
    const dito = cenas.map((c) => c.fala).join(" ");
    for (const palavra of a.conteudo.replace(/[-.:;,()]/g, " ").split(/\s+/).filter((p) => p.length > 8)) {
      assert.ok(dito.includes(palavra), `${a.chave}: ${palavra}`);
    }
  }
});

test("a demonstração acompanha o assunto", () => {
  assert.equal(demonstracaoDaCena("Lave bem as mãos ao chegar"), "maos");
  assert.equal(demonstracaoDaCena("Mantenha acima de 60 °C"), "termometro");
  assert.equal(demonstracaoDaCena("Fogo na panela: abafe"), "fogo");
  assert.equal(demonstracaoDaCena("Use a etiqueta com validade"), "etiqueta");
  assert.equal(demonstracaoDaCena("Meça com dosador"), "balanca");
  assert.equal(demonstracaoDaCena("Bem-vindo"), "conversa");
});

test("progresso: sem prova é null; pratos não contam e aprovação vem do banco", () => {
  const m = [{ id: "a", tipo: "aulas" }, { id: "b", tipo: "aulas" }, { id: "p", tipo: "pratos" }];
  const aulas = [{ id: "1", modulo_id: "a" }, { id: "2", modulo_id: "a" }, { id: "3", modulo_id: "b" }];
  assert.equal(progressoDaTrilha([m[2]], [], new Set(), []), null);
  assert.equal(resumirModulo(m[0], aulas, new Set(["1"]), []).estado, "andamento");
  assert.equal(resumirModulo(m[0], aulas, new Set(["1", "2"]), []).estado, "prova");
  assert.equal(resumirModulo(m[0], aulas, new Set(["1", "2"]), [{ modulo_id: "a", aprovada: false }]).estado, "prova");
  assert.deepEqual(progressoDaTrilha(m, aulas, new Set(["1", "2"]), [{ modulo_id: "a", aprovada: true }]), { aprovados: 1, total: 2, percentual: 50 });
});

test("prato: mostra o que falta e nunca dá por completo o que não existe", () => {
  const f = { id: "1", nome_receita: "Tacacá", departamento: "cozinha", fichas_ingredientes: [{ id: 1 }], modo_preparo: "" };
  assert.deepEqual(faltasDoPrato(f, null, "preparar"), ["modo de preparo"]);
  assert.deepEqual(faltasDoPrato(f, { descritivo: "Ingredientes:\n• Goma: 1 kg e mais coisa" }, "montar"), ["passo a passo da montagem", "foto"]);
  assert.equal(guiaEscrito({ descritivo: "Ingredientes:\n• Tucupi: 1 l e muito mais texto" }), false);
  assert.deepEqual(faltasDoPrato({ ...f, modo_preparo: "1. Ferva o tucupi por dez minutos." }, { foto_url: "x" }, "preparar"), []);
  assert.deepEqual(faltasDoPrato({ ...f, fichas_ingredientes: [] }, null, "conhecer"), ["ingredientes"]);
  assert.equal(guiaDaFicha({ nome_receita: "Arroz Paraense " }, [{ nome: "arroz paraense" }]).nome, "arroz paraense");
});

test("etapas: bar prepara só as bases; conhecer e montar não mostram bases nem fichas inativas", () => {
  const fichas = [
    { departamento: "bar", nome_receita: "Xarope", eh_base: true },
    { departamento: "bar", nome_receita: "Caipirinha", eh_base: false },
    { departamento: "bar", nome_receita: "Antigo", eh_base: false, ativo: false },
    { departamento: "cozinha", nome_receita: "Molho", eh_base: true },
    { departamento: "cozinha", nome_receita: "Tacacá", eh_base: false },
  ];
  assert.deepEqual(fichasDaEtapa(fichas, "bar", "preparar").map((f) => f.nome_receita), ["Xarope"]);
  assert.deepEqual(fichasDaEtapa(fichas, "bar", "montar").map((f) => f.nome_receita), ["Caipirinha"]);
  assert.deepEqual(fichasDaEtapa(fichas, "cozinha", "preparar").map((f) => f.nome_receita), ["Molho", "Tacacá"]);
  const p = pendenciasDeFichas(fichas, []);
  assert.deepEqual(p.cozinha.semPreparo, ["Molho", "Tacacá"]);
  assert.equal(p.bar.preparar, 1);
});

test("marca [PREENCHER] e erro de tabela ausente", () => {
  assert.equal(temPreencher("[PREENCHER: história]"), true);
  assert.equal(temPreencher("história"), false);
  assert.match(mensagemDeErro({ message: 'relation "trein_trilhas" does not exist' }), /ainda não foi ativado/);
  assert.equal(mensagemDeErro({ message: "Conclua todas as aulas antes da prova." }), "Conclua todas as aulas antes da prova.");
});

test("falas da IA: só passa fala válida e demonstração conhecida", () => {
  const c = normalizarCenasDaIA({ cenas: [{ fala: "  Sirva o vinho  pela direita ", demonstracao: "foguete" }, { fala: "" }, { fala: "Lave as mãos", demonstracao: "maos" }] });
  assert.equal(c.length, 2);
  assert.equal(c[0].fala, "Sirva o vinho pela direita");
  assert.equal(c[0].demonstracao, "vinho");
  assert.deepEqual(normalizarCenasDaIA("não é json"), []);
  assert.equal(cenasParaTocar({ cenas: c, conteudo: "outro" })[0].fala, c[0].fala);
  assert.equal(cenasParaTocar({ cenas: null, conteudo: "Texto" })[0].fala, "Texto");
});

test("prato: o boneco fala só o que está na ficha e admite o que falta", () => {
  const ficha = { departamento: "bar", nome_receita: "Marguerita", copo: "Taça", metodo_bar: "Batido", fichas_ingredientes: [{ insumos: { nome: "Tequila" } }, { insumos: { nome: "Ingrediente" } }] };
  const cenas = cenasDoPrato(ficha, null, "montar");
  const texto = cenas.map((c) => c.fala).join(" ");
  assert.match(texto, /Tequila/);
  assert.doesNotMatch(texto, /Ingrediente/);
  assert.match(texto, /Copo: Taça/);
  assert.match(texto, /ainda não foi escrita/);
  const comPreparo = cenasDoPrato({ departamento: "cozinha", nome_receita: "Arroz", modo_preparo: "1. Doure o alho na panela.\n2. Junte o arroz e a água.", fichas_ingredientes: [] }, null, "preparar");
  assert.match(comPreparo.map((c) => c.fala).join(" "), /Doure o alho/);
  assert.match(cenasDoPrato({ departamento: "cozinha", nome_receita: "Tacacá" }, null, "preparar").at(-1).fala, /ainda não foi escrito/);
});

test("falas da IA: número que não está na aula é detectado", async () => {
  const { numerosForaDoTexto } = await import("./treinamento-regras.mjs");
  assert.deepEqual(numerosForaDoTexto([{ fala: "Mantenha acima de 60 °C por 6 horas" }], "acima de 60 °C, por no máximo 6 horas"), []);
  assert.deepEqual(numerosForaDoTexto([{ fala: "Cozinhe por 45 minutos a 70 °C" }], "chega a 70 °C"), ["45"]);
});
