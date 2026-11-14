// Conversa Jhon ↔ Nico (14/11/2026). TESTADO EM MOCK: o provedor de IA é
// trocado por respostas roteirizadas; o que se testa é o motor e as travas.
import test from "node:test";
import assert from "node:assert/strict";
import { conversarJhonNico, validarPlano, numerosDoPedido } from "../agents/conversa-jhon-nico.mjs";

const fatos = {
  agora: "sábado 14/11, 10:00",
  equipe: [{ id: "c1", nome: "Maria", funcao: "Cozinheira", entrada: "08:00", saida: "16:20", intervalo: "12:00" }, { id: "c2", nome: "João", funcao: "Auxiliar" }],
  fichas: [{ id: "f-acai", nome: "Açaí batido", tempoMin: 20 }, { id: "f-vatapa", nome: "Vatapá", tempoMin: 90 }],
  procedimentos: [{ nome: "Limpeza do balcão", tipo: "limpeza" }],
};
const PEDIDO = "Hoje tem que bater 4 litros de açaí, fazer vatapá e limpar o balcão.";

function roteiro(respostas) {
  const chamadas = [];
  return {
    chamadas,
    disponivel: () => true,
    async interpretar(args) { chamadas.push(args); const r = respostas.shift(); return r ? { ok: true, dados: r } : { ok: false, motivo: "fim" }; },
  };
}

test("o Jhon propõe, o Nico pede ajuste, o Jhon refaz e o Nico aceita", async () => {
  const p = roteiro([
    { mensagem: "Proposta: açaí primeiro.", tarefas: [{ titulo: "Bater açaí", tipo: "producao", ficha_id: "f-acai", procedimento: null, quantidade: 4, unidade: "L", responsavel_id: "c2", depois_do_intervalo: false, motivo: "rápido" }] },
    { mensagem: "Vatapá leva 90 min: começa antes. E falta o balcão.", aceito: false, ajustes: ["Vatapá primeiro", "Balcão no fim"] },
    { mensagem: "Refiz.", tarefas: [
      { titulo: "Fazer vatapá", tipo: "producao", ficha_id: "f-vatapa", procedimento: null, quantidade: null, unidade: null, responsavel_id: "c1", depois_do_intervalo: false, motivo: "leva mais tempo" },
      { titulo: "Bater açaí", tipo: "producao", ficha_id: "f-acai", procedimento: null, quantidade: 4, unidade: "L", responsavel_id: "c2", depois_do_intervalo: false, motivo: "enquanto o vatapá cozinha" },
      { titulo: "Limpar o balcão", tipo: "limpeza", ficha_id: null, procedimento: "Limpeza do balcão", quantidade: null, unidade: null, responsavel_id: "c2", depois_do_intervalo: true, motivo: "depois da produção" },
    ] },
    { mensagem: "Fechado.", aceito: true, ajustes: [] },
  ]);
  const r = await conversarJhonNico({ pedido: PEDIDO, fatos, provedor: p });
  assert.equal(r.status, "combinado");
  assert.equal(r.rodadas, 2);
  assert.deepEqual(r.conversa.map((m) => m.de), ["jhon", "nico", "jhon", "nico"]);
  assert.deepEqual(r.plano.map((t) => [t.ordem, t.titulo, t.responsavelNome]), [[1, "Fazer vatapá", "Maria"], [2, "Bater açaí", "João"], [3, "Limpar o balcão", "João"]]);
  assert.equal(r.plano[1].quantidade, 4);
  assert.deepEqual(r.pendencias, ['"Fazer vatapá": quanto produzir?'], "o dono não disse quanto vatapá");
  assert.equal(r.natureza, "SUGESTÃO");
  // o Nico recebe o plano do Jhon na conversa, e os dois recebem só os fatos
  assert.match(p.chamadas[1].texto, /PLANO PROPOSTO/);
  assert.match(p.chamadas[0].sistema, /Maria/);
  assert.doesNotMatch(p.chamadas[1].sistema, /R\$|custo de|salário de/i);
});

