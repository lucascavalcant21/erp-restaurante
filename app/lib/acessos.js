// ═══════════════════════════════════════════════════════════════
// acessos.js — Logins por módulo (criados pelo master em Configurações)
// Cada acesso enxerga EXCLUSIVAMENTE um módulo de uma unidade específica.
// É um controle interno (guardado no próprio ERP), separado do login master.
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

// Módulos que o master pode liberar. `rota` é para onde o acesso é levado e
// fica travado. Um acesso vê só o seu módulo, na sua unidade.
export const MODULOS_ACESSO = [
  { id: "ponto",     label: "Ponto Eletrônico",     rota: "/dashboard/rh/ponto" },
  { id: "rotina",    label: "Checklists / Rotina",  rota: "/dashboard/operacao/rotina" },
  { id: "estoque",   label: "Controle de Estoque",  rota: "/dashboard/operacao/estoque" },
  { id: "etiquetas", label: "Etiquetas / Validade", rota: "/dashboard/operacao/etiquetas" },
  { id: "fichas",    label: "Fichas Técnicas",      rota: "/dashboard/operacao/fichas" },
  { id: "montagem",  label: "Guia de Montagem",     rota: "/dashboard/operacao/montagem" },
  { id: "compras",   label: "Lista de Compras",     rota: "/dashboard/operacao/compras" },
  { id: "producao",  label: "Produção Diária",      rota: "/dashboard/operacao/producao" },
  { id: "orcamento", label: "Orçamento de Eventos", rota: "/dashboard/operacao/orcamento" },
];

export function moduloDoAcesso(id) {
  return MODULOS_ACESSO.find((m) => m.id === id) || null;
}

// ── Operações no banco (tabela acessos_modulo) ─────────────────────────────────
export async function listarAcessos() {
  if (!isSupabaseReady()) return { data: [], error: null };
  const { data, error } = await supabase.from("acessos_modulo").select("*").order("created_at", { ascending: false });
  return { data: data || [], error: error?.message || null };
}

export async function criarAcesso({ email, senha, modulo, unidade_id }) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const payload = {
    email: String(email || "").trim().toLowerCase(),
    senha: String(senha || ""),
    modulo, unidade_id, ativo: true,
  };
  const { error } = await supabase.from("acessos_modulo").insert([payload]);
  return { error: error?.message || null };
}

export async function removerAcesso(id) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const { error } = await supabase.from("acessos_modulo").delete().eq("id", id);
  return { error: error?.message || null };
}

// Login de acesso por módulo: confere e-mail + senha na tabela.
export async function loginAcesso(email, senha) {
  if (!isSupabaseReady()) return null;
  const e = String(email || "").trim().toLowerCase();
  const { data } = await supabase.from("acessos_modulo")
    .select("*").eq("email", e).eq("ativo", true).maybeSingle();
  if (!data || String(data.senha) !== String(senha)) return null;
  return data;
}

// ── Sessão local do acesso (guardada só neste aparelho) ────────────────────────
const CHAVE_ACESSO = "hefisto_acesso";

export function salvarAcessoLocal(acesso) {
  try {
    const mod = moduloDoAcesso(acesso.modulo);
    localStorage.setItem(CHAVE_ACESSO, JSON.stringify({
      email: acesso.email, modulo: acesso.modulo, unidade_id: acesso.unidade_id,
      rota: mod?.rota || "/dashboard", nome: mod?.label || "Acesso",
    }));
  } catch (_) {}
}

export function lerAcessoLocal() {
  if (typeof window === "undefined") return null;
  try {
    const bruto = localStorage.getItem(CHAVE_ACESSO);
    return bruto ? JSON.parse(bruto) : null;
  } catch (_) { return null; }
}

export function limparAcessoLocal() {
  try { localStorage.removeItem(CHAVE_ACESSO); } catch (_) {}
}
