// Gravar o preço de venda de um prato ou drink (Precificação, 27/11/2026).
// Mesmo caminho do editor de fichas: o preço mora no produto do Cardápio
// (é o que a venda usa) e é espelhado em fichas_tecnicas.preco_venda.

import { supabase, isSupabaseReady } from "./supabase";
import { fetchProdutos, salvarProduto } from "./vendas";

export async function salvarPrecoDaFicha({ ficha, preco, unidadeId }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const valor = Number(String(preco ?? "").replace(",", "."));
  if (!ficha?.id || !(valor > 0)) return { error: "Informe um preço maior que zero." };
  const dept = ficha.departamento === "bar" ? "bar" : "cozinha";
  const { error: eFicha } = await supabase.from("fichas_tecnicas").update({ preco_venda: valor }).eq("id", ficha.id);
  if (eFicha) return { error: eFicha.message };
  const { data: prods } = await fetchProdutos(unidadeId, dept);
  const nome = String(ficha.nome_receita || "").trim();
  const existente = (prods || []).find((p) => p.ficha_id === ficha.id || String(p.nome_produto || "").toLowerCase() === nome.toLowerCase());
  const r = existente
    ? await salvarProduto({ id: existente.id, ficha_id: ficha.id, preco_venda: valor })
    : await salvarProduto({
      unidade_id: unidadeId, ficha_id: ficha.id, nome_produto: nome, preco_venda: valor, departamento: dept,
      categoria: dept === "bar" ? (ficha.tipo_base === "produto_pronto" ? (ficha.categoria || "Outros produtos prontos") : "Drinks") : "Pratos Principais",
      observacoes: "Criado pela Precificação.",
    });
  if (r?.error) return { error: `O preço foi salvo na ficha, mas não chegou ao Cardápio: ${r.error}` };
  return { error: null, produtoId: existente?.id || r?.id || null, preco: valor };
}
