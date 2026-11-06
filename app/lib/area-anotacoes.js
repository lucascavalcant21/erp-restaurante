// Anotações da conta da área: o que produzir hoje ou amanhã e o que falta comprar.
// Pedido de compra aqui é um aviso: não gera compra nem conta a pagar.

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade } from "./unidades";

const OFFLINE = "Sistema indisponível no momento.";

// Só as colunas que a equipe vê: custo e margem nem saem do banco nesta tela.
const CAMPOS_FICHA = `id, nome_receita, nome_comercial, categoria, eh_base, imagem, montagem_foto, descricao, descricao_comercial,
  rendimento_porcoes, rendimento_unidade, validade_dias, modo_preparo, montagem_sequencia, alergenicos_pode_conter, copo, tipo_gelo, guarnicao,
  fichas_montagem_passos(ordem, descricao),
  fichas_ingredientes!ficha_id(quantidade, insumos(nome, unidade_medida), subficha:fichas_tecnicas!fichas_ingredientes_subficha_id_fkey(nome_receita))`;

export async function fetchConsultaDaArea(unidadeId, area) {
  if (!isSupabaseReady()) return { fichas: [], montagens: [], produtos: [], error: OFFLINE };
  const [fichas, montagens, produtos] = await Promise.all([
    supabase.from("fichas_tecnicas").select(CAMPOS_FICHA).eq("unidade_id", unidadeId).eq("departamento", area).eq("ativo", true).order("nome_receita"),
    escoparPorUnidade(supabase.from("montagem").select("nome, descritivo, foto_url").eq("departamento", area), unidadeId),
    supabase.from("produtos").select("id, ficha_id, nome_produto, categoria, preco_venda, ativo, imagem_url, fichas_tecnicas(tipo_base)").eq("unidade_id", unidadeId).eq("departamento", area),
  ]);
  const deVenda = (produtos.data || []).filter((p) => !["pre", "receita"].includes(String(p.fichas_tecnicas?.tipo_base || "").toLowerCase()));
  return { fichas: fichas.data || [], montagens: montagens.data || [], produtos: deVenda, error: fichas.error?.message || montagens.error?.message || produtos.error?.message || null };
}

export async function fetchAnotacoes(unidadeId, area, desde) {
  if (!isSupabaseReady()) return { data: [], error: OFFLINE };
  const { data, error } = await supabase.from("area_anotacoes").select("*")
    .eq("unidade_id", unidadeId).eq("area", area)
    .or(`status.eq.aberta,para_dia.gte.${desde}`)
    .order("para_dia").limit(200);
  return { data: data || [], error: error?.message || null };
}

export async function criarAnotacao(unidadeId, a) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { error } = await supabase.from("area_anotacoes").insert({
    unidade_id: unidadeId, area: a.area, tipo: a.tipo, para_dia: a.para_dia, texto: a.texto.trim(),
    quantidade: a.quantidade === "" || a.quantidade == null ? null : Number(a.quantidade),
    unidade: a.quantidade === "" || a.quantidade == null ? null : a.unidade || null, quem: a.quem.trim(),
  });
  return { error: error?.message || null };
}

export async function marcarAnotacao(id, feita) {
  if (!isSupabaseReady()) return { error: OFFLINE };
  const { error } = await supabase.from("area_anotacoes")
    .update({ status: feita ? "feita" : "aberta", concluida_em: feita ? new Date().toISOString() : null }).eq("id", id);
  return { error: error?.message || null };
}
