// CONFERÊNCIA DO LUCRO DO MÊS (pedido do dono, 21/11/2026: "tudo voltado à
// gestão do negócio para eu ter certeza de lucro"). Responde três perguntas com
// os números do DRE da marmitaria:
//   1. O lucro do mês é real ou estimado?
//   2. A cozinha gastou o que a ficha manda? (CMV real × CMV pela ficha = perda)
//   3. Bati a meta de lucro por marmita? Se não, quantas marmitas faltam.
// Conta determinística, sem inventar número: sem dado, DADOS INSUFICIENTES.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : typeof v === "number" ? v : null;
};

// Perda aceitável sobre o CMV da ficha antes de virar alerta.
export const TOLERANCIA_PERDA_PCT = 5;

export function conferenciaDoLucro({ dre, cmvReal = null, cmvPrev = null, metaPorMarmita = null } = {}) {
  const ind = dre?.indicadores || {};
  const marmitas = ind.marmitas > 0 ? ind.marmitas : null;
  const lucro = ind.lucroLiquido ?? null;
  const itens = [];

  // 1. Natureza do lucro
  const cmvLinha = (dre?.linhas || []).find((l) => l.id === "cmv");
  const estimado = cmvLinha?.natureza === "estimado" || !(cmvReal?.valor != null);
  const natureza = lucro === null ? null : estimado ? "ESTIMATIVA" : "REAL";

  // 2. Perda na cozinha
  let perda = null;
  if (cmvReal?.valor != null && cmvPrev?.valor != null && cmvPrev.valor > 0) {
    const diferenca = r2(cmvReal.valor - cmvPrev.valor);
    const pct = r2((diferenca / cmvPrev.valor) * 100);
    const situacao = pct > TOLERANCIA_PERDA_PCT ? "alerta" : pct < -TOLERANCIA_PERDA_PCT ? "conferir" : "ok";
    perda = { real: r2(cmvReal.valor), ficha: r2(cmvPrev.valor), diferenca, pct, situacao, porMarmita: marmitas ? r2(diferenca / marmitas) : null };
    itens.push({
      id: "perda", situacao,
      titulo: situacao === "alerta" ? `A cozinha gastou ${brl(diferenca)} a mais que as fichas (${fmtPct(pct)})`
        : situacao === "conferir" ? `A cozinha gastou ${brl(-diferenca)} a menos que as fichas (${fmtPct(-pct)})`
        : "A cozinha gastou o que as fichas mandam",
      texto: situacao === "alerta" ? "Desperdício, porção maior que a ficha, sobra jogada fora ou compra sem baixa. Confira a montagem e as sobras do dia."
        : situacao === "conferir" ? "Porção menor que a ficha, venda não lançada ou contagem de estoque errada. Confira antes de confiar no lucro."
        : `Diferença de ${fmtPct(pct)}, dentro da tolerância de ${TOLERANCIA_PERDA_PCT}%.`,
    });
  } else {
    const motivos = [...(cmvReal?.motivos || []), ...(cmvPrev?.motivos || [])];
    itens.push({ id: "perda", situacao: "sem_dado", titulo: "Perda na cozinha: DADOS INSUFICIENTES",
      texto: motivos.length ? motivos.join(" ") : "Precisa da contagem de estoque do começo e do fim do mês e das vendas com a marmita identificada." });
  }

  // 3. Meta de lucro do mês
  const metaUn = num(metaPorMarmita);
  let meta = null;
  if (metaUn > 0 && marmitas && lucro !== null) {
    const valor = r2(metaUn * marmitas);
    const falta = r2(valor - lucro);
    // Cada marmita a mais traz a margem de contribuição média (os fixos já estão pagos).
    const mcUn = ind.margemContribuicao != null ? r2(ind.margemContribuicao / marmitas) : null;
    const marmitasFaltam = falta > 0 && mcUn > 0 ? Math.ceil(falta / mcUn) : falta > 0 ? null : 0;
    meta = { porMarmita: metaUn, valor, lucro: r2(lucro), falta: falta > 0 ? falta : 0, sobra: falta < 0 ? r2(-falta) : 0, lucroPorMarmita: r2(lucro / marmitas), contribuicaoPorMarmita: mcUn, marmitasFaltam, atingida: falta <= 0.005 };
    itens.push({
      id: "meta", situacao: meta.atingida ? "ok" : lucro < 0 ? "alerta" : "atencao",
      titulo: meta.atingida ? `Meta batida: ${brl(meta.lucroPorMarmita)} de lucro por marmita` : `Faltam ${brl(meta.falta)} para a meta do mês`,
      texto: meta.atingida ? `Meta de ${brl(metaUn)} por marmita × ${marmitas} marmitas = ${brl(valor)}; sobrou ${brl(meta.sobra)} acima dela.`
        : `Meta de ${brl(metaUn)} por marmita × ${marmitas} marmitas = ${brl(valor)}. Hoje são ${brl(meta.lucroPorMarmita)} por marmita.`
          + (marmitasFaltam ? ` Vendendo mais ${marmitasFaltam} marmitas no mesmo preço, chega lá (cada uma deixa ${brl(mcUn)} depois dos custos variáveis).` : marmitasFaltam === null ? " A margem por marmita não cobre: suba o preço ou corte custo." : ""),
    });
  } else {
    itens.push({ id: "meta", situacao: "sem_dado", titulo: "Meta de lucro: DADOS INSUFICIENTES",
      texto: !(metaUn > 0) ? "Defina a meta de lucro por marmita em Configurações → Custos." : "Precisa das vendas do mês lançadas e do lucro apurado." });
  }

  // Veredito
  const veredito = lucro === null ? { situacao: "sem_dado", texto: "Ainda não dá para dizer se o mês deu lucro: faltam dados no DRE." }
    : lucro < 0 ? { situacao: "alerta", texto: `O mês está com prejuízo de ${brl(-lucro)} (${natureza}).` }
    : { situacao: meta?.atingida === false || perda?.situacao === "alerta" ? "atencao" : "ok", texto: `O mês deu ${brl(lucro)} de lucro (${natureza}).` };
  if (lucro !== null && natureza === "ESTIMATIVA") veredito.aviso = "Para ter certeza, faça a contagem de estoque do fim do mês: aí o CMV passa a ser real.";

  return { natureza, lucro, perda, meta, itens, veredito };
}

function brl(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v) {
  return `${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
