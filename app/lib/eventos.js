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

// ─── Importação do Cardápio Regular ──────────────────────────────────────
/**
 * Busca ingredientes do ERP regular (tabela ingredientes).
 * Retorna lista normalizada para escolha.
 */
export async function fetchIngredientesERP(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  let q = supabase.from("ingredientes").select("*").order("nome");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message || null };
}

/**
 * Busca pratos do cardápio regular.
 */
export async function fetchPratosERP(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  let q = supabase.from("cardapio").select("*").order("nome");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message || null };
}

/**
 * Busca drinks do cardápio regular.
 */
export async function fetchDrinksERP(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };
  let q = supabase.from("drinks").select("*").order("nome");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message || null };
}

/**
 * Mapeia ingrediente do ERP regular → formato do evento.
 * Detecta tipo (food/bar) pelo nome (palavras-chave de bebidas).
 */
function mapIngredienteERPtoEvento(ing, tipoForcado) {
  const nome = (ing.nome || "").toLowerCase();
  const bebidaKeywords = ["vodka", "gin", "rum", "whisky", "whiskey", "tequila", "cerveja", "vinho", "champagne", "xarope", "tônica", "tonica", "soda", "suco", "refrigerante", "água tônica"];
  const detectado = bebidaKeywords.some((k) => nome.includes(k)) ? "bar" : "food";
  const tipo = tipoForcado || detectado;

  // Unidade
  const u = (ing.unidade || "").toUpperCase();
  let unidade = "g", peso_unit = 1000;
  if (u === "KG") { unidade = "g"; peso_unit = 1000; }
  else if (u === "G") { unidade = "g"; peso_unit = 1; }
  else if (u === "L") { unidade = "ml"; peso_unit = 1000; }
  else if (u === "ML") { unidade = "ml"; peso_unit = 1; }
  else if (u === "UN" || u === "MACO" || u === "CX") { unidade = "un"; peso_unit = 1; }

  return {
    tipo,
    nome: ing.nome,
    custo_unit: Number(ing.preco_compra) || 0,
    peso_unit,
    unidade,
  };
}

/**
 * Importa múltiplos ingredientes do ERP regular para um evento.
 * Evita duplicatas (por nome).
 */
export async function importarIngredientes(eventoId, ingredientesERP, tipoForcado, ingredientesExistentes) {
  if (!isSupabaseReady()) return { count: 0, error: "Supabase não configurado" };
  const nomesExistentes = new Set((ingredientesExistentes || []).map((i) => i.nome.toLowerCase()));
  const novos = ingredientesERP
    .filter((ing) => !nomesExistentes.has(ing.nome.toLowerCase()))
    .map((ing) => ({ ...mapIngredienteERPtoEvento(ing, tipoForcado), evento_id: eventoId }));
  if (!novos.length) return { count: 0, error: null };
  const { error } = await supabase.from("evento_ingredientes").insert(novos);
  return { count: novos.length, error: error?.message || null };
}

/**
 * Importa pratos do cardápio regular.
 * NOTA: Pratos do cardápio têm apenas custo total, não receita detalhada.
 * Por isso a importação cria pratos sem ingredientes — você precisa adicionar
 * os ingredientes manualmente no evento.
 */
export async function importarPratos(eventoId, pratosERP, pratosExistentes) {
  if (!isSupabaseReady()) return { count: 0, error: "Supabase não configurado" };
  const nomesExistentes = new Set((pratosExistentes || []).map((p) => p.nome.toLowerCase()));
  const mapCategoria = (cat) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("entrada") || c.includes("petisco")) return "Entrada";
    if (c.includes("sobremesa") || c.includes("doce")) return "Sobremesa";
    return "Principal";
  };
  const novos = pratosERP
    .filter((p) => !nomesExistentes.has(p.nome.toLowerCase()))
    .map((p) => ({
      evento_id: eventoId,
      nome: p.nome,
      categoria: mapCategoria(p.categoria),
      rendimento: 1,
      descricao: p.descricao || null,
      tags: [],
      ingredients: [],
    }));
  if (!novos.length) return { count: 0, error: null };
  const { error } = await supabase.from("evento_pratos").insert(novos);
  return { count: novos.length, error: error?.message || null };
}

/**
 * Duplica um evento completo (configurações + cardápio + drinks + custos).
 * Reservas NÃO são copiadas (são específicas de cada edição).
 *
 * Preserva integridade referencial:
 * - Cria mapeamento ID antigo → ID novo para ingredientes e preparos
 * - Reescreve as referências em pratos.ingredients, drinks.ingredients e
 *   preparos.base_ingredients usando os IDs novos
 */
