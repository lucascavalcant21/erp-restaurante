import test from "node:test";
import assert from "node:assert/strict";
import {
  TOPICOS_INICIAIS,
  RECEITAS_GREEN_DOT,
  ROTINAS_OPERACIONAIS,
  EQUIPAMENTOS_MANUTENCAO,
  CHAMADOS_MANUTENCAO_INICIAIS,
  ESCALA_TURNO_GANTT,
  ESCALA_ORGANOGRAMA_DO_DIA,
  EXTRAS_DISPONIVEIS,
  FORMACAO_PRACAS_BASE,
  ROTINAS_LIMPEZA_HIGIENIZACAO,
  CHECKLISTS_PRACA,
  calcularDiluicaoLimpeza,
  recalcularReceitaPorIngrediente,
  detectarIntencaoRecalculo,
} from "./green-dot-data.js";

test("Green Dot Assist — Receitas possuem perfil sensorial, major steps P/M/G/FAM, vídeo e harmonização", () => {
  assert.ok(RECEITAS_GREEN_DOT.length >= 4, "Deve ter ao menos 4 receitas completas");
  for (const r of RECEITAS_GREEN_DOT) {
    assert.ok(r.id && r.codigo && r.nome, "Receita deve ter id, codigo e nome");
    assert.ok(r.perfilSensorial?.sabor && r.perfilSensorial?.aroma && r.perfilSensorial?.textura);
    assert.equal(r.colunasTamanho.length, 4, "Deve ter 4 colunas de tamanho");
    assert.ok(r.majorSteps.length >= 3, "Deve ter majorSteps");
    for (const s of r.majorSteps) {
      assert.equal(s.valores.length, 4, "Cada passo deve ter 4 valores de tamanho");
    }
    assert.ok(r.videoSteps.length >= 2, "Deve ter etapas de vídeo com foto/vídeo");
    assert.ok(Array.isArray(r.ingredientesBase), "Deve ter ingredientesBase para recálculo");
  }
});

test("Green Dot Assist — Receita de Vatapá Baiano com 3L de Leite de Coco e vídeo passo a passo", () => {
  const vatapa = RECEITAS_GREEN_DOT.find((r) => r.id === "vatapa-baiano");
  assert.ok(vatapa, "Vatapá Baiano deve existir nas receitas");
  assert.equal(vatapa.rendimentoPorcoes, 30);
  assert.ok(vatapa.videoUrl, "Deve possuir vídeo do preparo");
  assert.ok(vatapa.videoSteps.length >= 3, "Deve possuir etapas detalhadas com fotos");

  const leiteCoco = vatapa.ingredientesBase.find((i) => i.id === "leite-coco");
  assert.ok(leiteCoco, "Deve ter ingrediente Leite de Coco");
  assert.equal(leiteCoco.quantidade, 3);
  assert.equal(leiteCoco.unidade, "L");

  const camaraoSeco = vatapa.ingredientesBase.find((i) => i.id === "camarao-seco");
  assert.ok(camaraoSeco, "Deve ter Camarão Seco");
  assert.equal(camaraoSeco.quantidade, 1.5);
  assert.equal(camaraoSeco.unidade, "kg");
});

test("Green Dot Assist — Motor de Recálculo Proporcional: 3L de Leite de Coco para 2L (66.7%)", () => {
  const vatapa = RECEITAS_GREEN_DOT.find((r) => r.id === "vatapa-baiano");
  const res = recalcularReceitaPorIngrediente(vatapa, "leite-coco", 2, "L");

  assert.ok(res, "Recálculo deve retornar resultado");
  assert.equal(res.percentual, 66.7, "Fator deve ser ~66.7% (2L / 3L)");
  assert.equal(res.quantidadeOriginalLimitante, 3);
  assert.equal(res.quantidadeDisponivelLimitante, 2);

  // Rendimento original 30 porções -> 20 porções (30 * 2/3)
  assert.equal(res.porcoesNovas, 20);

  // Camarão seco: 1.5kg * (2/3) = 1.0kg
  const camaraoRecalc = res.ingredientesRecalculados.find((i) => i.id === "camarao-seco");
  assert.ok(camaraoRecalc);
  assert.equal(camaraoRecalc.quantidadeNova, 1.0);

  // Pão amanhecido: 1.8kg * (2/3) = 1.2kg
  const paoRecalc = res.ingredientesRecalculados.find((i) => i.id === "pao-amanhecido");
  assert.ok(paoRecalc);
  assert.equal(paoRecalc.quantidadeNova, 1.2);

  // Azeite de dendê: 900ml * (2/3) = 600ml
  const dendeRecalc = res.ingredientesRecalculados.find((i) => i.id === "azeite-dende");
  assert.ok(dendeRecalc);
  assert.equal(dendeRecalc.quantidadeNova, 600);
});

