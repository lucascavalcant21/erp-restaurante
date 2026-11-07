// MENU PRINCIPAL — a única lista das áreas e telas do Héfisto.
//
// O menu do topo (TopNavigation), o botão "voltar" das telas (ERPContext) e os
// antigos painéis /dashboard/modulo/* saem DAQUI: tela que não está no menu
// não vira caminho escondido (pedido do dono, 31/10/2026: "é uma tela que não
// está no meu menu"). Menu reorganizado em 29/10/2026: cada área com o que é
// dela e nomes curtos. Financeiro, Eventos e Marmitaria têm a própria barra de
// áreas, então não têm submenu aqui.
//
// Cozinha, Bar e Salão são "universos" (pedido do dono, 03/11/2026): o clique no
// menu abre uma tela de cards só daquela área, e o voltar de qualquer card
// retorna a ela. Os cards ficam aqui, em `secoes`, pela mesma regra da lista
// única. `icone` é o nome de um ícone do lucide-react (ui/IconeModulo.js).
//
// Visual do Nina (pedido do dono, 07/11/2026): cada área tem `icone`, `cor` e
// `desc` curta para o lançador de módulos do Início; a cor dos cards sai do
// ícone (app/lib/cores-modulo.mjs). `destaque` é o card grande grafite no topo
// do universo (o KDS na Cozinha e no Bar, as comandas no Salão): ele sai da
// grade para não aparecer duas vezes.

