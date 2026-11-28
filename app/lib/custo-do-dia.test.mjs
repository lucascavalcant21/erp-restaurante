import { test } from "node:test";
import assert from "node:assert/strict";
import { turnoDoHorario, equipePorTurno, descontosDaVenda, custoDoDia, oQueAVendaPagou, extrasDoDia } from "./custo-do-dia.mjs";

const params = {
  dias_operacao_mes: 26,
  custo_aluguel_mes: 5000, custo_luz_mes: 5000, custo_agua_mes: 1500,
  meta_cmv: 30, imposto_pct: 9, taxa_cartao_pct: 0,
};
const equipe = [
  { id: "a", nome: "Ana", tipo_contrato: "Fixo", salario: 2600, vale_alimentacao: 0, horario_entrada: "09:00" },
  { id: "b", nome: "Beto", tipo_contrato: "Fixo", salario: 1300, horario_entrada: "15:40:00" },
  { id: "c", nome: "Caio", tipo_contrato: "Freelancer", salario: 130, horario_entrada: "19:00" },
  { id: "d", nome: "Duda", tipo_contrato: "Fixo", salario: 0, horario_entrada: "09:00" },
  { id: "e", nome: "Eva", tipo_contrato: "Fixo", salario: 2000, status: "inativo" },
  { id: "f", nome: "Fabi", tipo_contrato: "Fixo", salario: 1560 },
];

test("turno pelo horário de entrada", () => {
  assert.equal(turnoDoHorario("06:30"), "manha");
  assert.equal(turnoDoHorario("11:59"), "manha");
  assert.equal(turnoDoHorario("12:00"), "tarde");
  assert.equal(turnoDoHorario("17:59:00"), "tarde");
  assert.equal(turnoDoHorario("18:00"), "noite");
  assert.equal(turnoDoHorario(""), "sem_horario");
  assert.equal(turnoDoHorario(null), "sem_horario");
  assert.equal(turnoDoHorario("25:00"), "sem_horario");
});

test("equipe por turno: só contratados; extra fica fora de turno e de sem-salário", () => {
  const r = equipePorTurno(equipe, { dias: 26 });
  const manha = r.turnos.find((t) => t.id === "manha");
  assert.equal(manha.fixos.length, 1);
  assert.equal(manha.fixos[0].dia, 100); // 2600 ÷ 26
  const tarde = r.turnos.find((t) => t.id === "tarde");
  assert.equal(tarde.fixoDia, 50);
  // Caio é extra: não aparece em turno nenhum (a noite só tinha ele).
  assert.equal(r.turnos.find((t) => t.id === "noite"), undefined);
  assert.ok(!r.turnos.some((t) => t.fixos.some((p) => p.id === "c")));
  const sem = r.turnos.find((t) => t.id === "sem_horario");
  assert.equal(sem.fixos[0].dia, 60);
  assert.deepEqual(r.semSalario.map((p) => p.id), ["d"]);
  assert.equal(r.fixoMes, 2600 + 1300 + 1560);
  assert.equal(r.pessoasExtras, 1);
  // inativo fora
  assert.ok(!r.turnos.some((t) => t.fixos.some((p) => p.id === "e")));
});

test("encargos entram sobre o salário", () => {
  const r = equipePorTurno([{ id: "a", tipo_contrato: "Fixo", salario: 2600, horario_entrada: "08:00" }], { dias: 26, encargosPct: 10 });
  assert.equal(r.fixoMes, 2860);
  assert.equal(r.turnos[0].fixos[0].dia, 110);
});

test("sem dias de operação: nada por dia", () => {
  const r = equipePorTurno(equipe, { dias: 0 });
  assert.equal(r.fixoDia, null);
  assert.equal(r.turnos[0].fixos[0].dia, null);
});

