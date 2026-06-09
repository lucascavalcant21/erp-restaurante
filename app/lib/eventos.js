import { supabase, isSupabaseReady } from "./supabase";

export const EVENTOS_SEED = [
  { id: "ev1", nome: "Casamento Silva & Costa", tipo: "Casamento", status: "Confirmado", data: "2026-07-12T18:00", local: "Salão Villa Bella", responsavel: "Ana Torres", convidados: 120, valor_contrato: 8500, custo_estimado: 4200, observacoes: "Cardápio executivo + barra de doces" },
  { id: "ev2", nome: "Aniversário 50 anos João", tipo: "Aniversário", status: "Pendente", data: "2026-06-20T20:00", local: "Residência do cliente", responsavel: "Lucas Cavalcante", convidados: 60, valor_contrato: 3200, custo_estimado: 1800, observacoes: "Confirmar cardápio até 15/06" },
  { id: "ev3", nome: "Confraternização Empresa XYZ", tipo: "Corporativo", status: "Concluído", data: "2026-05-15T12:00", local: "Sede da empresa", responsavel: "Maria Souza", convidados: 80, valor_contrato: 4000, custo_estimado: 2100, observacoes: "Almoço executivo — pago" },
];

export async function fetchEventos() {
  if (!isSupabaseReady()) return { data: EVENTOS_SEED, fromSeed: true };
  const { data, error } = await supabase.from("eventos").select("*").order("data", { ascending: true });
  if (error || !data?.length) return { data: EVENTOS_SEED, fromSeed: true };
  return { data, fromSeed: false };
}

export async function inserirEvento(ev) {
  if (!isSupabaseReady()) return { data: { ...ev, id: `ev${Date.now()}` }, error: null };
  const { data, error } = await supabase.from("eventos").insert([ev]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarEvento(id, updates) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("eventos").update(updates).eq("id", id);
  return { error: error?.message || null };
}

export async function removerEvento(id) {
  if (!isSupabaseReady()) return { error: null };
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  return { error: error?.message || null };
}
