import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sezccspqxgklicfndwxx.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_hstqbkrp5CM1FBZoyrjcXg_MrOOKCsX";

// A sessão precisa ficar guardada no aparelho e se renovar sozinha — sem isso
// o app desloga a cada vez que o token de 1h expira (comum no celular/tablet,
// que suspende o app em segundo plano). Mantemos a chave padrão do Supabase
// para não derrubar quem já está logado.
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function isSupabaseReady() {
  return supabase !== null;
}
