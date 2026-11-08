// Ficha técnica pelo Héfisto: ingredientes e preparo cadastrados, só da unidade da sessão.
// TESTADO EM MOCK (banco em memória com as duas empresas).
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado, ErroDeIsolamento } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { quantidadeLegivel } from "../metrics/fichas.mjs";
import { bancoFalso, contexto, depsFalsas } from "./apoio.mjs";
import { tabelasPadrao, CAMARAO, OLEO } from "./fixtures.mjs";

const AGORA = new Date("2026-10-07T17:00:00Z");

async function montar({ negar = [], extra = null } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, "loja-a", deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const tabelas = tabelasPadrao();
  if (extra) extra(tabelas);
  const db = bancoFalso(tabelas);
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  const pedir = (texto) => processarComando({ pedido: { texto, chave: "chave-ficha-1" }, ic, motor, servicoAcoes, store, provedor: null, nomeUsuario: "Lucas", correlationId: "c1" });
  return { pedir, dbe };
}

test("como faz o vatapá: ingredientes, base da casa e etapas em ordem, sem a empresa B", async () => {
  const { pedir } = await montar();
  const r = await pedir("Como faz o vatapá?");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.match(r.texto, /^Vatapá Baiano rende 10 porções \(porção de 250 g\)\. Ingredientes: 500 g de Camarão 40\/60; 100 ml de Óleo de soja; 1,5 L de Caldo de camarão \(base da casa\)\. Preparo: 1\) Refogar o camarão no óleo\. 2\) Juntar o caldo/);
  assert.ok(!JSON.stringify(r).includes("999999") && !JSON.stringify(r).includes("segredo da B"), "vazou ficha da empresa B");
});

test("prato sem ficha: DADOS INSUFICIENTES, sem inventar receita", async () => {
  const { pedir } = await montar();
  const r = await pedir("Qual a receita da moqueca?");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.match(r.texto, /DADOS INSUFICIENTES/);
  assert.match(r.texto, /moqueca/);
});

test("sem permissão de fichas, a receita não aparece", async () => {
  const { pedir } = await montar({ negar: ["fichas.recipes.view", "cozinha.recipes.view", "bar.recipes.view"] });
  const r = await pedir("Como faz o vatapá?");
  assert.ok(!/Camarão|Refogar/.test(r.texto), r.texto);
});

test("ingredientes só da ficha já conferida desta unidade (regra pai do banco escopado)", async () => {
  const { dbe } = await montar();
  assert.throws(() => dbe.from("fichas_ingredientes").select("quantidade").eq("ficha_id", "fb"), ErroDeIsolamento, "ficha da B nunca lida");
  await assert.rejects(async () => await dbe.from("fichas_ingredientes").select("quantidade"), ErroDeIsolamento, "sem filtro pela ficha");
  await dbe.from("fichas_tecnicas").select("id");
  assert.throws(() => dbe.from("fichas_ingredientes").select("quantidade").in("ficha_id", ["f1", "fb"]), ErroDeIsolamento, "B continua fora mesmo misturada");
  const { data } = await dbe.from("fichas_ingredientes").select("quantidade").eq("ficha_id", "f1");
  assert.equal(data.length, 3);
});

test("quantidadeLegivel: kg e L pequenos viram g e ml", () => {
  assert.equal(quantidadeLegivel(0.25, "kg"), "250 g");
  assert.equal(quantidadeLegivel(2, "kg"), "2 kg");
  assert.equal(quantidadeLegivel(0.05, "L"), "50 ml");
  assert.equal(quantidadeLegivel(3, "un"), "3 un");
});