test("as travas tiram o que a IA inventou e viram pendência", () => {
  const { plano, pendencias } = validarPlano([
    { titulo: "Bater açaí", tipo: "producao", ficha_id: "f-acai", quantidade: 10, unidade: "L", responsavel_id: "c9", procedimento: "Limpeza da coifa", depois_do_intervalo: false },
    { titulo: "Coisa", tipo: "hackear", ficha_id: "f-x" },
  ], fatos, PEDIDO);
  assert.equal(plano[0].quantidade, null, "10 L não foi dito pelo dono");
  assert.equal(plano[0].responsavelId, null);
  assert.equal(plano[0].procedimento, null);
  assert.equal(plano[1].tipo, "outro");
  assert.equal(plano[1].fichaId, null);
  assert.equal(pendencias.length, 4);
});

test("sem acordo no limite de rodadas: plano vem com aviso", async () => {
  const p = roteiro([
    { mensagem: "A", tarefas: [] }, { mensagem: "não", aceito: false, ajustes: ["x"] },
    { mensagem: "B", tarefas: [] }, { mensagem: "não", aceito: false, ajustes: ["y"] },
  ]);
  const r = await conversarJhonNico({ pedido: PEDIDO, fatos, provedor: p, maxRodadas: 2 });
  assert.equal(r.status, "sem_acordo");
  assert.match(r.pendencias[0], /ainda tinha ajustes/);
  assert.equal(p.chamadas.length, 4, "não passa do limite");
});

test("sem IA ou com falha: diz o motivo, não inventa plano", async () => {
  assert.equal((await conversarJhonNico({ pedido: PEDIDO, fatos, provedor: { disponivel: () => false } })).status, "sem_ia");
  const r = await conversarJhonNico({ pedido: PEDIDO, fatos, provedor: roteiro([]) });
  assert.equal(r.status, "falha");
  assert.deepEqual(r.plano, []);
  assert.equal((await conversarJhonNico({ pedido: " ", fatos, provedor: roteiro([]) })).status, "sem_pedido");
});

test("números do pedido", () => {
  assert.deepEqual([...numerosDoPedido("4 litros, 3,5 kg e 12 unidades")], [4, 3.5, 12]);
});

import { handlerPlanoDoDia, fatosDoDia } from "../server/plano-do-dia.mjs";

function motorFalso({ escalaFalha = false } = {}) {
  const tabelas = { op_processos: [{ id: "p1", nome: "Limpeza do balcão", descricao: null, setor: "geral", conteudo: { tipo: "limpeza" } }], op_secoes: [{ id: "s1", processo_id: "p1", titulo: "Passo a passo", ordem: 0 }], op_itens: [{ id: "i1", processo_id: "p1", secao_id: "s1", titulo: "Tirar tudo do balcão", ordem: 0 }] };
  const q = (t) => { const r = { data: tabelas[t] || [], error: null }; const o = { select: () => o, eq: () => o, order: () => o, limit: () => o, in: () => o, then: (f, g) => Promise.resolve(r).then(f, g) }; return o; };
  return {
    ambiente: { dbe: { from: q, consultas: [] } },
    getSchedule: async () => (escalaFalha ? { status: "insuficiente", motivo: "Nenhum colaborador cadastrado nesta unidade." } : { detalhes: { trabalham: [{ id: "c1", nome: "Maria", cargo: "Cozinheira", entrada: "08:00", saida: "16:20" }] } }),
    listRecipes: async () => ({ detalhes: { fichas: [{ id: "f-acai", nome: "Açaí batido" }] } }),
  };
}
const icDono = { usuario: { superAdmin: true }, permissoes: ["*"], escopo: {}, fuso: "America/Sao_Paulo" };
const icTablet = { usuario: { superAdmin: false, perfil: "setor" }, permissoes: ["dashboard.intelligence.view"], escopo: {} };
const store = { registrarEvento: async () => {} };

