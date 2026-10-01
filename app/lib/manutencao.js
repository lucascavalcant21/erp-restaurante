import { supabase, isSupabaseReady } from "./supabase";
import { lancarConta } from "./financeiro";

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

  // Lança no financeiro só uma vez, pela camada única de contas a pagar
  // (contas-pagar.mjs): a conta nasce pendente e, se o serviço declara que
  // já foi pago (forma de pagamento diferente de "A pagar"), o pagamento é
  // registrado na data do serviço, numa segunda operação verificada.
  let erroConta = null, erroPagamento = null;
  if (!servico.conta_lancada) {
    const declaradoPago = !!servico.forma_pagamento && servico.forma_pagamento !== "A pagar";
    const dataServico = String(servico.data || "").slice(0, 10) || null;
    const r = await lancarConta({
      unidade_id: servico.unidade_id,
      descricao: `Manutenção: ${servico.servico}${servico.prestador ? ` - ${servico.prestador}` : ""}`,
      valor: servico.valor,
      data_vencimento: dataServico,
      competencia: dataServico,
      categoria_codigo: "manutencao",
    }, {
      // chave pelo serviço: finalizar de novo não lança a conta duas vezes
      chave: `manutencao:${servico.id}`, origem_tipo: "MANUTENCAO",
      origem_id: /^[0-9a-f-]{36}$/i.test(String(servico.id)) ? servico.id : null,
      pagaEm: declaradoPago ? dataServico : null,
    });
    if (r.error) erroConta = r.error;
    else {
      patch.conta_lancada = true;
      erroPagamento = r.erroPagamento || null;
    }
  }

  const { error } = await supabase.from("manutencao_servicos").update(patch).eq("id", servico.id);
  return { error: error?.message, contaLancada: patch.conta_lancada, erroConta, erroPagamento };
}
