import { createClient } from "@supabase/supabase-js";

// SEM VALOR DE RESERVA. Havia aqui a URL e a chave do projeto de PRODUÇÃO como
// fallback, e era isso que quebrava o preview: o navegador logava no Supabase
// de produção (pelo fallback) enquanto o servidor, sem variável nenhuma, não
// conseguia montar cliente para validar aquele token — o usuário entrava, mas
// toda chamada de servidor voltava 401. Pior: qualquer build sem variável
// falava com o banco real do restaurante.
//
// Agora as duas variáveis são obrigatórias e valem para os dois lados.
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export const CONFIG_SUPABASE_AUSENTE = (() => {
  const faltando = [
    supabaseUrl ? null : "NEXT_PUBLIC_SUPABASE_URL",
    supabaseKey ? null : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  return faltando.length ? `Configure ${faltando.join(" e ")} neste ambiente.` : "";
})();

// A sessão precisa ficar guardada no aparelho e se renovar sozinha — sem isso
// o app desloga a cada vez que o token de 1h expira (comum no celular/tablet,
// que suspende o app em segundo plano).
export const supabase = CONFIG_SUPABASE_AUSENTE
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

export function isSupabaseReady() {
  return supabase !== null;
}

/** Identificador PÚBLICO do projeto configurado (o <ref> de
 *  https://<ref>.supabase.co). Serve para conferir se cliente e servidor estão
 *  no mesmo projeto — não é segredo e não dá acesso a nada. */
export function projectRefConfigurado() {
  const m = supabaseUrl.match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return m ? m[1].toLowerCase() : "";
}
