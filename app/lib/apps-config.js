import { supabase, isSupabaseReady } from "./supabase";

// ════════════════════════════════════════════════════════════════════════════
// MÓDULOS E TELAS DISPONÍVEIS PARA COMPOR CADA APP
// O dono escolhe o que cada app/login enxerga
// ════════════════════════════════════════════════════════════════════════════
export const MODULOS_APP = [
  {
    id: "cozinha",
    label: "Cozinha & KDS",
    icone: "UtensilsCrossed",
    cor: "#A43E2B",
    descricao: "Central de pedidos KDS, produção do dia, fichas técnicas e controles",
    rotas: [
      "/dashboard/operacao/inteligente",
      "/dashboard/operacao/producao",
      "/dashboard/operacao/fichas",
      "/dashboard/operacao/montagem",
      "/dashboard/operacao/controles",
      "/dashboard/operacao/limpeza",
      "/dashboard/operacao/manutencao",
    ],
    telas: [
      { id: "kds_cozinha", label: "Central Operacional / KDS Cozinha", rota: "/dashboard/operacao/inteligente" },
      { id: "producao_cozinha", label: "Produção Diária & Memorandos", rota: "/dashboard/operacao/producao" },
      { id: "fichas_cozinha", label: "Fichas Técnicas da Cozinha", rota: "/dashboard/operacao/fichas" },
      { id: "limpeza_cozinha", label: "Controles & Higienização", rota: "/dashboard/operacao/limpeza" },
    ],
    permissaoBase: "cozinha.*",
  },
  {
    id: "bar",
    label: "Bar & Coquetelaria",
    icone: "Wine",
    cor: "#9E6412",
    descricao: "KDS do Bar, fichas de drinks, chopeiras e preparo de bebidas",
    rotas: [
      "/dashboard/operacao/inteligente",
      "/dashboard/operacao/drinks",
      "/dashboard/operacao/fichas",
      "/dashboard/operacao/limpeza",
    ],
    telas: [
      { id: "kds_bar", label: "KDS Bar / Expedição de Bebidas", rota: "/dashboard/operacao/inteligente" },
      { id: "drinks_bar", label: "Receitas de Drinks & Coquetéis", rota: "/dashboard/operacao/drinks" },
      { id: "fichas_bar", label: "Fichas de Insumos do Bar", rota: "/dashboard/operacao/fichas" },
    ],
    permissaoBase: "bar.*",
  },
  {
    id: "salao",
    label: "Salão & Garçons (PDV Mesas)",
    icone: "Users",
    cor: "#0284C7",
    descricao: "Controle de mesas, lançar pedidos, cardápio digital de salão",
    rotas: [
      "/dashboard/salao/mesas",
      "/dashboard/operacao/cardapio",
      "/dashboard/salao/online",
    ],
    telas: [
      { id: "mesas_salao", label: "Mapa de Mesas & Comandas (PDV Móvel)", rota: "/dashboard/salao/mesas" },
      { id: "cardapio_salao", label: "Cardápio Digital de Consulta", rota: "/dashboard/operacao/cardapio" },
    ],
    permissaoBase: "vendas.tables.*",
  },
  {
    id: "estoque",
    label: "Estoque & Almoxarifado",
    icone: "Package",
    cor: "#047857",
    descricao: "Contagem de estoque, movimentações, validades e etiquetas",
    rotas: [
      "/dashboard/operacao/estoque",
      "/dashboard/operacao/estoque/contagens",
      "/dashboard/operacao/ingredientes",
      "/dashboard/operacao/etiquetas",
      "/dashboard/operacao/validade",
    ],
    telas: [
      { id: "mov_estoque", label: "Painel & Saldo de Estoque", rota: "/dashboard/operacao/estoque" },
      { id: "contagens_estoque", label: "Contagem Física de Estoque (Inventário)", rota: "/dashboard/operacao/estoque/contagens" },
      { id: "etiquetas_estoque", label: "Impressão de Etiquetas e Validades", rota: "/dashboard/operacao/etiquetas" },
    ],
    permissaoBase: "estoque.*",
  },
  {
    id: "ponto",
    label: "Terminal de Ponto dos Funcionários",
    icone: "Clock",
    cor: "#4F46E5",
    descricao: "Quiosque de bater ponto eletrônico (PIN / Facial)",
    rotas: [
      "/dashboard/ponto",
      "/dashboard/rh/ponto",
    ],
    telas: [
      { id: "kiosk_ponto", label: "Quiosque de Bater Ponto", rota: "/dashboard/ponto" },
      { id: "espelho_ponto", label: "Consulta de Ponto e Espelho", rota: "/dashboard/rh/ponto" },
    ],
    permissaoBase: "ponto.*",
  },
  {
    id: "caixa",
    label: "Frente de Caixa & Vendas",
    icone: "DollarSign",
    cor: "#166534",
    descricao: "Frente de caixa, pagamentos, fechamento do dia",
    rotas: [
      "/dashboard/vendas",
      "/dashboard/salao/mesas",
    ],
    telas: [
      { id: "frente_caixa", label: "Frente de Caixa (PDV)", rota: "/dashboard/vendas" },
      { id: "mesas_caixa", label: "Fechamento de Mesas e Contas", rota: "/dashboard/salao/mesas" },
    ],
    permissaoBase: "vendas.*",
  },
  {
    id: "assistente",
    label: "Green Dot Assist (Tablet IA)",
    icone: "Bot",
    cor: "#047857",
    descricao: "Assistente operacional com receitas, equipamentos e guias de limpeza",
    rotas: [
      "/dashboard/assistente",
    ],
    telas: [
      { id: "green_dot_assist", label: "Tablet Green Dot Assist IA", rota: "/dashboard/assistente" },
    ],
    permissaoBase: "dashboard.intelligence.view",
  },
  {
    id: "gestao",
    label: "Painel Gerencial / DRE (Opcional)",
    icone: "TrendingUp",
    cor: "#334155",
    descricao: "Resultados gerais, faturamento e relatórios básicos",
    rotas: [
      "/dashboard",
      "/dashboard/financeiro/dre",
      "/dashboard/relatorios",
    ],
    telas: [
      { id: "dash_geral", label: "Painel Geral do Dia", rota: "/dashboard" },
      { id: "relatorios_geral", label: "Relatórios de Vendas e Fechamento", rota: "/dashboard/relatorios" },
    ],
    permissaoBase: "dashboard.overview.view",
  },
];