export const MENU_PRINCIPAL = Object.freeze([
  { id: "inteligencia", label: "Inteligência", href: "/dashboard/inteligencia", exigeInteligencia: true, icone: "BrainCircuit", cor: "violeta", desc: "Análises e recomendações" },
  {
    id: "cozinha", label: "Cozinha", href: "/dashboard/cozinha", icone: "ChefHat", cor: "laranja",
    desc: "Preparo, produção e KDS",
    titulo: "Cozinha", subtitulo: "Tudo o que a cozinha usa no dia a dia",
    destaque: { href: "/dashboard/cozinha/kds?setor=cozinha", acao: "Abrir KDS", setorKds: "cozinha" },
    secoes: [
      { titulo: "Hoje", cards: [
        { label: "Consulta", desc: "Fichas, montagem e cardápio", href: "/dashboard/operacao/consulta?dept=cozinha", icone: "Search" },
        { label: "Anotações", desc: "Produzir hoje ou amanhã e pedir compras", href: "/dashboard/operacao/anotacoes?dept=cozinha", icone: "NotebookPen" },
        { label: "Produção do dia", desc: "Lotes e preparos de hoje", href: "/dashboard/operacao/producao?dept=cozinha", icone: "CookingPot" },
        { label: "Tela da cozinha (KDS)", desc: "Pedidos em preparo", href: "/dashboard/cozinha/kds?setor=cozinha", icone: "ConciergeBell" },
        { label: "Etiquetas", desc: "Imprimir etiquetas de produção", href: "/dashboard/operacao/etiquetas?dept=cozinha", icone: "Tag" },
        { label: "Validades", desc: "O que vence primeiro", href: "/dashboard/operacao/validade", icone: "Hourglass" },
        { label: "Memorando de amanhã", desc: "O que deixar pronto", href: "/dashboard/operacao/producao/memorando", icone: "StickyNote" },
      ] },
      { titulo: "Receitas", cards: [
        { label: "Fichas técnicas", desc: "Receitas, rendimento e custo", href: "/dashboard/operacao/fichas?dept=cozinha", icone: "BookOpen" },
        { label: "Guia de montagem", desc: "Fotos e passo a passo", href: "/dashboard/operacao/montagem?dept=cozinha", icone: "Salad" },
        { label: "Green Dot Assist", desc: "Assistente de bancada no tablet", href: "/dashboard/assistente", icone: "Sparkles" },
      ] },
      { titulo: "Estoque e compras", cards: [
        { label: "Estoque da cozinha", desc: "Entrada e retirada", href: "/dashboard/operacao/estoque?area=cozinha", icone: "Package" },
        { label: "Ingredientes", desc: "Produtos usados nas receitas", href: "/dashboard/operacao/ingredientes?dept=cozinha", icone: "Carrot" },
        { label: "Lista de compras", desc: "Cotações e pedidos", href: "/dashboard/operacao/compras", icone: "ShoppingCart" },
      ] },
      { titulo: "Rotina da equipe", cards: [
        { label: "Checklist operacional", desc: "Abertura e fechamento", href: "/dashboard/operacao/rotina?dept=cozinha&tipo=operacional", icone: "CheckSquare" },
        { label: "Checklist de limpeza", desc: "Limpeza da cozinha", href: "/dashboard/operacao/rotina?dept=cozinha&tipo=limpeza", icone: "SprayCan" },
        { label: "Controles", desc: "Temperaturas e registros", href: "/dashboard/operacao/controles", icone: "Thermometer" },
        { label: "Treinamento", desc: "Aulas com os instrutores da cozinha", href: "/dashboard/treinamento?area=cozinha", icone: "GraduationCap" },
        { label: "Guias de uso", desc: "Equipamentos e produtos", href: "/dashboard/operacao/guias", icone: "FileText" },
      ] },
    ],
  },
  {
    id: "bar", label: "Bar", href: "/dashboard/bar", icone: "GlassWater", cor: "azul",
    desc: "Drinks, produção e KDS",
    titulo: "Bar", subtitulo: "Tudo o que o bar usa no dia a dia",
    destaque: { href: "/dashboard/cozinha/kds?setor=bar", acao: "Abrir KDS", setorKds: "bar" },
    secoes: [
      { titulo: "Hoje", cards: [
        { label: "Consulta", desc: "Fichas, montagem e cardápio", href: "/dashboard/operacao/consulta?dept=bar", icone: "Search" },
        { label: "Anotações", desc: "Produzir hoje ou amanhã e pedir compras", href: "/dashboard/operacao/anotacoes?dept=bar", icone: "NotebookPen" },
        { label: "Produção do dia", desc: "Bases, xaropes e preparos", href: "/dashboard/operacao/producao?dept=bar", icone: "Coqueteleira" },
        { label: "Tela do bar (KDS)", desc: "Pedidos em preparo", href: "/dashboard/cozinha/kds?setor=bar", icone: "ConciergeBell" },
        { label: "Etiquetas", desc: "Imprimir etiquetas do bar", href: "/dashboard/operacao/etiquetas?dept=bar", icone: "Tag" },
        { label: "Validades", desc: "O que vence primeiro", href: "/dashboard/operacao/validade", icone: "Hourglass" },
        { label: "Memorando de amanhã", desc: "O que deixar pronto", href: "/dashboard/operacao/producao/memorando", icone: "StickyNote" },
      ] },
      { titulo: "Drinks", cards: [
        { label: "Fichas de drinks", desc: "Receitas, rendimento e custo", href: "/dashboard/operacao/fichas?dept=bar", icone: "Martini" },
        { label: "Guia de montagem", desc: "Fotos e passo a passo", href: "/dashboard/operacao/montagem?dept=bar", icone: "Citrus" },
        { label: "Criação de drinks", desc: "Novos produtos de venda", href: "/dashboard/operacao/produtos?dept=bar", icone: "WandSparkles" },
        { label: "Engenharia de cardápio", desc: "Margem e giro dos drinks", href: "/dashboard/operacao/engenharia?dept=bar", icone: "Star" },
        { label: "Cardápio digital", desc: "Drinks e QR Code", href: "/dashboard/operacao/cardapio", icone: "Smartphone" },
      ] },
      { titulo: "Estoque e compras", cards: [
        { label: "Estoque do bar", desc: "Entrada e retirada", href: "/dashboard/operacao/estoque?area=bar", icone: "Package" },
        { label: "Produtos do bar", desc: "Bebidas e insumos", href: "/dashboard/operacao/ingredientes?dept=bar", icone: "Wine" },
        { label: "Lista de compras", desc: "Cotações e pedidos", href: "/dashboard/operacao/compras", icone: "ShoppingCart" },
      ] },
      { titulo: "Rotina da equipe", cards: [
        { label: "Checklist operacional", desc: "Abertura e fechamento", href: "/dashboard/operacao/rotina?dept=bar&tipo=operacional", icone: "CheckSquare" },
        { label: "Checklist de limpeza", desc: "Limpeza do bar", href: "/dashboard/operacao/rotina?dept=bar&tipo=limpeza", icone: "SprayCan" },
        { label: "Treinamento", desc: "Aulas com os instrutores do bar", href: "/dashboard/treinamento?area=bar", icone: "GraduationCap" },
        { label: "Guias de uso", desc: "Equipamentos e produtos", href: "/dashboard/operacao/guias", icone: "FileText" },
      ] },
    ],
  },
  {
    id: "salao", label: "Salão", href: "/dashboard/salao", icone: "Store", cor: "rosa",
    desc: "Comandas, caixa e delivery",
    titulo: "Salão", subtitulo: "Tudo o que o salão usa no dia a dia",
    destaque: { href: "/dashboard/mesas", acao: "Abrir comandas" },
    secoes: [
      { titulo: "Atendimento", cards: [
        { label: "Comandas", desc: "Lançar pedidos e pedir a conta", href: "/dashboard/mesas", icone: "ConciergeBell" },
        { label: "Caixa e mesas", desc: "Receber as contas e vender no balcão", href: "/dashboard/salao/mesas", icone: "UtensilsCrossed" },
        { label: "Pedidos online", desc: "Pedidos do cardápio e QR Code", href: "/dashboard/salao/online", icone: "Smartphone" },
        { label: "Delivery", desc: "Entregas em andamento", href: "/dashboard/delivery", icone: "Bike" },
        { label: "Clientes", desc: "Cadastro e relacionamento", href: "/dashboard/clientes", icone: "Users" },
      ] },
      { titulo: "Estoque", cards: [
        { label: "Estoque do salão", desc: "Entrada e retirada", href: "/dashboard/operacao/estoque?area=salao", icone: "Package" },
      ] },
      { titulo: "Rotina da equipe", cards: [
        { label: "Checklist operacional", desc: "Abertura e conferência", href: "/dashboard/operacao/rotina?dept=salao&tipo=operacional", icone: "CheckSquare" },
        { label: "Checklist de limpeza", desc: "Limpeza do salão", href: "/dashboard/operacao/rotina?dept=salao&tipo=limpeza", icone: "SprayCan" },
        { label: "Observações", desc: "Observações padrão dos pedidos", href: "/dashboard/operacao/observacoes", icone: "MessageSquareText" },
        { label: "Treinamento", desc: "Aulas com os instrutores do salão", href: "/dashboard/treinamento?area=salao", icone: "GraduationCap" },
        { label: "Guias de uso", desc: "Equipamentos e produtos", href: "/dashboard/operacao/guias", icone: "FileText" },
      ] },
    ],
  },
  {
    id: "estoque", label: "Estoque", href: "/dashboard/operacao/estoque", icone: "Package", cor: "indigo",
    desc: "Saldos, compras e CMV",
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
    id: "cardapio", label: "Cardápio", href: "/dashboard/operacao/cardapio", icone: "UtensilsCrossed", cor: "vermelho",
    desc: "Cardápio digital e clientes",
    submodules: [
      { label: "Cardápio digital", href: "/dashboard/operacao/cardapio" },
      { label: "Engenharia de cardápio", href: "/dashboard/operacao/engenharia" },
      { label: "Clientes", href: "/dashboard/clientes" },
      { label: "Campanhas", href: "/dashboard/experience/campanhas" },
      { label: "Experiência do cliente", href: "/dashboard/experience/intelligence" },
    ],
  },
  {
    id: "operacao", label: "Operação", href: "/dashboard/operacao/inteligente", icone: "ClipboardList", cor: "ardosia",
    desc: "Controles, limpeza e manutenção",
    submodules: [
      { label: "Central operacional", href: "/dashboard/operacao/inteligente" },
      { label: "Controles e checklists", href: "/dashboard/operacao/controles" },
      { label: "Limpeza", href: "/dashboard/operacao/limpeza" },
      { label: "Produtos de limpeza", href: "/dashboard/operacao/materiais/limpeza" },
      { label: "Máquina de lavar", href: "/dashboard/operacao/materiais/maquina" },
      { label: "Manutenção", href: "/dashboard/operacao/manutencao" },
    ],
  },
  { id: "eventos", label: "Eventos", href: "/dashboard/reservas-eventos", icone: "PartyPopper", cor: "amarelo", desc: "Funil, agenda e reservas" },
  { id: "marmitaria", label: "Marmitaria", href: "/dashboard/marmitaria", icone: "Soup", cor: "dourado", desc: "Pedidos, produção e entregas" },
  {
    id: "rh", label: "Equipe", href: "/dashboard/rh", icone: "Users", cor: "ciano",
    desc: "Ponto, escala e folha",
    submodules: [
      { label: "Painel da equipe", href: "/dashboard/rh" },
      { label: "Quadro de funcionários", href: "/dashboard/rh?aba=quadro" },
      { label: "Escala da semana", href: "/dashboard/rh?aba=escala" },
      { label: "Ponto e espelho", href: "/dashboard/rh/ponto" },
      { label: "Corrigir ponto", href: "/dashboard/rh/ponto/corrigir" },
      { label: "Fechar folha", href: "/dashboard/rh/fechamento" },
      { label: "Extras e banco de horas", href: "/dashboard/rh/extra" },
      { label: "Janta dos funcionários", href: "/dashboard/rh/cardapio-funcionarios" },
      { label: "Treinamento da equipe", href: "/dashboard/treinamento/equipe" },
      { label: "Héfisto Estúdio", href: "/dashboard/treinamento/estudio" },
    ],
  },
  { id: "financeiro", label: "Financeiro", href: "/dashboard/financeiro", icone: "Wallet", cor: "verde", desc: "Contas, caixa e DRE" },
]);

