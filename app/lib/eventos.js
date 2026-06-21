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

// Categorias para alimentos / Cozinha
export const CATEGORIAS_ING_FOOD = [
  { id: "carnes_vermelhas", label: "Carnes Vermelhas", cor: "#DC2626" },
  { id: "aves",             label: "Aves",              cor: "#F59E0B" },
  { id: "peixes",           label: "Peixes e Frutos do Mar", cor: "#0EA5E9" },
  { id: "suinos",           label: "Suínos",            cor: "#EC4899" },
  { id: "embutidos",        label: "Embutidos",         cor: "#A855F7" },
  { id: "vegetais",         label: "Vegetais e Verduras", cor: "#22C55E" },
  { id: "frutas",           label: "Frutas",            cor: "#EF4444" },
  { id: "cereais",          label: "Cereais e Grãos",   cor: "#CA8A04" },
  { id: "massas",           label: "Massas",            cor: "#EAB308" },
  { id: "paes",             label: "Pães",              cor: "#A16207" },
  { id: "laticinios",       label: "Laticínios",        cor: "#FBBF24" },
  { id: "ovos",             label: "Ovos",              cor: "#FCD34D" },
  { id: "temperos",         label: "Temperos e Ervas",  cor: "#10B981" },
  { id: "oleos",            label: "Óleos e Vinagres",  cor: "#84CC16" },
  { id: "conservas",        label: "Conservas",         cor: "#78716C" },
  { id: "doces",            label: "Doces e Sobremesas", cor: "#F472B6" },
  { id: "outros",           label: "Outros",            cor: "#6B7280" },
];

// Categorias para ingredientes do Bar
export const CATEGORIAS_ING_BAR = [
  { id: "destilados",   label: "Destilados",         cor: "#92400E" },
  { id: "vinhos",       label: "Vinhos",             cor: "#7F1D1D" },
  { id: "cervejas",     label: "Cervejas",           cor: "#CA8A04" },
  { id: "espumantes",   label: "Espumantes",         cor: "#FBBF24" },
  { id: "licores",      label: "Licores",            cor: "#A16207" },
  { id: "xaropes",      label: "Xaropes",            cor: "#EC4899" },
  { id: "sucos",        label: "Sucos",              cor: "#F97316" },
  { id: "refrigerantes", label: "Refrigerantes e Mixers", cor: "#3B82F6" },
  { id: "aguas",        label: "Águas",              cor: "#0EA5E9" },
  { id: "frutas_decor", label: "Frutas e Decorações", cor: "#22C55E" },
  { id: "aromaticos",   label: "Aromáticos",         cor: "#10B981" },
  { id: "laticinios_bar", label: "Laticínios",       cor: "#FCD34D" },
  { id: "doces_bar",    label: "Adoçantes",          cor: "#F472B6" },
  { id: "outros_bar",   label: "Outros",             cor: "#6B7280" },
];

export function getCategoriaIng(id, tipo) {
  const lista = tipo === "bar" ? CATEGORIAS_ING_BAR : CATEGORIAS_ING_FOOD;
  return lista.find((c) => c.id === id);
}

// Unidades suportadas (com conversão pra base g/ml)
export const UNIDADES_ING = [
  { id: "g",  label: "g",  base: "g",  fator: 1 },
  { id: "Kg", label: "Kg", base: "g",  fator: 1000 },
  { id: "ml", label: "ml", base: "ml", fator: 1 },
  { id: "L",  label: "L",  base: "ml", fator: 1000 },
  { id: "un", label: "un", base: "un", fator: 1 },
];

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

// ─── Compras realizadas ──────────────────────────────────────────────────
export const Compras = {
  list: (eId) => fetchList("evento_compras", eId, "created_at"),
  /**
   * Upsert: cria ou atualiza compra de um ingrediente.
   * Usa o unique (evento_id, ingrediente_id) como chave.
   */
  upsert: async (eventoId, ingredienteId, patch) => {
    if (!isSupabaseReady()) return { error: "Supabase não configurado" };
    const { error } = await supabase
      .from("evento_compras")
      .upsert(
        {
          evento_id: eventoId,
          ingrediente_id: ingredienteId,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "evento_id,ingrediente_id" },
      );
    if (error) console.error("[eventos] upsert compra:", error.message);
    return { error: error?.message || null };
  },
  remove: (id) => removeOne("evento_compras", id),
};

