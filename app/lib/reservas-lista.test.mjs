// Rode com: node --test app/lib/reservas-lista.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { rotuloStatusReserva, filtrarReservas, agruparPorDia, pessoasDasReservas, reservaCancelada } from "./reservas-lista.mjs";

const HOJE = "2026-10-17";
const R = [
  { id: "a", cliente_nome: "Carlos Mendes", telefone: "(11) 95555-4444", data_reserva: "2026-10-17", horario: "20:00:00", qtd_pessoas: 4, status: "confirmed" },
  { id: "b", cliente_nome: "Patrícia Rocha", telefone: "(11) 94444-5555", data_reserva: "2026-10-19", horario: "13:00", qtd_pessoas: 8, status: "nova", mesa: "T2" },
  { id: "c", cliente_nome: "José", data_reserva: "2026-10-17", horario: "12:00", qtd_pessoas: 2, status: "cancelled" },
  { id: "d", cliente_nome: "Ana", data_reserva: "2026-10-10", horario: "19:00", qtd_pessoas: 6, status: "confirmada" },
  { id: "e", cliente_nome: "Sem data", data_reserva: null, qtd_pessoas: 3 },
];

test("status em português e inglês viram o mesmo rótulo", () => {
  assert.equal(rotuloStatusReserva("confirmed"), "Confirmada");
  assert.equal(rotuloStatusReserva("confirmada"), "Confirmada");
  assert.equal(rotuloStatusReserva("CANCELLED"), "Cancelada");
  assert.equal(rotuloStatusReserva(""), "Nova");
  assert.equal(rotuloStatusReserva("aguardando"), "Aguardando");
  assert.equal(reservaCancelada({ status: "CANCELLED" }), true);
});

test("próximas: de hoje em diante, sem canceladas, por data e hora", () => {
  assert.deepEqual(filtrarReservas(R, { periodo: "proximas", hojeIso: HOJE }).map((r) => r.id), ["a", "b"]);
});

test("passadas: antes de hoje, a mais recente primeiro; todas inclui canceladas e ignora sem data", () => {
  assert.deepEqual(filtrarReservas(R, { periodo: "passadas", hojeIso: HOJE }).map((r) => r.id), ["d"]);
  assert.deepEqual(filtrarReservas(R, { periodo: "todas", hojeIso: HOJE }).map((r) => r.id), ["d", "c", "a", "b"]);
});

test("busca sem acento por nome, mesa e dígitos do telefone", () => {
  assert.deepEqual(filtrarReservas(R, { periodo: "todas", termo: "patricia", hojeIso: HOJE }).map((r) => r.id), ["b"]);
  assert.deepEqual(filtrarReservas(R, { periodo: "todas", termo: "t2", hojeIso: HOJE }).map((r) => r.id), ["b"]);
  assert.deepEqual(filtrarReservas(R, { periodo: "todas", termo: "955554444", hojeIso: HOJE }).map((r) => r.id), ["a"]);
});

test("agrupa por dia e soma pessoas sem as canceladas", () => {
  const lista = filtrarReservas(R, { periodo: "todas", hojeIso: HOJE });
  assert.deepEqual(agruparPorDia(lista).map(([d, l]) => [d, l.length]), [["2026-10-10", 1], ["2026-10-17", 2], ["2026-10-19", 1]]);
  assert.equal(pessoasDasReservas(lista), 18);
});
