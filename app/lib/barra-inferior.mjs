// BARRA INFERIOR — as abas fixas do Héfisto no celular e no tablet.
//
// Pedido do dono (14/11/2026): upgrade visual inspirado no app da Medway, que
// tem cinco abas fixas embaixo (Início, assistente, pesquisa, a atividade
// principal e Menu), com um traço em cima da aba ativa. No Héfisto:
//   Início · Assistente · Pesquisar · Delivery · Menu
// (17/11/2026: "no lugar de Tarefas quero o ícone de delivery"; Tarefas segue no Menu.)
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
  { id: "delivery", label: "Delivery", href: "/dashboard/marmitaria", icone: "Bike", exigeRota: "/dashboard/marmitaria" },
  { id: "menu", label: "Menu", href: "/dashboard/menu", icone: "Menu" },
]);

// Telas onde a barra aparece (rota exata, sem as filhas).
const ROTAS_COM_BARRA = new Set([
  "/dashboard",
  "/dashboard/menu",
  "/dashboard/tarefas",
  "/dashboard/notificacoes",
  "/dashboard/cozinha",
  "/dashboard/bar",
  "/dashboard/salao",
]);

const semBarraFinal = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

// 24/11/2026 (dono: "o menu no tablet e no celular… sempre fica embaixo fixo"): a barra
// passa a ficar em TODAS as telas, menos as de trabalho em tela cheia, que têm
// rodapé próprio fixo ou precisam da altura inteira (comandas, KDS, conversa do
// assistente, ponto, tablet de etiquetas, contagem de estoque…).
const SEM_BARRA = Object.freeze([
  "/dashboard/mesas", "/dashboard/salao/mesas", "/dashboard/cozinha/kds", "/dashboard/inteligencia/assistente",
  "/dashboard/rh/ponto", "/dashboard/operacao/etiquetas/tablet", "/dashboard/operacao/estoque/contagens",
  "/dashboard/ia/heitor", "/dashboard/reservas-eventos/rapido", "/dashboard/rh/extra/", "/dashboard/operacao/inteligente/processos/",
  "/dashboard/marketing/sinalizacao", "/dashboard/configuracoes/impressao", "/dashboard/assistente",
]);

/** A barra aparece nesta rota? App dedicado (tablet de loja, KDS) não tem barra. */
export function mostraBarraInferior(pathname, sessao) {
  if (!sessao || sessao.is_app) return false;
  const p = semBarraFinal(String(pathname || ""));
  if (ROTAS_COM_BARRA.has(p)) return true;
  if (!p.startsWith("/dashboard")) return false;
  return !SEM_BARRA.some((r) => (r.endsWith("/") ? p.startsWith(r) : p === r || p.startsWith(`${r}/`)));
}

/** Id da aba acesa nesta rota (ou null). */
export function abaAtiva(pathname, inicio = "/dashboard") {
  const p = semBarraFinal(String(pathname || ""));
  if (p === "/dashboard/marmitaria" || p.startsWith("/dashboard/marmitaria/")) return "delivery";
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
