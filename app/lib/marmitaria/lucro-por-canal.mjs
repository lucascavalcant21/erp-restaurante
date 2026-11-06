// O mesmo item, um lucro em cada canal. Usa a mesma conta do Cardápio
// (cardapioDeVendas), para os números nunca divergirem entre as telas.

import { cardapioDeVendas, catalogoParaCombo } from "./promocoes.mjs";
import { composicaoDoPreco } from "./cardapio.mjs";
import { r2 } from "./nucleo.mjs";

const SECOES = new Set(["marmitas", "combos"]);

export function lucroPorCanal({ marmitas = [], custos = new Map(), fichas = [], custoFicha = () => null, combos = [], canais = [], tributosPct = null, embutidos = null } = {}) {
  const porItem = new Map();
  const faltas = [];
  for (const canal of canais) {
    const catalogo = catalogoParaCombo({ marmitas, custos, fichas, custoFicha, canalId: canal.id });
    const linhas = cardapioDeVendas({ catalogo, marmitas, combos, canal, tributosPct, embutidos }).filter((l) => SECOES.has(l.secao));
    if (linhas[0]?.falta) faltas.push(linhas[0].falta);
    for (const l of linhas) {
      if (!porItem.has(l.id)) porItem.set(l.id, { id: l.id, nome: l.nome, secao: l.secao, valores: {} });
      porItem.get(l.id).valores[canal.id] = { canalId: canal.id, canal: canal.nome, preco: l.precoPago, lucro: l.lucro, lucroPct: l.lucroPct, linha: l };
    }
  }
  const itens = [...porItem.values()].map((item) => {
    const comLucro = Object.values(item.valores).filter((v) => v.lucro != null).sort((a, b) => b.lucro - a.lucro);
    const melhor = comLucro[0] || null;
    const pior = comLucro.length > 1 ? comLucro[comLucro.length - 1] : null;
    return { ...item, melhor, pior, diferenca: pior ? r2(melhor.lucro - pior.lucro) : null };
  }).sort((a, b) => (b.diferenca ?? -1) - (a.diferenca ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { itens, faltas: [...new Set(faltas)] };
}

const partes = (v, embutidos, custos) => {
  const custo = v.linha.ficha ? custos.get(v.linha.ficha.id) : null;
  const c = composicaoDoPreco({ linha: v.linha, custoFicha: custo, embutidos });
  const mapa = new Map();
  for (const l of c?.linhas || []) {
    if (l.id === "lucro") continue;
    if (l.filhos?.length && l.id === "taxas") for (const f of l.filhos) mapa.set(f.rotulo, f.valor);
    else mapa.set(l.rotulo, l.valor);
  }
  return mapa;
};

/** O que faz o lucro cair do melhor canal para o pior, do maior peso ao menor. */
export function porQueCai(item, { embutidos = null, custos = new Map() } = {}) {
  if (!item?.melhor || !item?.pior) return [];
  const melhor = partes(item.melhor, embutidos, custos);
  const pior = partes(item.pior, embutidos, custos);
  const motivos = [...pior].map(([rotulo, valor]) => ({ rotulo, valor: r2(valor - (melhor.get(rotulo) || 0)) })).filter((m) => m.valor > 0);
  const menosPreco = r2((item.melhor.preco || 0) - (item.pior.preco || 0));
  if (menosPreco > 0) motivos.push({ rotulo: "Preço menor", valor: menosPreco });
  return motivos.sort((a, b) => b.valor - a.valor);
}
