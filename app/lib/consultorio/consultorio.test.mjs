// Rode com: node --test app/lib/consultorio/consultorio.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { fimDaConsulta, valorDaConsulta, conflitos, horariosLivres, filaDoMedico, resumoDoDia, retornosEsquecidos, podeMudar, cpfValido, idade, textoDeConfirmacao } from "./agenda.mjs";
import { contaDaConsulta, cascataDaConsulta, consultasParaEquilibrio, analiseDoConvenio, resultadoDoMes } from "./precificacao.mjs";

const CFG = {
  custos_fixos: [{ nome: "Aluguel da sala", valor: "2.000" }, { nome: "Secretária", valor: 2000 }],
  pro_labore: 8000, consultas_mes: 200, custos_variaveis: [{ nome: "Material", valor: "5" }],
  imposto_pct: 10, taxa_cartao_pct: 3, meta_lucro: 20,
};

test("preço da consulta: custo, ponto de equilíbrio e preço da meta", () => {
  const c = contaDaConsulta(CFG);
  assert.equal(c.ok, true);
  assert.equal(c.fixosPorConsulta, 60);       // (4.000 + 8.000) ÷ 200
  assert.equal(c.proLaborePorConsulta, 40);
  assert.equal(c.custo, 65);
  assert.equal(c.pontoEquilibrio, 74.72);     // 65 ÷ 0,87, para cima
  assert.equal(c.precoMeta, 97.71);           // 85 ÷ 0,87
  const k = cascataDaConsulta(250, c);
  assert.equal(k.lucro, 152.5);               // 250 − 32,50 − 5 − 20 − 40
  assert.equal(k.atingeMeta, true);
  assert.equal(cascataDaConsulta(70, c).abaixoDoEquilibrio, true);
  assert.equal(consultasParaEquilibrio(250, c), 57); // 12.000 ÷ (217,5 − 5)
  assert.equal(contaDaConsulta({}).ok, false);
});

test("convênio: glosa, imposto (sem cartão) e lucro contra o custo", () => {
  const c = contaDaConsulta(CFG);
  const a = analiseDoConvenio({ valor: 100, glosaPct: 5, conta: c });
  assert.equal(a.recebido, 95);
  assert.equal(a.liquido, 80.5);              // 95 × 0,9 − 5
  assert.equal(a.lucro, 20.5);                // − 60
  assert.equal(analiseDoConvenio({ valor: 60, conta: c }).cobreCusto, false);
});

test("agenda: fim, valor, conflitos, livres, fila e resumo", () => {
  assert.equal(fimDaConsulta("2026-11-24T13:00:00.000Z", 45), "2026-11-24T13:45:00.000Z");
  const tipo = { id: "t", valor_particular: "250" };
  assert.equal(valorDaConsulta(tipo), 250);
  assert.equal(valorDaConsulta(tipo, { valores: { t: "100,50" } }), 100.5);
  assert.equal(valorDaConsulta(tipo, { valores: {} }), null);
  const lista = [
    { id: "a", inicio: "2026-11-24T13:00:00.000Z", fim: "2026-11-24T13:30:00.000Z", status: "agendada", valor: 250 },
    { id: "b", inicio: "2026-11-24T14:00:00.000Z", fim: "2026-11-24T14:30:00.000Z", status: "cancelada", valor: 250 },
    { id: "c", inicio: "2026-11-24T15:00:00.000Z", fim: "2026-11-24T15:30:00.000Z", status: "chegou", chegada_em: "2026-11-24T14:50:00.000Z", valor: 100 },
    { id: "d", inicio: "2026-11-24T16:00:00.000Z", fim: "2026-11-24T16:30:00.000Z", status: "atendida", valor: 250, pago_em: "2026-11-24T16:31:00.000Z" },
    { id: "e", inicio: "2026-11-24T17:00:00.000Z", fim: "2026-11-24T17:30:00.000Z", status: "em_atendimento", valor: 250 },
  ];
  assert.deepEqual(conflitos(lista, "2026-11-24T13:15:00.000Z", "2026-11-24T13:45:00.000Z").map((x) => x.id), ["a"]);
  assert.equal(conflitos(lista, "2026-11-24T14:00:00.000Z", "2026-11-24T14:30:00.000Z").length, 0); // cancelada libera
  assert.deepEqual(filaDoMedico(lista).map((x) => x.id), ["e", "c"]);
  const r = resumoDoDia(lista);
  assert.deepEqual([r.total, r.atendidas, r.aguardando, r.recebido], [4, 1, 2, 250]);
  const livres = horariosLivres({ dia: "2026-11-24", consultas: [], expediente: { inicio: "08:00", fim: "10:00" }, minutos: 30 });
  assert.equal(livres.length, 4);
  assert.equal(podeMudar("agendada", "chegou"), true);
  assert.equal(podeMudar("atendida", "cancelada"), false);
});

