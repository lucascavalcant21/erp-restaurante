import { supabase, isSupabaseReady } from "./supabase";
import { salvarConta } from "./financeiro";

// ─── SERVIÇOS DE MANUTENÇÃO (prestadores de serviço) ─────────────────────────
// Cada serviço tem um status; ao FINALIZAR, gera recibo e lança no financeiro.

export const CATEGORIAS_MANUTENCAO = [
  "Elétrica", "Hidráulica", "Refrigeração", "Gás", "Equipamentos de cozinha",
  "Marcenaria", "Pintura", "Dedetização", "Ar-condicionado", "Informática", "Outros",
];

export async function fetchServicosManutencao(unidadeId, mesAno = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("manutencao_servicos").select("*").eq("unidade_id", unidadeId).order("data", { ascending: false });
  if (mesAno) {
    const [ano, mes] = String(mesAno).split("-").map(Number);
    const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
    q = q.gte("data", `${mesAno}-01`).lt("data", fim);
  }
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function salvarServicoManutencao(servico) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, ...campos } = servico;
  if (id) {
    const { error } = await supabase.from("manutencao_servicos").update(campos).eq("id", id);
    return { id, error: error?.message };
  }
  const { data, error } = await supabase.from("manutencao_servicos").insert([campos]).select("id").single();
  return { id: data?.id, error: error?.message };
}

export async function removerServicoManutencao(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("manutencao_servicos").delete().eq("id", id);
  return { error: error?.message };
}

// Finaliza um serviço: marca concluído, salva o recibo e lança no financeiro
// (categoria "manutencao"), sem duplicar se já foi lançado.
export async function finalizarServicoManutencao(servico, { recibo_texto }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const patch = { status: "concluido", recibo_texto: recibo_texto || servico.recibo_texto || null };

  // Lança no financeiro só uma vez
  if (!servico.conta_lancada) {
    const { error: errConta } = await salvarConta({
      unidade_id: servico.unidade_id,
      descricao: `Manutenção: ${servico.servico}${servico.prestador ? ` - ${servico.prestador}` : ""}`,
      valor: Number(servico.valor) || 0,
      data_vencimento: servico.data || new Date().toISOString().split("T")[0],
      categoria: "manutencao",
      status: (servico.forma_pagamento && servico.forma_pagamento !== "A pagar") ? "pago" : "pendente",
    });
    if (!errConta) patch.conta_lancada = true;
  }

  const { error } = await supabase.from("manutencao_servicos").update(patch).eq("id", servico.id);
  return { error: error?.message, contaLancada: patch.conta_lancada };
}
