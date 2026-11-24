// Cadastro único (dono, 21/11/2026): os eventos usam as mesmas fichas,
// ingredientes, embalagens e bebidas do delivery. Muda o custo num lugar,
// muda nos dois. Junta o que a unidade dos eventos tiver com o do delivery.

import { fetchFichas, fetchInsumos } from "./operacao";
import { UNIDADE_MARMITARIA } from "./negocios.mjs";

function juntar(...listas) {
  const vistos = new Set();
  const out = [];
  for (const l of listas) for (const x of l || []) if (x?.id && !vistos.has(x.id)) { vistos.add(x.id); out.push(x); }
  return out;
}

export async function fetchFichasDoEvento(unidadeId) {
  if (!unidadeId || unidadeId === UNIDADE_MARMITARIA) return fetchFichas(unidadeId);
  const [a, b] = await Promise.all([fetchFichas(unidadeId), fetchFichas(UNIDADE_MARMITARIA)]);
  return { data: juntar(a.data, b.data), error: a.error || null };
}

export async function fetchInsumosDoEvento(unidadeId) {
  if (!unidadeId || unidadeId === UNIDADE_MARMITARIA) return fetchInsumos(unidadeId);
  const [a, b] = await Promise.all([fetchInsumos(unidadeId), fetchInsumos(UNIDADE_MARMITARIA)]);
  return { data: juntar(a.data, b.data), error: a.error || null };
}
