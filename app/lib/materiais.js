// Materiais da casa (limpeza, máquina de lavar, embalagens) no estoque
// unificado: cadastro em insumos, saldo em estoque_itens por local e toda
// entrada/saída pelo estoque_movimentar (registrarMovimentoMulti). Regras em
// materiais.mjs. Lê e grava com a sessão do usuário (RLS por unidade).

import { supabase, isSupabaseReady } from "./supabase";
import { grupoMaterial, situacaoDosMateriais, validarMaterial } from "./materiais.mjs";
import { garantirEstoquesPadrao, registrarMovimentoMulti, vincularItemEstoque } from "./estoques-multiplos";
import { salvarEmbalagem } from "./embalagens";

/** Produtos do grupo com o saldo em cada estoque dele. */
export async function carregarMateriais(unidadeId, grupoId) {
  const grupo = grupoMaterial(grupoId);
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas" || !grupo) return { data: [], estoques: [], error: "Escolha uma unidade." };
  await garantirEstoquesPadrao(unidadeId);
  const slugs = grupo.locais.map((l) => l.slug);
  const [rE, rI] = await Promise.all([
    supabase.from("estoques").select("id, slug, nome").eq("unidade_id", unidadeId).in("slug", slugs),
    supabase.from("insumos").select("id, nome, categoria, unidade_medida, custo_unitario").eq("unidade_id", unidadeId).eq("departamento", grupo.departamento).order("nome"),
  ]);
  if (rE.error || rI.error) return { data: [], estoques: [], error: "Não foi possível ler o estoque agora." };
  const estoques = rE.data || [];
  const slugDe = new Map(estoques.map((e) => [e.id, e.slug]));
  let itens = [];
  if (estoques.length) {
    const rIt = await supabase.from("estoque_itens").select("id, estoque_id, insumo_id, quantidade_atual, estoque_minimo").eq("unidade_id", unidadeId).in("estoque_id", estoques.map((e) => e.id));
    if (rIt.error) return { data: [], estoques, error: "Não foi possível ler o estoque agora." };
    itens = (rIt.data || []).map((it) => ({ ...it, estoque_slug: slugDe.get(it.estoque_id) }));
  }
  // Produto do grupo que já está num estoque dele, mesmo cadastrado com outro
  // departamento (ex.: embalagem antiga), também aparece.
  const ids = new Set((rI.data || []).map((i) => i.id));
  const extras = [...new Set(itens.map((i) => i.insumo_id).filter((id) => !ids.has(id)))];
  let insumos = rI.data || [];
  if (extras.length) {
    const rX = await supabase.from("insumos").select("id, nome, categoria, unidade_medida, custo_unitario").in("id", extras);
    if (!rX.error) insumos = [...insumos, ...(rX.data || [])];
  }
  return { data: situacaoDosMateriais(grupoId, insumos, itens), estoques, error: null };
}

/** Cadastra o produto e o põe no estoque escolhido (saldo zero; a quantidade entra por "Entrada"). */
export async function cadastrarMaterial(unidadeId, grupoId, form) {
  const v = validarMaterial(grupoId, form);
  if (!v.ok) return { erros: v.erros };
  const p = v.produto;
  if (grupoId === "embalagens") {
    // Embalagem segue pelo cadastro da marmitaria/delivery, que já sincroniza com o estoque.
    const departamento = p.local === "embalagens-bar" ? "bar" : "cozinha";
    const r = await salvarEmbalagem(unidadeId, { nome: p.nome, categoria: p.categoria, departamento, quantidade_atual: 0, quantidade_minima: p.minimo, preco_unitario: p.custo });
    if (r?.error || !r?.data) return { erro: "Não foi possível cadastrar a embalagem." };
    const emb = r.data; // salvarEmbalagem já cria o insumo e o põe no estoque da cozinha/bar
    if (p.local === "embalagens-marmitaria") {
      const { data: ins } = await supabase.from("operacao_embalagens").select("insumo_id").eq("id", emb.id).maybeSingle();
      const { data: est } = await supabase.from("estoques").select("id").eq("unidade_id", unidadeId).eq("slug", p.local).maybeSingle();
      if (ins?.insumo_id && est?.id) await vincularItemEstoque({ unidadeId, estoqueId: est.id, insumoId: ins.insumo_id, minimo: p.minimo, custoUnitario: p.custo });
    }
    return { erro: null };
  }
  const { data: est } = await supabase.from("estoques").select("id").eq("unidade_id", unidadeId).eq("slug", p.local).maybeSingle();
  if (!est?.id) return { erro: "Estoque não encontrado. Recarregue a tela." };
  const { data: ins, error } = await supabase.from("insumos").insert([{
    unidade_id: unidadeId, nome: p.nome, departamento: p.departamento, categoria: p.categoria,
    unidade_medida: p.unidade, unidade_comercial: p.unidade, tamanho_embalagem: 1,
    custo_unitario: p.custo, custo_compra: p.custo,
  }]).select("id").single();
  if (error || !ins?.id) return { erro: "Não foi possível cadastrar o produto." };
  const r = await vincularItemEstoque({ unidadeId, estoqueId: est.id, insumoId: ins.id, minimo: p.minimo, custoUnitario: p.custo });
  return r.error ? { erro: "Produto cadastrado, mas não entrou no estoque. Tente de novo." } : { erro: null };
}

/** Põe um produto já cadastrado em outro estoque do grupo (ex.: o secante também na máquina do bar). */
export async function adicionarAoEstoque(unidadeId, insumoId, slug, minimo = 0) {
  const { data: est } = await supabase.from("estoques").select("id").eq("unidade_id", unidadeId).eq("slug", slug).maybeSingle();
  if (!est?.id) return { erro: "Estoque não encontrado." };
  const r = await vincularItemEstoque({ unidadeId, estoqueId: est.id, insumoId, minimo });
  return { erro: r.error || null };
}

/** Entrada (compra/reposição) ou saída (uso) pelo motor do estoque. */
export async function movimentarMaterial({ unidadeId, estoqueId, insumoId, tipo, quantidade, usuarioNome, observacao }) {
  return registrarMovimentoMulti({
    unidadeId, estoqueId, insumoId, tipo, quantidade, usuarioNome, observacao,
    motivo: tipo === "entrada" ? "recebimento" : "consumo",
  });
}