/** Áreas que esta sessão vê no menu. */
export function menuPrincipal({ podeInteligencia = false } = {}) {
  return MENU_PRINCIPAL.filter((m) => !m.exigeInteligencia || podeInteligencia);
}

/**
 * Menu de quem tem acesso limitado: só as áreas que a pessoa pode abrir. A
 * chefe de bar vê Bar, não uma lista de portas que a mandam de volta. `pode`
 * recebe o caminho e a busca (o guarda de rotas usa a mesma regra).
 */
export function menuVisivel(modulos, pode) {
  const liberado = (href) => {
    const [rota, busca = ""] = String(href).split("?");
    return !!pode(rota, busca);
  };
  return modulos
    .map((m) => (m.submodules ? { ...m, submodules: m.submodules.filter((s) => liberado(s.href)) } : m))
    .filter((m) => liberado(m.href) || m.submodules?.length > 0 || cardsDaArea(m).filter(cardAbreUniverso).some((c) => liberado(c.href)));
}

const rotaDe = (href) => String(href || "").split("?")[0];

const buscaDe = (href) => String(href || "").split("?")[1] || "";
const casaRota = (p, r) => p === r || p.startsWith(`${r}/`);
// As telas compartilhadas recebem o setor por ?dept= ou ?area= (Estoque).
const setorDe = (busca) => {
  const q = new URLSearchParams(String(busca || "").replace(/^\?/, ""));
  return q.get("dept") || q.get("area") || null;
};