// ─── Achar o prato/drink pelo que foi dito + folha visual (pedido do dono, 07/11/2026) ───
const F_CLASSICA = "c0000000-0000-4000-8000-000000000001";
const F_MORANGO = "c0000000-0000-4000-8000-000000000002";
const F_VAT_CAM = "c0000000-0000-4000-8000-000000000003";
function comDrinks(t) {
  t.fichas_tecnicas.push(
    { id: F_CLASSICA, unidade_id: "loja-a", nome_receita: "Caipirinha Clássica", departamento: "bar", ativo: true, metodo_bar: "Macerado", modo_preparo: "" },
    { id: F_MORANGO, unidade_id: "loja-a", nome_receita: "Caipirinha morango ", departamento: "bar", ativo: true },
    { id: F_VAT_CAM, unidade_id: "loja-a", nome_receita: "Vatapá de Camarão", departamento: "cozinha", ativo: true, rendimento_porcoes: 4, rendimento_unidade: "porções",
      modo_preparo: "1. Doure os camarões no dendê.\n   • Panela de fundo grosso · Fogo médio\n2. Junte o leite de coco." },
    { id: "fbx", unidade_id: "loja-b", nome_receita: "Caipirinha Clássica", departamento: "bar", ativo: true, copo: "copo da B" },
  );
  t.fichas_ingredientes.push(
    { ficha_id: F_CLASSICA, insumo_id: OLEO, quantidade: 0.05 },
    { ficha_id: F_VAT_CAM, insumo_id: CAMARAO, quantidade: 0.3 },
  );
  t.montagem = [
    { unidade_id: "loja-a", nome: "Caipirinha Clássica", departamento: "bar", descritivo: "Ingredientes:\n• Suco de limão: 0.03 l", foto_url: "https://exemplo.supabase.co/storage/v1/object/public/montagem-fotos/caipi.jpg",
      estrutura_ia: [{ nome: "Copo Old Fashioned", tipo: "copo" }, { nome: "Cubos de gelo", tipo: "liquido" }] },
    { unidade_id: "loja-a", nome: "Vatapá de camarão", departamento: "cozinha", descritivo: "Vatapá de camarão\n200 g de vatapá no prato fundo\n4 camarões por cima", foto_url: "javascript:alert(1)" },
    { unidade_id: "loja-b", nome: "Caipirinha Clássica", descritivo: "segredo da B", estrutura_ia: [{ nome: "Copo da B", tipo: "copo" }] },
  ];
  t.fichas_montagem_passos = [];
}

test("'caipirinha' com duas fichas: pergunta qual, com um botão para cada (não escolhe sozinho)", async () => {
  const { pedir } = await montar({ extra: comDrinks });
  const r = await pedir("Como faz uma caipirinha?");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.deepEqual(r.pergunta.opcoes.map((o) => o.rotulo), ["Caipirinha Clássica", "Caipirinha morango"]);
  assert.equal(r.pergunta.opcoes[0].comando, "Como faz Caipirinha Clássica?");
});

test("fala com palavras a mais acha o prato pelo nome dito ('eu quero montar… a ficha técnica de um vatapá de camarão')", async () => {
  const { pedir } = await montar({ extra: comDrinks });
  const r = await pedir("Eu quero montar um eu quero saber qual é a ficha técnica de um vatapá de camarão");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.match(r.texto, /^Vatapá de Camarão rende 4 porções/);
});

test("fala com palavras a mais e nome parcial: oferece as fichas que têm a palavra", async () => {
  const { pedir } = await montar({ extra: comDrinks });
  const r = await pedir("Eu quero montar um eu quero saber qual é a ficha técnica de um vatapá");
  assert.equal(r.interpretacao.intencao, "fichas.preparo");
  assert.deepEqual(r.pergunta.opcoes.map((o) => o.rotulo).sort(), ["Vatapá Baiano", "Vatapá de Camarão"]);
});