export async function duplicarEvento(eventoOrigem, novoNome, novaData, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };

  // 1) Cria o novo evento (copia configs, troca nome/data)
  const { id, created_at, updated_at, ...configs } = eventoOrigem;
  const novoEvento = {
    ...configs,
    nome: novoNome,
    data_evento: novaData,
    status: "ativo",
  };
  const { data: criado, error: errEv } = await supabase
    .from("eventos")
    .insert([carimbarUnidade(novoEvento, unidadeId)])
    .select()
    .single();
  if (errEv) return { data: null, error: errEv.message };
  const novoId = criado.id;

  // 2) Copia ingredientes — mantém mapeamento antigoId → novoId
  const { data: ingsOrigem } = await supabase
    .from("evento_ingredientes").select("*").eq("evento_id", id);
  const mapIngId = {};
  if (ingsOrigem?.length) {
    const novos = ingsOrigem.map(({ id: oldId, created_at, evento_id, ...rest }) => ({
      ...rest, evento_id: novoId,
    }));
    const { data: criados } = await supabase
      .from("evento_ingredientes").insert(novos).select();
    (criados || []).forEach((novo, i) => { mapIngId[ingsOrigem[i].id] = novo.id; });
  }

  // 3) Copia preparos — reescreve base_ingredients usando mapIngId
  const { data: prepsOrigem } = await supabase
    .from("evento_preparos").select("*").eq("evento_id", id);
  const mapPrepId = {};
  if (prepsOrigem?.length) {
    const novos = prepsOrigem.map(({ id: oldId, created_at, evento_id, base_ingredients, ...rest }) => ({
      ...rest,
      evento_id: novoId,
      base_ingredients: (base_ingredients || []).map((bi) => ({
        ...bi,
        id: mapIngId[bi.id] || bi.id,
      })),
    }));
    const { data: criados } = await supabase
      .from("evento_preparos").insert(novos).select();
    (criados || []).forEach((novo, i) => { mapPrepId[prepsOrigem[i].id] = novo.id; });
  }

  // Helper para remapear array de ingredients (food/bar + prep)
  const remap = (arr) => (arr || []).map((it) => ({
    ...it,
    id: it.type === "prep" ? (mapPrepId[it.id] || it.id) : (mapIngId[it.id] || it.id),
  }));

  // 4) Copia pratos
  const { data: pratosOrigem } = await supabase
    .from("evento_pratos").select("*").eq("evento_id", id);
  if (pratosOrigem?.length) {
    const novos = pratosOrigem.map(({ id: oldId, created_at, evento_id, ingredients, ...rest }) => ({
      ...rest, evento_id: novoId, ingredients: remap(ingredients),
    }));
    await supabase.from("evento_pratos").insert(novos);
  }

  // 5) Copia drinks
  const { data: drinksOrigem } = await supabase
    .from("evento_drinks").select("*").eq("evento_id", id);
  if (drinksOrigem?.length) {
    const novos = drinksOrigem.map(({ id: oldId, created_at, evento_id, ingredients, ...rest }) => ({
      ...rest, evento_id: novoId, ingredients: remap(ingredients),
    }));
    await supabase.from("evento_drinks").insert(novos);
  }

  // 6) Copia custos fixos
  const { data: custosOrigem } = await supabase
    .from("evento_custos_fixos").select("*").eq("evento_id", id);
  if (custosOrigem?.length) {
    const novos = custosOrigem.map(({ id: oldId, created_at, evento_id, ...rest }) => ({
      ...rest, evento_id: novoId,
    }));
    await supabase.from("evento_custos_fixos").insert(novos);
  }

  // (Reservas NÃO são duplicadas)
  return { data: criado, error: null };
}

/**
 * Importa drinks do cardápio regular.
 */
export async function importarDrinks(eventoId, drinksERP, drinksExistentes) {
  if (!isSupabaseReady()) return { count: 0, error: "Supabase não configurado" };
  const nomesExistentes = new Set((drinksExistentes || []).map((d) => d.nome.toLowerCase()));
  const novos = drinksERP
    .filter((d) => !nomesExistentes.has(d.nome.toLowerCase()))
    .map((d) => ({
      evento_id: eventoId,
      nome: d.nome,
      has_alcohol: d.tipo !== "Mocktail",
      is_extra: false,
      preco_venda: Number(d.preco_venda) || 0,
      descricao: d.descricao || null,
      ingredients: [],
    }));
  if (!novos.length) return { count: 0, error: null };
  const { error } = await supabase.from("evento_drinks").insert(novos);
  return { count: novos.length, error: error?.message || null };
}
