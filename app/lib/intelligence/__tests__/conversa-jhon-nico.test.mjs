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