// ─── Sugestões de quantidade por porção ──────────────────────────────────
/**
 * Detecta categoria do ingrediente pelo nome e retorna sugestão de qty/porção.
 * Retorna { min, max, unidade } baseado em padrões da indústria.
 */
const SUGESTOES_QTD = [
  // Carnes nobres (filé, picanha, mignon, costela)
  { keywords: ["picanha", "filé mignon", "file mignon", "filet"], min: 180, max: 220, unidade: "g", categoria: "Carne nobre" },
  { keywords: ["alcatra", "maminha", "fraldinha", "contrafilé", "costela"], min: 200, max: 250, unidade: "g", categoria: "Carne bovina" },
  { keywords: ["carne", "boi", "boeuf", "wellington"], min: 180, max: 220, unidade: "g", categoria: "Carne bovina" },
  { keywords: ["frango", "peito", "coxa", "sobrecoxa"], min: 150, max: 200, unidade: "g", categoria: "Aves" },
  { keywords: ["porco", "lombo", "pernil", "bacon"], min: 150, max: 200, unidade: "g", categoria: "Suínos" },
  { keywords: ["salmão", "salmao", "atum", "robalo", "linguado", "tilapia", "tilápia", "peixe"], min: 150, max: 200, unidade: "g", categoria: "Peixes" },
  { keywords: ["camarão", "camarao", "lagosta", "polvo", "lula"], min: 100, max: 150, unidade: "g", categoria: "Frutos do mar" },

  // Massas e arrozes
  { keywords: ["arroz", "risoto", "risotto"], min: 80, max: 120, unidade: "g", categoria: "Carboidrato" },
  { keywords: ["massa", "macarrão", "macarrao", "spaghetti", "penne", "fettuccine", "ravioli"], min: 90, max: 120, unidade: "g", categoria: "Massa" },
  { keywords: ["batata", "purê", "pure"], min: 150, max: 200, unidade: "g", categoria: "Acompanhamento" },
  { keywords: ["farofa"], min: 50, max: 80, unidade: "g", categoria: "Acompanhamento" },

  // Vegetais e saladas
  { keywords: ["salada", "alface", "rúcula", "rucula", "espinafre", "agrião"], min: 60, max: 100, unidade: "g", categoria: "Folhas" },
  { keywords: ["legume", "cenoura", "abobrinha", "berinjela", "brócolis"], min: 80, max: 120, unidade: "g", categoria: "Legumes" },

  // Sobremesas
  { keywords: ["sobremesa", "mousse", "pudim", "torta", "bolo", "cheesecake", "tiramisu"], min: 100, max: 150, unidade: "g", categoria: "Sobremesa" },
  { keywords: ["sorvete", "gelato"], min: 80, max: 120, unidade: "g", categoria: "Sobremesa" },
  { keywords: ["fruta", "morango", "framboesa", "mirtilo"], min: 50, max: 100, unidade: "g", categoria: "Frutas" },

  // Bebidas (bar)
  { keywords: ["destilado", "vodka", "gin", "rum", "tequila", "whisky", "whiskey", "conhaque"], min: 40, max: 60, unidade: "ml", categoria: "Destilado (dose)" },
  { keywords: ["licor", "xarope"], min: 15, max: 30, unidade: "ml", categoria: "Licor/Xarope" },
  { keywords: ["vinho"], min: 120, max: 180, unidade: "ml", categoria: "Vinho" },
  { keywords: ["cerveja"], min: 300, max: 600, unidade: "ml", categoria: "Cerveja" },
  { keywords: ["champagne", "espumante", "prosecco"], min: 100, max: 150, unidade: "ml", categoria: "Espumante" },
  { keywords: ["tônica", "tonica", "soda", "refrigerante", "água tônica"], min: 150, max: 250, unidade: "ml", categoria: "Mixer" },
  { keywords: ["suco"], min: 100, max: 200, unidade: "ml", categoria: "Suco" },
  { keywords: ["leite", "creme"], min: 50, max: 100, unidade: "ml", categoria: "Lácteo" },
  { keywords: ["limão", "limao", "lima"], min: 10, max: 20, unidade: "ml", categoria: "Cítrico" },
  { keywords: ["açúcar", "acucar", "mel"], min: 5, max: 15, unidade: "g", categoria: "Adoçante" },
  { keywords: ["hortelã", "hortela", "manjericão", "canela"], min: 2, max: 8, unidade: "g", categoria: "Aromático" },
];

