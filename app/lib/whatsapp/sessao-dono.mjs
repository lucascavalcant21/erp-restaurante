// Sessão REAL do usuário do dono para o canal WhatsApp (server-only).
//
// Por que não usar a service role direto: o Intelligence Core lê o banco como o
// usuário (RLS, hefisto_user_can, auditoria com o auth.uid() verdadeiro). Aqui
// a service role só ABRE a sessão daquele usuário (admin.generateLink +
// verifyOtp, sem e-mail enviado); daí para frente tudo é o caminho normal da
// Central de Inteligência, com as permissões do perfil dele.
//
// Quem é o usuário: WHATSAPP_DONO_AUTH_USER_ID (auth.users.id). Nunca vem da mensagem.
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "../config/supabase-public.mjs";

const SEM_SESSAO = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let cache = null; // { userId, token, expiraEm }

export async function tokenDoDono({ env = process.env, criarCliente = createClient, agora = Date.now() } = {}) {
  const userId = String(env.WHATSAPP_DONO_AUTH_USER_ID || "").trim();
  if (!UUID.test(userId)) throw new Error("WHATSAPP_DONO_AUTH_USER_ID ausente ou inválido");
  if (cache && cache.userId === userId && cache.expiraEm - agora > 5 * 60_000) return cache.token;

  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  const { url, anonKey } = getSupabasePublicConfig();
  const admin = criarCliente(url, service, { auth: SEM_SESSAO });

  const { data: u, error: eu } = await admin.auth.admin.getUserById(userId);
  if (eu || !u?.user?.email) throw new Error("usuário do dono não encontrado no Auth");
  const { data: link, error: el } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const hash = link?.properties?.hashed_token;
  if (el || !hash) throw new Error("não foi possível gerar o acesso do dono");

  const anon = criarCliente(url, anonKey, { auth: SEM_SESSAO });
  const { data: s, error: es } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  const sessao = s?.session;
  if (es || !sessao?.access_token || sessao.user?.id !== userId) throw new Error("sessão do dono não confirmada");

  cache = { userId, token: sessao.access_token, expiraEm: (sessao.expires_at ? sessao.expires_at * 1000 : agora + 3600_000) };
  return cache.token;
}

export const esquecerSessaoDoDono = () => { cache = null; };
