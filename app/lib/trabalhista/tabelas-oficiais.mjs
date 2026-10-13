// TABELAS OFICIAIS DATADAS (HDEV-RH-001, Fase 4).
//
// Cada tabela vale a partir de uma competência ("AAAA-MM") e cita o ato que a
// publicou. O motor (motor-direitos.mjs) escolhe a tabela pela competência do
// cálculo: um mês de 2025 usa a tabela de 2025, mesmo calculado hoje.
//
// Sem tabela para a competência, nada é inventado: tabelaDaCompetencia devolve
// null e o motor marca o item como "sem tabela oficial".
//
// conferida_contador: false até o contador confirmar os números contra o texto
// oficial (as tabelas de 2026 foram conferidas em fontes secundárias em
// 13/10/2026; divergências de centavos no teto do INSS entre fontes).

const T = (o) => Object.freeze(o);

export const TABELAS = Object.freeze([
  T({
    desde: "2025-01",
    salario_minimo: { valor: 1518.0, fonte: "Decreto 12.342/2024" },
    inss_empregado: {
      faixas: [{ ate: 1518.0, aliquota: 7.5 }, { ate: 2793.88, aliquota: 9 }, { ate: 4190.83, aliquota: 12 }, { ate: 8157.41, aliquota: 14 }],
      fonte: "Portaria Interministerial MPS/MF 6/2025",
    },
    irrf: null, // 2025 mudou de tabela em maio; os meses de 2025 já foram pagos: não recalcular aqui
    conferida_contador: false,
  }),
  T({
    desde: "2026-01",
    salario_minimo: { valor: 1621.0, fonte: "Salário mínimo 2026 (reajuste de 6,79%)" },
    inss_empregado: {
      faixas: [{ ate: 1621.0, aliquota: 7.5 }, { ate: 2902.84, aliquota: 9 }, { ate: 4354.27, aliquota: 12 }, { ate: 8475.55, aliquota: 14 }],
      fonte: "Portaria Interministerial MPS/MF 13/2026",
    },
    irrf: {
      faixas: [
        { ate: 2428.8, aliquota: 0, deduzir: 0 },
        { ate: 2826.65, aliquota: 7.5, deduzir: 182.16 },
        { ate: 3751.05, aliquota: 15, deduzir: 394.16 },
        { ate: 4664.68, aliquota: 22.5, deduzir: 675.49 },
        { ate: Infinity, aliquota: 27.5, deduzir: 908.73 },
      ],
      dependente: 189.59,
      desconto_simplificado: 607.2,
      // Lei 15.270/2025: redução mensal sobre o rendimento tributável bruto
      reducao: { isento_ate: 5000.0, limite_isento: 312.89, ate: 7350.0, constante: 978.62, fator: 0.133145 },
      fonte: "Lei 9.250/95 art. 4º (tabela vigente desde 05/2025) e Lei 15.270/2025 (redução a partir de 01/2026)",
    },
    conferida_contador: false,
  }),
]);

// Não dependem de ano: estão na lei.
export const FGTS = Object.freeze({ aliquota: 8, aprendiz: 2, fonte: "Lei 8.036/90 art. 15 (aprendiz: §7º)" });

/** Tabela vigente na competência "AAAA-MM", ou null quando não há. */
export function tabelaDaCompetencia(competencia, tabelas = TABELAS) {
  const c = String(competencia).slice(0, 7);
  let achada = null;
  for (const t of tabelas) if (t.desde <= c && (!achada || t.desde > achada.desde)) achada = t;
  return achada;
}