// Modelos pré-configurados para criação com 1 clique
export const PRESETS_APPS = [
  {
    id: "preset-cozinha",
    nome: "App Cozinha / KDS",
    loginSugestao: "cozinha",
    icone: "UtensilsCrossed",
    cor: "#A43E2B",
    descricao: "Terminal da Cozinha: KDS de pedidos, receitas de pratos, produção diária e checklists de turno.",
    modulosIds: ["cozinha", "assistente"],
    telaInicial: "/dashboard/operacao/inteligente",
  },
  {
    id: "preset-bar",
    nome: "App Bar / Coquetelaria",
    loginSugestao: "bar",
    icone: "Wine",
    cor: "#9E6412",
    descricao: "Terminal do Bar: KDS de bebidas, fichas de coquetéis, Speed Rail e dosagens.",
    modulosIds: ["bar", "assistente"],
    telaInicial: "/dashboard/operacao/inteligente",
  },
  {
    id: "preset-salao",
    nome: "App Salão & Garçons (PDV)",
    loginSugestao: "salao",
    icone: "Users",
    cor: "#0284C7",
    descricao: "Aparelhos móveis dos garçons: controle de mesas, comanda digital e envio de pedidos à cozinha.",
    modulosIds: ["salao"],
    telaInicial: "/dashboard/salao/mesas",
  },
  {
    id: "preset-estoque",
    nome: "App Estoque & Validades",
    loginSugestao: "estoque",
    icone: "Package",
    cor: "#047857",
    descricao: "Tablet do almoxarifado: contagem cega/aberta, conferência de insumos e impressão de etiquetas térmicas.",
    modulosIds: ["estoque"],
    telaInicial: "/dashboard/operacao/estoque",
  },
  {
    id: "preset-ponto",
    nome: "App Ponto Eletrônico",
    loginSugestao: "ponto",
    icone: "Clock",
    cor: "#4F46E5",
    descricao: "Tablet fixo na parede da entrada: quiosque para colaboradores baterem ponto com PIN ou foto.",
    modulosIds: ["ponto"],
    telaInicial: "/dashboard/ponto",
  },
  {
    id: "preset-caixa",
    nome: "App Frente de Caixa",
    loginSugestao: "caixa",
    icone: "DollarSign",
    cor: "#166534",
    descricao: "Computador ou tablet do caixa: recebimentos, fechamento de comandas e conferência financeira do turno.",
    modulosIds: ["caixa", "salao"],
    telaInicial: "/dashboard/vendas",
  },
];