export function sugestaoQuantidade(nomeIngrediente) {
  const n = (nomeIngrediente || "").toLowerCase();
  for (const s of SUGESTOES_QTD) {
    if (s.keywords.some((k) => n.includes(k))) {
      return { min: s.min, max: s.max, unidade: s.unidade, categoria: s.categoria };
    }
  }
  return null;
}

// ─── Parser de Lista de Ingredientes (texto livre → estruturado) ────────
/**
 * Detecta categoria de ingrediente pelo nome (food).
 */
const CATEGORIA_KEYWORDS_FOOD = [
  { id: "carnes_vermelhas", k: ["picanha", "filé mignon", "file mignon", "filet", "alcatra", "maminha", "fraldinha", "contrafilé", "costela", "carne moída", "moida", "boi"] },
  { id: "aves",             k: ["frango", "galinha", "peito de frango", "coxa", "sobrecoxa", "asa", "peru", "pato"] },
  { id: "peixes",           k: ["salmão", "salmao", "atum", "robalo", "linguado", "tilápia", "tilapia", "merluza", "peixe", "camarão", "camarao", "lagosta", "polvo", "lula", "ostras"] },
  { id: "suinos",           k: ["porco", "lombo", "pernil", "bacon", "linguiça", "linguica", "calabresa"] },
  { id: "embutidos",        k: ["presunto", "salame", "mortadela", "salsicha"] },
  { id: "vegetais",         k: ["alface", "rúcula", "rucula", "espinafre", "tomate", "cebola", "alho", "batata", "cenoura", "abobrinha", "berinjela", "brócolis", "brocolis", "couve", "agrião", "agriao", "pimentão", "pimentao", "pepino"] },
  { id: "frutas",           k: ["morango", "framboesa", "mirtilo", "maçã", "maca", "banana", "laranja", "abacaxi", "manga", "uva", "kiwi", "melão", "melao", "pêssego", "pessego"] },
  { id: "cereais",          k: ["arroz", "feijão", "feijao", "lentilha", "grão de bico", "quinoa", "aveia"] },
  { id: "massas",           k: ["macarrão", "macarrao", "spaghetti", "penne", "fettuccine", "ravioli", "lasanha", "massa", "talharim"] },
  { id: "paes",             k: ["pão", "pao", "baguete", "ciabatta", "brioche", "torrada"] },
  { id: "laticinios",       k: ["leite", "queijo", "muçarela", "mussarela", "parmesão", "parmesao", "iogurte", "manteiga", "creme de leite", "ricota", "gorgonzola"] },
  { id: "ovos",             k: ["ovo", "ovos"] },
  { id: "temperos",         k: ["sal", "pimenta", "orégano", "oregano", "manjericão", "manjericao", "alecrim", "tomilho", "louro", "cominho", "páprika", "paprika", "açafrão", "acafrao"] },
  { id: "oleos",            k: ["óleo", "oleo", "azeite", "vinagre"] },
  { id: "conservas",        k: ["conserva", "milho", "ervilha", "azeitona", "palmito"] },
  { id: "doces",            k: ["açúcar", "acucar", "chocolate", "mel", "geleia", "sorvete", "creme", "mousse", "pudim"] },
];

const CATEGORIA_KEYWORDS_BAR = [
  { id: "destilados",    k: ["vodka", "gin", "rum", "tequila", "whisky", "whiskey", "conhaque", "cachaça", "cachaca"] },
  { id: "vinhos",         k: ["vinho", "tinto", "branco", "rosé", "rose"] },
  { id: "cervejas",       k: ["cerveja", "ipa", "pilsen", "stout", "weiss", "lager"] },
  { id: "espumantes",     k: ["champagne", "espumante", "prosecco", "champanhe"] },
  { id: "licores",        k: ["licor"] },
  { id: "xaropes",        k: ["xarope", "grenadine", "curaçau", "curacau"] },
  { id: "sucos",          k: ["suco", "néctar", "nectar"] },
  { id: "refrigerantes",  k: ["refrigerante", "tônica", "tonica", "soda", "coca", "guaraná", "guarana", "sprite", "fanta", "água tônica", "agua tonica"] },
  { id: "aguas",          k: ["água", "agua"] },
  { id: "frutas_decor",   k: ["limão", "limao", "lima", "laranja", "abacaxi", "morango", "cereja"] },
  { id: "aromaticos",     k: ["hortelã", "hortela", "manjericão", "manjericao", "canela", "alecrim"] },
  { id: "laticinios_bar", k: ["leite", "creme"] },
  { id: "doces_bar",      k: ["açúcar", "acucar", "mel"] },
];

