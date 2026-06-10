// ═══════════════════════════════════════════════════════════════
// unidades.js — Departamentos do Restaurante (Bar, Cozinha, Cervejas)
// ═══════════════════════════════════════════════════════════════
//
// Ao invés de múltiplas unidades/lojas, o ERP agora usa departamentos:
// - Bar: bebidas, drinks, coquetéis
// - Cozinha: alimentos, pratos principais, compostos
// - Cervejas: catálogo e estoque específicos de cerveja
//
// Cada departamento tem seu próprio estoque, ingredientes e cardápio.
// "Central" consolida a visão de todos os departamentos.

export const UNIDADES = [
  { id: "bar",      nome: "Bar",           curto: "Bar", cor: "#3B82F6" },
  { id: "cozinha",  nome: "Cozinha",       curto: "Coz", cor: "#10B981" },
  { id: "cervejas", nome: "Cervejas",      curto: "Cer", cor: "#F59E0B" },
];

// "Central" consolida todos os departamentos
export const CENTRAL = { id: "todas", nome: "Central · Todos", curto: "Tudo", cor: "#8B5CF6" };

/** Retorna a unidade pelo id (ou CENTRAL se for "todas"/inexistente). */
export function getUnidade(id) {
  if (!id || id === "todas") return CENTRAL;
  return UNIDADES.find((u) => u.id === id) || CENTRAL;
}

/** True se o contexto atual é a visão consolidada da matriz. */
export function isCentral(id) {
  return !id || id === "todas";
}

/**
 * Resolve a unidade inicial a partir da sessão do usuário.
 * - Admin / vínculo "Todas" → Central (pode trocar entre unidades)
 * - Gerente de unidade → travado na própria unidade
 * Aceita tanto id ("seldeestrela") quanto nome legado ("Seldeestrela").
 */
export function unidadeDaSessao(sessao) {
  const v = sessao?.unidade;
  if (!v || /todas/i.test(v)) return CENTRAL.id;
  const porId   = UNIDADES.find((u) => u.id === v);
  if (porId) return porId.id;
  const porNome = UNIDADES.find((u) => u.nome.toLowerCase() === String(v).toLowerCase());
  return porNome ? porNome.id : CENTRAL.id;
}

/** Papéis que enxergam a rede inteira e podem alternar de unidade. */
export function podeVerTodas(papelId) {
  return papelId === "admin" || papelId === "financeiro";
}

// ── Helpers de escopo de dados (multiunidade) ──────────────────────────────────
// Aplicam o filtro/carimbo de unidade só quando há uma unidade específica.
// Em "Central" (todas) NÃO filtram — retornam a rede inteira.

/** Aplica .eq("unidade_id", ...) na query quando a unidade é específica. */
export function escoparPorUnidade(query, unidadeId) {
  return (unidadeId && unidadeId !== "todas") ? query.eq("unidade_id", unidadeId) : query;
}

/** Carimba unidade_id num objeto a inserir (null em "Central"). */
export function carimbarUnidade(obj, unidadeId) {
  return { ...obj, unidade_id: (unidadeId && unidadeId !== "todas") ? unidadeId : null };
}