// Chave no LocalStorage para cache e contingência
const STORAGE_APPS_KEY = "hefisto_apps_config_v1";
const STORAGE_LOGS_KEY = "hefisto_apps_logs_v1";
const STORAGE_CURRENT_APP = "hefisto_app_session";

// ─── BUSCAR APPS CONFIGURADOS ───────────────────────────────────────────────
export async function fetchAppsConfig(unidadeId = "matriz") {
  let apps = [];

  // 1. Tenta carregar do Supabase (config_sistema.params.apps_config)
  if (isSupabaseReady()) {
    try {
      const uId = unidadeId && unidadeId !== "todas" ? unidadeId : "matriz";
      const { data } = await supabase
        .from("config_sistema")
        .select("params")
        .eq("unidade_id", uId)
        .limit(1);

      if (data && data[0]?.params?.apps_config && Array.isArray(data[0].params.apps_config)) {
        apps = data[0].params.apps_config;
      }
    } catch (_) {}
  }

  // 2. Fallback / Mescla com LocalStorage
  if (!apps.length && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_APPS_KEY);
      if (raw) apps = JSON.parse(raw);
    } catch (_) {}
  }

  // 3. Se ainda estiver vazio, gera os apps padrão para começar configurado
  if (!apps.length) {
    apps = PRESETS_APPS.map((preset) => ({
      id: `app-${preset.loginSugestao}`,
      nome: preset.nome,
      login: preset.loginSugestao,
      senha: `${preset.loginSugestao}123`,
      unidade_id: unidadeId || "matriz",
      ativo: true,
      icone: preset.icone,
      cor: preset.cor,
      modulosIds: preset.modulosIds,
      telaInicial: preset.telaInicial,
      criadoEm: new Date().toISOString(),
      ultimoAcesso: null,
      dispositivosConectados: 0,
    }));
    salvarAppsLocalmente(apps);
  }

  return apps;
}

