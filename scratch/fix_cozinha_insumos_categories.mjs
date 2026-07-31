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
  console.log("1. Buscando todos os insumos...");
  const { data: insumos } = await supabase.from("insumos").select("*");
  let corrigidos = 0;

  for (const item of insumos || []) {
    const dept = (item.departamento || "").trim().toLowerCase();
    const nome = (item.nome || "").trim().toLowerCase();

    const ehComidaOuCozinha = dept.includes("cozinha") ||
      dept.includes("alimento") ||
      /(pirarucu|peixe|cheiro-verde|chicoria|chicória|cumaru|frango|carne|tambaqui|tucunare|filhote|salmao|camarao|tomate|cebola|alho|batata|arroz|feijao|farinha|massa|queijo|presunto|bacon|molho|azeite|oleo|tempero|sal|açucar|açucar|limao|laranja|maracuja|morango|banana)/.test(nome);

    if (ehComidaOuCozinha && dept !== "bar") {
      // Se for comida/cozinha, garante departamento = cozinha e remove categoria de bar se tiver sido atribuída incorretamente
      const catAtual = item.categoria;
      const ehCatBar = ["Destilados", "Cervejas", "Vinhos", "Chopp", "Água", "Refrigerantes", "Bombons"].includes(catAtual);
      
      const payload = { departamento: "cozinha" };
      if (ehCatBar) {
        payload.categoria = null;
      }

      await supabase.from("insumos").update(payload).eq("id", item.id);
      await supabase.from("estoque_itens").delete().eq("estoque_id", "bar").eq("insumo_id", item.id);
      corrigidos++;
    }
  }

  console.log(`Concluído! ${corrigidos} itens da Cozinha foram removidos do Bar e mantidos exclusivamente na Cozinha!`);
}

fix();
