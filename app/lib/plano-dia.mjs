// Plano do dia (Jhon + Nico, 14/11/2026): regras puras de leitura, andamento
// e o que o Nico mostra. Testado em plano-dia.test.mjs.

/** Linha do banco (snake_case) ou do plano combinado (camelCase) → tarefa da tela. */
export function normalizarTarefa(t = {}) {
  return {
    id: t.id || null,
    ordem: Number(t.ordem) || 0,
    titulo: String(t.titulo || "").trim(),
    tipo: t.tipo || "outro",
    fichaId: t.ficha_id ?? t.fichaId ?? null,
    fichaNome: t.ficha_nome ?? t.fichaNome ?? null,
    procedimento: t.procedimento || null,
    quantidade: t.quantidade == null ? null : Number(t.quantidade),
    unidade: t.unidade_medida ?? t.unidade ?? null,
    responsavelId: t.responsavel_id ?? t.responsavelId ?? null,
    responsavelNome: t.responsavel_nome ?? t.responsavelNome ?? null,
    depoisDoIntervalo: Boolean(t.depois_do_intervalo ?? t.depoisDoIntervalo),
    motivo: t.motivo || null,
    feitoEm: t.feito_em ?? t.feitoEm ?? null,
    feitoPorNome: t.feito_por_nome ?? t.feitoPorNome ?? null,
  };
}

/** Andamento: o que o Jhon conta ao dono ("2 de 3 feitas, 67%"). */
export function andamento(tarefas) {
  const lista = (tarefas || []).filter((t) => t?.titulo);
  const feitas = lista.filter((t) => t.feitoEm).length;
  const total = lista.length;
  return { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0, proxima: lista.find((t) => !t.feitoEm) || null };
}

/** Frase do Jhon para o dono. */
export function fraseDoAndamento(a) {
  if (!a?.total) return "Nenhum plano aprovado hoje.";
  if (a.feitas === a.total) return `Plano do dia concluído: ${a.total} de ${a.total} tarefas.`;
  return `Plano do dia: ${a.feitas} de ${a.total} feitas (${a.pct}%).${a.proxima ? ` Agora: ${a.proxima.titulo}${a.proxima.responsavelNome ? ` (${a.proxima.responsavelNome})` : ""}.` : ""}`;
}

/** O que o Nico abre em "Ver como faz": a ficha ou o procedimento da tarefa. */
export function comandoDaTarefa(t) {
  if (t?.fichaNome) return `Vou preparar ${t.fichaNome}`;
  if (t?.procedimento) return `Procedimento da casa: ${t.procedimento}`;
  return null;
}

/** Quantidade que o dono digitou na tela para responder ao Jhon. */
export function quantidadeDigitada(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}