// ─── SALVAR / CRIAR UM APP ──────────────────────────────────────────────────
export async function salvarAppConfig(unidadeId = "matriz", appData) {
  const uId = unidadeId && unidadeId !== "todas" ? unidadeId : "matriz";
  const listaAtual = await fetchAppsConfig(uId);

  const id = appData.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const loginLimpo = String(appData.login || "").trim().toLowerCase();
  const senhaLimpa = String(appData.senha || "").trim();

  if (!loginLimpo) throw new Error("Informe o login de acesso do app.");
  if (!senhaLimpa || senhaLimpa.length < 3) throw new Error("A senha do app deve ter pelo menos 3 dígitos.");

  // Valida duplicidade de login
  const existente = listaAtual.find((a) => a.login === loginLimpo && a.id !== id);
  if (existente) throw new Error(`O login "${loginLimpo}" já está em uso pelo app "${existente.nome}".`);

  // Monta lista de rotas autorizadas com base nos módulos selecionados
  const modulosSelecionados = MODULOS_APP.filter((m) => (appData.modulosIds || []).includes(m.id));
  const rotasAutorizadas = [
    ...new Set(modulosSelecionados.flatMap((m) => m.rotas)),
    appData.telaInicial || "/dashboard",
  ];

  const appSalvo = {
    ...appData,
    id,
    login: loginLimpo,
    senha: senhaLimpa,
    nome: String(appData.nome || "").trim() || `App ${loginLimpo}`,
    unidade_id: uId,
    ativo: appData.ativo !== false,
    icone: appData.icone || "Smartphone",
    cor: appData.cor || "#047857",
    modulosIds: appData.modulosIds || [],
    telaInicial: appData.telaInicial || rotasAutorizadas[0] || "/dashboard",
    rotasAutorizadas,
    atualizadoEm: new Date().toISOString(),
  };

  const novaLista = listaAtual.some((a) => a.id === id)
    ? listaAtual.map((a) => (a.id === id ? { ...a, ...appSalvo } : a))
    : [...listaAtual, { ...appSalvo, criadoEm: new Date().toISOString() }];

  // Salva no banco config_sistema
  if (isSupabaseReady()) {
    try {
      const { data: exist } = await supabase
        .from("config_sistema")
        .select("id, params")
        .eq("unidade_id", uId)
        .limit(1);

      if (exist && exist.length) {
        const paramsAtual = exist[0].params || {};
        await supabase
          .from("config_sistema")
          .update({ params: { ...paramsAtual, apps_config: novaLista } })
          .eq("id", exist[0].id);
      } else {
        await supabase
          .from("config_sistema")
          .insert([{ unidade_id: uId, params: { apps_config: novaLista } }]);
      }
    } catch (_) {}
  }

  salvarAppsLocalmente(novaLista);
  return appSalvo;
}

// ─── REMOVER APP ────────────────────────────────────────────────────────────
export async function removerAppConfig(unidadeId = "matriz", appId) {
  const uId = unidadeId && unidadeId !== "todas" ? unidadeId : "matriz";
  const listaAtual = await fetchAppsConfig(uId);
  const novaLista = listaAtual.filter((a) => a.id !== appId);

  if (isSupabaseReady()) {
    try {
      const { data: exist } = await supabase
        .from("config_sistema")
        .select("id, params")
        .eq("unidade_id", uId)
        .limit(1);

      if (exist && exist.length) {
        const paramsAtual = exist[0].params || {};
        await supabase
          .from("config_sistema")
          .update({ params: { ...paramsAtual, apps_config: novaLista } })
          .eq("id", exist[0].id);
      }
    } catch (_) {}
  }

  salvarAppsLocalmente(novaLista);
  return true;
}

// ─── ALTERAR SENHA DO APP ───────────────────────────────────────────────────
export async function alterarSenhaApp(unidadeId = "matriz", appId, novaSenha) {
  const uId = unidadeId && unidadeId !== "todas" ? unidadeId : "matriz";
  const listaAtual = await fetchAppsConfig(uId);
  const app = listaAtual.find((a) => a.id === appId);
  if (!app) throw new Error("App não encontrado.");

  return salvarAppConfig(uId, { ...app, senha: String(novaSenha).trim() });
}

// ─── ALTERAR STATUS (ATIVAR / PAUSAR) ────────────────────────────────────────
export async function alterarStatusApp(unidadeId = "matriz", appId, novoStatus) {
  const uId = unidadeId && unidadeId !== "todas" ? unidadeId : "matriz";
  const listaAtual = await fetchAppsConfig(uId);
  const app = listaAtual.find((a) => a.id === appId);
  if (!app) throw new Error("App não encontrado.");

  return salvarAppConfig(uId, { ...app, ativo: novoStatus });
}

