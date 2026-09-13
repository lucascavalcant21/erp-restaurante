// Catálogo único de módulos, páginas e ações do Hefisto.
// É usado pelo menu, pelo guard de rotas e pelo montador de permissões.

export const ACTION_LABELS = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  confirm: "Confirmar",
  cancel: "Cancelar",
  approve: "Aprovar",
  reject: "Reprovar",
  print: "Imprimir",
  export: "Exportar",
  import: "Importar",
  view_values: "Ver valores",
  view_costs: "Ver custos",
  view_margin: "Ver margem de lucro",
  adjust_stock: "Alterar estoque",
  inventory: "Fazer inventário",
  close_inventory: "Fechar inventário",
  transfer: "Transferir produtos",
  record_loss: "Registrar perdas",
  view_history: "Consultar histórico",
  settings: "Alterar configurações",
};

const CRUD = ["view", "create", "edit", "delete"];
const VIEW_EXPORT = ["view", "print", "export"];

export const PERMISSION_MODULES = [
  {
    id: "dashboard", label: "Dashboard",
    pages: [
      { id: "overview", label: "Painel geral", route: "/dashboard", actions: ["view", "view_values", "export"] },
    ],
  },
  {
    id: "ponto", label: "Ponto eletrônico",
    pages: [
      { id: "clock", label: "Relógio de ponto", route: "/dashboard/rh/ponto", actions: ["view", "create", "edit", "delete", "view_history", "export"] },
      // Tela de bater ponto do colaborador (usa geolocalizacao), diferente do
      // painel de ponto do gestor acima.
      { id: "kiosk", label: "Bater ponto (quiosque)", route: "/dashboard/ponto", actions: ["view", "create"] },
    ],
  },
  {
    id: "estoque", label: "Estoque",
    pages: [
      { id: "overview", label: "Visão geral", route: "/dashboard/operacao/estoque", actions: ["view", "create", "edit", "delete", "adjust_stock", "view_values", "view_costs", "export"] },
      { id: "products", label: "Produtos", route: "/dashboard/operacao/ingredientes", actions: [...CRUD, "import", "export", "view_costs"] },
      { id: "entries", label: "Entrada de estoque", route: "/dashboard/operacao/notas", actions: [...CRUD, "confirm", "cancel", "view_costs"] },
      { id: "outputs", label: "Saída de estoque", route: "/dashboard/operacao/estoque", actions: ["view", "create", "confirm", "cancel", "adjust_stock"] },
      { id: "inventory", label: "Inventário", route: "/dashboard/gestao/inventario", actions: ["view", "create", "edit", "inventory", "close_inventory", "export"] },
      { id: "transfers", label: "Transferências", route: "/dashboard/operacao/estoque", actions: ["view", "create", "confirm", "cancel", "transfer"] },
      { id: "losses", label: "Perdas", route: "/dashboard/operacao/estoque", actions: ["view", "create", "approve", "record_loss", "view_history"] },
      { id: "suppliers", label: "Fornecedores", route: "/dashboard/operacao/fornecedores", actions: CRUD },
      { id: "labels", label: "Etiquetas e validade", route: "/dashboard/operacao/etiquetas", actions: ["view", "create", "edit", "delete", "print"] },
    ],
  },
  {
    id: "cozinha", label: "Cozinha",
    pages: [
      { id: "recipes", label: "Fichas técnicas", route: "/dashboard/operacao/fichas?dept=cozinha", actions: [...CRUD, "view_costs", "print", "export"] },
      { id: "assembly", label: "Guia de montagem", route: "/dashboard/operacao/montagem?dept=cozinha", actions: [...CRUD, "print"] },
      { id: "production", label: "Produção do dia", route: "/dashboard/operacao/producao?dept=cozinha", actions: ["view", "create", "edit", "confirm", "cancel", "print"] },
      { id: "cleaning", label: "Controles de limpeza", route: "/dashboard/operacao/controles", actions: CRUD },
      // A entrada de producao acima traz ?dept=cozinha. Quando a URL vem SEM
      // dept, o filtro descarta as duas variantes e a rota caia na entrada
      // generica /dashboard. Esta entrada sem dept cobre esse caso e, por
      // prefixo, o memorando.
      { id: "production_all", label: "Produção do dia (todos os setores)", route: "/dashboard/operacao/producao", actions: ["view", "create", "edit", "confirm", "cancel", "print"] },
      { id: "expiry", label: "Controle de validade", route: "/dashboard/operacao/validade", actions: [...CRUD, "print"] },
      { id: "guides", label: "Guias de uso e função", route: "/dashboard/operacao/guias", actions: ["view", "print"] },
      { id: "kds", label: "KDS — telão da cozinha", route: "/dashboard/kds", actions: ["view", "confirm", "cancel"] },
      // Cobre por prefixo /dashboard/cozinha/kds e /dashboard/cozinha/producao.
      { id: "sector", label: "Operação da cozinha (tablet)", route: "/dashboard/cozinha", actions: ["view", "create", "edit", "confirm"] },
    ],
  },
  {
    id: "bar", label: "Bar",
    pages: [
      { id: "products", label: "Produtos", route: "/dashboard/operacao/ingredientes?dept=bar", actions: [...CRUD, "view_costs"] },
      { id: "recipes", label: "Fichas de drinks", route: "/dashboard/operacao/fichas?dept=bar", actions: [...CRUD, "view_costs", "print"] },
      { id: "assembly", label: "Guia de montagem", route: "/dashboard/operacao/montagem?dept=bar", actions: [...CRUD, "print"] },
      { id: "production", label: "Produção do dia", route: "/dashboard/operacao/producao?dept=bar", actions: ["view", "create", "edit", "confirm", "cancel"] },
      // Cobre por prefixo /dashboard/bar/producao e /dashboard/bar/tablet.
      { id: "sector", label: "Operação do bar (tablet)", route: "/dashboard/bar", actions: ["view", "create", "edit", "confirm"] },
      { id: "drinks_legacy", label: "Drinks (redireciona para as fichas)", route: "/dashboard/operacao/drinks", actions: ["view"] },
    ],
  },
  {
    id: "salao", label: "Salão",
    pages: [
      { id: "overview", label: "Visão do salão", route: "/dashboard/modulo/salao", actions: ["view"] },
      { id: "tables", label: "Mesas", route: "/dashboard/mesas", actions: ["view", "create", "edit", "cancel", "view_values"] },
      { id: "training", label: "Treinamentos", route: "/dashboard/salao/treinamento", actions: CRUD },
      { id: "training_pick", label: "Escolher área de treinamento", route: "/dashboard/treinamentos", actions: CRUD },
      { id: "notes", label: "Observações", route: "/dashboard/operacao/observacoes", actions: CRUD },
      // Cobre por prefixo /dashboard/salao/mesas e /dashboard/salao/online.
      { id: "sector", label: "Operação do salão", route: "/dashboard/salao", actions: ["view", "create", "edit", "confirm", "view_values"] },
    ],
  },
  {
    id: "rh", label: "RH",
    pages: [
      { id: "overview", label: "Painel de RH", route: "/dashboard/rh", actions: ["view", "view_values", "export"] },
      { id: "extras", label: "Cadastro de extras", route: "/dashboard/rh/extra", actions: [...CRUD, "view_values", "view_history"] },
      { id: "employees", label: "Funcionários", route: "/dashboard/rh/gestao", actions: [...CRUD, "view_values", "view_history"] },
      { id: "payroll", label: "Folha de pagamento", route: "/dashboard/rh/fechamento", actions: [...CRUD, "confirm", "view_values", "export"] },
      { id: "orgchart", label: "Organograma", route: "/dashboard/rh/organograma", actions: CRUD },
      { id: "recruiting", label: "Recrutamento", route: "/dashboard/rh/recrutamento", actions: CRUD },
      { id: "minutes", label: "Atas de reunião", route: "/dashboard/rh/atas", actions: [...CRUD, "print"] },
      { id: "employee_portal", label: "Portal do colaborador", route: "/dashboard/rh/colaborador", actions: ["view", "edit", "view_history"] },
      { id: "admin_expenses", label: "Compras do mês", route: "/dashboard/rh/gastos-admin", actions: [...CRUD, "approve", "view_values", "export"] },
    ],
  },
  {
    id: "financeiro", label: "Financeiro",
    pages: [
      { id: "cashflow", label: "Fluxo de caixa", route: "/dashboard/financeiro", actions: [...CRUD, "approve", "reject", "view_values", "export"] },
      // A tela foi absorvida pela Pizza do Lucro; a rota segue viva como
      // redirecionamento, entao continua no catalogo para nao virar 403.
      { id: "breakeven", label: "Ponto de equilíbrio (redireciona)", route: "/dashboard/financeiro/equilibrio", actions: VIEW_EXPORT },
      { id: "dre", label: "Resultado (DRE)", route: "/dashboard/financeiro/dre", actions: [...VIEW_EXPORT, "confirm", "view_values", "view_margin"] },
      { id: "cmv", label: "CMV", route: "/dashboard/financeiro/cmv", actions: [...VIEW_EXPORT, "view_costs", "view_margin"] },
      { id: "pizza_lucro", label: "Pizza do Lucro", route: "/dashboard/financeiro/pizza", actions: [...VIEW_EXPORT, "view_costs", "view_margin"] },
      { id: "fiscal", label: "Dados fiscais", route: "/dashboard/gestao/fiscal", actions: [...CRUD, "view_values", "settings"] },
    ],
  },
  {
    id: "compras", label: "Compras",
    pages: [
      { id: "orders", label: "Lista de compras", route: "/dashboard/operacao/compras", actions: [...CRUD, "approve", "reject", "confirm", "view_costs", "export"] },
      { id: "invoices", label: "Entrada de notas", route: "/dashboard/operacao/notas", actions: [...CRUD, "confirm", "cancel", "view_costs"] },
      { id: "suppliers", label: "Fornecedores", route: "/dashboard/operacao/fornecedores", actions: CRUD },
    ],
  },
  {
    id: "checklist", label: "Checklist",
    pages: [
      { id: "pick_area", label: "Escolher área", route: "/dashboard/checklists", actions: ["view", "create", "edit", "confirm", "view_history"] },
      { id: "execution", label: "Execução", route: "/dashboard/operacao/rotina", actions: ["view", "create", "edit", "confirm", "view_history"] },
      { id: "templates", label: "Modelos", route: "/dashboard/checklists/gerenciar", actions: CRUD },
    ],
  },
  {
    id: "fichas", label: "Fichas técnicas",
    pages: [
      { id: "recipes", label: "Fichas técnicas", route: "/dashboard/operacao/fichas", actions: [...CRUD, "view_costs", "view_margin", "print", "export", "import"] },
      { id: "assembly", label: "Guia de montagem", route: "/dashboard/operacao/montagem", actions: [...CRUD, "print"] },
    ],
  },
  {
    id: "relatorios", label: "Relatórios",
    pages: [
      { id: "reports", label: "Relatórios gerenciais", route: "/dashboard/relatorios", actions: VIEW_EXPORT },
      { id: "audit", label: "Auditoria", route: "/dashboard/gestao/auditoria", actions: ["view", "view_history", "export"] },
    ],
  },
  {
    id: "tarefas", label: "Tarefas e notificações",
    pages: [
      { id: "tasks", label: "Tarefas", route: "/dashboard/tarefas", actions: CRUD },
      { id: "notifications", label: "Notificações", route: "/dashboard/notificacoes", actions: ["view", "edit", "delete"] },
    ],
  },
  {
    id: "vendas", label: "Vendas",
    pages: [
      { id: "pdv", label: "Vendas / PDV", route: "/dashboard/vendas", actions: [...CRUD, "confirm", "cancel", "view_values", "print"] },
      { id: "delivery", label: "Delivery", route: "/dashboard/delivery", actions: [...CRUD, "confirm", "cancel", "view_values"] },
      { id: "ifood", label: "iFood", route: "/dashboard/canais/ifood", actions: ["view", "edit", "settings"] },
    ],
  },
  {
    id: "clientes", label: "Clientes e marketing",
    pages: [
      { id: "overview", label: "Clientes", route: "/dashboard/clientes", actions: [...CRUD, "view_values", "export"] },
      { id: "crm", label: "CRM", route: "/dashboard/clientes/crm", actions: CRUD },
      { id: "campaigns", label: "Campanhas", route: "/dashboard/clientes/campanhas", actions: CRUD },
      { id: "nps", label: "NPS", route: "/dashboard/clientes/nps", actions: ["view", "edit", "export"] },
      { id: "coupons", label: "Cupons", route: "/dashboard/marketing/cupons", actions: CRUD },
    ],
  },
  {
    id: "eventos", label: "Eventos",
    pages: [
      { id: "events", label: "Eventos", route: "/dashboard/eventos", actions: [...CRUD, "approve", "cancel", "view_values", "view_costs", "print", "export"] },
      { id: "budget", label: "Orçamentos", route: "/dashboard/operacao/orcamento", actions: [...CRUD, "approve", "reject", "view_values", "view_costs", "print"] },
      { id: "operation", label: "Eventos na operação", route: "/dashboard/operacao/eventos", actions: [...CRUD, "confirm", "cancel"] },
    ],
  },
  {
    id: "cardapio", label: "Cardápio e produção",
    pages: [
      { id: "menu", label: "Cardápio", route: "/dashboard/operacao/cardapio", actions: [...CRUD, "view_costs", "view_margin", "import", "export"] },
      { id: "products", label: "Produtos de venda", route: "/dashboard/operacao/produtos", actions: [...CRUD, "view_costs", "view_margin"] },
      { id: "engineering", label: "Engenharia de cardápio", route: "/dashboard/operacao/engenharia", actions: ["view", "edit", "view_costs", "view_margin", "export"] },
      { id: "packaging", label: "Embalagens", route: "/dashboard/operacao/embalagens", actions: CRUD },
      { id: "beers", label: "Cervejas", route: "/dashboard/cervejas", actions: CRUD },
    ],
  },
  {
    id: "gestao", label: "Gestão",
    pages: [
      { id: "overview", label: "Painel de gestão", route: "/dashboard/gestao", actions: ["view"] },
      { id: "maintenance", label: "Manutenção", route: "/dashboard/gestao/manutencao", actions: CRUD },
      { id: "documents", label: "Documentos", route: "/dashboard/gestao/documentos", actions: [...CRUD, "view_values", "print"] },
      { id: "supplies", label: "Suprimentos", route: "/dashboard/gestao/suprimentos", actions: CRUD },
      { id: "units", label: "Gestão de unidades", route: "/dashboard/rede/gestao", actions: [...CRUD, "settings"] },
      { id: "network", label: "Visão da rede", route: "/dashboard/rede", actions: ["view", "view_values", "export"] },
      { id: "ai", label: "Assistente Heitor", route: "/dashboard/ia/heitor", actions: ["view", "create"] },
      // Cobre por prefixo processos, rankings, nao-conformidades e a TV.
      { id: "operational_center", label: "Central Operacional", route: "/dashboard/operacao/inteligente", actions: [...CRUD, "confirm", "approve", "export"] },
      { id: "cleaning_supplies", label: "Produtos de limpeza na despensa", route: "/dashboard/operacao/limpeza", actions: [...CRUD, "adjust_stock"] },
      { id: "areas", label: "Áreas de trabalho", route: "/dashboard/area", actions: ["view"] },
    ],
  },
  {
    id: "configuracoes", label: "Configurações",
    pages: [
      { id: "store", label: "Dados da loja", route: "/dashboard/configuracoes", actions: ["view", "edit", "settings"] },
      { id: "users", label: "Usuários e acessos", route: "/dashboard/configuracoes/usuarios", actions: [...CRUD, "settings", "view_history"] },
      { id: "profiles", label: "Perfis de acesso", route: "/dashboard/configuracoes/perfis", actions: [...CRUD, "settings"] },
      { id: "units", label: "Empresas e unidades", route: "/dashboard/configuracoes", actions: [...CRUD, "settings"] },
      { id: "stores", label: "Lojas", route: "/dashboard/lojas", actions: [...CRUD, "settings"] },
      { id: "departments", label: "Departamentos", route: "/dashboard/departamentos", actions: [...CRUD, "settings"] },
    ],
  },
];

