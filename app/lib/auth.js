// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação real via Supabase Auth
// (senhas com hash, sessão JWT gerenciada pelo Supabase)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

export const PAPEIS = [
  { id: "admin",     label: "Administrador",       descricao: "Acesso total ao sistema.",                         cor: "#0f172a" },
  { id: "gerente",   label: "Gerente de Unidade",  descricao: "Visão operacional e financeira da unidade.",       cor: "#10b981" },
  { id: "financeiro",label: "Financeiro",          descricao: "DRE, CMV, fluxo de caixa e documentos.",           cor: "#3b82f6" },
  { id: "rh",        label: "Recursos Humanos",    descricao: "Colaboradores, escala, ponto e holerites.",        cor: "#ec4899" },
  { id: "estoque",   label: "Estoquista",          descricao: "Insumos, categorias e movimentação de estoque.",   cor: "#8b5cf6" },
  { id: "cozinha",   label: "Cozinha / Chef",      descricao: "Fichas técnicas, cardápio e insumos.",             cor: "#f97316" },
  { id: "marketing", label: "Marketing",           descricao: "Campanhas, clientes e avaliações NPS.",            cor: "#f59e0b" },
  { id: "caixa",     label: "Operador de Caixa",   descricao: "Registra vendas e consulta o resumo do dia.",      cor: "#64748b" },
];

export function getPapel(papelId) {
  return PAPEIS.find((p) => p.id === papelId) || PAPEIS[0];
}

// ── Mapeia o usuário do Supabase para o formato usado no app ───────
function mapUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email,
    nome: m.nome || (u.email ? u.email.split("@")[0] : "Usuário"),
    papel: m.papel || "admin",
    unidade: m.unidade || null,
  };
}

function traduzErro(msg = "") {
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already been registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/at least 6/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/Unable to validate email/i.test(msg)) return "E-mail inválido.";
  return msg || "Erro de autenticação.";
}

// ── Registrar usuário ──────────────────────────────────────────
export async function registrarUsuario({ nome, email, senha, papel, unidade }) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível no momento." };
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, papel, unidade } },
  });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true, usuario: mapUser(data.user), precisaConfirmar: !data.session };
}

// ── Login ──────────────────────────────────────────────────────
export async function fazerLogin(email, senha) {
  if (!isSupabaseReady()) return { ok: false, erro: "Sistema indisponível no momento." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true, usuario: mapUser(data.user) };
}

// ── Ler sessão atual (async) ───────────────────────────────────
export async function lerSessao() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user ? mapUser(data.session.user) : null;
}

// ── Encerrar sessão ────────────────────────────────────────────
export async function encerrarSessao() {
  if (isSupabaseReady()) await supabase.auth.signOut();
}
