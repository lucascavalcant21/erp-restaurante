// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação e controle de acesso por papel
// ═══════════════════════════════════════════════════════════════

export const PAPEIS = [
  {
    id: "admin",
    label: "Administrador",
    descricao: "Acesso total ao sistema. Visualiza e edita todos os módulos.",
    cor: "#0f172a",
    nav: ["dashboard","notificacoes","rotina","cardapio","estoque","fornecedores","eventos","dre","fluxo","cmv","margem","documentos","gestao_rh","ponto","colaborador","crm","campanhas","nps","heitor"],
    modulos: ["dashboard","notificacoes","rotina","cardapio","estoque","fornecedores","eventos","dre","fluxo","cmv","margem","documentos","gestao_rh","ponto","colaborador","crm","campanhas","nps","heitor"],
  },
  {
    id: "gerente",
    label: "Gerente de Unidade",
    descricao: "Visão operacional e financeira da unidade. Acessa dashboard, estoque, RH e DRE.",
    cor: "#10b981",
    nav: ["dashboard","notificacoes","rotina","cardapio","estoque","fornecedores","eventos","dre","fluxo","cmv","gestao_rh","colaborador"],
    modulos: ["dashboard","notificacoes","rotina","cardapio","estoque","fornecedores","eventos","dre","fluxo","cmv","gestao_rh","colaborador"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    descricao: "Focado em resultados financeiros: DRE, CMV, fluxo de caixa e documentos fiscais.",
    cor: "#3b82f6",
    nav: ["dashboard","dre","fluxo","cmv","margem","documentos"],
    modulos: ["dashboard","dre","fluxo","cmv","margem","documentos"],
  },
  {
    id: "rh",
    label: "Recursos Humanos",
    descricao: "Gerencia colaboradores, escala, ponto e holerites.",
    cor: "#ec4899",
    nav: ["gestao_rh","ponto","colaborador"],
    modulos: ["gestao_rh","ponto","colaborador"],
  },
  {
    id: "estoque",
    label: "Estoquista",
    descricao: "Controle de insumos, categorias e movimentação de estoque.",
    cor: "#8b5cf6",
    nav: ["estoque","cardapio","fornecedores"],
    modulos: ["estoque","cardapio","fornecedores"],
  },
  {
    id: "cozinha",
    label: "Cozinha / Chef",
    descricao: "Acessa fichas técnicas, cardápio e insumos disponíveis.",
    cor: "#f97316",
    nav: ["cardapio","estoque"],
    modulos: ["cardapio","estoque"],
  },
  {
    id: "marketing",
    label: "Marketing",
    descricao: "Gerencia campanhas, clientes e avaliações NPS.",
    cor: "#f59e0b",
    nav: ["dashboard","crm","campanhas","nps"],
    modulos: ["dashboard","crm","campanhas","nps"],
  },
  {
    id: "caixa",
    label: "Operador de Caixa",
    descricao: "Registra vendas e consulta o resumo do dia.",
    cor: "#64748b",
    nav: ["dashboard"],
    modulos: ["dashboard"],
  },
];

const STORAGE_KEY = "erp_sessao";

// ── Salvar sessão ──────────────────────────────────────────────
export function salvarSessao(usuario) {
  try {
    const sessao = {
      ...usuario,
      logadoEm: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));

    // Registra no histórico de logins
    const hist = JSON.parse(localStorage.getItem("erp_login_hist") || "[]");
    const nova = {
      id: Date.now(),
      entrada: sessao.logadoEm,
      saida: null,
      dispositivo: typeof navigator !== "undefined" && navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
    };
    localStorage.setItem("erp_login_hist", JSON.stringify([nova, ...hist].slice(0, 10)));
  } catch (_) {}
}

// ── Ler sessão ─────────────────────────────────────────────────
export function lerSessao() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// ── Encerrar sessão ────────────────────────────────────────────
export function encerrarSessao() {
  try {
    // Registra horário de saída
    const hist = JSON.parse(localStorage.getItem("erp_login_hist") || "[]");
    if (hist.length > 0 && !hist[0].saida) {
      hist[0].saida = new Date().toISOString();
      localStorage.setItem("erp_login_hist", JSON.stringify(hist));
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

// ── Registrar usuário ──────────────────────────────────────────
export function registrarUsuario(dados) {
  try {
    const usuarios = JSON.parse(localStorage.getItem("erp_usuarios") || "[]");
    const jaExiste = usuarios.find((u) => u.email === dados.email);
    if (jaExiste) return { ok: false, erro: "E-mail já cadastrado." };

    const novo = {
      id: Date.now(),
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha, // em produção: hash
      papel: dados.papel,
      unidade: dados.unidade || null,
      telefone: dados.telefone || null,
      criadoEm: new Date().toISOString(),
    };
    localStorage.setItem("erp_usuarios", JSON.stringify([...usuarios, novo]));
    return { ok: true, usuario: novo };
  } catch (_) {
    return { ok: false, erro: "Erro ao salvar. Tente novamente." };
  }
}

// ── Login ──────────────────────────────────────────────────────
export function fazerLogin(email, senha) {
  try {
    const usuarios = JSON.parse(localStorage.getItem("erp_usuarios") || "[]");
    const usuario = usuarios.find((u) => u.email === email && u.senha === senha);
    if (!usuario) return { ok: false, erro: "E-mail ou senha incorretos." };
    salvarSessao(usuario);
    return { ok: true, usuario };
  } catch (_) {
    return { ok: false, erro: "Erro ao autenticar. Tente novamente." };
  }
}

// ── Papel do usuário ───────────────────────────────────────────
export function getPapel(papelId) {
  return PAPEIS.find((p) => p.id === papelId) || PAPEIS[0];
}
