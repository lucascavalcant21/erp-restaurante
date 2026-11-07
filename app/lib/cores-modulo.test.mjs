// Cores de módulo (visual do Nina, 07/11/2026): cada função com sempre a mesma cor.
import test from "node:test";
import assert from "node:assert/strict";
import { TONS, corDoModulo, iconeTemCor, iconeClaroSobre } from "./cores-modulo.mjs";
import { MENU_PRINCIPAL, UNIVERSOS, cardsDaArea } from "./menu-principal.mjs";

test("todo card e toda área do menu têm ícone com cor escolhida", () => {
  for (const area of MENU_PRINCIPAL) {
    assert.ok(area.icone && area.desc, `${area.id}: área sem ícone ou descrição para o lançador`);
    assert.ok(TONS.includes(corDoModulo(area)), area.id);
  }
  for (const card of UNIVERSOS.flatMap(cardsDaArea)) {
    assert.ok(iconeTemCor(card.icone), `${card.label}: ícone ${card.icone} sem cor em cores-modulo.mjs`);
  }
});

test("a mesma função tem a mesma cor em qualquer área", () => {
  const porLabel = new Map();
  for (const card of UNIVERSOS.flatMap(cardsDaArea)) {
    const nome = card.label.replace(/ d[aoe] (cozinha|bar|salão)$/i, "");
    const cor = corDoModulo(card);
    if (porLabel.has(nome)) assert.equal(cor, porLabel.get(nome), nome);
    porLabel.set(nome, cor);
  }
});

test("cor explícita vence o ícone; cor inválida ou ícone desconhecido caem no cinza", () => {
  assert.equal(corDoModulo({ icone: "Package" }), "indigo");
  assert.equal(corDoModulo({ icone: "Package", cor: "verde" }), "verde");
  assert.equal(corDoModulo({ icone: "Package", cor: "roxo-neon" }), "indigo");
  assert.equal(corDoModulo({ icone: "NaoExiste" }), "ardosia");
  assert.equal(corDoModulo(null), "ardosia");
});

test("amarelo e dourado levam ícone escuro", () => {
  assert.ok(iconeClaroSobre("amarelo") && iconeClaroSobre("dourado"));
  assert.ok(!iconeClaroSobre("azul"));
});

test("o destaque de cada universo é um card dele", () => {
  for (const u of UNIVERSOS) {
    assert.ok(u.destaque?.href && u.destaque.acao, `${u.id} sem destaque`);
    assert.ok(cardsDaArea(u).some((c) => c.href === u.destaque.href), `${u.id}: destaque fora dos cards`);
  }
});
