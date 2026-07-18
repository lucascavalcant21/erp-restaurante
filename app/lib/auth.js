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
  // Acesso por módulo (criado pelo master): sessão local e restrita a 1 módulo.
  if (typeof window !== "undefined") {
    try {
      const bruto = localStorage.getItem("hefisto_acesso");
      if (bruto) {
        const a = JSON.parse(bruto);
        return {
          id: a.email, email: a.email, nome: a.nome || "Acesso",
          papel: "acesso", unidade: a.unidade_id,
          restrito: true, modulo: a.modulo, rota: a.rota,
          rotas: Array.isArray(a.rotas) && a.rotas.length ? a.rotas : (a.rota ? [a.rota] : []),
        };
      }
    } catch (_) {}
  }
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
  if (data?.session?.user) return mapUser(data.session.user);

  // TOLERÂNCIA OFFLINE: no celular/tablet o app reabre muitas vezes SEM rede no
  // primeiro instante — a renovação falha e o usuário era expulso pro login
  // mesmo com a sessão válida guardada no aparelho. Se a sessão persistida
  // ainda existe (o Supabase a apaga quando o refresh token é realmente
  // inválido), seguimos logados; o autoRefresh renova quando a rede voltar.
  const guardado = sessaoGuardadaNoAparelho();
  if (guardado) return mapUser(guardado);
  return null;
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
  return { ok: true };
}
