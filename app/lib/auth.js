// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação (Supabase Auth) + permissões por papel
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

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
    home: "/dashboard",
    nav: ["dashboard","notificacoes","rotina","ingredientes","fichas","cardapio","estoque","fornecedores","eventos","dre","fluxo","cmv","margem","documentos","gestao_rh","ponto","colaborador","crm","campanhas","nps","heitor"],
  },
  {
    id: "financeiro", label: "Financeiro", cor: "#3b82f6",
    descricao: "Resultados financeiros da rede e das lojas.",
    home: "/dashboard/financeiro/dre",
    nav: ["dashboard","rede","notificacoes","dre","fluxo","cmv","margem","documentos"],
  },
  {
    id: "rh", label: "Recursos Humanos", cor: "#ec4899",
    descricao: "Equipe, ponto e portal do colaborador.",
    home: "/dashboard/rh/gestao",
    nav: ["notificacoes","gestao_rh","ponto","colaborador"],
  },
  {
    id: "estoque", label: "Estoquista", cor: "#8b5cf6",
    descricao: "Insumos, estoque, fichas, cardápio e fornecedores.",
    home: "/dashboard/operacao/estoque",
    nav: ["notificacoes","estoque","ingredientes","fichas","cardapio","fornecedores"],
  },
  {
    id: "cozinha", label: "Cozinha / Chef", cor: "#f97316",
    descricao: "Fichas técnicas, cardápio e insumos.",
    home: "/dashboard/operacao/cardapio",
    nav: ["notificacoes","ingredientes","fichas","cardapio","estoque"],
  },
  {
    id: "marketing", label: "Marketing", cor: "#f59e0b",
    descricao: "Clientes, campanhas e avaliações.",
    home: "/dashboard/clientes/crm",
    nav: ["dashboard","notificacoes","crm","campanhas","nps"],
  },
  {
    id: "caixa", label: "Operador de Caixa", cor: "#64748b",
    descricao: "Painel e notificações do dia.",
    home: "/dashboard", nav: ["dashboard","notificacoes"],
  },
];

export function getPapel(papelId) {
  return PAPEIS.find((p) => p.id === papelId) || PAPEIS[0];
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

function traduzErro(msg = "") {
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already been registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/at least 6/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/Unable to validate email/i.test(msg)) return "E-mail inválido.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  return msg || "Erro de autenticação.";
}

// ── Registrar ──────────────────────────────────────────────────
export async function registrarUsuario({ nome, email, senha, papel, unidade }) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const { data, error } = await supabase.auth.signUp({
    email, password: senha, options: { data: { nome, papel, unidade } },
  });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true, usuario: mapUser(data.user), precisaConfirmar: !data.session };
}

// ── Login ──────────────────────────────────────────────────────
export async function fazerLogin(email, senha) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true, usuario: mapUser(data.user) };
}

// ── Sessão ─────────────────────────────────────────────────────
export async function lerSessao() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user ? mapUser(data.session.user) : null;
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
  return { ok: true };
}
