/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Suprimentos (Limpeza e Materiais)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para criar as tabelas no Supabase:
 *
 *   create table suprimentos_catalogo (
 *     id uuid primary key default gen_random_uuid(),
 *     nome text not null,
 *     categoria text not null,      -- 'Limpeza', 'Escritório', etc
 *     unidade_medida text not null, -- 'UN', 'L', 'PCT', 'RL'
 *     estoque_central numeric not null default 0,
 *     custo_unitario numeric not null default 0,
 *     created_at timestamptz default now()
 *   );
 *
 *   create table suprimentos_unidades (
 *     id uuid primary key default gen_random_uuid(),
 *     catalogo_id uuid references suprimentos_catalogo(id) on delete cascade,
 *     unidade_id text not null,
 *     quantidade numeric not null default 0,
 *     minimo numeric not null default 0,
 *     maximo numeric not null default 0,
 *     updated_at timestamptz default now(),
 *     unique(catalogo_id, unidade_id)
 *   );
 *
 *   create table suprimentos_historico (
 *     id uuid primary key default gen_random_uuid(),
 *     catalogo_id uuid references suprimentos_catalogo(id),
 *     unidade_id text,          -- null se for central
 *     tipo text not null,       -- 'entrada', 'transferencia', 'consumo'
 *     quantidade numeric not null,
 *     responsavel text,
 *     created_at timestamptz default now()
 *   );
 *
 *   alter table suprimentos_catalogo enable row level security;
 *   alter table suprimentos_unidades enable row level security;
 *   alter table suprimentos_historico enable row level security;
 *   create policy "auth_all" on suprimentos_catalogo for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on suprimentos_unidades for all to authenticated using (true) with check (true);
 *   create policy "auth_all" on suprimentos_historico for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";

export const CATEGORIAS_SUP = ["Limpeza", "Higiene", "Escritório", "Descartáveis", "Outros"];
export const UNIDADES_SUP = ["UN", "L", "mL", "PCT", "CX", "RL", "KG"];

let MOCK_CATALOGO = [];
let MOCK_UNIDADES = [];

// ─── GESTÃO CENTRAL (NÍVEL 1) ────────────────────────────────────────────────

export async function fetchCatalogoCentral() {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase.from("suprimentos_catalogo").select("*").order("nome");
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchTodoEstoqueLojas() {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase.from("suprimentos_unidades").select("*");
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function inserirSuprimentoCentral(sup) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };
  try {
    const { data, error } = await supabase.from("suprimentos_catalogo").insert([sup]).select().single();
    if (error) throw new Error(error.message);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function atualizarSuprimentoCentral(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };
  const { error } = await supabase.from("suprimentos_catalogo").update(updates).eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function entradaEstoqueCentral(id, quantidade, responsavel) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };
  
  try {
    const { data: item, error: fetchErr } = await supabase.from("suprimentos_catalogo").select("estoque_central").eq("id", id).single();
    if (fetchErr) throw new Error(fetchErr.message);

    const novoEstoque = Number(item.estoque_central) + Number(quantidade);
    await supabase.from("suprimentos_catalogo").update({ estoque_central: novoEstoque }).eq("id", id);
    
    await supabase.from("suprimentos_historico").insert([{
      catalogo_id: id, tipo: "entrada", quantidade: Number(quantidade), responsavel
    }]);

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Transfere estoque do catálogo central para uma unidade.
 */
export async function transferirParaUnidade(catalogoId, unidadeDestino, quantidade, minimo, responsavel) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };

  // 1. Desconta do central
  const { data: central, error: errCentral } = await supabase.from("suprimentos_catalogo").select("estoque_central").eq("id", catalogoId).single();
  if(errCentral) return { error: errCentral.message };

  const novoCentral = Math.max(0, Number(central.estoque_central) - Number(quantidade));
  await supabase.from("suprimentos_catalogo").update({ estoque_central: novoCentral }).eq("id", catalogoId);

  // 2. Busca o item na unidade (upsert)
  const { data: unitItem } = await supabase.from("suprimentos_unidades")
    .select("*").eq("catalogo_id", catalogoId).eq("unidade_id", unidadeDestino).maybeSingle();

  if (unitItem) {
    const novaQtdUnit = Number(unitItem.quantidade) + Number(quantidade);
    const updates = { quantidade: novaQtdUnit, updated_at: new Date().toISOString() };
    if (minimo !== undefined && minimo !== null) updates.minimo = minimo;
    await supabase.from("suprimentos_unidades").update(updates).eq("id", unitItem.id);
  } else {
    await supabase.from("suprimentos_unidades").insert([{
      catalogo_id: catalogoId,
      unidade_id: unidadeDestino,
      quantidade: Number(quantidade),
      minimo: minimo || 0
    }]);
  }

  // 3. Registra histórico
  await supabase.from("suprimentos_historico").insert([{
    catalogo_id: catalogoId,
    unidade_id: unidadeDestino,
    tipo: "transferencia",
    quantidade: Number(quantidade),
    responsavel
  }]);

  return { error: null };
}

