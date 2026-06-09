/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Ingredientes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARQUITETURA DE INTERLIGAÇÃO
 * ───────────────────────────
 * Este módulo é a "fonte da verdade" do catálogo de ingredientes.
 * A Ficha Técnica importa `getIngredienteById` e calcula o custo de cada
 * linha da receita assim:
 *
 *   const ing = getIngredienteById(ingrediente_id);   // ex: Carne Moída
 *   const custo_linha = ing.custo_por_unidade_base * quantidade_usada;
 *   //                  ↑ R$/g ou R$/mL ou R$/un      ↑ ex: 200 (gramas)
 *
 * Exemplo real — Marmitex Executiva:
 *   Carne Moída  150g × R$ 0,035/g  = R$ 5,25
 *   Arroz        200g × R$ 0,006/g  = R$ 1,20
 *   Embalagem    1un  × R$ 0,60/un  = R$ 0,60
 *   ─────────────────────────────────────────
 *   Custo Total da Ficha              R$ 7,05
 *
 * PERSISTÊNCIA FUTURA (Supabase)
 * ───────────────────────────────
 *   tabela: `ingredientes`
 *   colunas: id (uuid), nome, unidade, preco_compra, quantidade_base, custo_por_unidade_base,
 *            created_at, updated_at, unidade_id (FK → unidades)
 *
 *   query: supabase.from('ingredientes').select('*').eq('id', ingrediente_id)
 */

import { supabase, isSupabaseReady } from "./supabase";


// Unidades disponíveis e sua unidade-base de custo fracionado
export const UNIDADES = [
  { id: "KG",   label: "KG",    base: "g",  fator: 1000, label_base: "por grama"   },
  { id: "L",    label: "L",     base: "mL", fator: 1000, label_base: "por mL"      },
  { id: "UN",   label: "UN",    base: "un", fator: 1,    label_base: "por unidade"  },
  { id: "MACO", label: "MAÇO",  base: "un", fator: 1,    label_base: "por unidade"  },
  { id: "CX",   label: "CX",    base: "un", fator: 1,    label_base: "por unidade"  },
];

export function getUnidade(id) {
  return UNIDADES.find((u) => u.id === id) ?? UNIDADES[2];
}

/**
 * Calcula o custo fracionado de um ingrediente.
 * @param {number} preco_compra  - Preço pago pela embalagem/kg/L/un
 * @param {string} unidade_id    - "KG" | "L" | "UN" | "MACO" | "CX"
 * @returns {number}             - Custo por unidade-base (R$/g, R$/mL ou R$/un)
 */
export function calcCustoUnitario(preco_compra, unidade_id) {
  const u = getUnidade(unidade_id);
  return preco_compra / u.fator;
}

/**
 * Calcula o custo de uma linha de ficha técnica.
 * @param {object} ingrediente   - Objeto ingrediente (com custo_por_unidade_base)
 * @param {number} quantidade    - Quantidade usada na receita (em unidade-base)
 * @returns {number}             - Custo em R$
 */
export function calcCustoLinha(ingrediente, quantidade) {
  return (ingrediente.custo_por_unidade_base ?? 0) * quantidade;
}

/**
 * Busca ingrediente por ID (client-side, estado em memória).
 * Substituir por query Supabase quando banco estiver ativo.
 * @param {number|string} id
 * @param {Array} lista - array de ingredientes do useState
 * @returns {object|undefined}
 */
export function getIngredienteById(id, lista) {
  return lista.find((i) => String(i.id) === String(id));
}


// ─── Normaliza campos vindos do Supabase ──────────────────────────────────────
function normalizar(i) {
  return {
    ...i,
    custo_por_unidade_base: i.custo_por_unidade_base ?? calcCustoUnitario(i.preco_compra, i.unidade),
  };
}

// ─── CRUD Supabase ────────────────────────────────────────────────────────────
export async function fetchIngredientes() {
  if (!isSupabaseReady()) return { data: INGREDIENTES_SEED.map(normalizar), fromSeed: true };
  const { data, error } = await supabase.from("ingredientes").select("*").order("nome");
  if (error || !data?.length) return { data: INGREDIENTES_SEED.map(normalizar), fromSeed: true };
  return { data: data.map(normalizar), fromSeed: false };
}

export async function inserirIngrediente(ing) {
  if (!isSupabaseReady()) return { data: { ...ing, id: Date.now() }, error: null };
  const payload = {
    nome: ing.nome,
    unidade: ing.unidade,
    preco_compra: ing.preco_compra,
    custo_por_unidade_base: calcCustoUnitario(ing.preco_compra, ing.unidade),
  };
  const { data, error } = await supabase.from("ingredientes").insert([payload]).select().single();
  return { data: data ? normalizar(data) : null, error: error?.message || null };
}

export async function atualizarIngrediente(id, ing) {
  const payload = {
    nome: ing.nome,
    unidade: ing.unidade,
    preco_compra: ing.preco_compra,
    custo_por_unidade_base: calcCustoUnitario(ing.preco_compra, ing.unidade),
  };
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("ingredientes").update(payload).eq("id", id);
  if (!error) recalcularFichasComIngrediente(id, payload.custo_por_unidade_base);
  return { error: error?.message || null };
}

export async function removerIngrediente(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("ingredientes").delete().eq("id", id);
  return { error: error?.message || null };
}

async function recalcularFichasComIngrediente(ingredienteId, novoCustoUnit) {
  if (!isSupabaseReady()) return;
  const { data: itens } = await supabase.from("ficha_itens").select("ficha_id, quantidade").eq("ingrediente_id", ingredienteId);
  if (!itens?.length) return;
  const fichaIds = [...new Set(itens.map(i => i.ficha_id))];
  for (const fichaId of fichaIds) {
    const { data: todosItens } = await supabase.from("ficha_itens").select("ingrediente_id, quantidade").eq("ficha_id", fichaId);
    const { data: ings } = await supabase.from("ingredientes").select("id, custo_por_unidade_base");
    if (!todosItens || !ings) continue;
    const ingMap = Object.fromEntries(ings.map(i => [i.id, i.custo_por_unidade_base]));
    const custo_total = todosItens.reduce((acc, it) => acc + (ingMap[it.ingrediente_id] ?? 0) * it.quantidade, 0);
    const { data: ficha } = await supabase.from("fichas_tecnicas").select("prato_id").eq("id", fichaId).single();
    if (!ficha) continue;
    await supabase.from("fichas_tecnicas").update({ custo_total }).eq("id", fichaId);
    if (ficha.prato_id) await supabase.from("cardapio").update({ custo: custo_total }).eq("id", ficha.prato_id);
  }
}

export const INGREDIENTES_SEED = [
  { id: 1, nome: "Carne Moída (Patinho)", unidade: "KG", preco_compra: 35.00, custo_por_unidade_base: 35.00 / 1000 },
  { id: 2, nome: "Arroz Agulhinha",       unidade: "KG", preco_compra: 6.00,  custo_por_unidade_base: 6.00 / 1000  },
  { id: 3, nome: "Embalagem Marmita",     unidade: "UN", preco_compra: 0.60,  custo_por_unidade_base: 0.60          },
  { id: 4, nome: "Feijão Carioca",        unidade: "KG", preco_compra: 8.50,  custo_por_unidade_base: 8.50 / 1000  },
  { id: 5, nome: "Óleo de Soja",          unidade: "L",  preco_compra: 7.90,  custo_por_unidade_base: 7.90 / 1000  },
];