test("descontos: salão usa a casa, app usa as taxas do app sem cobrar imposto duas vezes", () => {
  assert.equal(descontosDaVenda(params).pct, 39);
  const app = { nome: "99", regras: [
    { nome: "Comissão", tipo: "percentual", valor: 8.9 },
    { nome: "Pagamento online", tipo: "percentual", valor: 3.2 },
    { nome: "Impostos", tipo: "percentual", valor: 9 },
    { nome: "Taxa por pedido", tipo: "fixo_pedido", valor: 1 },
  ] };
  const d = descontosDaVenda(params, app);
  assert.equal(Number(d.pct.toFixed(2)), 51.1);
  assert.equal(d.partes.length, 4);
  assert.equal(d.fixosPorPedido, 1);
  assert.equal(d.fixosSemTicket, true);
});

test("descontos do app: promoção da loja e taxas por pedido viram % do pedido médio", () => {
  // Comprovante do 99 (28/11/2026): comissão 8,9%, pagamento 3,2%, logística R$ 5,49 e entrega grátis R$ 6,00.
  const app = { nome: "99", descontoLojaPct: 5, regras: [
    { nome: "Comissão", tipo: "percentual", valor: 8.9 },
    { nome: "Pagamento online", tipo: "percentual", valor: 3.2 },
    { nome: "Taxa por pedido", tipo: "fixo_pedido", valor: 5.49 },
    { nome: "Entrega paga pela loja", tipo: "fixo_pedido", valor: 6 },
  ] };
  const d = descontosDaVenda(params, app, { ticketMedio: 45.5 });
  assert.equal(d.fixosPorPedido, 11.49);
  assert.equal(d.fixosSemTicket, false);
  const porPedido = d.partes.find((p) => /por pedido/.test(p.rotulo));
  assert.equal(Number(porPedido.pct.toFixed(2)), 25.25); // 11,49 ÷ 45,50
  assert.ok(d.partes.some((p) => /Promoção/.test(p.rotulo) && p.pct === 5));
  assert.equal(Number(d.pct.toFixed(2)), Number((30 + 9 + 8.9 + 3.2 + 5 + 25.2527).toFixed(2)));
});

test("extras do dia: só os recibos com a data de hoje; o mês fica de referência", () => {
  const recibos = [
    { id: 1, colaborador_id: "c", valor_total: 130, data_trabalho: "2026-11-28", pagamento_realizado: false },
    { id: 2, colaborador_id: "c", valor_total: 140, data_trabalho: "2026-11-27", pagamento_realizado: true },
    { id: 3, colaborador_id: "x", valor_total: 0, data_trabalho: "2026-11-28" },
    { id: 4, colaborador_id: "c", valor_total: 100, data_trabalho: "2026-10-31" },
  ];
  const e = extrasDoDia(recibos, equipe, "2026-11-28");
  assert.equal(e.total, 130);
  assert.deepEqual(e.recibos.map((r) => r.nome), ["Caio"]);
  assert.equal(e.mesTotal, 270);
  assert.equal(e.mesRecibos, 2);
});

test("custo do dia e venda mínima: contratados + casa; extras só os recibos de hoje", () => {
  const r = custoDoDia({ params, colaboradores: equipe, extrasHoje: 130 });
  // equipe 5460 + casa 11500 = 16960 ÷ 26; o extra não entra no mês
  assert.equal(r.totalMes, 16960);
  assert.equal(Number(r.totalDia.toFixed(2)), 652.31);
  assert.equal(r.linhas.find((l) => l.id === "custo_aluguel_mes").dia.toFixed(2), "192.31");
  // 652,307… ÷ 0,61 = 1069,36…, arredonda para cima no centavo
  assert.equal(r.vendaMinimaDia, 1069.36);
  assert.equal(r.motivo, null);
  // Hoje: + R$ 130 do recibo da noite, logo depois da equipe contratada.
  assert.equal(Number(r.totalHoje.toFixed(2)), 782.31);
  assert.equal(r.linhasHoje[1].id, "extras_hoje");
  assert.equal(r.vendaMinimaHoje, 1282.48);
  const semExtra = custoDoDia({ params, colaboradores: equipe });
  assert.equal(semExtra.linhasHoje.length, semExtra.linhas.length);
  assert.equal(semExtra.vendaMinimaHoje, semExtra.vendaMinimaDia);
});