test("retornos esquecidos: venceu e não marcou; marcado depois não aparece", () => {
  const fichas = [
    { paciente_id: "p1", criado_em: "2026-10-01T12:00:00Z", retorno_dias: 30 },
    { paciente_id: "p2", criado_em: "2026-10-01T12:00:00Z", retorno_dias: 30 },
    { paciente_id: "p3", criado_em: "2026-11-15T12:00:00Z", retorno_dias: 30 },
  ];
  const consultas = [{ paciente_id: "p2", inicio: "2026-11-05T13:00:00Z", status: "agendada" }];
  const r = retornosEsquecidos({ fichas, consultas, hojeIso: "2026-11-21" });
  assert.deepEqual(r.map((x) => [x.paciente_id, x.retornoEm, x.vencido]), [["p1", "2026-10-31", true], ["p3", "2026-12-15", false]]);
  assert.equal(r[0].diasAtraso, 21);
});

test("resultado do mês pela agenda, com projeção", () => {
  const c = contaDaConsulta(CFG);
  const consultas = Array.from({ length: 50 }, (_, i) => ({ inicio: `2026-11-${String(1 + (i % 10)).padStart(2, "0")}T13:00:00Z`, status: "atendida", valor: 250, pago_em: i < 40 ? "x" : null }));
  const r = resultadoDoMes({ consultas, conta: c, mes: "2026-11", hojeIso: "2026-11-10" });
  assert.equal(r.receita, 12500);
  assert.equal(r.recebido, 10000);
  assert.equal(r.lucro, 12500 - 1625 - 250 - 12000);
  assert.equal(r.projecao.atendidas, 150);
  assert.equal(r.metaMes, 4000);
});

test("cadastro: CPF, idade e mensagem de confirmação", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(idade("1990-11-22", "2026-11-21"), 35);
  assert.match(textoDeConfirmacao({ paciente: { nome: "Maria Souza" }, inicio: "2026-11-24T13:00:00Z" }), /^Olá, Maria! Confirmando sua consulta/);
});

test("teleconsulta: termo, código, convite, sala embutida e duração", async () => {
  const { termoEmUso, gerarCodigo, linkDoPaciente, conviteWhatsApp, salaEmbutida, duracaoMin, TERMO_PADRAO } = await import("./teleconsulta.mjs");
  assert.equal(termoEmUso({}).texto, TERMO_PADRAO);
  assert.deepEqual(termoEmUso({ termo_telemedicina: { texto: "Meu termo", versao: "2026-11-21" } }), { texto: "Meu termo", versao: "2026-11-21" });
  const c = gerarCodigo();
  assert.match(c, /^[A-Za-z0-9]{40}$/);
  assert.notEqual(c, gerarCodigo());
  assert.equal(linkDoPaciente("https://app.x/", "abc"), "https://app.x/teleconsulta/abc");
  assert.match(conviteWhatsApp({ paciente: { nome: "Maria Souza" }, inicio: "2026-11-24T13:00:00Z", link: "https://l" }), /^Olá, Maria! Sua teleconsulta[\s\S]*https:\/\/l$/);
  assert.match(salaEmbutida("https://hefisto.whereby.com/abc", { nome: "Dr Lucas" }), /displayName=Dr\+Lucas/);
  assert.equal(salaEmbutida("javascript:alert(1)"), null);
  assert.equal(duracaoMin("2026-11-24T13:00:00Z", "2026-11-24T13:22:00Z"), 22);
});
