// Catálogo do que se etiqueta (tela de Etiquetas e o Nico, 24/11/2026): produtos
// do estoque da cozinha e do bar, bases e itens do cardápio, sem repetir nome.

import { fetchEstoque } from "./estoque";
import { fetchProdutos } from "./vendas";
import { fetchFichas } from "./operacao";

const AREAS = ["cozinha", "bar"];
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export async function carregarCatalogoEtiquetas(unidadeId) {
  if (!unidadeId || unidadeId === "todas") return [];
  const areas = await Promise.all(AREAS.map((area) => Promise.all([fetchEstoque(unidadeId, area), fetchProdutos(unidadeId, area), fetchFichas(unidadeId, area)])));
  const juntar = (i) => areas.flatMap((area) => area[i].data || []);
  const [estoque, cardapio, fichas] = [juntar(0), juntar(1), juntar(2)];
  const mapa = new Map();
  estoque.forEach((produto) => {
    if (!produto.nome) return;
    mapa.set(produto.nome.toLocaleLowerCase("pt-BR"), { id: `estoque:${produto.id || produto.insumo_id || produto.nome}`, nome: produto.nome, unidade: String(produto.unidade_comercial || produto.unidade_medida || produto.unidade || "UN").toUpperCase(), custo: numero(produto.custo_unitario || produto.preco_unit), origem: "Ingrediente" });
  });
  fichas.filter((f) => f.eh_base).forEach((ficha) => {
    const nome = ficha.nome_receita;
    if (!nome || mapa.has(nome.toLocaleLowerCase("pt-BR"))) return;
    mapa.set(nome.toLocaleLowerCase("pt-BR"), { id: `base:${ficha.id || nome}`, nome, unidade: String(ficha.rendimento_unidade || "UN").toUpperCase(), custo: 0, origem: "Base" });
  });
  cardapio.forEach((produto) => {
    const nome = produto.nome_produto;
    if (!nome || mapa.has(nome.toLocaleLowerCase("pt-BR"))) return;
    mapa.set(nome.toLocaleLowerCase("pt-BR"), { id: `produto:${produto.id || nome}`, nome, unidade: "UN", custo: 0, origem: "Cardápio" });
  });
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
