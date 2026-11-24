import { supabase, isSupabaseReady } from "./supabase";
// Rascunho no aparelho (dono, 17/11/2026: "o sistema atualiza e some a ficha
// que eu estava criando"). O que está sendo montado e ainda não foi salvo fica
// guardado neste aparelho a cada mudança; se a tela recarregar (atualização do
// app, puxar para atualizar, queda de conexão), volta do ponto onde parou.
// Some ao salvar ou ao cancelar. Validade: 7 dias. Só no navegador; erro de
// armazenamento nunca derruba a tela.

const PREFIXO = "hefisto:rascunho:";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export function guardarRascunho(chave, dados) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFIXO + chave, JSON.stringify({ em: Date.now(), dados }));
  } catch { /* sem espaço ou modo privado: segue sem rascunho */ }
}

export function lerRascunho(chave) {
  try {
    if (typeof window === "undefined") return null;
    const bruto = window.localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const r = JSON.parse(bruto);
    if (!r || typeof r !== "object" || Date.now() - Number(r.em || 0) > VALIDADE_MS) { apagarRascunho(chave); return null; }
    return r.dados ?? null;
  } catch { return null; }
}

export function apagarRascunho(chave) {
  try { if (typeof window !== "undefined") window.localStorage.removeItem(PREFIXO + chave); } catch { /* idem */ }
}

// ─── cópia no banco (RASCUNHO-1, dono 17/11/2026: "salve tudo no banco") ─────
// Além do aparelho, o rascunho vai para public.rascunhos_usuario (só o próprio
// usuário vê, RLS), 1,5 s depois da última mudança. Assim volta mesmo se o
// aparelho limpar o armazenamento ou se abrir em outro celular.

const pendentes = new Map();

export function guardarRascunhoNoBanco(chave, dados, unidadeId = null) {
  guardarRascunho(chave, dados);
  if (typeof window === "undefined" || !isSupabaseReady()) return;
  clearTimeout(pendentes.get(chave));
  pendentes.set(chave, setTimeout(async () => {
    pendentes.delete(chave);
    try {
      await supabase.from("rascunhos_usuario").upsert({ chave, unidade_id: unidadeId, dados, atualizado_em: new Date().toISOString() }, { onConflict: "auth_user_id,chave" });
    } catch { /* sem conexão: fica no aparelho e tenta de novo na próxima mudança */ }
  }, 1500));
}

export async function lerRascunhoDoBanco(chave) {
  const local = lerRascunho(chave);
  if (local) return local;
  if (!isSupabaseReady()) return null;
  try {
    const { data } = await supabase.from("rascunhos_usuario").select("dados, atualizado_em").eq("chave", chave).maybeSingle();
    if (!data?.dados || Date.now() - new Date(data.atualizado_em).getTime() > VALIDADE_MS) return null;
    return data.dados;
  } catch { return null; }
}

export function apagarRascunhoNoBanco(chave) {
  apagarRascunho(chave);
  clearTimeout(pendentes.get(chave)); pendentes.delete(chave);
  if (!isSupabaseReady()) return;
  supabase.from("rascunhos_usuario").delete().eq("chave", chave).then(() => {}, () => {});
}
