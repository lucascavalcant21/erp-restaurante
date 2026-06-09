import { supabase, isSupabaseReady } from "./supabase";

export const FORNECEDORES_SEED = [
  { id: "f1", nome: "Frigorifico São Paulo", segmento: "Carnes", contato: "João Silva", telefone: "(11) 98765-4321", email: "joao@frigorificosaopaulo.com.br", cidade: "São Paulo, SP", forma_pagamento: "Boleto 7d", pedido_minimo: 200, ultima_compra: "2026-05-28", total_compras: 4800, ativo: true, estrelas: 5 },
  { id: "f2", nome: "Distribuidora GrãoVerde", segmento: "Grãos e Cereais", contato: "Maria Souza", telefone: "(11) 91234-5678", email: "compras@graoverde.com", cidade: "Campinas, SP", forma_pagamento: "Boleto 15d", pedido_minimo: 150, ultima_compra: "2026-05-30", total_compras: 3200, ativo: true, estrelas: 4 },
  { id: "f3", nome: "Embal Express", segmento: "Embalagens", contato: "Carlos Lima", telefone: "(11) 94444-3333", email: "vendas@embalexpress.com", cidade: "Santo André, SP", forma_pagamento: "À Vista", pedido_minimo: 100, ultima_compra: "2026-06-01", total_compras: 1500, ativo: true, estrelas: 3 },
];

export async function fetchFornecedores() {
  if (!isSupabaseReady()) return { data: FORNECEDORES_SEED, fromSeed: true };
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  if (error || !data?.length) return { data: FORNECEDORES_SEED, fromSeed: true };
  return { data, fromSeed: false };
}

export async function inserirFornecedor(forn) {
  if (!isSupabaseReady()) return { data: { ...forn, id: `f${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("fornecedores").insert([forn]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarFornecedor(id, updates) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("fornecedores").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerFornecedor(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  return { error: error?.message || null };
}
