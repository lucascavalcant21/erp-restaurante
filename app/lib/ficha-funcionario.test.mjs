import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS, TITULOS_RAPIDOS, montarRegistro, recorrencias, sugestaoDisciplinar,
  uniformesComFuncionario, faltaAssinatura, linhaDoTempo, filtrar, reais,
} from "./ficha-funcionario.mjs";

const HOJE = "2026-11-14";

test("cada tipo tem títulos prontos para tocar", () => {
  for (const t of TIPOS) assert.ok(TITULOS_RAPIDOS[t.id]?.length, t.id);
});

test("advertência: título, data e gravidade; a unidade não vai no corpo", () => {
  const r = montarRegistro({ tipo: "advertencia_escrita", titulo: "  Atraso  repetido ", data: HOJE, gravidade: "media", descricao: "3ª vez" }, { colaboradorId: "c1", registradoPor: "Lucas" });
  assert.deepEqual(r.registro, {
    colaborador_id: "c1", tipo: "advertencia_escrita", data: HOJE, titulo: "Atraso repetido", descricao: "3ª vez",
    gravidade: "media", item: null, quantidade: null, tamanho: null, valor_centavos: null, registrado_por: "Lucas",
  });
  assert.equal("unidade_id" in r.registro, false);
});

test("uniforme exige peça e quantidade; quebra aceita valor em reais", () => {
  assert.deepEqual(Object.keys(montarRegistro({ tipo: "uniforme", titulo: "Entrega", data: HOJE }, { colaboradorId: "c1" }).erros), ["quantidade", "item"]);
  const u = montarRegistro({ tipo: "uniforme", titulo: "Entrega", data: HOJE, item: "Dólmã", quantidade: "2", tamanho: "M" }, { colaboradorId: "c1" }).registro;
  assert.deepEqual([u.item, u.quantidade, u.tamanho, u.gravidade], ["Dólmã", 2, "M", null]);
  const q = montarRegistro({ tipo: "quebra", titulo: "Copo quebrado", data: HOJE, item: "Taça de vinho", quantidade: "1", valor: "18,90" }, { colaboradorId: "c1" }).registro;
  assert.equal(q.valor_centavos, 1890);
  assert.ok(montarRegistro({ tipo: "quebra", titulo: "Copo", data: HOJE, item: "Taça", quantidade: 1, valor: "abc" }, { colaboradorId: "c1" }).erros.valor);
});

test("tipo e funcionário obrigatórios", () => {
  const e = montarRegistro({ tipo: "demissao", titulo: "x", data: "" }, {}).erros;
  assert.ok(e.tipo && e.colaborador && e.titulo && e.data);
});

test("recorrência conta 12 meses, ignora anulados e acha títulos repetidos", () => {
  const regs = [
    { tipo: "advertencia_verbal", titulo: "Atraso", data: "2026-10-01" },
    { tipo: "advertencia_verbal", titulo: "atraso", data: "2026-11-02" },
    { tipo: "advertencia_verbal", titulo: "Atraso", data: "2026-11-10", anulado_em: "2026-11-11" },
    { tipo: "advertencia_escrita", titulo: "Falta", data: "2025-01-01" }, // fora da janela
    { tipo: "quebra", titulo: "Copo quebrado", data: "2026-11-13" },
  ];
  const rec = recorrencias(regs, { hoje: HOJE });
  assert.equal(rec.advertencias, 2);
  assert.equal(rec.quebras, 1);
  assert.deepEqual(rec.repetidos, [{ tipo: "advertencia_verbal", titulo: "atraso", vezes: 2 }]);
  assert.match(sugestaoDisciplinar(rec).texto, /advertência por escrito/);
  assert.equal(sugestaoDisciplinar(rec).natureza, "SUGESTÃO");
  assert.equal(sugestaoDisciplinar(recorrencias([], { hoje: HOJE })), null);
});

test("a sugestão nunca fala em demissão", () => {
  const rec = recorrencias([
    { tipo: "suspensao", titulo: "Falta grave", data: "2026-09-01" },
    { tipo: "advertencia_escrita", titulo: "A", data: "2026-08-01" },
    { tipo: "advertencia_escrita", titulo: "B", data: "2026-07-01" },
  ], { hoje: HOJE });
  assert.doesNotMatch(sugestaoDisciplinar(rec).texto, /demit|justa causa/i);
});

