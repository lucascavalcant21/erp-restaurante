import { supabase } from "./supabase";

// fetch para as rotas do Héfisto que exigem login (SEC-API-1): leva o token
// da sessão no cabeçalho Authorization, como rh-arquivos.js já fazia.
export async function fetchComSessao(url, init = {}) {
  let token = "";
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || "";
  } catch { /* sem sessão: o servidor responde 401 */ }
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
