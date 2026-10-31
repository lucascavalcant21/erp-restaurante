// MENU PRINCIPAL — a única lista das áreas e telas do Héfisto.
//
// O menu do topo (TopNavigation), o botão "voltar" das telas (ERPContext) e os
// antigos painéis /dashboard/modulo/* saem DAQUI: tela que não está no menu
// não vira caminho escondido (pedido do dono, 31/10/2026: "é uma tela que não
// está no meu menu"). Menu reorganizado em 29/10/2026: cada área com o que é
// dela e nomes curtos. Financeiro, Eventos e Marmitaria têm a própria barra de
// áreas, então não têm submenu aqui.

export const MENU_PRINCIPAL = Object.freeze([
{ id: "inteligencia", label: "Inteligência", href: "/dashboard/inteligencia", exigeInteligencia: true },
  {
    id: "vendas", label: "Vendas", href: "/dashboard/vendas",
    submodules: [
      { label: "PDV e vendas", href: "/dashboard/vendas" },
      { label: "Mesas e salão", href: "/dashboard/salao/mesas" },
      { label: "Pedidos online", href: "/dashboard/salao/online" },
      { label: "Delivery", href: "/dashboard/delivery" },
      { label: "Tela da cozinha (KDS)", href: "/dashboard/cozinha/kds" },
      { label: "Clientes", href: "/dashboard/clientes" },
    ],
  },
  {
    id: "cozinha", label: "Cozinha", href: "/dashboard/cozinha",
    submodules: [
      { label: "Painel da cozinha", href: "/dashboard/cozinha" },
      { label: "Fichas técnicas", href: "/dashboard/operacao/fichas" },
      { label: "Produção do dia", href: "/dashboard/operacao/producao" },
      { label: "Guia de montagem", href: "/dashboard/operacao/montagem?dept=cozinha" },
      { label: "Etiquetas", href: "/dashboard/operacao/etiquetas" },
      { label: "Validades", href: "/dashboard/operacao/validade" },
      { label: "Green Dot Assist (tablet)", href: "/dashboard/assistente" },
    ],
  },
  {
    id: "estoque", label: "Estoque", href: "/dashboard/operacao/estoque",
    submodules: [
      { label: "Estoque", href: "/dashboard/operacao/estoque" },
      { label: "Produtos e ingredientes", href: "/dashboard/operacao/ingredientes" },
      { label: "Compras e custo médio", href: "/dashboard/operacao/estoque/compras" },
      { label: "Cotações e pedidos", href: "/dashboard/operacao/compras" },
      { label: "Entrada de notas", href: "/dashboard/operacao/notas" },
      { label: "Fornecedores", href: "/dashboard/operacao/fornecedores" },
      { label: "CMV real", href: "/dashboard/operacao/estoque/cmv" },
      { label: "Embalagens", href: "/dashboard/operacao/materiais/embalagens" },
    ],
  },
  {
    id: "cardapio", label: "Cardápio", href: "/dashboard/operacao/cardapio",
    submodules: [
      { label: "Cardápio digital", href: "/dashboard/operacao/cardapio" },
      { label: "Produtos e canais", href: "/dashboard/operacao/cardapio/produtos" },
      { label: "Promoções e descontos", href: "/dashboard/operacao/cardapio/promocoes" },
      { label: "Fidelidade e selos", href: "/dashboard/operacao/cardapio/fidelidade" },
      { label: "Engenharia de cardápio", href: "/dashboard/operacao/engenharia" },
      { label: "Campanhas", href: "/dashboard/experience/campanhas" },
      { label: "Experiência do cliente", href: "/dashboard/experience/intelligence" },
    ],
  },
  {
    id: "operacao", label: "Operação", href: "/dashboard/operacao/inteligente",
    submodules: [
      { label: "Central operacional", href: "/dashboard/operacao/inteligente" },
      { label: "Controles e checklists", href: "/dashboard/operacao/controles" },
      { label: "Limpeza", href: "/dashboard/operacao/limpeza" },
      { label: "Produtos de limpeza", href: "/dashboard/operacao/materiais/limpeza" },
      { label: "Máquina de lavar", href: "/dashboard/operacao/materiais/maquina" },
      { label: "Manutenção", href: "/dashboard/operacao/manutencao" },
    ],
  },
  { id: "eventos", label: "Eventos", href: "/dashboard/reservas-eventos" },
  { id: "marmitaria", label: "Marmitaria", href: "/dashboard/marmitaria" },
  {
    id: "rh", label: "Equipe", href: "/dashboard/rh",
    submodules: [
      { label: "Painel da equipe", href: "/dashboard/rh" },
      { label: "Ponto e espelho", href: "/dashboard/rh/ponto" },
      { label: "Extras e banco de horas", href: "/dashboard/rh/extra" },
      { label: "Janta dos funcionários", href: "/dashboard/rh/cardapio-funcionarios" },
      { label: "Treinamentos", href: "/dashboard/treinamentos" },
    ],
  },
  { id: "financeiro", label: "Financeiro", href: "/dashboard/financeiro" },
]);

/** Áreas que esta sessão vê no menu. */
export function menuPrincipal({ podeInteligencia = false } = {}) {
  return MENU_PRINCIPAL.filter((m) => !m.exigeInteligencia || podeInteligencia);
}

const rotaDe = (href) => String(href || "").split("?")[0];

/**
 * Área do menu dona da tela: a do link mais específico que casa com a rota
 * (o KDS fica em /cozinha/kds mas é de Vendas; Compras do estoque não é Cotações).
 */
export function areaDaRota(pathname, modulos = MENU_PRINCIPAL) {
  const p = String(pathname || "");
  let melhor = null; let tam = -1;
  for (const m of modulos) {
    for (const h of [m.href, ...(m.submodules || []).map((x) => x.href)]) {
      const r = rotaDe(h);
      if ((p === r || p.startsWith(`${r}/`)) && r.length > tam) { melhor = m; tam = r.length; }
    }
  }
  return melhor;
}

// Antigos painéis /dashboard/modulo/<x>: cada um abre a área do menu equivalente.
const PAINEL_ANTIGO = Object.freeze({
  cozinha: "/dashboard/cozinha",
  bar: "/dashboard/operacao/fichas?dept=bar",
  salao: "/dashboard/salao/mesas",
  financeiro: "/dashboard/financeiro",
  rh: "/dashboard/rh",
  gestao: "/dashboard/operacao/inteligente",
});
export const destinoDoPainelAntigo = (modulo) => PAINEL_ANTIGO[String(modulo || "").toLowerCase()] || "/dashboard";

/** Para onde o botão "voltar/menu" de uma tela leva: a página da área dela no menu. */
export function inicioDaArea(pathname) {
  const area = areaDaRota(pathname);
  if (!area) return "/dashboard";
  // já está na página da área: volta ao início do app
  return rotaDe(area.href) === String(pathname || "") ? "/dashboard" : area.href;
}