test("uniformes com o funcionário somam por peça e tamanho, sem os devolvidos", () => {
  const regs = [
    { tipo: "uniforme", item: "Dólmã", tamanho: "M", quantidade: 2, data: "2026-03-01" },
    { tipo: "uniforme", item: "Dólmã", tamanho: "M", quantidade: 1, data: "2026-09-01" },
    { tipo: "uniforme", item: "Avental", tamanho: "", quantidade: 1, data: "2026-09-01", devolvido_em: "2026-10-01" },
  ];
  assert.deepEqual(uniformesComFuncionario(regs), [{ item: "Dólmã", tamanho: "M", quantidade: 3, ultimaEntrega: "2026-09-01" }]);
});

test("falta assinatura: só tipos que pedem, sem anexo e sem recusa", () => {
  assert.equal(faltaAssinatura({ tipo: "advertencia_escrita" }), true);
  assert.equal(faltaAssinatura({ tipo: "advertencia_escrita", arquivo_url: "storage://x" }), false);
  assert.equal(faltaAssinatura({ tipo: "advertencia_escrita", recusou_assinar: true }), false);
  assert.equal(faltaAssinatura({ tipo: "observacao" }), false);
  assert.equal(faltaAssinatura({ tipo: "uniforme", anulado_em: "x" }), false);
});

test("linha do tempo junta o novo e o antigo, do mais novo ao mais velho, e filtra", () => {
  const itens = linhaDoTempo({
    registros: [{ id: "r1", tipo: "uniforme", data: "2026-11-01", titulo: "Entrega" }],
    advertenciasAntigas: [{ id: "a1", data: "2026-05-01", motivo: "Atraso" }],
    documentos: [{ id: "d1", tipo: "RG", created_at: "2026-11-10T10:00:00Z", url_arquivo: "storage://rh-docs/x" }],
    atas: [{ id: "t1", data: "2026-10-01", assunto: "Reunião de equipe" }],
  });
  assert.deepEqual(itens.map((i) => i.id), ["doc:d1", "r1", "ata:t1", "adv:a1"]);
  assert.equal(itens[0].origem, "legado");
  assert.deepEqual(filtrar(itens, "entregas").map((i) => i.id), ["r1"]);
  assert.deepEqual(filtrar(itens, "disciplina").map((i) => i.id), ["adv:a1"]);
});

test("reais", () => {
  assert.equal(reais(1890).replace(/\s/g, " "), "R$ 18,90");
  assert.equal(reais(null), null);
});

import { termoParaAssinar } from "./ficha-funcionario.mjs";

test("termo de uniforme e de advertência para imprimir e assinar", () => {
  const u = termoParaAssinar({ tipo: "uniforme", data: "2026-11-14", item: "Dólmã", quantidade: 2, tamanho: "M", titulo: "Entrega" }, { funcionario: { nome: "Ana", cargo: "Cozinheira" }, empresa: "Sel de Estrela" });
  assert.equal(u.titulo, "Termo de entrega de uniforme");
  assert.match(u.paragrafos[0], /Ana, Cozinheira.*14\/11\/2026, 2 unidade\(s\) de Dólmã, tamanho M/);
  assert.equal(u.assinaturas.length, 2);
  const a = termoParaAssinar({ tipo: "advertencia_escrita", data: "2026-11-14", titulo: "Atraso repetido", registrado_por: "Lucas" }, { funcionario: { nome: "Ana" } });
  assert.equal(a.assinaturas.length, 4);
  assert.ok(a.paragrafos.some((p) => /não a concordância/.test(p)));
  const q = termoParaAssinar({ tipo: "quebra", data: "2026-11-14", titulo: "Copo quebrado", item: "Taça", quantidade: 1, valor_centavos: 1890 }, { funcionario: { nome: "Ana" } });
  assert.ok(q.paragrafos.some((p) => /art\. 462/.test(p)));
});
