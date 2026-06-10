/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Eventos
 * ─────────────────────────────────────────────────────────────────────────────
 * Planejamento financeiro de eventos gastronômicos com cálculos de CMV,
 * break-even, lista de compras automática e gestão de reservas.
 *
 * SQL: ver docs/eventos.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

const BANNER_BUCKET = "eventos-banners";

// ─── Constantes (compartilhadas com a UI) ─────────────────────────────────
export const TIME_SLOTS = [
  { value: "19:00", label: "1º turno · 19h às 21h" },
  { value: "21:30", label: "2º turno · 21h30 às 23h30" },
];

export const PAYMENT_METHODS = [
  { id: "credit", label: "Crédito" },
  { id: "debit",  label: "Débito" },
  { id: "pix",    label: "PIX" },
];

export const CATEGORIAS_PRATO = ["Entrada", "Principal", "Sobremesa"];

export const DISH_TAGS = [
  "Vegetariano", "Vegano", "Sem Glúten", "Sem Lactose", "Picante", "Romântico", "Premium",
];

export const FIXED_COST_CATEGORIES = [
  { id: "cmo",        label: "CMO (Mão de Obra)", cor: "#ff2d55", isLabor: true },
  { id: "decoracao",  label: "Decoração",         cor: "#ff7eb6" },
  { id: "musica",     label: "Música",            cor: "#7b61ff" },
  { id: "infra",      label: "Infraestrutura",    cor: "#00b8d4" },
  { id: "marketing",  label: "Marketing",         cor: "#5b9bff" },
  { id: "outros",     label: "Outros",            cor: "#a0a0a0" },
];

export const CMO_AREAS = [
  {
    id: "cozinha", label: "Cozinha", cor: "#ff2d55",
    roles: [
      { id: "cozinheiro",       label: "Cozinheiro" },
      { id: "auxiliar_cozinha", label: "Auxiliar de Cozinha" },
      { id: "producao",         label: "Produção" },
      { id: "steward",          label: "Steward" },
    ],
  },
  {
    id: "salao", label: "Salão", cor: "#ffb300",
    roles: [
      { id: "garcom",         label: "Garçom" },
      { id: "hostess",        label: "Hostess" },
      { id: "maitre",         label: "Maître" },
      { id: "auxiliar_salao", label: "Auxiliar de Salão" },
    ],
  },
  {
    id: "bar", label: "Bar", cor: "#00e676",
    roles: [
      { id: "barmen",          label: "Barmen" },
      { id: "auxiliar_barmen", label: "Auxiliar de Barmen" },
    ],
  },
];

// ─── CRUD: Eventos ────────────────────────────────────────────────────────
export async function fetchEventos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await escoparPorUnidade(
    supabase.from("eventos").select("*").order("data_evento", { ascending: false }),
    unidadeId,
  );
  if (error) console.error("[eventos] fetchEventos:", error.message);
  return { data: data || [], error: error?.message || null };
}

export async function fetchEvento(id) {
  if (!isSupabaseReady()) return { data: null, error: null };
  const { data, error } = await supabase.from("eventos").select("*").eq("id", id).single();
  if (error) console.error("[eventos] fetchEvento:", error.message);
  return { data, error: error?.message || null };
}

export async function inserirEvento(evento, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from("eventos")
    .insert([carimbarUnidade(evento, unidadeId)])
    .select()
    .single();
  if (error) console.error("[eventos] inserirEvento:", error.message);
  return { data, error: error?.message || null };
}

export async function atualizarEvento(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase
    .from("eventos")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[eventos] atualizarEvento:", error.message);
  return { error: error?.message || null };
}

export async function removerEvento(id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) console.error("[eventos] removerEvento:", error.message);
  return { error: error?.message || null };
}

