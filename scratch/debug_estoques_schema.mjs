import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let envText = "";
try { envText = fs.readFileSync(".env.local", "utf8"); } catch {}
const envVars = {};
envText.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function debug() {
  console.log("1. Buscando estoques...");
  const { data: ests, error: errEst } = await supabase.from("estoques").select("*");
  console.log("estoques data:", ests, "err:", errEst);

  console.log("2. Tentando criar estoque Bar se não existir...");
  const { data: novoBar, error: errCriar } = await supabase.from("estoques").insert([{
    unidade_id: "seldeestrela",
    nome: "Bar",
    slug: "bar",
    tipo: "bebidas",
    cor: "#7c3aed",
    status: "ativo"
  }]).select("*");
  console.log("novoBar res:", novoBar, "err:", errCriar);

  const { data: novoCoz, error: errCoz } = await supabase.from("estoques").insert([{
    unidade_id: "seldeestrela",
    nome: "Cozinha",
    slug: "cozinha",
    tipo: "alimentos",
    cor: "#059669",
    status: "ativo"
  }]).select("*");
  console.log("novoCoz res:", novoCoz, "err:", errCoz);

  const { data: ests2 } = await supabase.from("estoques").select("*");
  console.log("estoques apos insert:", ests2);
}

debug();
