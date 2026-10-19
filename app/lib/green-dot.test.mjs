import test from "node:test";
import assert from "node:assert/strict";
import {
  TOPICOS_INICIAIS,
  RECEITAS_GREEN_DOT,
  ROTINAS_OPERACIONAIS,
  EQUIPAMENTOS_MANUTENCAO,
  CHAMADOS_MANUTENCAO_INICIAIS,
  ESCALA_TURNO_GANTT,
  EXTRAS_DISPONIVEIS,
  FORMACAO_PRACAS_BASE,
} from "./green-dot-data.js";

test("Green Dot Assist — Receitas possuem perfil sensorial, major steps P/M/G/FAM, vídeo e harmonização", () => {
  assert.ok(RECEITAS_GREEN_DOT.length >= 3, "Deve ter ao menos 3 receitas completas");
  for (const r of RECEITAS_GREEN_DOT) {
    assert.ok(r.id && r.codigo && r.nome, "Receita deve ter id, codigo e nome");
    assert.ok(r.perfilSensorial?.sabor && r.perfilSensorial?.aroma && r.perfilSensorial?.textura);
    assert.equal(r.colunasTamanho.length, 4, "Deve ter 4 colunas de tamanho");
    assert.ok(r.majorSteps.length >= 3, "Deve ter majorSteps");
    for (const s of r.majorSteps) {
      assert.equal(s.valores.length, 4, "Cada passo deve ter 4 valores de tamanho");
    }
    assert.ok(r.videoSteps.length >= 2, "Deve ter etapas de vídeo");
    assert.ok(r.harmonizacoes.length >= 2, "Deve ter sugestões de harmonização (Pairing Recommendation)");
  }
});

test("Green Dot Assist — Equipamentos possuem hotspots de anatomia, troubleshooting e checklist de chamado", () => {
  assert.ok(EQUIPAMENTOS_MANUTENCAO.length >= 3);
  for (const eq of EQUIPAMENTOS_MANUTENCAO) {
    assert.ok(eq.hotspots.length >= 4, "Deve ter hotspots para o diagrama interativo");
    assert.ok(eq.passosTroubleshooting.length >= 4, "Deve ter passos de diagnóstico");
    assert.ok(eq.checklistPreChamado.length >= 2, "Deve ter checklist da Etapa 3 de 4");
  }
  assert.ok(CHAMADOS_MANUTENCAO_INICIAIS.length >= 3);
});

test("Green Dot Assist — Escala Gantt, Extras disponíveis e Mapa de Praças (Play Caller)", () => {
  assert.ok(ESCALA_TURNO_GANTT.length >= 8);
  assert.equal(EXTRAS_DISPONIVEIS.length, 4);
  assert.equal(FORMACAO_PRACAS_BASE.length, 4);
  assert.ok(ROTINAS_OPERACIONAIS["pull-to-thaw"]);
  assert.ok(ROTINAS_OPERACIONAIS["organizacao-camara"]);
  assert.ok(TOPICOS_INICIAIS.producao.length >= 4);
});