export function detectarCategoria(nome, tipo) {
  const n = (nome || "").toLowerCase();
  const lista = tipo === "bar" ? CATEGORIA_KEYWORDS_BAR : CATEGORIA_KEYWORDS_FOOD;
  for (const cat of lista) {
    if (cat.k.some((kw) => n.includes(kw))) return cat.id;
  }
  return tipo === "bar" ? "outros_bar" : "outros";
}

/**
 * Parser de linha única: "Picanha 65 R$/Kg" → { nome, custo_unit, peso_unit, unidade }
 *
 * Regras de detecção:
 * - Procura preço (números com R$, vírgula ou ponto)
 * - Procura unidade explícita (Kg, kg, g, L, ml, un)
 * - Procura quantidade (número antes da unidade)
 * - Resto = nome
 *
 * Exemplos suportados:
 *   "Picanha 65 reais o kg"
 *   "Picanha - 65,00/kg"
 *   "Vinho tinto suave R$ 35 - 750ml"
 *   "Tônica 6,50 - 350ml"
 *   "Filé mignon 95"
 *   "Salmão 110/kg"
 */
export function parseIngredienteLinha(linha, tipo = "food") {
  if (!linha || !linha.trim()) return null;
  let texto = linha.trim();

  // Detecta unidade (com precedência: Kg/L > g/ml/un)
  let unidade = null;
  let qtd = null;

  // Procura padrão "número + unidade" ou "/unidade"
  const padraoComQtd = /(\d+(?:[.,]\d+)?)\s*(kg|Kg|KG|L|l|g|ml|ML|un|UN)\b/;
  const padraoSoUnid = /\/\s*(kg|Kg|KG|L|l|g|ml|ML|un|UN)\b/i;
  const padraoUnidPosicao = /\b(kg|Kg|KG|L|l|g|ml|ML|un|UN)\b/;

  const matchComQtd = texto.match(padraoComQtd);
  if (matchComQtd) {
    qtd = parseFloat(matchComQtd[1].replace(",", "."));
    unidade = matchComQtd[2].toLowerCase();
    texto = texto.replace(matchComQtd[0], "").trim();
  } else {
    const matchSo = texto.match(padraoSoUnid);
    if (matchSo) {
      unidade = matchSo[1].toLowerCase();
      texto = texto.replace(matchSo[0], "").trim();
    } else {
      const matchPos = texto.match(padraoUnidPosicao);
      if (matchPos) {
        unidade = matchPos[1].toLowerCase();
        texto = texto.replace(matchPos[0], "").trim();
      }
    }
  }

  // Normaliza unidade
  if (unidade === "kg") unidade = "Kg";
  if (unidade === "l")  unidade = "L";

  // Procura preço (R$ X,XX ou apenas X,XX após "reais" / no fim)
  let preco = null;
  // Tenta capturar com R$
  const padraoComRS = /R\$\s*(\d+(?:[.,]\d+)?)/i;
  const matchRS = texto.match(padraoComRS);
  if (matchRS) {
    preco = parseFloat(matchRS[1].replace(",", "."));
    texto = texto.replace(matchRS[0], "").trim();
  } else {
    // Procura número solto (último número da linha geralmente é o preço)
    const todosNumeros = texto.match(/\d+(?:[.,]\d+)?/g);
    if (todosNumeros && todosNumeros.length > 0) {
      preco = parseFloat(todosNumeros[todosNumeros.length - 1].replace(",", "."));
      texto = texto.replace(new RegExp(todosNumeros[todosNumeros.length - 1] + "(?!.*" + todosNumeros[todosNumeros.length - 1].replace(/[.,]/g, "[.,]") + ")"), "").trim();
    }
  }

  // Limpa lixo (R$, reais, /, -, "o", "por", "a", etc)
  let nome = texto
    .replace(/\b(reais?|real|R\$|por|o|a|os|as|de|do|da)\b/gi, "")
    .replace(/[\/\-—–]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Default se nada foi achado
  if (!unidade) unidade = tipo === "bar" ? "ml" : "g";
  if (!qtd) qtd = unidade === "Kg" || unidade === "L" ? 1 : (tipo === "bar" ? 750 : 1000);
  if (!preco) preco = 0;

  if (!nome) return null;

  return {
    nome,
    custo_unit: preco,
    peso_unit: qtd,
    unidade,
    categoria: detectarCategoria(nome, tipo),
    tipo,
  };
}

/**
 * Parse de lista (várias linhas).
 */
export function parseIngredientesLista(texto, tipo = "food") {
  if (!texto) return [];
  return texto
    .split(/\r?\n/)
    .map((l) => parseIngredienteLinha(l, tipo))
    .filter(Boolean);
}

// ─── Parser de RECEITA (mais sofisticado, lida com colher/xícara/frações) ─

// Equivalências aproximadas pra converter medidas culinárias em g/ml
const MEDIDAS_CONVERSAO = [
  // Xícaras (chá padrão = 240ml)
  { regex: /x[íi]caras?(?:\s*\(ch[áa]\))?/i, valor: 240, unidade: "ml" },
  { regex: /x[íi]caras?\s*\(caf[ée]\)/i,     valor: 60,  unidade: "ml" },
  // Colheres
  { regex: /colher(?:es)?\s*(?:\(sopa\)|de\s*sopa)?/i, valor: 15, unidade: "ml" },
  { regex: /colher(?:es)?\s*\(ch[áa]\)|colher(?:es)?\s*de\s*ch[áa]/i, valor: 5, unidade: "ml" },
  { regex: /colher(?:es)?\s*\(caf[ée]\)|colher(?:es)?\s*de\s*caf[ée]/i, valor: 2.5, unidade: "ml" },
  // Outras
  { regex: /pitadas?/i,    valor: 0.5, unidade: "g" },
  { regex: /punhados?/i,   valor: 30,  unidade: "g" },
  { regex: /copos?/i,      valor: 200, unidade: "ml" },
  { regex: /lat(?:a|inha)s?/i, valor: 350, unidade: "ml" },
  { regex: /garrafas?/i,   valor: 600, unidade: "ml" },
  { regex: /a\s*gosto/i,   valor: 1,   unidade: "g", aGosto: true },
];

// Converte frações em decimal: "1/2", "3/4", etc
function parseNumeroComFracao(s) {
  if (!s) return 0;
  s = String(s).trim().replace(",", ".");
  // Mista: "1 1/2" → 1.5
  const mista = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mista) return Number(mista[1]) + Number(mista[2]) / Number(mista[3]);
  // Pura: "1/2"
  const fracao = s.match(/^(\d+)\/(\d+)$/);
  if (fracao) return Number(fracao[1]) / Number(fracao[2]);
  // Decimal/inteiro
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse de UMA linha de ingrediente de receita.
 * Exemplos suportados:
 *   "200g de farinha"
 *   "1 xícara (chá) de leite"
 *   "2 colheres (sopa) de açúcar"
 *   "1/2 cebola picada"
 *   "3 ovos"
 *   "1 kg de carne moída"
 *   "1L de leite"
 *   "Sal a gosto"
 *
 * Retorna: { qty, unidade, nome, originalLinha, aGosto }
 */
export function parseIngredienteReceita(linha) {
  if (!linha || !linha.trim()) return null;
  const original = linha.trim();
  let texto = original;

  // Remove marcadores de lista (-, *, •, números)
  texto = texto.replace(/^[-*•·–—]\s*/, "").replace(/^\d+[\.\)]\s+/, "").trim();
  if (!texto) return null;

  // 1) Detecta "a gosto"
  if (/a\s*gosto/i.test(texto)) {
    const nome = texto.replace(/a\s*gosto/i, "").replace(/^de\s+/i, "").trim();
    return { qty: 0, unidade: "g", nome, originalLinha: original, aGosto: true };
  }

  // 2) Extrai número (incluindo frações: 1/2, 1 1/2, 2.5, 3,75)
  const padraoNumero = /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:[.,]\d+)?)/;
  const matchN = texto.match(padraoNumero);
  let qty = 1;
  if (matchN) {
    qty = parseNumeroComFracao(matchN[1]);
    texto = texto.slice(matchN[0].length).trim();
  }

  // 3) Detecta unidade explícita (g, Kg, ml, L)
  let unidade = null;
  const matchUnidExplicita = texto.match(/^(kg|Kg|KG|g|G|ml|ML|L|l)\b/);
  if (matchUnidExplicita) {
    unidade = matchUnidExplicita[1].toLowerCase();
    texto = texto.slice(matchUnidExplicita[0].length).trim();
    if (unidade === "kg") unidade = "Kg";
    if (unidade === "l")  unidade = "L";
  }

  // 4) Detecta medida culinária (colher, xícara, etc)
  if (!unidade) {
    for (const m of MEDIDAS_CONVERSAO) {
      const match = texto.match(m.regex);
      if (match) {
        qty = qty * m.valor;
        unidade = m.unidade;
        texto = texto.replace(m.regex, "").trim();
        break;
      }
    }
  }

  // 5) Default: se ainda não tem unidade, é "un"
  if (!unidade) {
    unidade = "un";
  }

  // 6) Limpa preposições e palavras irrelevantes
  let nome = texto
    .replace(/^(de|do|da|dos|das)\s+/i, "")
    .replace(/\s*(picad[oa]s?|fatiad[oa]s?|ralad[oa]s?|cortad[oa]s?|amassad[oa]s?|inteir[oa]s?|fresc[oa]s?)\s*$/i, "")
    .replace(/\s+a\s+gosto$/i, "")
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!nome) return null;

  return { qty, unidade, nome, originalLinha: original };
}

