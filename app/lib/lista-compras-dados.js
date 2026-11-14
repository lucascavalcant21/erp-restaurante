// Lista de compras do Jhon: guardada em config_sistema.params.lista_compras
// (uma por unidade) — { data, itens, comprador: { nome, telefone }, enviadaEm }.
import { salvarParams } from "./parametros";

export async function salvarListaDeCompras(unidadeId, lista) {
  const r = await salvarParams(unidadeId, { lista_compras: lista });
  return { error: r?.error || null };
}
