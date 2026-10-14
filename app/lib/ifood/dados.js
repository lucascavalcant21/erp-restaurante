// Acesso a dados dos pedidos do iFood pelo navegador.
//   - pedidos, associação de itens e separação: tabelas com RLS por unidade;
//   - sincronizar, reprocessar e preferências: rotas do servidor
//     (/api/ifood/*), que conferem sessão, unidade e permissão;
//   - baixa de estoque por pedido: marmitaria_baixar_pedidos, que passa por
//     estoque_movimentar com o usuário logado.
// Conta e regra ficam em nucleo.mjs.

import { supabase, isSupabaseReady } from "../supabase";

export const MSG_MIGRACAO_IFOOD = "O banco ainda não recebeu a atualização dos pedidos do iFood (IFOOD-2). Avise o administrador.";
const SEM_BANCO = "Sem conexão com o banco. Tente de novo.";
const faltaMigracao = (m) => /delivery_(pedidos|itens_mapeamento|repasses)|marmitaria_baixar_pedidos|could not find the function|PGRST202|PGRST205/i.test(String(m || ""));
const msg = (e) => {
  if (!e) return null;
  const m = String(e.message || e || "");
  if (faltaMigracao(m)) return MSG_MIGRACAO_IFOOD;
  if (/row-level security|permission denied/i.test(m)) return "Sem permissão nesta unidade.";
  if (/Failed to fetch|NetworkError|network|timeout/i.test(m)) return SEM_BANCO;
  return m;
};

/** Chamada autenticada às rotas /api/ifood/*. Nunca envia nem recebe segredo. */
export async function chamarApi(rota, metodo, corpo, unidadeId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { ok: false, erro: "Sessão expirada: entre de novo." };
  const url = metodo === "GET" ? `${rota}?unidadeId=${encodeURIComponent(unidadeId)}` : rota;
  try {
    const res = await fetch(url, {
      method: metodo, headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify({ ...corpo, unidadeId }) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? d : { ok: false, ...d, erro: d.erro || `Erro ${res.status}` };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

const NUM = ["subtotal", "taxa_entrega", "descontos_loja", "beneficios_canal", "taxas_adicionais", "valor_pedido"];

export async function fetchPedidos(unidadeId, de, ate) {
  if (!isSupabaseReady()) return { data: [], error: SEM_BANCO };
  let q = supabase.from("delivery_pedidos").select("id, canal, pedido_externo_id, display_id, status, status_canal, confirmado, preparo_iniciado, tipo, agendado, agendado_para, criado_no_canal_em, data_operacao, cliente_nome, itens, subtotal, taxa_entrega, descontos_loja, beneficios_canal, taxas_adicionais, valor_pedido, entregue_por, teste, detalhes_carregados, cancelamento, separacao, estoque_aplicado, estoque_versao, estoque_atualizado_em")
    .eq("unidade_id", unidadeId).eq("canal", "ifood");
  if (de) q = q.gte("data_operacao", de);
  if (ate) q = q.lte("data_operacao", ate);
  const { data, error } = await q.order("criado_no_canal_em", { ascending: false }).limit(500);
  return {
    data: (data || []).map((p) => ({ ...p, ...Object.fromEntries(NUM.map((k) => [k, p[k] == null ? null : Number(p[k])])) })),
    error: msg(error), migracaoPendente: faltaMigracao(error?.message),
  };
}

export async function fetchMapeamento(unidadeId) {
  if (!isSupabaseReady()) return { data: new Map(), error: SEM_BANCO };
  const { data, error } = await supabase.from("delivery_itens_mapeamento").select("codigo_externo, nome_externo, ficha_id, quantidade_por_item, ignorar")
    .eq("unidade_id", unidadeId).eq("canal", "ifood");
  return { data: new Map((data || []).map((m) => [m.codigo_externo, { ...m, quantidade_por_item: Number(m.quantidade_por_item) || 1 }])), error: msg(error) };
}

/** Associa (ou desassocia) um item do iFood a uma marmita. escolha: id da ficha | "ignorar" | "" */
export async function salvarMapeamento(unidadeId, { codigo, nome, escolha, quantidadePorItem = 1 }) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!escolha) {
    const { error } = await supabase.from("delivery_itens_mapeamento").delete().eq("unidade_id", unidadeId).eq("canal", "ifood").eq("codigo_externo", codigo);
    return { error: msg(error) };
  }
  const { error } = await supabase.from("delivery_itens_mapeamento").upsert({
    unidade_id: unidadeId, canal: "ifood", codigo_externo: codigo, nome_externo: nome || null,
    ficha_id: escolha === "ignorar" ? null : escolha, ignorar: escolha === "ignorar",
    quantidade_por_item: Number(quantidadePorItem) > 0 ? Number(quantidadePorItem) : 1, updated_at: new Date().toISOString(),
  }, { onConflict: "unidade_id,canal,codigo_externo" });
  return { error: msg(error) };
}

export async function marcarSeparacao(pedidoId, separado) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { error } = await supabase.from("delivery_pedidos").update({ separacao: separado ? "separado" : "pendente" }).eq("id", pedidoId);
  return { error: msg(error) };
}

/** pedidos: [{ pedido_id, versao, aplicado, movimentos }] */
export async function baixarPedidos(unidadeId, pedidos) {
  if (!isSupabaseReady()) return { data: null, error: SEM_BANCO };
  try {
    const { data, error } = await supabase.rpc("marmitaria_baixar_pedidos", { p_dados: { unidade_id: unidadeId, pedidos } });
    return { data, error: msg(error) };
  } catch (e) {
    return { data: null, error: msg(e) };
  }
}

export async function fetchRepasses(unidadeId, de, ate) {
  if (!isSupabaseReady()) return { data: [], error: SEM_BANCO };
  let q = supabase.from("delivery_repasses").select("referencia_externa, tipo, status, competencia, data_pagamento, valor").eq("unidade_id", unidadeId).eq("canal", "ifood");
  if (de) q = q.gte("data_pagamento", de);
  if (ate) q = q.lte("data_pagamento", ate);
  const { data, error } = await q;
  return { data: (data || []).map((r) => ({ ...r, valor: Number(r.valor) })), error: msg(error), migracaoPendente: faltaMigracao(error?.message) };
}
