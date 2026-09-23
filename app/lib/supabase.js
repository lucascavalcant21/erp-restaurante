import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config/supabase-public.mjs";

let client = null;
try {
  const config = getSupabasePublicConfig();
  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (err) {
  if (process.env.NODE_ENV !== 'test') {
    console.error("Erro ao inicializar cliente Supabase público:", err.message);
  }
}

export const supabase = client;

export function isSupabaseReady() {
  return supabase !== null;
}
