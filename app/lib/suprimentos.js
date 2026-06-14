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

let MOCK_CATALOGO = [
  { id: "s1", nome: "Sabão Líquido 5L", categoria: "Limpeza", unidade_medida: "UN", estoque_central: 10, custo_unitario: 25.50, fornecedor: "Distribuidora ABC" },
  { id: "s2", nome: "Papel Toalha", categoria: "Higiene", unidade_medida: "PCT", estoque_central: 50, custo_unitario: 8.90, fornecedor: "Atacadão" }
];
let MOCK_UNIDADES = [];

// ─── GESTÃO CENTRAL (NÍVEL 1) ────────────────────────────────────────────────

export async function fetchCatalogoCentral() {
  if (!isSupabaseReady()) return { data: [...MOCK_CATALOGO].sort((a,b)=>a.nome.localeCompare(b.nome)), error: null };
  const { data, error } = await supabase.from("suprimentos_catalogo").select("*").order("nome");
  return { data: data || [], error: error?.message || null };
}

export async function inserirSuprimentoCentral(sup) {
  if (!isSupabaseReady()) {
    const novo = { ...sup, id: "s" + Date.now(), estoque_central: 0 };
    MOCK_CATALOGO.push(novo);
    return { data: novo, error: null };
  }
  const { data, error } = await supabase.from("suprimentos_catalogo").insert([sup]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarSuprimentoCentral(id, updates) {
  if (!isSupabaseReady()) {
    const idx = MOCK_CATALOGO.findIndex(c => c.id === id);
    if(idx > -1) MOCK_CATALOGO[idx] = { ...MOCK_CATALOGO[idx], ...updates };
    return { error: null };
  }
  const { error } = await supabase.from("suprimentos_catalogo").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function entradaEstoqueCentral(id, quantidade, responsavel) {
  if (!isSupabaseReady()) {
    const idx = MOCK_CATALOGO.findIndex(c => c.id === id);
    if(idx > -1) MOCK_CATALOGO[idx].estoque_central = Number(MOCK_CATALOGO[idx].estoque_central || 0) + Number(quantidade);
    return { error: null };
  }
  
  const { data: item } = await supabase.from("suprimentos_catalogo").select("estoque_central").eq("id", id).single();
  if (!item) return { error: "Item não encontrado" };

  const novoEstoque = Number(item.estoque_central) + Number(quantidade);
  await supabase.from("suprimentos_catalogo").update({ estoque_central: novoEstoque }).eq("id", id);
  
  await supabase.from("suprimentos_historico").insert([{
    catalogo_id: id, tipo: "entrada", quantidade: Number(quantidade), responsavel
  }]);

  return { error: null };
}

/**
 * Transfere estoque do catálogo central para uma unidade.
 */
export async function transferirParaUnidade(catalogoId, unidadeDestino, quantidade, minimo, responsavel) {
  if (!isSupabaseReady()) {
    const idx = MOCK_CATALOGO.findIndex(c => c.id === catalogoId);
    if(idx > -1) MOCK_CATALOGO[idx].estoque_central = Math.max(0, Number(MOCK_CATALOGO[idx].estoque_central || 0) - Number(quantidade));
    
    let uItem = MOCK_UNIDADES.find(u => u.catalogo_id === catalogoId && u.unidade_id === unidadeDestino);
    if(uItem) {
      uItem.quantidade = Number(uItem.quantidade) + Number(quantidade);
      if(minimo !== undefined && minimo !== null) uItem.minimo = minimo;
    } else {
      MOCK_UNIDADES.push({ id: "su"+Date.now(), catalogo_id: catalogoId, unidade_id: unidadeDestino, quantidade: Number(quantidade), minimo: minimo || 0 });
    }
    return { error: null };
  }

  // 1. Desconta do central
  const { data: central } = await supabase.from("suprimentos_catalogo").select("estoque_central").eq("id", catalogoId).single();
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
    if(!isSupabaseReady() && unidadeId && unidadeId !== "todas") {
      return { data: MOCK_UNIDADES.filter(u => u.unidade_id === unidadeId).map(u => {
        const cat = MOCK_CATALOGO.find(c => c.id === u.catalogo_id) || {};
        return { ...u, nome: cat.nome, categoria: cat.categoria, unidade_medida: cat.unidade_medida, custo_unitario: cat.custo_unitario };
      }), error: null };
    }
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
  if (!isSupabaseReady()) {
    const uItem = MOCK_UNIDADES.find(u => u.id === unidadeEstoqueId);
    if(uItem) {
      uItem.quantidade = Math.max(0, Number(uItem.quantidade) - Number(quantidade));
      return { error: null, novaQtd: uItem.quantidade };
    }
    return { error: "Item não encontrado" };
  }

  const { data: item } = await supabase.from("suprimentos_unidades").select("*").eq("id", unidadeEstoqueId).single();
  if (!item) return { error: "Item não encontrado" };

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
  if (!isSupabaseReady()) {
    return { data: MOCK_UNIDADES.filter(u => u.quantidade <= u.minimo).map(u => ({
      unidade_id: u.unidade_id,
      item: MOCK_CATALOGO.find(c => c.id === u.catalogo_id)?.nome,
      quantidade: u.quantidade,
      minimo: u.minimo
    }))};
  }
  
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