test("fatos do dia: escala, fichas e procedimentos lidos do banco; o que falta é dito", async () => {
  const { fatos, faltando } = await fatosDoDia({ motor: motorFalso(), agora: new Date("2026-11-14T13:00:00Z") });
  assert.deepEqual(fatos.equipe, [{ id: "c1", nome: "Maria", funcao: "Cozinheira", entrada: "08:00", saida: "16:20" }]);
  assert.deepEqual(fatos.procedimentos, [{ nome: "Limpeza do balcão", tipo: "limpeza" }]);
  assert.match(fatos.agora, /10:00/);
  assert.deepEqual(faltando, []);
  assert.deepEqual((await fatosDoDia({ motor: motorFalso({ escalaFalha: true }) })).faltando, ["Nenhum colaborador cadastrado nesta unidade."]);
});

test("plano do dia: só o dono; pedido vazio recusado; resultado com a conversa", async () => {
  const h = handlerPlanoDoDia();
  assert.equal((await h({ ic: icTablet, motor: motorFalso(), store, corpo: { pedido: "x" } })).status, 403);
  assert.equal((await h({ ic: icDono, motor: motorFalso(), store, corpo: { pedido: " " } })).status, 400);
  const p = roteiro([
    { mensagem: "Açaí com a Maria.", tarefas: [{ titulo: "Bater açaí", tipo: "producao", ficha_id: "f-acai", procedimento: null, quantidade: 4, unidade: "L", responsavel_id: "c1", depois_do_intervalo: false, motivo: "único item" }] },
    { mensagem: "Ok.", aceito: true, ajustes: [] },
  ]);
  const out = await h({ ic: icDono, motor: motorFalso(), store, corpo: { pedido: "Bater 4 litros de açaí" }, provedor: p, correlationId: "c" });
  assert.equal(out.corpo.resultado.status, "combinado");
  assert.equal(out.corpo.resultado.plano[0].responsavelNome, "Maria");
  assert.equal(out.corpo.resultado.pedido, "Bater 4 litros de açaí");
});

import { ehPerguntaDoQueFazer, respostaDoPlano } from "../agents/plano-do-dia-nico.mjs";
import { normalizarTarefa } from "../../plano-dia.mjs";

test("'cheguei, o que eu faço agora?' responde com o plano aprovado, só o que falta", () => {
  for (const f of ["Cheguei na cozinha, o que eu faço agora?", "Nico, o que eu tenho que fazer?", "qual a minha tarefa", "plano de hoje"]) assert.equal(ehPerguntaDoQueFazer(f), true, f);
  assert.equal(ehPerguntaDoQueFazer("como limpo a chapa?"), false);
  const r = respostaDoPlano({ tarefas: [
    normalizarTarefa({ ordem: 1, titulo: "Fazer vatapá", ficha_nome: "Vatapá", quantidade: 3, unidade_medida: "kg", responsavel_nome: "Maria", feito_em: "x" }),
    normalizarTarefa({ ordem: 2, titulo: "Bater açaí", ficha_nome: "Açaí batido", quantidade: 4, unidade_medida: "L", responsavel_nome: "João" }),
    normalizarTarefa({ ordem: 3, titulo: "Limpar o balcão", procedimento: "Limpeza do balcão", depois_do_intervalo: true }),
  ] });
  assert.match(r.texto, /1 de 3 feitas/);
  assert.match(r.texto, /2\. Bater açaí \(4 L\), João/);
  assert.equal(r.natureza, "REAL");
  assert.deepEqual(r.blocos[0].etapas.map((e) => e.abre?.comando), ["Vou preparar Açaí batido", "Procedimento da casa: Limpeza do balcão"]);
  assert.match(respostaDoPlano({ tarefas: [normalizarTarefa({ ordem: 1, titulo: "x", feito_em: "y" })] }).texto, /todo feito/);
});