// O estoque é uma tela só, separada por ?area=. Poder movimentar o estoque do bar
// não pode abrir os universos da Cozinha e do Salão só por causa desse card.
const cardAbreUniverso = (card) => !/[?&]area=/.test(card.href);

/** Todos os cards de um universo, sem as seções. */
export const cardsDaArea = (area) => (area?.secoes || []).flatMap((s) => s.cards);

/** Só Cozinha, Bar e Salão: as áreas que têm tela de cards. */
export const UNIVERSOS = Object.freeze(MENU_PRINCIPAL.filter((m) => m.secoes));
export const universoPorId = (id) => UNIVERSOS.find((u) => u.id === id) || null;

/** A tela de cards abre para quem pode usar ao menos um dos cards dela. */
export function universoLiberado(pathname, pode) {
  const universo = UNIVERSOS.find((u) => u.href === pathname);
  if (!universo) return false;
  return cardsDaArea(universo).filter(cardAbreUniverso).some((c) => {
    const [rota, busca = ""] = c.href.split("?");
    return !!pode(rota, busca);
  });
}

/**
 * Área do menu dona da tela: a do link mais específico que casa com a rota
 * (Compras do estoque não é Cotações). Os links do menu vêm primeiro; os cards
 * dos universos só decidem telas que o menu não lista.
 */
