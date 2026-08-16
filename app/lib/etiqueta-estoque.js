import { supabase, isSupabaseReady } from "./supabase";
import { registrarMovimentoMulti, vincularItemEstoque } from "./estoques-multiplos";

// LIGAÇÃO ETIQUETA → ESTOQUE
// Etiquetar é declarar que aquilo existe: ao gerar a etiqueta, a quantidade
// entra no estoque; ao dar baixa ou perda, sai. Nada aqui pode derrubar a
// impressão — se o estoque falhar, a etiqueta continua valendo e o motivo
// volta para a tela.

// Produto aberto/manipulado nasce no estoque de pré-preparos do setor;
// produto lacrado fica no estoque do próprio setor.
export function slugDoEstoqueDaEtiqueta(etiqueta) {
  const dept = String(etiqueta?.departamento || etiqueta?.setor || "cozinha").toLowerCase().includes("bar") ? "bar" : "cozinha";
  const manipulado = String(etiqueta?.tipo_etiqueta || "aberto").toLowerCase() !== "fechado";
  return manipulado ? `pre-preparos-${dept}` : dept;
}

// Quanto a etiqueta representa de fato: cada cópia é uma embalagem.
export function quantidadeDaEtiqueta(etiqueta) {
  const porEtiqueta = Number(etiqueta?.quantidade) || 0;
  const copias = Math.max(1, Number(etiqueta?.copias) || 1);
  return porEtiqueta > 0 ? porEtiqueta * copias : 0;
}

async function acharInsumo(unidadeId, nome) {
  const limpo = String(nome || "").trim();
  if (!limpo) return null;
  const { data: exato } = await supabase.from("insumos").select("id, nome")
    .eq("unidade_id", unidadeId).ilike("nome", limpo).limit(1);
  if (exato?.length) return exato[0];
  const { data: parecido } = await supabase.from("insumos").select("id, nome")
    .eq("unidade_id", unidadeId).ilike("nome", `%${limpo}%`).limit(1);
  return parecido?.[0] || null;
}

async function acharEstoque(unidadeId, slug) {
  const { data } = await supabase.from("estoques").select("id, nome")
    .eq("unidade_id", unidadeId).eq("slug", slug).maybeSingle();
  return data || null;
}

// Movimenta o estoque a partir de uma etiqueta. tipo: "entrada" | "saida".
async function movimentarPorEtiqueta({ unidadeId, etiqueta, tipo, usuario, observacao }) {
  if (!isSupabaseReady() || !unidadeId || !etiqueta) return { ok: false, motivo: "sem conexão" };
  const quantidade = quantidadeDaEtiqueta(etiqueta);
  // Etiqueta sem peso é o caso normal (etiqueta de nome, por exemplo): não há
  // o que somar no estoque e não há nada para o usuário corrigir.
  if (quantidade <= 0) return { ok: false, silencioso: true, motivo: "etiqueta sem peso informado" };

  try {
    const insumo = await acharInsumo(unidadeId, etiqueta.produto);
    if (!insumo) return { ok: false, motivo: `"${etiqueta.produto}" não está cadastrado como produto` };

    const slug = slugDoEstoqueDaEtiqueta(etiqueta);
    const estoque = await acharEstoque(unidadeId, slug);
    if (!estoque) return { ok: false, motivo: "estoque de destino não encontrado" };

    // Primeira etiqueta de um produto: cria o vínculo com saldo zero antes de
    // movimentar, senão a entrada não teria onde cair.
    if (tipo === "entrada") {
      await vincularItemEstoque({
        unidadeId, estoqueId: estoque.id, insumoId: insumo.id,
        custoUnitario: Number(etiqueta.custo_unit) > 0 ? Number(etiqueta.custo_unit) : null,
        validade: etiqueta.validade_em ? String(etiqueta.validade_em).slice(0, 10) : null,
      }).catch(() => {});
    }

    const { error } = await registrarMovimentoMulti({
      unidadeId, estoqueId: estoque.id, insumoId: insumo.id,
      tipo, quantidade,
      usuarioId: usuario?.id || null,
      usuarioNome: usuario?.nome || etiqueta.responsavel || "",
      observacao: observacao || `Etiqueta ${etiqueta.codigo || ""}`.trim(),
    });
    if (error) return { ok: false, motivo: error };
    return { ok: true, estoque: estoque.nome, quantidade, insumo: insumo.nome };
  } catch (e) {
    return { ok: false, motivo: e?.message || "falha ao lançar no estoque" };
  }
}

// Etiqueta gerada = produção declarada: entra no estoque.
export function entradaPorEtiqueta({ unidadeId, etiqueta, usuario }) {
  return movimentarPorEtiqueta({
    unidadeId, etiqueta, tipo: "entrada", usuario,
    observacao: `Etiqueta ${etiqueta?.codigo || ""} — ${Math.max(1, Number(etiqueta?.copias) || 1)} etiqueta(s)`.trim(),
  });
}

// Baixa (consumido) ou perda (descartado): sai do mesmo estoque em que entrou.
export function saidaPorEtiqueta({ unidadeId, etiqueta, motivo = "baixa", usuario }) {
  return movimentarPorEtiqueta({
    unidadeId, etiqueta, tipo: "saida", usuario,
    observacao: motivo === "perda"
      ? `Perda — etiqueta ${etiqueta?.codigo || ""}`.trim()
      : `Consumo — etiqueta ${etiqueta?.codigo || ""}`.trim(),
  });
}