export const permissionKey = (moduleId, pageId, action = "view") =>
  `${moduleId}.${pageId}.${action}`;

export const allPermissionKeys = () => PERMISSION_MODULES.flatMap((module) =>
  module.pages.flatMap((page) => page.actions.map((action) => permissionKey(module.id, page.id, action)))
);

export function permissionMatches(granted, wanted) {
  if (granted === "*" || granted === wanted) return true;
  const [moduleId, pageId] = wanted.split(".");
  return granted === `${moduleId}.*` || granted === `${moduleId}.${pageId}.*`;
}

export function hasPermission(session, wanted) {
  if (!session) return false;
  if (session.papel === "admin" || session.super_admin || session.permissions === "*") return true;
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  return permissions.some((granted) => permissionMatches(granted, wanted));
}

function routeParts(route = "") {
  const [path, query = ""] = route.split("?");
  return { path, params: new URLSearchParams(query) };
}

export function pagesForRoute(pathname, search = "") {
  const currentParams = search instanceof URLSearchParams ? search : new URLSearchParams(String(search).replace(/^\?/, ""));
  let candidates = PERMISSION_MODULES.flatMap((module) =>
    module.pages.map((page) => ({ module, page, parsed: routeParts(page.route) }))
  ).filter(({ parsed }) => pathname === parsed.path || pathname.startsWith(`${parsed.path}/`));

  const currentDept = currentParams.get("dept");
  if (currentDept) {
    candidates = candidates.filter(({ parsed }) => !parsed.params.has("dept") || parsed.params.get("dept") === currentDept);
  } else if (candidates.some(({ parsed }) => !parsed.params.has("dept"))) {
    candidates = candidates.filter(({ parsed }) => !parsed.params.has("dept"));
  }
  candidates.sort((a, b) => {
    const deptA = a.parsed.params.has("dept") && a.parsed.params.get("dept") === currentParams.get("dept") ? 1 : 0;
    const deptB = b.parsed.params.has("dept") && b.parsed.params.get("dept") === currentParams.get("dept") ? 1 : 0;
    return deptB - deptA || b.parsed.path.length - a.parsed.path.length;
  });
  return candidates;
}