test("custo do dia sem dias ou com margem zero: DADOS INSUFICIENTES com motivo", () => {
  const semDias = custoDoDia({ params: { ...params, dias_operacao_mes: 0 }, colaboradores: equipe });
  assert.equal(semDias.vendaMinimaDia, null);
  assert.match(semDias.motivo, /dias/);
  const semMargem = custoDoDia({ params: { ...params, meta_cmv: 95 }, colaboradores: equipe });
  assert.equal(semMargem.vendaMinimaDia, null);
  assert.match(semMargem.motivo, /não sobra/);
});

test("pró-labore entra no fim da fila", () => {
  const r = custoDoDia({ params: { ...params, pro_labore: [{ socio: "Lucas", valor_mensal: 2600 }] }, colaboradores: [] });
  assert.equal(r.linhas.at(-1).rotulo, "Pró-labore · Lucas");
  assert.equal(r.linhas.at(-1).dia, 100);
});

test("simulador: paga na ordem, mostra o que faltou", () => {
  const linhas = [{ id: "equipe", rotulo: "Equipe", dia: 300 }, { id: "aluguel", rotulo: "Aluguel", dia: 192.31 }, { id: "luz", rotulo: "Luz", dia: 192.31 }];
  const r = oQueAVendaPagou({ venda: 800, sobraPct: 61, linhas });
  assert.equal(r.sobraC, 48800);
  assert.equal(r.saiuAntesC, 31200);
  assert.deepEqual(r.linhas.map((l) => l.status), ["pago", "parcial", "falta"]);
  assert.equal(r.linhas[1].pagoC, 18800);
  assert.equal(r.faltouC, 68462 - 48800);
  assert.equal(r.situacao, "faltou");
  assert.equal(r.pagoC + r.faltouC, r.custoDiaC);
});

test("simulador: passou do custo vira lucro do dia", () => {
  const r = oQueAVendaPagou({ venda: 2000, sobraPct: 61, linhas: [{ id: "x", rotulo: "Tudo", dia: 702.31 }] });
  assert.equal(r.situacao, "lucro");
  assert.equal(r.lucroC, 122000 - 70231);
  assert.equal(r.faltouC, 0);
  assert.equal(oQueAVendaPagou({ venda: 0, sobraPct: 61, linhas: [] }).situacao, "sem_venda");
});

import { pesosDaEquipeNoMes, repartirPorPeso } from "./custo-do-dia.mjs";

test("peso de cada pessoa no mês: contratado pelo cadastro, extra pelas diárias pagas", () => {
  const p = pesosDaEquipeNoMes({
    colaboradores: equipe,
    recibos: [
      { colaborador_id: "c", valor_total: 130, pagamento_realizado: true, data_pagamento: "2026-11-05" },
      { colaborador_id: "c", valor_total: 130, pagamento_realizado: true, data_pagamento: "2026-11-12" },
      { colaborador_id: "c", valor_total: 130, pagamento_realizado: false, data_pagamento: "2026-11-19" },
      { colaborador_id: "c", valor_total: 130, pagamento_realizado: true, data_pagamento: "2026-10-30" },
    ],
    referencia: new Date("2026-11-28T12:00:00"),
  });
  assert.deepEqual(p.map((x) => [x.id, x.mes]), [["a", 2600], ["f", 1560], ["b", 1300], ["c", 260]]);
});

test("repartir o CMO do produto por pessoa soma exatamente", () => {
  const r = repartirPorPeso(1001, [{ id: "a", mes: 1 }, { id: "b", mes: 1 }, { id: "c", mes: 1 }]);
  assert.equal(r.reduce((s, x) => s + x.centavos, 0), 1001);
  assert.deepEqual(r.map((x) => x.centavos), [334, 334, 333]);
  assert.equal(Number(r[0].parte.toFixed(2)), 33.33);
  assert.deepEqual(repartirPorPeso(500, []).length, 0);
});
