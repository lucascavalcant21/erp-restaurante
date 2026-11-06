// Os três negócios da casa (decisão do dono, 05/11/2026): restaurante, marmitaria
// e eventos. A troca fica no topo do app, para não ter confusão de onde se está.

export const NEGOCIOS = [
  { id: "restaurante", rotulo: "Restaurante", href: "/dashboard" },
  { id: "marmitaria", rotulo: "Marmitaria", href: "/dashboard/marmitaria" },
  { id: "eventos", rotulo: "Eventos", href: "/dashboard/reservas-eventos" },
];

const dentroDe = (caminho, base) => caminho === base || String(caminho || "").startsWith(`${base}/`);

/** Negócio aberto: marmitaria e eventos têm rota própria, o resto é restaurante. */
export function negocioDaRota(caminho) {
  return NEGOCIOS.find((n) => n.id !== "restaurante" && dentroDe(caminho, n.href))?.id || "restaurante";
}

/** Só mostra a troca para quem alcança mais de um negócio. */
export function negociosVisiveis(pode) {
  const lista = NEGOCIOS.filter((n) => pode(n.href));
  return lista.length > 1 ? lista : [];
}
