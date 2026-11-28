// Banco da lista de compras com pesquisa de preço (tabela compras_cotacoes,
// migração db/COMPRAS_COT_1_PESQUISA_DE_PRECO.sql). As regras ficam em
// cotacoes.mjs; aqui só lê e grava.
//
// Enquanto a migração não estiver aplicada, as leituras devolvem
// semTabela: true e a tela avisa, em vez de quebrar.

import { supabase, isSupabaseReady } from "./supabase";
import { salvarInsumo } from "./operacao";
import { inserirFornecedor } from "./fornecedores";
import { camposDaEscolha } from "./cotacoes.mjs";

const semTabela = (e) => {
  const m = String(e?.message || e || "").toLowerCase();
  return m.includes("compras_cotacoes") && (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"));
};

export async function fetchCotacoes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: null, semTabela: false };
  const { data, error } = await supabase.from("compras_cotacoes").select("*")
    .eq("unidade_id", unidadeId).order("registrada_em", { ascending: true }).limit(5000);
  if (error) return { data: [], error: semTabela(error) ? null : error.message, semTabela: semTabela(error) };
  return { data: data || [], error: null, semTabela: false };
}

/** Um lugar de compra novo (supermercado, atacado, feira): vira um fornecedor. */
export async function criarLocal(unidadeId, nome) {
  const n = String(nome || "").trim();
  if (n.length < 2) return { error: "Digite o nome do lugar." };
  return inserirFornecedor({ nome: n.slice(0, 120), segmento: "Supermercado", ativo: true }, unidadeId);
}

export async function registrarCotacao(unidadeId, linha) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // unidade_id vai porque a coluna é obrigatória, mas o banco troca pela do
  // ingrediente (gatilho): não é o corpo que decide a unidade.
  const { data, error } = await supabase.from("compras_cotacoes").insert([{ ...linha, unidade_id: unidadeId }]).select().single();
  if (error) return { error: semTabela(error) ? "A tabela de pesquisas ainda não foi criada no banco." : error.message };
  return { data, error: null };
}

/* Escolher onde comprar: marca a pesquisa como escolhida (desmarca as outras
 * do mesmo ingrediente feitas nas 12 horas em volta, a mesma ida às compras) e,
 * se o preço for diferente do cadastro, atualiza o ingrediente pelo
 * salvarInsumo de sempre: grava o histórico de preço, e fichas e
 * precificação passam a usar o preço novo na hora. */
export async function escolherCotacao({ insumo, cotacao, todas = [] }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const escolha = camposDaEscolha(insumo, cotacao);
  if (!escolha) return { error: "A embalagem pesquisada não bate com a unidade do cadastro." };

  const t = new Date(cotacao.registrada_em).getTime();
  const mesmaIda = (todas || []).filter((c) => c.insumo_id === insumo.id && c.id !== cotacao.id && c.escolhida
    && Math.abs(new Date(c.registrada_em).getTime() - t) <= 12 * 3600 * 1000).map((c) => c.id);
  if (mesmaIda.length) {
    const { error } = await supabase.from("compras_cotacoes").update({ escolhida: false }).in("id", mesmaIda);
    if (error) return { error: error.message };
  }
  const { error: e1 } = await supabase.from("compras_cotacoes").update({ escolhida: true }).eq("id", cotacao.id);
  if (e1) return { error: e1.message };

  if (!escolha.mudou) return { error: null, atualizouCadastro: false, variacaoPct: 0 };

  // salvarInsumo regrava os vínculos com fornecedores: manda os que já existem
  // mais o escolhido, para não apagar nenhum.
  const { data: vinculos } = await supabase.from("insumos_fornecedores").select("fornecedor_id").eq("insumo_id", insumo.id);
  const fornecedorIds = [...new Set([...(vinculos || []).map((v) => v.fornecedor_id), cotacao.fornecedor_id].filter(Boolean))];
  const r = await salvarInsumo({ id: insumo.id, ...escolha.campos, fornecedor_ids: fornecedorIds }, { origem: `Lista de compras · ${cotacao.local_nome}` });
  if (r.error) return { error: `A escolha foi marcada, mas o ingrediente não atualizou: ${r.error}` };
  return { error: null, atualizouCadastro: true, variacaoPct: escolha.variacaoPct, fichasAtualizadas: r.fichasAtualizadas || 0 };
}
