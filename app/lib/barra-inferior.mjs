// BARRA INFERIOR — as abas fixas do Héfisto no celular e no tablet.
//
// Pedido do dono (14/11/2026): upgrade visual inspirado no app da Medway, que
// tem cinco abas fixas embaixo (Início, assistente, pesquisa, a atividade
// principal e Menu), com um traço em cima da aba ativa. No Héfisto:
//   Início · Assistente · Pesquisar · Tarefas · Menu
//
// A barra só aparece nas telas de PRIMEIRO NÍVEL (as que a própria barra abre
// e as telas de cards das áreas). Nas telas de trabalho (comandas, caixa, KDS,
// fichas, conversa do assistente) ela some: elas têm botões fixos no rodapé e
// precisam da altura inteira. É o mesmo comportamento do app de referência,
// que esconde as abas quando a pessoa entra numa tarefa.

export const ABAS = Object.freeze([
  { id: "inicio", label: "Início", href: "/dashboard", icone: "Home" },
  { id: "assistente", label: "Assistente", acao: "assistente", icone: "Sparkles", exigeInteligencia: true },
  { id: "pesquisar", label: "Pesquisar", acao: "pesquisar", icone: "Search" },
  { id: "tarefas", label: "Tarefas", href: "/dashboard/tarefas", icone: "ListChecks", exigeRota: "/dashboard/tarefas" },
  { id: "menu", label: "Menu", href: "/dashboard/menu", icone: "Menu" },
]);

// Telas onde a barra aparece (rota exata, sem as filhas).
const ROTAS_COM_BARRA = new Set([
  "/dashboard",
  "/dashboard/menu",
  "/dashboard/conta",
  "/dashboard/tarefas",
  "/dashboard/notificacoes",
  "/dashboard/cozinha",
  "/dashboard/bar",
  "/dashboard/salao",
]);

const semBarraFinal = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** A barra aparece nesta rota? App dedicado (tablet de loja, KDS) não tem barra. */
export function mostraBarraInferior(pathname, sessao) {
  if (!sessao || sessao.is_app) return false;
  return ROTAS_COM_BARRA.has(semBarraFinal(String(pathname || "")));
}

/** Id da aba acesa nesta rota (ou null). */
export function abaAtiva(pathname, inicio = "/dashboard") {
  const p = semBarraFinal(String(pathname || ""));
  if (p === "/dashboard/tarefas") return "tarefas";
  if (p === "/dashboard/menu" || p === "/dashboard/conta") return "menu";
  if (p === semBarraFinal(inicio) || p === "/dashboard") return "inicio";
  return null;
}

/**
 * Abas que esta sessão vê. `podeRota(rota)` é o guard de rotas;
 * `podeInteligencia` é a porta do Assistente Héfisto.
 */
export function abasVisiveis({ podeRota = () => true, podeInteligencia = false } = {}) {
  return ABAS.filter((a) => (!a.exigeInteligencia || podeInteligencia) && (!a.exigeRota || podeRota(a.exigeRota)));
}