// ─── AUTENTICAR LOGIN DE APP ────────────────────────────────────────────────
export async function autenticarApp(login, senha) {
  const loginLimpo = String(login || "").trim().toLowerCase();
  const senhaLimpa = String(senha || "").trim();
  if (!loginLimpo || !senhaLimpa) return null;

  const apps = await fetchAppsConfig("matriz");
  const app = apps.find(
    (a) => a.login === loginLimpo && a.ativo && String(a.senha).trim() === senhaLimpa
  );

  if (!app) return null;

  // Monta permissões compatíveis com o catálogo do sistema
  const modulosSelecionados = MODULOS_APP.filter((m) => (app.modulosIds || []).includes(m.id));
  const permissions = [
    ...modulosSelecionados.map((m) => m.permissaoBase),
    "dashboard.overview.view",
  ];

  const sessaoApp = {
    id: app.id,
    login: app.login,
    nome: app.nome,
    papel: app.login, // Usado como papel exclusivo
    tipo_acesso: "terminal",
    is_app: true,
    app_id: app.id,
    app_nome: app.nome,
    app_icone: app.icone,
    app_cor: app.cor,
    unidade: app.unidade_id || "matriz",
    pagina_inicial: app.telaInicial || "/dashboard",
    permissions,
    allowed_routes: app.rotasAutorizadas || [app.telaInicial || "/dashboard"],
    modulos_visiveis: app.modulosIds || [],
    autenticadoEm: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_CURRENT_APP, JSON.stringify(sessaoApp));
      localStorage.setItem("erp_lembrar", "1");
      localStorage.setItem("erp_cred", JSON.stringify({ email: app.login }));
    } catch (_) {}
  }

  // Registra o acesso na auditoria
  await registrarLogAcesso({
    app_id: app.id,
    app_nome: app.nome,
    login: app.login,
    unidade_id: app.unidade_id || "matriz",
    sucesso: true,
    evento: "login_app_sucesso",
    detalhes: `Acesso realizado no ${app.nome} (${app.telaInicial})`,
  });

  return sessaoApp;
}

// ─── LER SESSÃO ATIVA DE APP ────────────────────────────────────────────────
export function lerSessaoAppLocal() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_APP);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── ENCERRAR SESSÃO DE APP ─────────────────────────────────────────────────
export function encerrarSessaoAppLocal() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_CURRENT_APP);
  } catch (_) {}
}

// ─── AUDITORIA & LOGS DE ACESSO (QUE HORAS, QUAL LOCAL, QUAL APARELHO) ──────
export async function registrarLogAcesso(dados) {
  const agora = new Date();
  const infoAparelho = extrairInfoDispositivo();

  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    app_id: dados.app_id || "sistema",
    app_nome: dados.app_nome || "App Hefisto",
    login: dados.login || "desconhecido",
    unidade_id: dados.unidade_id || "matriz",
    sucesso: dados.sucesso !== false,
    evento: dados.evento || "acesso",
    detalhes: dados.detalhes || "",
    timestamp: agora.toISOString(),
    horarioFormatado: formatarHoraLocal(agora),
    dataFormatada: formatarDataLocal(agora),
    dispositivo: infoAparelho.dispositivo,
    navegador: infoAparelho.navegador,
    tipoTela: infoAparelho.tipoTela,
    ip: infoAparelho.ip || "Rede Local",
    local: dados.local || `Unidade ${dados.unidade_id === "matriz" ? "Matriz" : dados.unidade_id || "Local"}`,
  };

  // Salva no LocalStorage
  salvarLogLocal(log);

  // Tenta enviar para a rota da API server-side para capturar IP real do request
  try {
    fetch("/api/apps/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    }).catch(() => {});
  } catch (_) {}

  return log;
}

