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

async function check() {
  const { data: ests } = await supabase.from("estoques").select("*");
  console.log("estoques:", ests?.length, ests);

  const { data: ins } = await supabase.from("insumos").select("id, nome, departamento, categoria, unidade_id").limit(10);
  console.log("insumos sample:", ins);
}

check();