test("Green Dot Assist — Detecção inteligente de intenção de recálculo em frase em português", () => {
  const vatapa = RECEITAS_GREEN_DOT.find((r) => r.id === "vatapa-baiano");
  const frase =
    "tenho todos os ingredientes do vatapá so o leite de coco que era para ser 3L e so tenho 2L";

  const det = detectarIntencaoRecalculo(frase, vatapa, RECEITAS_GREEN_DOT);
  assert.ok(det, "Deve detectar a intenção de recálculo");
  assert.equal(det.receita.id, "vatapa-baiano");
  assert.ok(det.calculo);
  assert.equal(det.calculo.percentual, 66.7);
  assert.equal(det.calculo.ingredienteLimitante.id, "leite-coco");
  assert.equal(det.calculo.quantidadeDisponivelLimitante, 2);
});

test("Green Dot Assist — Equipamentos e Liquidificadores com 110V/220V, Guias de Encaixe, Uso e Limpeza", () => {
  assert.ok(EQUIPAMENTOS_MANUTENCAO.length >= 4);

  const liqSkymsen = EQUIPAMENTOS_MANUTENCAO.find((e) => e.id === "liq-skymsen-4l");
  assert.ok(liqSkymsen, "Deve ter o liquidificador industrial de Cozinha");
  assert.equal(liqSkymsen.voltagem, "220V");
  assert.equal(liqSkymsen.categoriaTipo, "liquidificador");
  assert.ok(liqSkymsen.imagem, "Deve ter foto do liquidificador");
  assert.ok(liqSkymsen.videoUrl, "Deve ter vídeo");
  assert.ok(liqSkymsen.guiaEncaixe?.passos?.length >= 3, "Deve ter guia de como encaixar copo e tampa");
  assert.ok(liqSkymsen.guiaUso?.passos?.length >= 3, "Deve ter guia de como usar");
  assert.ok(liqSkymsen.guiaLimpeza?.passos?.length >= 3, "Deve ter guia de como limpar");

  const liqVitamix = EQUIPAMENTOS_MANUTENCAO.find((e) => e.id === "liq-vitamix-bar");
  assert.ok(liqVitamix, "Deve ter o liquidificador do Bar");
  assert.ok(liqVitamix.voltagem.includes("110V"));
  assert.equal(liqVitamix.categoriaTipo, "liquidificador");
  assert.ok(liqVitamix.guiaEncaixe?.passos?.length >= 3);
  assert.ok(liqVitamix.guiaUso?.passos?.length >= 3);
  assert.ok(liqVitamix.guiaLimpeza?.passos?.length >= 3);
});

test("Green Dot Assist — Escala do Dia em Organograma Hierárquico por Área e Horários", () => {
  assert.ok(ESCALA_ORGANOGRAMA_DO_DIA);
  assert.equal(ESCALA_ORGANOGRAMA_DO_DIA.totalColaboradores, 9);
  assert.equal(ESCALA_ORGANOGRAMA_DO_DIA.liderGeral.nome, "Ingrid B.");
  assert.equal(ESCALA_ORGANOGRAMA_DO_DIA.liderGeral.horario, "08:00 – 17:00");
  assert.equal(ESCALA_ORGANOGRAMA_DO_DIA.areas.length, 5);

  const areaQuente = ESCALA_ORGANOGRAMA_DO_DIA.areas.find((a) => a.id === "cozinha-quente");
  assert.ok(areaQuente);
  assert.equal(areaQuente.colaboradores.length, 3);
  assert.equal(areaQuente.colaboradores[0].nome, "Gabriel K.");
  assert.equal(areaQuente.colaboradores[0].horario, "08:00 – 16:20");

  const areaBar = ESCALA_ORGANOGRAMA_DO_DIA.areas.find((a) => a.id === "bar");
  assert.ok(areaBar);
  assert.equal(areaBar.colaboradores.length, 2);
  assert.equal(areaBar.colaboradores[0].nome, "Carlos G.");
  assert.equal(areaBar.colaboradores[0].horario, "09:15 – 17:35");

  for (const area of ESCALA_ORGANOGRAMA_DO_DIA.areas) {
    for (const c of area.colaboradores) {
      assert.ok(c.id && c.nome && c.horario && c.cargo && c.praca);
      assert.ok(c.horario.includes("–") || c.horario.includes("-"));
    }
  }

  const topicoOrg = TOPICOS_INICIAIS.escala.find((t) => t.id === "escala-organograma");
  assert.ok(topicoOrg, "Tópico de organograma deve existir nos tópicos iniciais");
});

test("Green Dot Assist — Escala Gantt, Extras disponíveis e Mapa de Praças (Play Caller)", () => {
  assert.ok(ESCALA_TURNO_GANTT.length >= 8);
  assert.equal(EXTRAS_DISPONIVEIS.length, 4);
  assert.equal(FORMACAO_PRACAS_BASE.length, 4);
  assert.ok(ROTINAS_OPERACIONAIS["pull-to-thaw"]);
  assert.ok(ROTINAS_OPERACIONAIS["organizacao-camara"]);
  assert.ok(TOPICOS_INICIAIS.producao.length >= 4);
});
