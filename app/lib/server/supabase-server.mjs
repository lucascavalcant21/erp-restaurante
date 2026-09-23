import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerConfig } from '../config/supabase-server.mjs';

/**
 * Cliente Supabase Server-Only com privilégios de service_role.
 * UTILIZAÇÃO RESTRITA AO BACKEND / SERVER-SIDE (API Routes, Server Actions, Job Runners).
 * NUNCA EXPORTAR PARA BUNDLE CLIENT-SIDE OU COMPONENTES DE BROWSER.
 */
export function getSupabaseServerClient() {
  const config = getSupabaseServerConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