export function areaDaRota(pathname, modulos = MENU_PRINCIPAL) {
  const p = String(pathname || "");
  const buscar = (hrefsDe) => {
    let melhor = null; let tam = -1;
    for (const m of modulos) {
      for (const h of hrefsDe(m)) {
        const r = rotaDe(h);
        if (casaRota(p, r) && r.length > tam) { melhor = m; tam = r.length; }
      }
    }
    return melhor;
  };
  return buscar((m) => [m.href, ...(m.submodules || []).map((x) => x.href)])
    || buscar((m) => cardsDaArea(m).map((x) => x.href));
}

// A mesma tela serve mais de um setor. Um card com setor só vale para aquele
// setor: "Estoque" aberto pelo menu do topo não é o "Estoque do bar".
function cardCasa(card, pathname, search) {
  const r = rotaDe(card.href);
  const p = String(pathname || "");
  if (!casaRota(p, r)) return false;
  const doCard = setorDe(buscaDe(card.href));
  if (!doCard) return true;
  const daTela = setorDe(search);
  return daTela ? daTela === doCard : p !== r;
}

/**
 * Universo em que a tela está. `origem` é o universo aberto por último neste
 * aparelho: é o que decide telas sem setor, como Validades, que servem Cozinha
 * e Bar. Sem origem (link direto), vale o setor da URL e depois o menu.
 */
export function universoDaRota(pathname, search = "", origem = null) {
  const p = String(pathname || "");
  const hub = UNIVERSOS.find((u) => u.href === p);
  if (hub) return hub;
  const daOrigem = universoPorId(origem);
  if (daOrigem && cardsDaArea(daOrigem).some((c) => cardCasa(c, p, search))) return daOrigem;
  const doSetor = universoPorId(setorDe(search));
  if (doSetor && cardsDaArea(doSetor).some((c) => cardCasa(c, p, search))) return doSetor;
  // O treinamento é de toda a casa: sem origem, não pertence a um universo.
  if (casaRota(p, "/dashboard/treinamento")) return null;
  const area = areaDaRota(p);
  return area?.secoes ? area : null;
}

// Antigos painéis /dashboard/modulo/<x>: cada um abre a área do menu equivalente.
const PAINEL_ANTIGO = Object.freeze({
  cozinha: "/dashboard/cozinha",
  bar: "/dashboard/bar",
  salao: "/dashboard/salao",
  financeiro: "/dashboard/financeiro",
  rh: "/dashboard/rh",
  gestao: "/dashboard/operacao/inteligente",
});
export const destinoDoPainelAntigo = (modulo) => PAINEL_ANTIGO[String(modulo || "").toLowerCase()] || "/dashboard";

/**
 * Para onde o botão "voltar/menu" de uma tela leva: a tela de cards do universo
 * de onde ela foi aberta ou, fora deles, a página da área dela no menu.
 */
export function inicioDaArea(pathname, { search = "", origem = null } = {}) {
  const p = String(pathname || "");
  const universo = universoDaRota(p, search, origem);
  if (universo && universo.href !== p) return universo.href;
  const area = areaDaRota(p);
  if (!area) return "/dashboard";
  // já está na página da área: volta ao início do app
  return rotaDe(area.href) === p ? "/dashboard" : area.href;
}

/**
 * Onde a tela está no menu, para o cabeçalho das páginas (visual do Nina,
 * 07/11/2026): a área (trilha "Cozinha / Produção do dia") e o card ou item do
 * menu que abre a tela (ícone colorido e nome). Mesma regra do "voltar": o
 * universo de origem e o setor da URL decidem telas compartilhadas.
 * @returns {{ area: object|null, item: object|null }}
 */
export function telaDaRota(pathname, search = "", origem = null) {
  const p = String(pathname || "");
  const universo = universoDaRota(p, search, origem);
  const area = universo || areaDaRota(p);
  if (!area) return { area: null, item: null };
  const candidatos = [
    ...cardsDaArea(area).filter((c) => cardCasa(c, p, search)),
    ...(area.submodules || []).filter((s) => casaRota(p, rotaDe(s.href))),
  ];
  // o link mais específico vence (Compras e custo médio não é Estoque)
  let item = null; let tam = -1;
  for (const c of candidatos) {
    const r = rotaDe(c.href).length;
    if (r > tam) { item = c; tam = r; }
  }
  if (item && !item.icone) item = { ...item, icone: area.icone, cor: area.cor };
  return { area, item: item || null };
}
