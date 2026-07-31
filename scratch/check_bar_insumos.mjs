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
  const { data: insumos } = await supabase.from("insumos").select("*");
  const { data: itensEstoque } = await supabase.from("estoque_itens").select("*");

  console.log(`Total insumos no banco: ${insumos?.length || 0}`);
  console.log(`Total itens em estoque_itens: ${itensEstoque?.length || 0}`);

  const barItens = itensEstoque?.filter(i => i.estoque_id === "bar") || [];
  console.log(`Itens no estoque do Bar (estoque_id = 'bar'): ${barItens.length}`);

  const barIds = new Set(barItens.map(i => i.insumo_id));

  const insumosBarNaoMigrados = insumos?.filter(i => {
    const dept = (i.departamento || "").toLowerCase();
    const cat = (i.categoria || "").toLowerCase();
    const nome = (i.nome || "").toLowerCase();
    const ehBar = dept.includes("bar") || dept.includes("bebida") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("licor") || cat.includes("cachaça") || cat.includes("cachaca") || cat.includes("vodka") || cat.includes("gin") || cat.includes("whisky") || cat.includes("rum") || cat.includes("tequila") || cat.includes("refrigerante") || cat.includes("suco") || cat.includes("água") || cat.includes("agua");
    return ehBar && !barIds.has(i.id);
  });

  console.log(`Insumos do Bar ainda NÃO no estoque_id 'bar': ${insumosBarNaoMigrados?.length || 0}`);
  if (insumosBarNaoMigrados?.length) {
    console.log("Exemplos:", insumosBarNaoMigrados.slice(0, 10).map(i => ({ nome: i.nome, dept: i.departamento, cat: i.categoria })));
  }
}

check();