test("folha do drink: copo e gelo da tela de Montagem, foto https, o que falta aparece — nada da empresa B", async () => {
  const { pedir } = await montar({ extra: comDrinks });
  const r = await pedir("Como faz a Caipirinha Clássica?");
  const folha = r.blocos.find((b) => b.tipo === "folha")?.folha;
  assert.ok(folha, "sem folha");
  assert.equal(folha.tipo, "drink");
  assert.equal(folha.nome, "Caipirinha Clássica");
  assert.deepEqual(folha.ingredientes.map(({ nome, quantidade, qtd, unidade }) => ({ nome, quantidade, qtd, unidade })), [{ nome: "Óleo de soja", quantidade: "50 ml", qtd: 0.05, unidade: "L" }]);
  assert.ok(folha.ingredientes[0].estoque === null || Number.isFinite(folha.ingredientes[0].estoque), "saldo em estoque vem do sistema ou fica vazio");
  const s = Object.fromEntries(folha.servico.map((x) => [x.id, x.valor]));
  assert.deepEqual(s, { copo: "Copo Old Fashioned", gelo: "Cubos de gelo", metodo: "Macerado", guarnicao: null });
  assert.equal(folha.foto, "https://exemplo.supabase.co/storage/v1/object/public/montagem-fotos/caipi.jpg");
  assert.deepEqual(folha.faltando, ["modo de preparo", "montagem", "guarnição"]);
  assert.ok(!JSON.stringify(r).includes("da B"), "vazou dado da empresa B");
  assert.equal(r.acoes[0].rota, `/dashboard/operacao/fichas/${F_CLASSICA}`);
  assert.equal(r.referencia?.ficha?.id, F_CLASSICA);
});

test("folha do prato: preparo numerado com detalhe e montagem da tela de Montagem; foto insegura descartada", async () => {
  const { pedir } = await montar({ extra: comDrinks });
  const r = await pedir("como faz o vatapá de camarão?");
  const folha = r.blocos.find((b) => b.tipo === "folha").folha;
  assert.equal(folha.tipo, "prato");
  assert.deepEqual(folha.preparo, [
    { texto: "Doure os camarões no dendê.", detalhe: "Panela de fundo grosso · Fogo médio" },
    { texto: "Junte o leite de coco.", detalhe: null },
  ]);
  assert.deepEqual(folha.montagem.map((p) => p.texto), ["200 g de vatapá no prato fundo", "4 camarões por cima"]);
  assert.equal(folha.foto, null);
  assert.match(r.texto, /Montagem: 1\) 200 g de vatapá no prato fundo 2\) 4 camarões por cima/);
});

// ─── Receita base ou prato? Foto e sem botões extras (pedido do dono, 07/11/2026) ───
function comBaseEPratos(t) {
  comDrinks(t);
  const vat = t.fichas_tecnicas.find((f) => f.id === F_VAT_CAM);
  vat.eh_base = true; // como no banco real: "Vatapá de Camarão" é a receita base
  t.produtos = [
    { unidade_id: "loja-a", ficha_id: F_VAT_CAM, nome_produto: "Vatapá", imagem_url: "https://exemplo.supabase.co/storage/v1/object/public/anexos/produtos/vatapa.jpeg" },
    { unidade_id: "loja-b", ficha_id: F_VAT_CAM, nome_produto: "Vatapá B", imagem_url: "https://b.exemplo/foto-da-b.jpg" },
  ];
}

test("'como fazer um vatapá' com receita base e pratos: pergunta primeiro receita ou prato", async () => {
  const { pedir } = await montar({ extra: comBaseEPratos });
  const r = await pedir("Como fazer um vatapá");
  assert.match(r.pergunta.texto, /receita base e 1 prato de Vatapá\. Você quer a receita \(o preparo\) ou o prato\?/);
  assert.deepEqual(r.pergunta.opcoes.map((o) => o.comando), ["Como faz a receita base de Vatapá?", "Como faz o prato de Vatapá?"]);
  assert.ok(!r.sugestoes?.length);
});

test("escolheu a receita: abre a base direto, com a foto do cardápio desta unidade e sem sugestões no fim", async () => {
  const { pedir } = await montar({ extra: comBaseEPratos });
  const r = await pedir("Como faz a receita base de Vatapá?");
  const folha = r.blocos.find((b) => b.tipo === "folha").folha;
  assert.equal(folha.nome, "Vatapá de Camarão");
  assert.equal(folha.tipo, "base");
  assert.equal(folha.foto, "https://exemplo.supabase.co/storage/v1/object/public/anexos/produtos/vatapa.jpeg");
  assert.ok(!r.sugestoes?.length, "a folha termina só com Abrir a ficha");
  assert.equal(r.acoes.length, 1);
});