/**
 * Parse de receita inteira:
 * Retorna { titulo, ingredientes, modo_preparo, rendimento }
 */
export function parseReceita(texto) {
  if (!texto) return null;
  const linhas = texto.split(/\r?\n/);

  let titulo = "";
  let rendimento = null;
  const ingredientes = [];
  const modoPreparo = [];

  // Estado de parsing
  let secao = "indef"; // 'titulo' | 'ingredientes' | 'preparo' | 'indef'
  let viuTitulo = false;

  for (const linha of linhas) {
    const l = linha.trim();
    if (!l) continue;

    // Detecta cabeçalhos de seção
    const isCabIng = /^ingredientes?:?$/i.test(l) || /^lista\s+de\s+ingredientes/i.test(l);
    const isCabPrep = /^(modo\s+de\s+preparo|preparo|instruções|instrucoes|como\s+fazer|prepara[çc][ãa]o)/i.test(l);

    if (isCabIng)  { secao = "ingredientes"; continue; }
    if (isCabPrep) { secao = "preparo";      continue; }

    // Detecta rendimento (porções)
    const matchRend = l.match(/(?:rendimento|rende|porc(?:o|õ)es)[:\s]*(\d+)/i);
    if (matchRend) { rendimento = Number(matchRend[1]); continue; }

    // Se ainda não viu título, primeira linha não-vazia que não parece ingrediente vira título
    if (!viuTitulo && secao === "indef") {
      // Se a linha começa com número/marcador, é provavelmente ingrediente
      if (!/^[-*•·–—]\s*/.test(l) && !/^\d+\s*[gkl]/i.test(l) && !/^\d+\s*x[íi]cara/i.test(l) && l.length < 80) {
        titulo = l;
        viuTitulo = true;
        continue;
      }
      secao = "ingredientes"; // assume ingredientes se cair fora
    }

    if (secao === "ingredientes") {
      const ing = parseIngredienteReceita(l);
      if (ing) ingredientes.push(ing);
    } else if (secao === "preparo") {
      modoPreparo.push(l);
    } else if (secao === "indef") {
      // Tenta detectar se é ingrediente
      const ing = parseIngredienteReceita(l);
      if (ing && ing.qty > 0) ingredientes.push(ing);
    }
  }

  return {
    titulo,
    rendimento,
    ingredientes,
    modo_preparo: modoPreparo.join("\n"),
  };
}

