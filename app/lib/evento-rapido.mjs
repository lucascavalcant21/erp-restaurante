// ORÇAMENTO RÁPIDO POR PESSOA (pedido do dono, 27/10/2026): "puxando todos
// os produtos das fichas da cozinha e do bar e facilitando a navegação para
// fazer um orçamento por pessoa o mais rápido possível".
//
// Nada de conta nova: o orçamento é o mesmo do evento (evento-orcamento.mjs)
// e o custo do prato vem da ficha técnica (custoPorcaoDaFicha). Aqui só o
// catálogo das fichas e a montagem do orçamento a partir da tela rápida.
// Funções puras (testes em evento-rapido.test.mjs).

import { orcamentoVazio, novoId } from "./evento-orcamento.mjs";
import { custoPorcaoDaFicha } from "./evento-financeiro.mjs";
import { tipoFichaDe, setorId } from "./ficha-modelo.mjs";

const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const SEM_CATEGORIA = "Outros";
// "Adicional - …" ganham categoria própria, no fim (senão dominam a lista).
const ADICIONAIS = "Adicionais";
const ehAdicional = (nome) => /^adiciona(l|is)\b/.test(normal(nome));

/**
 * Fichas que podem entrar num evento, por setor (cozinha/bar) e categoria,
 * com o custo de uma porção. Fora: pré-preparo (é ingrediente de outra ficha)
 * e ficha inativa.
 * @returns {{ cozinha: Array<{categoria, itens}>, bar: Array<{categoria, itens}>, total: number }}
 */
export function catalogoDeFichas(fichas = []) {
  const porSetor = { cozinha: new Map(), bar: new Map() };
  let total = 0;
  for (const f of fichas || []) {
    if (!f || f.ativo === false || String(f.status || "").toLowerCase() === "inativo") continue;
    if (f.eh_base || tipoFichaDe(f) === "pre_preparo") continue;
    const setor = setorId(f.departamento);
    const categoria = ehAdicional(f.nome_comercial || f.nome_receita) ? ADICIONAIS : String(f.categoria || "").trim() || SEM_CATEGORIA;
    const custo = custoPorcaoDaFicha(f, fichas);
    const item = {
      id: f.id, nome: f.nome_comercial || f.nome_receita || "Ficha", setor, categoria,
      custoPorcao: custo > 0 ? custo : null, // null = ficha sem custo (DADOS INSUFICIENTES)
      precoVenda: Number(f.preco_venda) > 0 ? Number(f.preco_venda) : null,
      // Para pesquisar pelo insumo ("camarão" acha as fichas que levam camarão).
      insumos: (f.fichas_ingredientes || []).map((i) => i?.insumos?.nome || i?.nome || "").filter(Boolean),
    };
    const m = porSetor[setor];
    if (!m.has(categoria)) m.set(categoria, []);
    m.get(categoria).push(item);
    total++;
  }
  const ordenar = (m) => [...m.entries()]
    .sort(([a], [b]) => (a === ADICIONAIS) - (b === ADICIONAIS) || (a === SEM_CATEGORIA) - (b === SEM_CATEGORIA) || a.localeCompare(b, "pt-BR"))
    .map(([categoria, itens]) => ({ categoria, itens: itens.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }));
  return { cozinha: ordenar(porSetor.cozinha), bar: ordenar(porSetor.bar), total };
}

/**
 * Filtra o catálogo de um setor pela busca (sem acento) e pela categoria. A
 * busca acha pelo nome, pela categoria ou por um insumo da ficha; quando foi
 * pelo insumo, o item leva `peloInsumo` (o nome que casou) para a tela mostrar.
 */
export function filtrarCatalogo(grupos = [], { busca = "", categoria = "" } = {}) {
  const t = normal(busca);
  return grupos
    .filter((g) => !categoria || g.categoria === categoria)
    .map((g) => ({
      ...g,
      itens: g.itens.flatMap((i) => {
        if (!t || normal(`${i.nome} ${i.categoria}`).includes(t)) return [i];
        const ins = (i.insumos || []).find((n) => normal(n).includes(t));
        return ins ? [{ ...i, peloInsumo: ins }] : [];
      }),
    }))
    .filter((g) => g.itens.length);
}

/**
 * Orçamento do evento a partir da tela rápida. Buffet: pratos da cozinha na
 * seção buffet, bebidas no bar. Equipe e extras entram como uma linha cada
 * (o detalhe fica na tela completa do evento).
 * @param {object} rapido { convidados, criancas, itens:[{ficha_id,nome,setor,por_pessoa}], equipe, extras, meta_lucro_pct, preco_por_pessoa, cliente:{...} }
 */
export function orcamentoDoRapido(rapido = {}, params = {}) {
  const base = orcamentoVazio(params);
  const n = (v) => Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0);
  const equipe = n(rapido.equipe);
  const extras = n(rapido.extras);
  return {
    ...base,
    tipo: "buffet",
    cardapio: (rapido.itens || []).map((i) => ({
      id: i.id || novoId(), secao: i.setor === "bar" ? "bar" : "buffet", origem: "ficha",
      ficha_id: i.ficha_id, nome: i.nome, descricao: "", por_pessoa: n(i.por_pessoa),
    })),
    equipe: equipe > 0 ? [{ id: novoId(), area: "Outros", funcao: "Equipe do evento", nome: "", quantidade: 1, valor: equipe }] : [],
    extras: extras > 0 ? [{ id: novoId(), categoria: "outros", descricao: "Extras (aluguel, decoração…)", valor: extras }] : [],
    cliente: {
      ...base.cliente, ...(rapido.cliente || {}),
      convidados: Math.round(n(rapido.convidados)),
      criancas: Math.min(Math.round(n(rapido.criancas)), Math.round(n(rapido.convidados))),
    },
    financeiro: {
      ...base.financeiro,
      ...(rapido.meta_lucro_pct !== undefined && rapido.meta_lucro_pct !== "" ? { meta_lucro_pct: n(rapido.meta_lucro_pct) } : {}),
      preco_por_pessoa: n(rapido.preco_por_pessoa),
    },
  };
}
