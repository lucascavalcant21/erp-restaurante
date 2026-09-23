/* Confere a configuração de Supabase do ambiente ATUAL, sem conectar em nada.
   Não imprime chave nenhuma: só diz se existe, qual o ambiente declarado e
   para qual project ref a URL aponta.

   Uso:
     node scripts/verificar-ambiente-supabase.mjs
     HEFISTO_ENV=staging node scripts/verificar-ambiente-supabase.mjs

   Sai com código 1 quando a configuração não presta — dá para usar como porta
   de entrada de deploy.
*/
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ambienteHefisto, validarConfigSupabase, projectRefDaUrl, REF_PRODUCAO } =
  await import(pathToFileURL(path.join(RAIZ, "app", "lib", "config-supabase.mjs")).href);

const env = process.env;
const ambiente = ambienteHefisto(env);
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = projectRefDaUrl(url);
const temAnon = !!String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const temService = !!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const publico = validarConfigSupabase({ ambiente, url, chave: temAnon ? "presente" : "" });
const servidor = validarConfigSupabase({ ambiente, url, chave: temService ? "presente" : "", rotuloChave: "SUPABASE_SERVICE_ROLE_KEY" });

console.log("Ambiente declarado :", ambiente, env.HEFISTO_ENV ? "(HEFISTO_ENV)" : env.VERCEL_ENV ? `(VERCEL_ENV=${env.VERCEL_ENV})` : "(padrão)");
console.log("URL configurada    :", url ? "sim" : "NÃO");
console.log("Project ref        :", ref || "(não identificado)");
console.log("É o de produção?   :", ref && ref === REF_PRODUCAO ? "SIM" : "não");
console.log("Chave anônima      :", temAnon ? "presente" : "AUSENTE");
console.log("Service role       :", temService ? "presente (só servidor)" : "ausente");
console.log("");
console.log("Configuração pública :", publico.ok ? "OK" : `ERRO — ${publico.erro}`);
console.log("Configuração servidor:", servidor.ok ? "OK" : `AVISO — ${servidor.erro}`);

/* A pública é obrigatória para o app subir. A de servidor só é exigida onde
   existem rotas administrativas, então ela sai como aviso. */
if (!publico.ok) {
  console.log("\nRESULTADO: FALHOU");
  process.exit(1);
}
console.log("\nRESULTADO: OK");
