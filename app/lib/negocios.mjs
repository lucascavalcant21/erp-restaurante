// Os três negócios da casa (decisão do dono, 05/11/2026): restaurante, marmitaria
// e eventos não se relacionam. Cada um é uma unidade no banco, com RH, ingredientes
// e fichas próprios. A troca fica no topo, sempre mostrando onde a pessoa está.

export const UNIDADE_MARMITARIA = "marmitaria";
export const UNIDADE_EVENTOS = "eventos";
const SEPARADAS = [UNIDADE_MARMITARIA, UNIDADE_EVENTOS];

export const ehNegocioSeparado = (id) => SEPARADAS.includes(id);

const NEGOCIOS = [
  { id: "restaurante", rotulo: "Restaurante", href: "/dashboard" },
  { id: UNIDADE_MARMITARIA, rotulo: "Marmitaria", href: "/dashboard/marmitaria" },
  { id: UNIDADE_EVENTOS, rotulo: "Eventos", href: "/dashboard/reservas-eventos" },
];

const dentroDe = (caminho, base) => caminho === base || String(caminho || "").startsWith(`${base}/`);

/**
 * Unidade com que o app abre. Nunca um negócio separado, a não ser que seja o
 * único do login: o administrador, sem unidade principal, caía no primeiro da
 * lista em ordem alfabética, e o restaurante parecia sem funcionários.
 */
export function unidadeInicial(unidades = [], ...preferidas) {
  const existe = (id) => id && !ehNegocioSeparado(id) && unidades.some((u) => u.id === id);
  return preferidas.find(existe) || unidades.find((u) => !ehNegocioSeparado(u.id))?.id || preferidas.find(Boolean) || "";
}

/** Marmitaria tem telas próprias; no resto do app, vale a unidade ativa. */
export function negocioAtual(caminho, unidadeAtiva) {
  if (dentroDe(caminho, "/dashboard/marmitaria")) return UNIDADE_MARMITARIA;
  return ehNegocioSeparado(unidadeAtiva) ? unidadeAtiva : "restaurante";
}

/** Negócios que o login alcança, com a unidade de cada um. Com um só, não há troca. */
export function negociosDoLogin(unidades = [], pode = () => true) {
  const lista = NEGOCIOS.map((n) => ({
    ...n,
    unidadeId: n.id === "restaurante" ? unidades.find((u) => !ehNegocioSeparado(u.id))?.id : unidades.find((u) => u.id === n.id)?.id,
  })).filter((n) => n.unidadeId && pode(n.href));
  return lista.length > 1 ? lista : [];
}
