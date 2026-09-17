/**
 * Helpers Matemáticos e Analíticos Centrais do Héfisto Analytics (F4)
 */

/**
 * 1. Formata variação de porcentagens em Pontos Percentuais (p.p.)
 * Exemplo: 30% -> 33% é +3,0 p.p. (JAMAIS "+3%")
 */
export function formatPercentPointsVariation(currentPct, previousPct) {
  const curr = Number(currentPct) || 0;
  const prev = Number(previousPct) || 0;
  const diff = curr - prev;

  const diffStr = diff >= 0 ? `+${diff.toFixed(1).replace(".", ",")}` : diff.toFixed(1).replace(".", ",");
  return {
    diff,
    formatted: `${diffStr} p.p.`,
    currFormatted: `${curr.toFixed(1).replace(".", ",")}%`,
    prevFormatted: `${prev.toFixed(1).replace(".", ",")}%`
  };
}

/**
 * 2. Formata variação monetária (R$) com percentual e proteção contra divisão por zero
 */
export function formatMonetaryVariation(currentVal, previousVal) {
  const curr = Number(currentVal) || 0;
  const prev = Number(previousVal) || 0;
  const diff = curr - prev;

  const fmtCurrency = (v) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const diffMonetaryStr = diff >= 0 ? `+${fmtCurrency(diff)}` : `-${fmtCurrency(diff)}`;

  if (prev <= 0) {
    return {
      diff,
      pct: null,
      pctFormatted: "Sem base de comparação",
      monetaryFormatted: diffMonetaryStr,
      fullFormatted: `${diffMonetaryStr} (Sem base de comparação)`
    };
  }

  const pct = (diff / prev) * 100;
  const pctStr = pct >= 0 ? `+${pct.toFixed(1).replace(".", ",")}%` : `${pct.toFixed(1).replace(".", ",")}%`;

  return {
    diff,
    pct,
    pctFormatted: pctStr,
    monetaryFormatted: diffMonetaryStr,
    fullFormatted: `${diffMonetaryStr} (${pctStr})`
  };
}

/**
 * 3. Resolve períodos comparáveis com suporte a Mês Parcial (Dia 1 ao Dia N)
 * Se hoje for dia 17, compara 1-17 do mês atual vs 1-17 do mês anterior.
 */
export function getComparableDateRanges(periodKey = "este_mes", refDate = new Date()) {
  const now = new Date(refDate);
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  // Helper para formatar ISO (AAAA-MM-DD)
  const toIso = (d) => d.toISOString().slice(0, 10);
  const fmtBr = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  if (periodKey === "hoje" || periodKey === "today") {
    const todayIso = toIso(now);
    const yesterday = new Date(now);
    yesterday.setDate(day - 1);
    const yesterdayIso = toIso(yesterday);

    return {
      periodKey: "hoje",
      label: "Hoje vs Ontem",
      current: { de: todayIso, ate: todayIso, label: `Hoje (${fmtBr(todayIso)})` },
      previous: { de: yesterdayIso, ate: yesterdayIso, label: `Ontem (${fmtBr(yesterdayIso)})` },
      isPartialMonth: false
    };
  }

  if (periodKey === "ultimos_7_dias" || periodKey === "esta_semana") {
    const currEnd = new Date(now);
    const currStart = new Date(now);
    currStart.setDate(day - 6);

    const prevEnd = new Date(currStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);

    return {
      periodKey: "ultimos_7_dias",
      label: "Últimos 7 dias vs 7 dias anteriores",
      current: { de: toIso(currStart), ate: toIso(currEnd), label: `${fmtBr(toIso(currStart))} a ${fmtBr(toIso(currEnd))}` },
      previous: { de: toIso(prevStart), ate: toIso(prevEnd), label: `${fmtBr(toIso(prevStart))} a ${fmtBr(toIso(prevEnd))}` },
      isPartialMonth: false
    };
  }

  if (periodKey === "mes_passado") {
    const prevMonthEnd = new Date(year, month, 0);
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

    const prevPrevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), 0);
    const prevPrevMonthStart = new Date(prevPrevMonthEnd.getFullYear(), prevPrevMonthEnd.getMonth(), 1);

    return {
      periodKey: "mes_passado",
      label: "Mês passado vs Mês retrasado",
      current: { de: toIso(prevMonthStart), ate: toIso(prevMonthEnd), label: `Mês Passado (${fmtBr(toIso(prevMonthStart))} a ${fmtBr(toIso(prevMonthEnd))})` },
      previous: { de: toIso(prevPrevMonthStart), ate: toIso(prevPrevMonthEnd), label: `Mês Retrasado (${fmtBr(toIso(prevPrevMonthStart))} a ${fmtBr(toIso(prevPrevMonthEnd))})` },
      isPartialMonth: false
    };
  }

  // Padrão: "este_mes" (compara 1..dia do mês atual com 1..dia do mês anterior)
  const currStart = new Date(year, month, 1);
  const currEnd = new Date(now);

  // Mês anterior (mesmos dias: 1 até dia)
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  const cappedPrevDay = Math.min(day, daysInPrevMonth);

  const prevStart = new Date(prevYear, prevMonth, 1);
  const prevEnd = new Date(prevYear, prevMonth, cappedPrevDay);

  const isPartial = day < new Date(year, month + 1, 0).getDate();

  return {
    periodKey: "este_mes",
    label: isPartial ? `1–${day} deste mês vs 1–${cappedPrevDay} do mês anterior` : "Este mês vs Mês passado",
    current: { de: toIso(currStart), ate: toIso(currEnd), label: `1 a ${day} de ${currStart.toLocaleString("pt-BR", { month: "short" })}.` },
    previous: { de: toIso(prevStart), ate: toIso(prevEnd), label: `1 a ${cappedPrevDay} de ${prevStart.toLocaleString("pt-BR", { month: "short" })}.` },
    isPartialMonth: isPartial,
    daysElapsed: day
  };
}

/**
 * 4. Ranqueamento determinístico das mudanças mais relevantes (Top 3 a 5)
 */
export function rankRelevantChanges(changeList = [], maxItems = 5) {
  if (!changeList || changeList.length === 0) return [];

  // Ordena pelo valor absoluto do impacto (monetário R$ ou pontos percentuais)
  const sorted = [...changeList].sort((a, b) => {
    const impactA = Math.abs(a.impactValue !== undefined ? a.impactValue : (a.diff || 0));
    const impactB = Math.abs(b.impactValue !== undefined ? b.impactValue : (b.diff || 0));
    return impactB - impactA;
  });

  return sorted.slice(0, maxItems);
}
