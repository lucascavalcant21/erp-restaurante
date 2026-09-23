/**
 * Configuração Pública Central do Supabase para HÉFISTO ERP.
 * Valida variáveis de ambiente públicas, ambiente lógico (HEFISTO_ENV)
 * e impede conexões de staging para o projeto de produção.
 */

export const ALLOWED_HEFISTO_ENVS = ['development', 'staging', 'production', 'test'];
export const PRODUCTION_SUPABASE_PROJECT_REF = process.env.HEFISTO_PRODUCTION_SUPABASE_REF || 'sezccspqxgklicfndwxx';

/**
 * Extrai o project ref de uma URL do Supabase (ex: https://abcxyz.supabase.co -> abcxyz)
 */
export function extractProjectRef(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const parts = host.split('.');
    if (parts.length >= 3 && (parts[1] === 'supabase' || parts[1] === 'supabase-staging')) {
      return parts[0];
    }
    return parts[0] || null;
  } catch {
    const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.(co|net|in|io)/i);
    return match ? match[1] : null;
  }
}

/**
 * Retorna e valida o ambiente lógico HEFISTO_ENV (suporta NEXT_PUBLIC_HEFISTO_ENV no client-side)
 */
export function getHefistoEnv() {
  // Agora HEFISTO_ENV está no next.config.js, então é injetado nativamente no client bundle!
  const envRaw = process.env.NEXT_PUBLIC_HEFISTO_ENV || process.env.HEFISTO_ENV || 'production';
  const env = (envRaw || '').trim().toLowerCase();
  
  if (!env) {
    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }
    throw new Error('MISSING_HEFISTO_ENV: A variável de ambiente HEFISTO_ENV é obrigatória.');
  }

  if (!ALLOWED_HEFISTO_ENVS.includes(env)) {
    throw new Error(`INVALID_HEFISTO_ENV: Ambiente "${env}" é inválido. Valores permitidos: ${ALLOWED_HEFISTO_ENVS.join(', ')}.`);
  }

  return env;
}

/**
 * Valida se o ambiente de staging está tentando se conectar ao projeto de produção
 */
export function validateEnvironmentAndUrl(hefistoEnv, url) {
  const projectRef = extractProjectRef(url);
  const prodRef = PRODUCTION_SUPABASE_PROJECT_REF;

  if (hefistoEnv === 'staging' && projectRef && prodRef && projectRef === prodRef) {
    throw new Error(`STAGING_MUST_NOT_USE_PRODUCTION_SUPABASE: O ambiente staging (HEFISTO_ENV=staging) não pode se conectar ao projeto Supabase de produção (project ref: ${prodRef}).`);
  }

  return projectRef;
}

/**
 * Retorna as configurações públicas do Supabase com validação rígida (sem fallbacks para produção)
 */
export function getSupabasePublicConfig() {
  const env = getHefistoEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!url || !anonKey) {
    throw new Error(`MISSING_PUBLIC_SUPABASE_CONFIG: As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias em ambiente ${env}.`);
  }

  const projectRef = validateEnvironmentAndUrl(env, url);

  return {
    url,
    anonKey,
    env,
    projectRef,
  };
}
