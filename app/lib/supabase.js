import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config-supabase.mjs";

// Sem valor de reserva: se a URL ou a chave anônima faltarem, isto estoura com
// a mensagem dizendo o que configurar. Antes, o código caía no projeto de
// PRODUÇÃO — qualquer build sem variável (preview, staging, máquina nova)
// abria o banco real do restaurante sem ninguém perceber.
const { url: supabaseUrl, anonKey: supabaseKey } = getSupabasePublicConfig();

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
