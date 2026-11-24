"use client";

// Salmoura / empanado no Assistente (dono, 23/11/2026): o cartão com a
// calculadora, nas cores do chat. Sem internet (receitas-cache.js).

import CalculadoraFormula from "../cozinha/CalculadoraFormula";

export default function FormulaRapida({ formula, kg = null }) {
  return (
    <CalculadoraFormula formula={formula} kgInicial={kg}
      cores={{ destaque: "var(--wa-verde-escuro, #005A49)", meta: "var(--wa-meta, #667781)", item: "#fff" }} />
  );
}
