// Lista de colaboradores depois da SEC-RLS-2 (HDEV-SEC-002).
//
// O banco devolve dois recortes:
//   - hefisto_colaboradores_operacional(): toda a equipe da(s) unidade(s) do usuário,
//     SEM dado sensível (CPF, salário, RG, PIX, endereço, biometria…);
//   - select na tabela colaboradores: só as linhas que a RLS libera por completo
//     (RH/gerência autorizados da unidade, o próprio funcionário, super admin).
// As telas continuam recebendo uma lista só: a linha completa vence a operacional.
// Antes da migração a função não existe: fica só a tabela, como era.

/** Junta as duas listas por id; a completa vence. Ordena por nome. */
export function juntarColaboradores(operacional, completos) {
  const porId = new Map();
  for (const c of Array.isArray(operacional) ? operacional : []) if (c?.id) porId.set(c.id, c);
  for (const c of Array.isArray(completos) ? completos : []) if (c?.id) porId.set(c.id, { ...porId.get(c.id), ...c });
  return [...porId.values()].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
}

/** Filtro de unidade igual ao de antes ("matriz" = todas as que o usuário alcança). */
export const unidadeDoFiltro = (unidadeId) => (unidadeId && unidadeId !== "matriz" ? unidadeId : null);

/**
 * Busca e junta. `cliente` tem o formato do supabase-js.
 * Erro da tabela só derruba a lista se a lista operacional também falhar.
 */
export async function buscarColaboradores(cliente, unidadeId) {
  const unidade = unidadeDoFiltro(unidadeId);
  let tabela = cliente.from("colaboradores").select("*");
  if (unidade) tabela = tabela.eq("unidade_id", unidade);
  const [oper, comp] = await Promise.all([
    cliente.rpc("hefisto_colaboradores_operacional", { p_unidade_id: unidade }),
    tabela.order("nome"),
  ]);
  if (oper.error && comp.error) return { data: [], error: comp.error.message || String(comp.error) };
  return { data: juntarColaboradores(oper.error ? [] : oper.data, comp.error ? [] : comp.data), error: null };
}

/** Horário de um colaborador para a trava de entrada do ponto (não precisa de dado sensível). */
export async function horarioDoColaborador(cliente, colaboradorId) {
  const { data, error } = await cliente.rpc("hefisto_colaboradores_operacional", { p_unidade_id: null });
  if (!error && Array.isArray(data)) return data.find((c) => c.id === colaboradorId) || null;
  // antes da migração: como era
  const r = await cliente.from("colaboradores")
    .select("horario_entrada, horario_dom_entrada, horario_por_dia, horarios_dia").eq("id", colaboradorId).maybeSingle();
  return r.data || null;
}
