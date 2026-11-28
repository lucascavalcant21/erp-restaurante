// Custo da receita no motor: NÃO recalcula por fórmula própria. Usa a conta
// das fichas técnicas (ficha-calculos.mjs → custo-rendimento.mjs), a mesma das
// telas, e só converte para centavos com a natureza e o que falta.
//
// Perda (decisão do dono, 27/11/2026): a perda é cadastrada no ingrediente e
// vale em todas as receitas; na ficha ela pode ser tirada ou mudada só
// naquela receita, sem mexer no cadastro. Hoje vale a do cadastro (o FC da
// linha só entra para ingrediente sem perda cadastrada) — nunca as duas.

import { custoDeProduzirFicha } from "../../ficha-calculos.mjs";
import { centavos } from "./dinheiro.mjs";

export function custoDaFicha(ficha, todasFichas = []) {
  if (!ficha) return { status: "DADOS INSUFICIENTES", falta: ["ficha"] };
  const linhas = ficha.fichas_ingredientes || [];
  const semPreco = linhas.filter((fi) => fi.insumos && !(Number(fi.insumos.custo_unitario) > 0) && !(Number(fi.insumos.custo_compra) > 0)).map((fi) => fi.insumos.nome);
  const totalC = centavos(custoDeProduzirFicha(ficha, todasFichas));
  const rend = Number(ficha.rendimento_porcoes) || 0;
  return {
    status: linhas.length ? (semPreco.length ? "PARCIAL" : "OK") : "DADOS INSUFICIENTES",
    totalC, porPorcaoC: rend > 0 ? Math.round(totalC / rend) : null,
    falta: [...(linhas.length ? [] : ["ingredientes da ficha"]), ...semPreco.map((n) => `preço de ${n}`), ...(rend > 0 ? [] : ["rendimento"])],
    natureza: semPreco.length ? "ESTIMATIVA" : "REAL",
  };
}
