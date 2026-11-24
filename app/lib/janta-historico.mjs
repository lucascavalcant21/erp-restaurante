// HISTÓRICO DA JANTA (dono, 24/11/2026: "saber quanto a gente gasta por dia em
// uma janta e quanto gasta por pessoa… e ter uma história").
// Cada dia registrado guarda: data, quantas pessoas jantaram, custo, custo por
// pessoa, os pratos e se o custo é REAL (todos os itens com preço) ou
// ESTIMATIVA (faltou preço em algum item). Guardado em
// config_sistema.params.janta_historico (lista, um registro por data).

export const MAX_DIAS_HISTORICO = 800; // pouco mais de 2 anos

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Registro do dia a partir do cardápio calculado (cardapioDoDia). */
export function registroDoDia(dataIso, diaId, calculado) {
  const pessoas = Math.round(Number(calculado?.pessoas) || 0);
  const custo = Number(calculado?.custo) > 0 ? r2(calculado.custo) : null;
  return {
    data: String(dataIso).slice(0, 10),
    dia: diaId,
    pessoas,
    custo,
    custoPorPessoa: custo != null && pessoas > 0 ? r2(custo / pessoas) : null,
    itensSemPreco: Number(calculado?.semCusto) || 0,
    natureza: custo == null ? null : Number(calculado?.semCusto) ? "ESTIMATIVA" : "REAL",
    pratos: (calculado?.pratos || []).filter((p) => !p.fixo).map((p) => p.nome).filter(Boolean),
    registrado_em: new Date().toISOString(),
  };
}

/** Põe (ou troca) o registro da data; mais recente primeiro; corta o excesso. */
export function registrarNoHistorico(historico = [], registro) {
  const resto = (Array.isArray(historico) ? historico : []).filter((h) => h?.data !== registro.data);
  return [registro, ...resto].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, MAX_DIAS_HISTORICO);
}

export const tirarDoHistorico = (historico = [], data) => (historico || []).filter((h) => h?.data !== data);

/** Meses com registro ("AAAA-MM"), mais recente primeiro. */
export const mesesDoHistorico = (historico = []) => [...new Set((historico || []).map((h) => String(h.data).slice(0, 7)))].sort().reverse();

/** Resumo de um mês: dias, pessoas, custo total, média por dia e por pessoa. */
export function resumoDoMes(historico = [], mes) {
  const doMes = (historico || []).filter((h) => String(h?.data).startsWith(mes));
  const comCusto = doMes.filter((h) => h.custo != null);
  const custoTotal = r2(comCusto.reduce((t, h) => t + h.custo, 0));
  const pessoasComCusto = comCusto.reduce((t, h) => t + (h.pessoas || 0), 0);
  return {
    mes, dias: doMes.length, diasComCusto: comCusto.length,
    pessoas: doMes.reduce((t, h) => t + (h.pessoas || 0), 0),
    custoTotal: comCusto.length ? custoTotal : null,
    mediaPorDia: comCusto.length ? r2(custoTotal / comCusto.length) : null,
    mediaPorPessoa: pessoasComCusto > 0 ? r2(custoTotal / pessoasComCusto) : null,
    natureza: !comCusto.length ? null : comCusto.some((h) => h.natureza === "ESTIMATIVA") || comCusto.length < doMes.length ? "ESTIMATIVA" : "REAL",
    lista: doMes,
  };
}
