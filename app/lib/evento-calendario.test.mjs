// Rode com: node --test app/lib/evento-calendario.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { situacaoDoPagamento, eventoDoCalendario, marcasDosEventos, semanasDoMes, recebimentosDosEventos, vencimentoPadrao } from "./evento-calendario.mjs";

const HOJE = "2026-11-21";

test("situação: nada, parcial a vencer, parcial atrasado, pago e sem valor", () => {
  assert.equal(situacaoDoPagamento({ total: 0, hojeIso: HOJE }).estado, "sem_valor");
  const nada = situacaoDoPagamento({ total: 5000, pagamentos: [], dataEvento: "2026-12-20", restanteDias: 7, hojeIso: HOJE });
  assert.equal(nada.estado, "nada");
  assert.equal(nada.vencimento, "2026-12-13");
  assert.equal(nada.venceEm, 22);
  const parcial = situacaoDoPagamento({ total: 5000, pagamentos: [{ valor: 1500, data: "2026-11-01" }], vencimentoRestante: "2026-11-18", hojeIso: HOJE });
  assert.equal(parcial.estado, "parcial");
  assert.equal(parcial.falta, 3500);
  assert.equal(parcial.atrasado, true);
  assert.equal(parcial.diasAtraso, 3);
  assert.equal(parcial.primeiraData, "2026-11-01");
  const pago = situacaoDoPagamento({ total: 5000, pagamentos: [{ valor: "1.500", data: "2026-11-01" }, { valor: 3500, data: "2026-11-10" }], hojeIso: HOJE });
  assert.equal(pago.estado, "pago");
  assert.equal(pago.atrasado, false);
  assert.equal(vencimentoPadrao("2026-12-20", 0), "2026-12-20");
});

test("calendário: dia do evento, pagamento parcial, quitação e vencimento atrasado", () => {
  const linha = (id, extra) => ({ id, nome: `Evento ${id}`, cliente_nome: "Ana", data_evento: "2026-12-05", valor_contratado: 4000, historico_pagamentos: [], operacao_detalhes: { orcamento: { cliente: { categoria: "Casamento" }, financeiro: {} } }, ...extra });
  const a = eventoDoCalendario(linha("a", { historico_pagamentos: [{ valor: 1000, data: "2026-11-02", metodo: "PIX" }], operacao_detalhes: { orcamento: { cliente: { categoria: "Casamento" }, financeiro: { vencimento_restante: "2026-11-20" } } } }), { hojeIso: HOJE });
  const b = eventoDoCalendario(linha("b", { historico_pagamentos: [{ valor: 1000, data: "2026-11-03" }, { valor: 3000, data: "2026-11-15" }] }), { hojeIso: HOJE });
  const c = eventoDoCalendario(linha("c", { valor_contratado: 2000, historico_pagamentos: [{ valor: 2000, data: "2026-11-04" }], operacao_detalhes: null }), { hojeIso: HOJE });
  assert.equal(a.categoria, "Casamento");
  assert.equal(c.categoria, "Sem categoria");
  const m = marcasDosEventos([a, b, c]);
  assert.equal(m.get("2026-12-05").filter((x) => x.tipo === "evento").length, 3);
  assert.equal(m.get("2026-11-02")[0].tipoPag, "parcial");
  assert.equal(m.get("2026-11-15")[0].tipoPag, "quitacao");
  assert.equal(m.get("2026-11-04")[0].tipoPag, "integral");
  const venc = m.get("2026-11-20")[0];
  assert.equal(venc.tipo, "vencimento");
  assert.equal(venc.valor, 3000);
  assert.equal(venc.atrasado, true);
  const rec = recebimentosDosEventos([a, b, c]);
  assert.equal(rec.atrasados.length, 1);
  assert.equal(rec.totalAtrasado, 3000);
  assert.equal(rec.totalAReceber, 3000);
});

test("semanas do mês começam no domingo", () => {
  const s = semanasDoMes("2026-11"); // 1/11/2026 é domingo
  assert.equal(s[0][0], "2026-11-01");
  assert.equal(s.flat().filter(Boolean).length, 30);
  assert.equal(semanasDoMes("2026-12")[0].filter((x) => x === null).length, 2); // 1/12 é terça
});
