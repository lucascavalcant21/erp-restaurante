import { getHefistoEnv, validateEnvironmentAndUrl } from './supabase-public.mjs';

/**
 * Configuração Privilegiada de Servidor (Server-Only) do Supabase para HÉFISTO ERP.
 * ESTE MÓDULO NUNCA DEVE SER EXECUTADO NO CLIENTE / BROWSER.
 */

if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: app/lib/config/supabase-server.mjs é de uso exclusivo do servidor e não pode ser executado no navegador.');
}

export function getSupabaseServerConfig() {
  const env = getHefistoEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url) {
    throw new Error(`MISSING_SERVER_SUPABASE_URL: A URL do Supabase não foi configurada em ambiente ${env}.`);
  }

  if (!serviceRoleKey) {
    throw new Error(`MISSING_SUPABASE_SERVICE_ROLE_KEY: A variável SUPABASE_SERVICE_ROLE_KEY é obrigatória no servidor em ambiente ${env}. Sem fallbacks.`);
  }

  const projectRef = validateEnvironmentAndUrl(env, url);

  return {
    url,
    serviceRoleKey,
    env,
    projectRef,
  };
}
