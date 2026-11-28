// Prévia da Conta rápida (dono, 28/11/2026: "aqui eu quero pré-visualizar
// como vai ser"). Monta, com as MESMAS regras do sistema (menu + permissões),
// o que a conta vê ao entrar: a tela de cards do módulo, o ponto ou o Nico.

import { MENU_PRINCIPAL, cardsDaArea } from "./menu-principal.mjs";
import { canAccessRoute } from "./permissions-catalog.mjs";
import { MODULOS_CONTA } from "./contas-rapidas.mjs";

const rota = (href) => String(href || "").split("?")[0];
const busca = (href) => String(href || "").split("?")[1] || "";

/** { tipo: "ponto"|"nico"|"cards"|"inicio", titulo, cards: [{ label, icone }] } ou null. */
export function previaDaConta(modelo) {
  if (!modelo?.modulos?.length) return null;
  const sessao = { gerenciado: true, permissions: modelo.permissoes || [] };
  const ids = modelo.modulos;
  if (ids.length === 1 && ids[0] === "ponto") return { tipo: "ponto", titulo: "Ponto dos funcionários", cards: [] };
  if (ids.length === 1 && ids[0] === "nico") return { tipo: "nico", titulo: "Nico", cards: [] };
  if (ids.length === 1) {
    const area = MENU_PRINCIPAL.find((m) => rota(m.href) === rota(modelo.paginaInicial));
    const cards = cardsDaArea(area)
      .filter((c) => canAccessRoute(sessao, rota(c.href), busca(c.href)))
      .map((c) => ({ label: c.label, icone: c.icone || area?.icone || null, href: c.href }));
    return { tipo: "cards", titulo: area?.label || modelo.nome, cards };
  }
  return {
    tipo: "inicio",
    titulo: "Início",
    cards: ids.map((id) => MODULOS_CONTA.find((m) => m.id === id)).filter(Boolean).map((m) => ({ label: m.nome, icone: m.icone })),
  };
}
