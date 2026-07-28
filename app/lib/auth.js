// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação (Supabase Auth) + permissões por papel
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { canAccessRoute, permittedRoutes } from "./permissions-catalog";

// Papéis: cada um tem uma "home" (pra onde vai ao logar) e os módulos que enxerga.
// nav: "*" = tudo; ou lista de ids de módulos (iguais aos do menu/getNavId).
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
];

export function getPapel(papelId) {
  return PAPEIS.find((p) => p.id === papelId) || PAPEIS[0];
}

/** Verifica se o papel logado é o Cérebro (Administrador Master) */
export function isCerebro(papelId) {
  return papelId === "admin";
}

/** Verifica se o papel tem permissão de edição global nas tabelas do sistema */
export function podeEditarGlobal(papelId) {
  return papelId === "admin";
}

/** Rota inicial do papel (pra onde vai ao logar). */
export function homeDoPapel(papelId) {
  return getPapel(papelId).home || "/dashboard";
}

/** Se o papel pode acessar um módulo (navId). */
export function podeAcessar(papelId, navId) {
  const nav = getPapel(papelId).nav;
  return nav === "*" || (Array.isArray(nav) && nav.includes(navId));
}

// ── Mapeia o usuário do Supabase para o formato do app ─────────
function mapUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return {
    id: u.id, email: u.email,
    nome: m.nome || (u.email ? u.email.split("@")[0] : "Usuário"),
    papel: m.papel || "admin", unidade: m.unidade || null,
  };
}

async function enrichUser(u) {
  const base = mapUser(u);
  if (!base || !isSupabaseReady()) return base;
  try {
    const { data, error } = await supabase.rpc("hefisto_session_context");
    if (error || !data) return base;
    return {
      ...base,
      ...data,
      id: u.id,
      email: data.email || base.email,
      nome: data.nome || base.nome,
      unidade: data.unidade || base.unidade,
      gerenciado: true,
    };
  } catch {
    // A migração pode ainda não ter sido aplicada. Mantém os papéis antigos
    // funcionando até o administrador concluir a instalação no banco.
    return base;
  }
}

function traduzErro(msg = "") {
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already been registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/at least 6/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/Unable to validate email/i.test(msg)) return "E-mail inválido.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  return msg || "Erro de autenticação.";
}

// ── Helpers de Conversão Usuário <-> E-mail (Multi-tenant Login) ───────────────
export function formatarParaEmailFantasma(usuario) {
  if (!usuario) return "";
  // Se já tiver '@', assumimos que o usuário digitou o e-mail completo real (Cérebro).
  if (usuario.includes("@")) return usuario.trim().toLowerCase();
  
  // Limpa espaços e cria o e-mail fantasma (ex: "matriz" vira "matriz@hefisto.app")
  const slug = usuario.trim().toLowerCase().replace(/\s+/g, ".");
  return `${slug}@hefisto.app`;
}

// ── Registrar ──────────────────────────────────────────────────
export async function registrarUsuario({ nome, email, senha, papel, unidade }) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { ok: false, erro: "Somente um administrador autenticado pode criar usuários." };
  const profileByRole = {
    admin: "administrador-geral", gerente: "gerente-geral", financeiro: "financeiro",
    rh: "recursos-humanos", estoque: "estoquista", cozinha: "cozinheiro",
    caixa: "caixa", garcom: "garcom", marketing: "marketing",
  };
  try {
    const response = await fetch("/api/admin/access-control", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: "create-user",
        user: {
          nome, email, login: String(email).split("@")[0], password: senha,
          unidade_principal_id: unidade,
          tipo_acesso: papel === "admin" ? "administrador" : papel === "gerente" ? "gerente" : "funcionario",
          profile_code: profileByRole[papel] || "somente-consulta",
          pagina_inicial: homeDoPapel(papel), exigir_troca_senha: true, status: "ativo",
        },
        scopes: [{ unidade_id: unidade, data_scope: "unidade" }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, erro: result.error || "Não foi possível criar o usuário." };
    return { ok: true, usuario: result.user, precisaConfirmar: false };
  } catch (error) {
    return { ok: false, erro: traduzErro(error.message) };
  }
}

// ── Login ──────────────────────────────────────────────────────
export async function fazerLogin(email, senha) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  const usuario = await enrichUser(data.user);
  if (usuario?.gerenciado && usuario.status !== "ativo") {
    await supabase.auth.signOut();
    return { ok: false, erro: "Acesso indisponível. Fale com o administrador." };
  }
  if (usuario?.terminate_previous_sessions) {
    try { await supabase.auth.signOut({ scope: "others" }); } catch (_) {}
  }
  return { ok: true, usuario };
}

// ── Sessão ─────────────────────────────────────────────────────
export async function lerSessao() {
  if (!isSupabaseReady()) return null;
  let { data } = await supabase.auth.getSession();
  // Se não achou a sessão de primeira (token expirado ou rede oscilou ao voltar
  // do segundo plano), tenta renovar pelo refresh token antes de dar como
  // deslogado — assim o usuário não é expulso à toa no celular/tablet.
  if (!data?.session) {
    try {
      const r = await supabase.auth.refreshSession();
      if (r?.data?.session) data = r.data;
    } catch (_) {}
  }
  if (data?.session?.user) {
    const usuario = await enrichUser(data.session.user);
    if (usuario?.gerenciado && usuario.status !== "ativo") {
      await supabase.auth.signOut();
      return null;
    }
    return usuario;
  }

  // TOLERÂNCIA OFFLINE: no celular/tablet o app reabre muitas vezes SEM rede no
  // primeiro instante — a renovação falha e o usuário era expulso pro login
  // mesmo com a sessão válida guardada no aparelho. Se a sessão persistida
  // ainda existe (o Supabase a apaga quando o refresh token é realmente
  // inválido), seguimos logados; o autoRefresh renova quando a rede voltar.
  const guardado = sessaoGuardadaNoAparelho();
  if (guardado) return enrichUser(guardado);
  return null;
}

export function homeDoUsuario(usuario) {
  const configured = usuario?.home || usuario?.pagina_inicial || homeDoPapel(usuario?.papel);
  if (!usuario?.gerenciado) return configured;
  const [path, query = ""] = String(configured).split("?");
  return canAccessRoute(usuario, path, query) ? configured : (permittedRoutes(usuario)?.[0] || "/login");
}

// Lê a sessão que o Supabase persistiu no localStorage (chave sb-<ref>-auth-token)
function sessaoGuardadaNoAparelho() {
  if (typeof window === "undefined") return null;
  try {
    let bruto = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        bruto = localStorage.getItem(k);
        break;
      }
    }
    if (!bruto) return null;
    const p = JSON.parse(bruto);
    const sess = p?.currentSession || p; // cobre formatos antigos e novos
    return sess?.user || null;
  } catch (_) { return null; }
}

export async function encerrarSessao() {
  if (isSupabaseReady()) await supabase.auth.signOut();
}

// ── Recuperação de senha ───────────────────────────────────────
/** Envia e-mail com link para redefinir a senha. */
export async function recuperarSenha(email) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/nova-senha` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true };
}

/** Define a nova senha (usado na página de redefinição, após o link do e-mail). */
export async function redefinirSenha(novaSenha) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  try { await supabase.rpc("hefisto_mark_password_changed"); } catch (_) {}
  return { ok: true };
}
