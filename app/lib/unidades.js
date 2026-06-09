// ═══════════════════════════════════════════════════════════════
// unidades.js — Fonte única da verdade das UNIDADES (restaurantes)
// ═══════════════════════════════════════════════════════════════
//
// Toda a rede é multiunidade: cada registro do ERP (estoque, cardápio,
// ficha, funcionário, lançamento...) pertence a uma unidade. A "Central"
// (Matriz) é a visão consolidada de TODAS as unidades.
//
// Para escopar os dados no Supabase, cada tabela deve ganhar uma coluna
// `unidade_id text` e as queries devem filtrar por ela. Ver SQL em docs.
//
// Edite a lista abaixo para refletir seus restaurantes reais.

export const UNIDADES = [
  { id: "seldeestrela", nome: "Seldeestrela",      curto: "Sel", cor: "#10B981" },
  { id: "ticotico",     nome: "Tico Tico Saladas", curto: "Tico", cor: "#3B82F6" },
  { id: "burguer",      nome: "Burguer",           curto: "Bur", cor: "#F97316" },
];

// "Central" representa a visão consolidada da matriz (todas as unidades).
export const CENTRAL = { id: "todas", nome: "Central", curto: "Tudo", cor: "#8B5CF6" };

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