// ─── GESTÃO DA UNIDADE (FILIAL) ──────────────────────────────────────────────

/**
 * Puxa todos os suprimentos que a filial X possui.
 * Traz também os dados do catálogo (nome, medida) via join.
 */
export async function fetchSuprimentosDaUnidade(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { data: [], error: null };
  }
  
  const { data, error } = await supabase
    .from("suprimentos_unidades")
    .select(`
      *,
      catalogo:suprimentos_catalogo(nome, categoria, unidade_medida, custo_unitario)
    `)
    .eq("unidade_id", unidadeId);

  if (error) return { data: [], error: error.message };

  // Format para ficar flat
  const flat = (data || []).map(d => ({
    id: d.id, // ID local da unidade
    catalogo_id: d.catalogo_id,
    unidade_id: d.unidade_id,
    quantidade: d.quantidade,
    minimo: d.minimo,
    nome: d.catalogo?.nome,
    categoria: d.catalogo?.categoria,
    unidade_medida: d.catalogo?.unidade_medida,
    custo_unitario: d.catalogo?.custo_unitario
  }));
  
  // Ordena por nome
  flat.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));

  return { data: flat, error: null };
}

/**
 * Registra o consumo diário de um item na unidade (baixa).
 */
export async function registrarConsumo(unidadeEstoqueId, quantidade, responsavel) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };

  const { data: item, error: fetchErr } = await supabase.from("suprimentos_unidades").select("*").eq("id", unidadeEstoqueId).single();
  if (fetchErr || !item) return { error: "Item não encontrado" };

  const novaQtd = Math.max(0, Number(item.quantidade) - Number(quantidade));
  await supabase.from("suprimentos_unidades").update({ quantidade: novaQtd, updated_at: new Date().toISOString() }).eq("id", unidadeEstoqueId);

  await supabase.from("suprimentos_historico").insert([{
    catalogo_id: item.catalogo_id,
    unidade_id: item.unidade_id,
    tipo: "consumo",
    quantidade: Number(quantidade),
    responsavel
  }]);

  return { error: null, novaQtd };
}

/**
 * Checa quais unidades estão com estoque de limpeza crítico (<= minimo).
 * Usado pelo Cérebro/Notificações do Gestor Central.
 */
export async function checkAlertasLimpeza() {
  if (!isSupabaseReady()) return { data: [] };
  
  const { data, error } = await supabase
    .from("suprimentos_unidades")
    .select(`
      *,
      catalogo:suprimentos_catalogo(nome)
    `);
    
  if (error || !data) return { data: [] };

  const alertas = data.filter(d => d.quantidade <= d.minimo).map(d => ({
    unidade_id: d.unidade_id,
    item: d.catalogo?.nome,
    quantidade: d.quantidade,
    minimo: d.minimo
  }));

  return { data: alertas };
}