export function pageForRoute(pathname, search = "") {
  return pagesForRoute(pathname, search)[0] || null;
}

/* As entradas MAIS ESPECÍFICAS que casaram com a rota.
 *
 * `pagesForRoute` casa por prefixo, então uma rota como
 * /dashboard/rh/fechamento casa com três entradas: a própria, o painel de RH
 * (/dashboard/rh) e a tela inicial (/dashboard). Como /dashboard é prefixo de
 * TODO o sistema, perguntar "o usuário tem permissão em alguma delas?" fazia
 * `dashboard.overview.view` — a permissão básica que todo funcionário recebe
 * para ver a tela inicial — abrir folha de pagamento, DRE e a própria tela de
 * usuários e acessos.
 *
 * Quem manda é a entrada mais específica, como em qualquer roteador. Empates
 * (duas entradas para a mesma rota, ou as variantes ?dept=) continuam valendo
 * como alternativas: ter a permissão de qualquer uma delas basta.
 */
function maisEspecificas(candidatas) {
  if (!candidatas.length) return candidatas;
  const alvo = candidatas[0].parsed.path.length;
  return candidatas.filter((c) => c.parsed.path.length === alvo);
}

export function canAccessRoute(session, pathname, search = "") {
  if (!session) return false;
  if (session.papel === "admin" || session.super_admin || session.permissions === "*") return true;
  const found = maisEspecificas(pagesForRoute(pathname, search));
  if (!found.length) return false;
  return found.some(({ module, page }) => hasPermission(session, permissionKey(module.id, page.id, "view")));
}

export function permittedRoutes(session) {
  if (!session || session.permissions === "*" || session.papel === "admin" || session.super_admin) return null;
  return PERMISSION_MODULES.flatMap((module) =>
    module.pages
      .filter((page) => hasPermission(session, permissionKey(module.id, page.id, "view")))
      .map((page) => page.route)
  );
}
