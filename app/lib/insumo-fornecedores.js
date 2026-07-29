import { supabase, isSupabaseReady } from "./supabase";
import { calcularPrecoNormalizado } from "./ingredientes-utils.mjs";

// Preço por fornecedor de um ingrediente. Cada fornecedor tem seu próprio preço
// e embalagem; o fornecedor "atual" (insumos.fornecedor_atual_id) define o custo
// usado nas fichas/estoque. Histórico por fornecedor vive em
// insumos_precos_historico (coluna fornecedor_id).
// Enquanto a migração (db/migracao_insumo_fornecedor_precos.sql) não for rodada,
// as funções degradam em silêncio (retornam "sem_migracao").

function semMigracao(e) {
  const m = (e?.message || e || "").toString().toLowerCase();
  return m.includes("preco") && (m.includes("column") || m.includes("does not exist"))
    || m.includes("could not find") || m.includes("schema cache");
}

// Preços cadastrados por fornecedor para um ingrediente.
export async function fetchPrecosDoInsumo(insumoId) {
  if (!isSupabaseReady() || !insumoId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("insumos_fornecedores")
    .select("id, insumo_id, fornecedor_id, preco, tamanho_embalagem, unidade_embalagem, preco_normalizado, atualizado_em, fornecedor:fornecedores(id, nome)")
    .eq("insumo_id", insumoId);
  if (error) return { data: [], error: semMigracao(error) ? "sem_migracao" : (error.message || "erro") };
  return { data: (data || []).map(r => ({ ...r, fornecedor: Array.isArray(r.fornecedor) ? r.fornecedor[0] : r.fornecedor })), error: null };
}

// Grava/atualiza o preço de UM fornecedor para o ingrediente (upsert) e, se o
// preço mudou, registra no histórico daquele fornecedor.
export async function salvarPrecoFornecedor({
  unidadeId, insumoId, insumoNome = "", fornecedorId, fornecedorNome = "",
  preco, tamanho, unidade, usuario = null,
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!insumoId || !fornecedorId) return { error: "Ingrediente e fornecedor são obrigatórios." };
  const valor = Number(preco) || 0;
  const tam = Number(tamanho) || 1;
  const normalizado = calcularPrecoNormalizado(tam, unidade, valor);

  // Preço anterior deste fornecedor (para o histórico).
  const { data: antes } = await supabase
    .from("insumos_fornecedores")
    .select("preco, preco_normalizado, tamanho_embalagem, unidade_embalagem")
    .eq("insumo_id", insumoId).eq("fornecedor_id", fornecedorId).maybeSingle();

  const { error } = await supabase.from("insumos_fornecedores").upsert({
    unidade_id: unidadeId || null,
    insumo_id: insumoId,
    fornecedor_id: fornecedorId,
    preco: valor,
    tamanho_embalagem: tam,
    unidade_embalagem: unidade || null,
    preco_normalizado: normalizado,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "insumo_id,fornecedor_id" });
  if (error) return { error: semMigracao(error) ? "sem_migracao" : (error.message || "erro") };

  // Histórico só quando o preço realmente mudou.
  const anteriorValor = antes ? Number(antes.preco) : null;
  const anteriorNorm = antes ? Number(antes.preco_normalizado) : null;
  if (anteriorValor === null || Math.abs(anteriorValor - valor) > 0.0001) {
    const dif = anteriorNorm != null ? normalizado - anteriorNorm : null;
    const pct = anteriorNorm ? (dif / anteriorNorm) * 100 : null;
    await supabase.from("insumos_precos_historico").insert({
      unidade_id: unidadeId || null,
      insumo_id: insumoId,
      insumo_nome: insumoNome || null,
      fornecedor_id: fornecedorId,
      fornecedor_nome: fornecedorNome || null,
      embalagem_quantidade_anterior: antes ? Number(antes.tamanho_embalagem) || null : null,
      embalagem_unidade_anterior: antes ? antes.unidade_embalagem : null,
      embalagem_quantidade_nova: tam,
      embalagem_unidade_nova: unidade || null,
      valor_anterior: anteriorValor,
      valor_novo: valor,
      preco_normalizado_anterior: anteriorNorm,
      preco_normalizado_novo: normalizado,
      diferenca_valor: dif,
      diferenca_percentual: pct,
      custo_anterior: anteriorNorm,
      custo_novo: normalizado,
      usuario_id: usuario?.id || null,
      usuario_nome: usuario?.user_metadata?.nome || usuario?.email || "Usuário do sistema",
      origem: "Preço por fornecedor",
    }).then(() => {}, () => {}); // histórico é acessório
  }
  return { error: null, preco_normalizado: normalizado };
}

// Escolhe o fornecedor ATIVO do ingrediente: copia o preço dele para o custo
// do insumo (usado nas fichas/estoque).
export async function escolherFornecedor({ insumoId, fornecedorId }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!insumoId || !fornecedorId) return { error: "Ingrediente e fornecedor são obrigatórios." };
  const { data: row, error: e1 } = await supabase
    .from("insumos_fornecedores")
    .select("preco, tamanho_embalagem, unidade_embalagem, preco_normalizado")
    .eq("insumo_id", insumoId).eq("fornecedor_id", fornecedorId).maybeSingle();
  if (e1) return { error: semMigracao(e1) ? "sem_migracao" : (e1.message || "erro") };
  if (!row) return { error: "Fornecedor sem preço cadastrado para este ingrediente." };

  const valor = Number(row.preco) || 0;
  const tam = Number(row.tamanho_embalagem) || 1;
  const patch = {
    fornecedor_atual_id: fornecedorId,
    custo_compra: valor,
    custo_unitario: tam > 0 ? valor / tam : valor,
    tamanho_embalagem: tam,
    preco_normalizado: row.preco_normalizado != null ? Number(row.preco_normalizado) : calcularPrecoNormalizado(tam, row.unidade_embalagem, valor),
    preco_atualizado_em: new Date().toISOString(),
  };
  if (row.unidade_embalagem) patch.unidade_medida = row.unidade_embalagem;
  const { error } = await supabase.from("insumos").update(patch).eq("id", insumoId);
  if (error) return { error: error.message || "erro" };
  return { error: null, custo_compra: valor };
}

export async function removerPrecoFornecedor(id) {
  if (!isSupabaseReady() || !id) return { error: "Registro inválido." };
  const { error } = await supabase.from("insumos_fornecedores").delete().eq("id", id);
  return { error: error?.message || null };
}
