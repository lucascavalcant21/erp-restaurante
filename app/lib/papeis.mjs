// ═══════════════════════════════════════════════════════════════
// papeis.mjs — os papéis da interface e QUEM decide o papel da sessão
//
// Ficou num arquivo próprio (.mjs) para poder ser testado sem subir o app.
// auth.js reexporta PAPEIS e getPapel, então quem já importava de lá continua
// funcionando.
//
// REGRA DE OURO: user_metadata NÃO decide autorização. Ele é gravado pelo
// próprio usuário (supabase.auth.updateUser({ data })), então serve no máximo
// para mostrar um nome na tela. Papel e permissões vêm de
// hefisto_session_context(), que lê usuarios_erp no servidor. Sem esse
// contexto, a sessão fica SEM ACESSO — nunca admin.
// ═══════════════════════════════════════════════════════════════

// Papel de quem entrou mas o servidor não reconhece (ou reconhece como
// inativo). Não enxerga módulo nenhum: é o fundo do poço, de propósito.
export const PAPEL_SEM_ACESSO = "sem_acesso";

export const PAPEIS = [
  {
    id: "admin", label: "Administrador", cor: "#0f172a",
    descricao: "Acesso total, incluindo a Visão de Rede.",
    home: "/dashboard", nav: "*",
  },
  {
    id: "gerente", label: "Gerente de Unidade", cor: "#10b981",
    descricao: "Gestão completa da sua loja (sem visão consolidada da rede).",
    home: "/dashboard/tarefas",
    nav: ["dashboard","tarefas","bar","cozinha","cervejas","vendas","mesas","drinks","montagem","notificacoes","rotina","ingredientes","fichas","cardapio","estoque","fornecedores","eventos","etiquetas","validade","gestao","financeiro","dre","fluxo","cmv","margem","documentos","rh","organograma","configuracoes","gestao_rh","recrutamento","ponto","colaborador","clientes","crm","campanhas","nps","heitor"],
  },
  {
    id: "financeiro", label: "Financeiro", cor: "#3b82f6",
    descricao: "Resultados financeiros da rede e das lojas.",
    home: "/dashboard/financeiro/dre",
    nav: ["dashboard","rede","notificacoes","financeiro","dre","fluxo","cmv","margem","documentos"],
  },
  {
    id: "rh", label: "Recursos Humanos", cor: "#ec4899",
    descricao: "Equipe, ponto e portal do colaborador.",
    home: "/dashboard/rh/gestao",
    nav: ["notificacoes","rh","organograma","configuracoes","gestao_rh","recrutamento","ponto","colaborador"],
  },
  {
    id: "estoque", label: "Estoquista", cor: "#8b5cf6",
    descricao: "Insumos, estoque, fichas, cardápio e fornecedores.",
    home: "/dashboard/tarefas",
    nav: ["tarefas","notificacoes","bar","cozinha","cervejas","estoque","ingredientes","fichas","cardapio","fornecedores","etiquetas","validade","gestao","ponto","colaborador"],
  },
  {
    id: "cozinha", label: "Cozinha / Chef", cor: "#f97316",
    descricao: "Fichas técnicas, cardápio e insumos.",
    home: "/dashboard/tarefas",
    nav: ["tarefas","notificacoes","bar","cozinha","ingredientes","fichas","cardapio","montagem","estoque","etiquetas","validade","gestao","ponto","colaborador"],
  },
  {
    id: "marketing", label: "Marketing", cor: "#f59e0b",
    descricao: "Clientes, campanhas e avaliações.",
    home: "/dashboard/clientes/crm",
    nav: ["dashboard","notificacoes","clientes","crm","campanhas","nps","ponto","colaborador"],
  },
  {
    id: "caixa", label: "Operador de Caixa", cor: "#64748b",
    descricao: "Ponto de venda, painel e notificações do dia.",
    home: "/dashboard/tarefas", nav: ["dashboard","tarefas","vendas","mesas","notificacoes","ponto","colaborador"],
  },
  {
    id: "garcom", label: "Garçom / Atendimento", cor: "#0284c7",
    descricao: "Acesso restrito ao PDV Celular (Mesas).",
    home: "/dashboard/mesas", nav: ["mesas"],
  },
  {
    id: PAPEL_SEM_ACESSO, label: "Sem acesso", cor: "#94a3b8",
    descricao: "Entrou, mas o cadastro no ERP não libera nenhum módulo.",
    home: "/dashboard", nav: [],
  },
];

export function papelExiste(papelId) {
  return PAPEIS.some((p) => p.id === papelId);
}

/** O papel pedido. Papel desconhecido, vazio ou nulo cai em SEM ACESSO —
 *  nunca no primeiro da lista, que é o administrador. */
export function getPapel(papelId) {
  return PAPEIS.find((p) => p.id === papelId)
    || PAPEIS.find((p) => p.id === PAPEL_SEM_ACESSO);
}

/** O papel da sessão, a partir do contexto do SERVIDOR (hefisto_session_context).
 *
 *  Só sai daqui um papel de verdade se o servidor reconheceu o usuário e ele
 *  está ativo. Qualquer outra situação — contexto ausente, usuário sem
 *  cadastro, usuário bloqueado/desativado, papel que a interface não conhece
 *  (`setor`, `terminal_ponto`, `consulta`, `funcionario`, texto solto) — vira
 *  SEM ACESSO. O que vier de user_metadata é ignorado nesta decisão. */
export function papelDaSessao(contextoDoServidor) {
  const ctx = contextoDoServidor || null;
  if (!ctx) return PAPEL_SEM_ACESSO;
  if (ctx.status && ctx.status !== "ativo") return PAPEL_SEM_ACESSO;
  if (ctx.super_admin === true) return "admin";
  // Comparação exata, sem trim e sem normalizar caixa: decisão de autorização
  // não adivinha intenção. " admin " e "ADMIN" não são o papel "admin".
  const papel = ctx.papel;
  return typeof papel === "string" && papelExiste(papel) && papel !== PAPEL_SEM_ACESSO
    ? papel
    : PAPEL_SEM_ACESSO;
}

/** Permissões da sessão. Só valem as que vieram do servidor; sem contexto,
 *  lista vazia (e não "*"). */
export function permissoesDaSessao(contextoDoServidor) {
  const ctx = contextoDoServidor || null;
  if (!ctx) return [];
  if (ctx.status && ctx.status !== "ativo") return [];
  if (ctx.permissions === "*" && ctx.super_admin === true) return "*";
  return Array.isArray(ctx.permissions) ? ctx.permissions : [];
}
