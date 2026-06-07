/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENTE SUPABASE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Configure as variáveis no arquivo .env.local na raiz do projeto:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
 *
 * Para obter essas chaves: Supabase Dashboard → Project Settings → API
 *
 * Em produção (Vercel) adicione as mesmas variáveis em:
 *   Vercel Dashboard → seu projeto → Settings → Environment Variables
 *
 * Política de RLS recomendada (habilitar em todas as tabelas):
 *   - Leitura: authenticated
 *   - Escrita:  authenticated
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || "https://sezccspqxgklicfndwxx.supabase.co";
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_hstqbkrp5CM1FBZoyrjcXg_MrOOKCsX";

if (!supabaseUrl || !supabaseKey) {
  // Aviso em dev; não quebra o build
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados.\n" +
      "Crie o arquivo .env.local na raiz do projeto com essas variáveis.\n" +
      "Enquanto isso, os módulos usarão dados de demonstração."
    );
  }
}

// Exporta null se não configurado — módulos verificam antes de usar
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * Helper: retorna true se o Supabase está configurado e disponível.
 * Use nos módulos para decidir entre dados reais e dados de demo.
 *
 * Exemplo:
 *   if (isSupabaseReady()) {
 *     const data = await fetchEstoque();
 *   } else {
 *     setItens(ESTOQUE_SEED);
 *   }
 */
export function isSupabaseReady() {
  return supabase !== null;
}