test("escolheu o prato: só os pratos (aqui um só, abre direto)", async () => {
  const { pedir } = await montar({ extra: comBaseEPratos });
  const r = await pedir("Como faz o prato de Vatapá?");
  assert.equal(r.blocos.find((b) => b.tipo === "folha")?.folha.nome, "Vatapá Baiano");
});

// ─── Assistente clicável (pedido do dono, 08/11/2026) ───
const comBaseComCamarao = (t) => {
  t.fichas_ingredientes.push({ ficha_id: "f2", insumo_id: OLEO, quantidade: 0.05 });
  t.fichas_tecnicas.push({ id: "f3", unidade_id: "loja-a", nome_receita: "Bobó", departamento: "cozinha", ativo: true });
  t.fichas_ingredientes.push({ ficha_id: "f3", subficha_id: "f2", quantidade: 0.5 });
};

test("'Onde vai óleo de soja?': fichas que usam direto e as que usam pela base (nada da B)", async () => {
  const { pedir } = await montar({ extra: comBaseComCamarao });
  const r = await pedir("Onde vai óleo de soja?");
  assert.equal(r.interpretacao.intencao, "fichas.onde_vai");
  assert.match(r.texto, /^Óleo de soja vai em 3 fichas: Bobó \(dentro de Caldo de camarão\); Vatapá Baiano \(100 ml\); Caldo de camarão \(50 ml\)\.$/);
  assert.deepEqual(r.pergunta.opcoes.map((o) => o.comando), ["Como faz Bobó?", "Como faz Vatapá Baiano?", "Como faz Caldo de camarão?"]);
  assert.ok(!JSON.stringify(r).includes("999999"));
});

test("'Onde vai um ingrediente?' sem dizer qual: pergunta com o comando pronto", async () => {
  const { pedir } = await montar();
  const r = await pedir("Atalhos: ingrediente");
  assert.equal(r.pergunta.livre, true);
  assert.equal(r.pergunta.comandoBase, "Onde vai {valor}?");
});

test("menu por área e lista de pratos com um toque ('Vou preparar …' abre a folha já perguntando)", async () => {
  const { pedir } = await montar({ extra: comBaseComCamarao });
  const m = await pedir("Me ajuda");
  assert.deepEqual(m.pergunta.opcoes.map((o) => o.rotulo), ["Cozinha", "Bar", "Salão", "Estoque"]);
  const coz = await pedir(m.pergunta.opcoes[0].comando);
  assert.equal(coz.pergunta.opcoes[0].comando, "Pratos da cozinha");
  const lista = await pedir("Pratos da cozinha");
  assert.deepEqual(lista.pergunta.opcoes.map((o) => o.rotulo), ["Bobó", "Vatapá Baiano"], "só pratos da cozinha desta unidade (a base fica em 'Bases da cozinha')");
  const folha = (await pedir(lista.pergunta.opcoes[1].comando)).blocos.find((b) => b.tipo === "folha").folha;
  assert.equal(folha.preparar, true);
  assert.equal(folha.rendimentoQtd, 10);
  const leo = folha.ingredientes.find((i) => i.nome === "Óleo de soja");
  assert.deepEqual([leo.qtd, leo.unidade], [0.1, "L"]);
});

test("salão: a situação vai para o agente com o foco de passo a passo (sem IA, responde e não grava nada)", async () => {
  const { pedir } = await montar();
  const p = await pedir("Atalhos: problemas");
  assert.ok(p.pergunta.opcoes.some((o) => o.comando === "Situação no salão: o cliente tem alergia. Como resolvo?"));
  const r = await pedir("Situação no salão: o prato está demorando. Como resolvo?");
  assert.equal(r.interpretacao.intencao, "salao.orientacao");
  assert.deepEqual(r.agentes, ["geral"]);
  assert.ok(!r.confirmacao);
});
