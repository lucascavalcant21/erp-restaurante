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

async function fix() {
  console.log("1. Buscando insumos do Bar para corrigir unidades de medida de kg/g para ml/l...");
  const { data: insumos } = await supabase.from("insumos").select("*");
  let corrigidos = 0;

  for (const item of insumos || []) {
    const dept = (item.departamento || "").trim().toLowerCase();
    const cat = (item.categoria || "").trim();
    const ehBar = dept === "bar" || dept === "bebidas" || ["Destilados", "Cervejas", "Vinhos", "Chopp", "Água", "Refrigerantes", "Bombons", "Pré-preparos"].includes(cat);
    
    if (ehBar) {
      const u = (item.unidade_medida || "").toLowerCase();
      if (u === "kg" || u === "g" || !u) {
        const tam = Number(item.tamanho_embalagem) || 1;
        // Se o tamanho for ex. 750 (750ml), 355 (355ml), 500 (500ml), 1000 (1000ml) -> unidade_medida = 'ml'
        // Se o tamanho for ex. 1, 2, 5 -> unidade_medida = 'l' ou 'ml' (se tam >= 10 -> ml, senão l)
        const novaUnidade = tam >= 10 ? "ml" : "l";
        await supabase.from("insumos").update({ unidade_medida: novaUnidade }).eq("id", item.id);
        await supabase.from("estoque_itens").update({ unidade_medida: novaUnidade }).eq("insumo_id", item.id);
        console.log(`Corrigido [Bar]: ${item.nome} -> ${tam} ${novaUnidade}`);
        corrigidos++;
      }
    }
  }

  console.log(`Concluído! ${corrigidos} insumos do Bar tiveram a unidade corrigida de kg/g para ml/l!`);
}

fix();
