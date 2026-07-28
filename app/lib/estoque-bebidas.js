import { supabase, isSupabaseReady } from "./supabase";

// Camada cliente para o estoque de bebidas/embalados (saldo FECHADO x ABERTO).
// Chama as funções SQL criadas em db/migracao_estoque_bebidas.sql. Só use em
// itens fracionáveis (insumo.permite_fracionado). Enquanto a migração não for
// rodada, estas chamadas retornam erro — por isso a tela deve cair no fluxo
// atual (registrarMovimentoMulti) quando a função ainda não existe.

const err = (error) => error?.message || null;

// Entrada por unidade comercial (ex.: +3 garrafas).
export async function entradaBebidaUnidades({ unidadeId, estoqueId, insumoId, unidades, usuarioId = null, usuarioNome = "", observacao = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const n = Number(unidades);
  if (!Number.isFinite(n) || n <= 0) return { error: "Informe as unidades recebidas." };
  const { data, error } = await supabase.rpc("bebida_entrada_unidades", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId,
    p_unidades: n, p_usuario_id: usuarioId, p_usuario_nome: usuarioNome || null, p_observacao: observacao || null,
  });
  return { data: Array.isArray(data) ? data[0] : data, error: err(error) };
}

// Baixa por unidade fechada inteira.
export async function baixaBebidaUnidades({ unidadeId, estoqueId, insumoId, unidades, usuarioId = null, usuarioNome = "", observacao = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const n = Number(unidades);
  if (!Number.isFinite(n) || n <= 0) return { error: "Informe as unidades a baixar." };
  const { data, error } = await supabase.rpc("bebida_baixa_unidades", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId,
    p_unidades: n, p_usuario_id: usuarioId, p_usuario_nome: usuarioNome || null, p_observacao: observacao || null,
  });
  return { data: Array.isArray(data) ? data[0] : data, error: err(error) };
}

// Baixa por conteúdo (ml/g) — consome o aberto e abre garrafa automática.
export async function baixaBebidaConteudo({ unidadeId, estoqueId, insumoId, quantidade, usuarioId = null, usuarioNome = "", observacao = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const n = Number(quantidade);
  if (!Number.isFinite(n) || n <= 0) return { error: "Informe a quantidade a baixar." };
  const { data, error } = await supabase.rpc("bebida_baixa_conteudo", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId,
    p_qtd: n, p_usuario_id: usuarioId, p_usuario_nome: usuarioNome || null, p_observacao: observacao || null,
  });
  return { data: Array.isArray(data) ? data[0] : data, error: err(error) };
}

// Contagem com dois campos (fechadas + aberto).
export async function contagemBebida({ unidadeId, estoqueId, insumoId, fechadas, aberto, usuarioId = null, usuarioNome = "", observacao = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const f = Number(fechadas), a = Number(aberto);
  if (!Number.isFinite(f) || f < 0 || !Number.isFinite(a) || a < 0) return { error: "Contagem inválida." };
  const { data, error } = await supabase.rpc("bebida_contagem", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId,
    p_fechadas: f, p_aberto: a, p_usuario_id: usuarioId, p_usuario_nome: usuarioNome || null, p_observacao: observacao || null,
  });
  return { data: Array.isArray(data) ? data[0] : data, error: err(error) };
}

// Zerar produto (motivo obrigatório).
export async function zerarBebida({ unidadeId, estoqueId, insumoId, motivo, usuarioId = null, usuarioNome = "" }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!String(motivo || "").trim()) return { error: "Informe o motivo." };
  const { data, error } = await supabase.rpc("bebida_zerar", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId,
    p_motivo: motivo, p_usuario_id: usuarioId, p_usuario_nome: usuarioNome || null,
  });
  return { data: Array.isArray(data) ? data[0] : data, error: err(error) };
}

// Divide um total (conteúdo) em fechadas + aberto, dado o conteúdo por embalagem.
export function dividirSaldo(total, conteudo, permiteFracionado = true) {
  const c = Number(conteudo) || 1;
  const t = Number(total) || 0;
  if (c <= 1 || !permiteFracionado) return { fechadas: t, aberto: 0 };
  const fechadas = Math.floor(t / c);
  return { fechadas, aberto: +(t - fechadas * c).toFixed(3) };
}