/**
 * Normaliza nome de ingrediente para comparação (lowercase, sem acentos, sem plurais simples).
 */
function normalizarNome(nome) {
  return (nome || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cruza ingredientes da receita com os existentes no evento.
 * Retorna ingredientes da receita com flag `existe` e `ingredienteId` (se existir).
 */
export function cruzarReceitaComEstoque(ingredientesReceita, ingredientesEvento) {
  return ingredientesReceita.map((ing) => {
    const nomeNorm = normalizarNome(ing.nome);
    // Match: nome igual ou nome contém uma das palavras-chave principais
    const existe = ingredientesEvento.find((ie) => {
      const ieNorm = normalizarNome(ie.nome);
      if (ieNorm === nomeNorm) return true;
      // Match parcial: nome do evento contido na receita ou vice-versa
      const palavrasReceita = nomeNorm.split(" ").filter((p) => p.length > 3);
      const palavrasEvento = ieNorm.split(" ").filter((p) => p.length > 3);
      return palavrasReceita.some((p) => ieNorm.includes(p)) || palavrasEvento.some((p) => nomeNorm.includes(p));
    });
    return {
      ...ing,
      existe: !!existe,
      ingredienteId: existe?.id || null,
      ingredienteCadastrado: existe || null,
    };
  });
}

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
