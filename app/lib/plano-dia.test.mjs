import test from "node:test";
import assert from "node:assert/strict";
import { normalizarTarefa, andamento, fraseDoAndamento, comandoDaTarefa, quantidadeDigitada } from "./plano-dia.mjs";

test("linha do banco e plano combinado viram a mesma tarefa", () => {
  const a = normalizarTarefa({ id: "1", ordem: 1, titulo: "Fazer vatapá", tipo: "producao", ficha_nome: "Vatapá", quantidade: "3", unidade_medida: "kg", responsavel_nome: "Maria", depois_do_intervalo: false });
  const b = normalizarTarefa({ ordem: 1, titulo: "Fazer vatapá", tipo: "producao", fichaNome: "Vatapá", quantidade: 3, unidade: "kg", responsavelNome: "Maria" });
  assert.deepEqual({ ...a, id: null }, b);
});

test("andamento e a frase do Jhon", () => {
  const ts = [
    normalizarTarefa({ titulo: "Vatapá", feito_em: "2026-11-14T13:00:00Z", responsavel_nome: "Maria" }),
    normalizarTarefa({ titulo: "Açaí", responsavel_nome: "João" }),
    normalizarTarefa({ titulo: "Balcão" }),
  ];
  const a = andamento(ts);
  assert.deepEqual([a.feitas, a.total, a.pct, a.proxima.titulo], [1, 3, 33, "Açaí"]);
  assert.equal(fraseDoAndamento(a), "Plano do dia: 1 de 3 feitas (33%). Agora: Açaí (João).");
  assert.equal(fraseDoAndamento(andamento([])), "Nenhum plano aprovado hoje.");
  assert.match(fraseDoAndamento(andamento([normalizarTarefa({ titulo: "x", feito_em: "y" })])), /concluído/);
});

test("ver como faz: ficha primeiro, depois procedimento", () => {
  assert.equal(comandoDaTarefa({ fichaNome: "Vatapá" }), "Vou preparar Vatapá");
  assert.equal(comandoDaTarefa({ procedimento: "Limpeza do balcão" }), "Procedimento da casa: Limpeza do balcão");
  assert.equal(comandoDaTarefa({}), null);
});

test("quantidade digitada", () => {
  assert.equal(quantidadeDigitada("3,5"), 3.5);
  assert.equal(quantidadeDigitada("0"), null);
  assert.equal(quantidadeDigitada("abc"), null);
});