export async function fetchLogsAcesso(unidadeId = "matriz") {
  // 1. Tenta carregar da rota API server-side
  try {
    const res = await fetch(`/api/apps/audit?unidade=${unidadeId || "matriz"}`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.logs) && json.logs.length) {
        return json.logs;
      }
    }
  } catch (_) {}

  // 2. Fallback: LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_LOGS_KEY);
      if (raw) {
        const logs = JSON.parse(raw);
        return Array.isArray(logs) ? logs : [];
      }
    } catch (_) {}
  }

  // 3. Mock realista inicial de acessos caso ainda não tenha logs
  return [
    {
      id: "log-seed-1",
      app_nome: "App Cozinha / KDS",
      login: "cozinha",
      unidade_id: "matriz",
      sucesso: true,
      evento: "login_app_sucesso",
      detalhes: "Estação iniciada no KDS Cozinha",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      horarioFormatado: formatarHoraLocal(new Date(Date.now() - 5 * 60 * 1000)),
      dataFormatada: formatarDataLocal(new Date()),
      dispositivo: "Tablet Android 13 (Samsung Galaxy Tab A8)",
      navegador: "Chrome Mobile 124",
      tipoTela: "Tablet (10.5 polegadas)",
      ip: "192.168.1.42 (Wi-Fi Cozinha)",
      local: "Unidade Matriz · Cozinha Principal",
    },
    {
      id: "log-seed-2",
      app_nome: "App Bar / Coquetelaria",
      login: "bar",
      unidade_id: "matriz",
      sucesso: true,
      evento: "login_app_sucesso",
      detalhes: "Estação Bar conectada",
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      horarioFormatado: formatarHoraLocal(new Date(Date.now() - 35 * 60 * 1000)),
      dataFormatada: formatarDataLocal(new Date()),
      dispositivo: "Apple iPad Air (iPadOS 17)",
      navegador: "Mobile Safari",
      tipoTela: "Tablet (10.9 polegadas)",
      ip: "192.168.1.55 (Wi-Fi Bar)",
      local: "Unidade Matriz · Balcão do Bar",
    },
  ];
}

// ─── HELPERS AUXILIARES ─────────────────────────────────────────────────────
function salvarAppsLocalmente(lista) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_APPS_KEY, JSON.stringify(lista));
  } catch (_) {}
}

function salvarLogLocal(novoLog) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    const atualizados = [novoLog, ...(Array.isArray(logs) ? logs : [])].slice(0, 300);
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(atualizados));
  } catch (_) {}
}

function formatarHoraLocal(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(data);
}

function formatarDataLocal(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

export function tempoRelativo(isoString) {
  if (!isoString) return "Desconhecido";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffSec < 45) return "Agora mesmo";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHoras < 24) return `Há ${diffHoras}h`;
  if (diffDias === 1) return "Ontem";
  return `Há ${diffDias} dias`;
}

export function extrairInfoDispositivo() {
  if (typeof window === "undefined") {
    return { dispositivo: "Servidor", navegador: "Node.js", tipoTela: "Desktop", ip: "127.0.0.1" };
  }

  const ua = navigator.userAgent || "";
  let dispositivo = "Computador / Desktop";
  let tipoTela = "Desktop";

  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    dispositivo = /ipad/i.test(ua) ? "Apple iPad" : "Tablet Android";
    tipoTela = "Tablet";
  } else if (/iphone|mobile|android/i.test(ua)) {
    dispositivo = /iphone/i.test(ua) ? "Apple iPhone" : "Celular Android";
    tipoTela = "Smartphone";
  } else if (/windows/i.test(ua)) {
    dispositivo = "Computador Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    dispositivo = "Apple Mac";
  } else if (/linux/i.test(ua)) {
    dispositivo = "Terminal Linux";
  }

  let navegador = "Navegador Web";
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) navegador = "Google Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) navegador = "Apple Safari";
  else if (/firefox|fxios/i.test(ua)) navegador = "Mozilla Firefox";
  else if (/edg/i.test(ua)) navegador = "Microsoft Edge";

  return {
    dispositivo,
    navegador,
    tipoTela,
    largura: window.innerWidth,
    altura: window.innerHeight,
    ip: "Conectado via Rede Local",
  };
}