// ─── Upload de banner ────────────────────────────────────────────────────
export async function uploadBanner(file, eventoId) {
  if (!isSupabaseReady()) return { url: null, error: "Supabase não configurado" };
  const ext = file.name.split(".").pop();
  const path = `${eventoId || "evt"}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BANNER_BUCKET).upload(path, file, {
    cacheControl: "3600", upsert: false,
  });
  if (upErr) return { url: null, error: upErr.message };
  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);
  return { url: data?.publicUrl || null, error: null };
}

// ─── CRUD genérico para sub-tabelas ──────────────────────────────────────
async function fetchList(table, eventoId, orderBy = "created_at") {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase
    .from(table).select("*").eq("evento_id", eventoId).order(orderBy);
  if (error) console.error(`[eventos] fetch ${table}:`, error.message);
  return { data: data || [], error: error?.message || null };
}

async function insertOne(table, eventoId, obj) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase
    .from(table).insert([{ ...obj, evento_id: eventoId }]).select().single();
  if (error) console.error(`[eventos] insert ${table}:`, error.message);
  return { data, error: error?.message || null };
}

async function updateOne(table, id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from(table).update(updates).eq("id", id);
  if (error) console.error(`[eventos] update ${table}:`, error.message);
  return { error: error?.message || null };
}

async function removeOne(table, id) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`[eventos] remove ${table}:`, error.message);
  return { error: error?.message || null };
}

// ─── API granular ────────────────────────────────────────────────────────
export const Ingredientes = {
  list:   (eId) => fetchList("evento_ingredientes", eId, "nome"),
  add:    (eId, obj) => insertOne("evento_ingredientes", eId, obj),
  update: (id, patch) => updateOne("evento_ingredientes", id, patch),
  remove: (id) => removeOne("evento_ingredientes", id),
};

export const Preparos = {
  list:   (eId) => fetchList("evento_preparos", eId, "nome"),
  add:    (eId, obj) => insertOne("evento_preparos", eId, obj),
  update: (id, patch) => updateOne("evento_preparos", id, patch),
  remove: (id) => removeOne("evento_preparos", id),
};

export const Pratos = {
  list:   (eId) => fetchList("evento_pratos", eId, "nome"),
  add:    (eId, obj) => insertOne("evento_pratos", eId, obj),
  update: (id, patch) => updateOne("evento_pratos", id, patch),
  remove: (id) => removeOne("evento_pratos", id),
};

export const Drinks = {
  list:   (eId) => fetchList("evento_drinks", eId, "nome"),
  add:    (eId, obj) => insertOne("evento_drinks", eId, obj),
  update: (id, patch) => updateOne("evento_drinks", id, patch),
  remove: (id) => removeOne("evento_drinks", id),
};

export const Reservas = {
  list:   (eId) => fetchList("evento_reservas", eId, "created_at"),
  add:    (eId, obj) => insertOne("evento_reservas", eId, obj),
  update: (id, patch) => updateOne("evento_reservas", id, patch),
  remove: (id) => removeOne("evento_reservas", id),
};

export const CustosFixos = {
  list:   (eId) => fetchList("evento_custos_fixos", eId, "created_at"),
  add:    (eId, obj) => insertOne("evento_custos_fixos", eId, obj),
  update: (id, patch) => updateOne("evento_custos_fixos", id, patch),
  remove: (id) => removeOne("evento_custos_fixos", id),
};

// ─── Helpers de cálculo ──────────────────────────────────────────────────
export function custoIngrediente(ing, qty) {
  if (!ing || !ing.peso_unit) return 0;
  return (Number(ing.custo_unit) / Number(ing.peso_unit)) * Number(qty);
}

export function custoPreparoUnit(preparo, ingredientes) {
  if (!preparo || !preparo.rendimento) return 0;
  const total = (preparo.base_ingredients || []).reduce((s, item) => {
    const ing = ingredientes.find((i) => i.id === item.id);
    return s + custoIngrediente(ing, item.qty);
  }, 0);
  return total / Number(preparo.rendimento);
}

export function custoItem(item, ingredientes, preparos) {
  if (item.type === "prep") {
    const prep = preparos.find((p) => p.id === item.id);
    return custoPreparoUnit(prep, ingredientes) * Number(item.qty);
  }
  const ing = ingredientes.find((i) => i.id === item.id);
  return custoIngrediente(ing, item.qty);
}

export function custoPrato(prato, ingredientes, preparos) {
  return (prato.ingredients || []).reduce(
    (s, it) => s + custoItem(it, ingredientes, preparos), 0,
  );
}

export function custoDrink(drink, ingredientes, preparos) {
  return (drink.ingredients || []).reduce(
    (s, it) => s + custoItem(it, ingredientes, preparos), 0,
  );
}

export function calcularMaquininha(creditRate, debitRate, creditMix) {
  return Number(creditRate) * Number(creditMix) + Number(debitRate) * (1 - Number(creditMix));
}

export function rateForMethod(method, evento) {
  if (method === "credit") return Number(evento.credito_rate);
  if (method === "debit")  return Number(evento.debito_rate);
  if (method === "pix")    return 0;
  return calcularMaquininha(evento.credito_rate, evento.debito_rate, evento.credito_mix);
}
