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

async function executar() {
  console.log("1. Atualizando 'fardo' para 'lata'...");
  await supabase.from("insumos").update({ unidade_comercial: "lata" }).ilike("unidade_comercial", "%fardo%");
  await supabase.from("insumos").update({ embalagem: "lata" }).ilike("embalagem", "%fardo%");

  console.log("2. Buscando insumos do banco...");
  const { data: insumos } = await supabase.from("insumos").select("*");
  console.log(`Encontrados ${insumos?.length || 0} insumos.`);

  let barCont = 0;
  let cozinhaCont = 0;
  let limpezaCont = 0;
  let embalagensCont = 0;

  for (const item of insumos || []) {
    const unidadId = item.unidade_id;
    if (!unidadId) continue;

    const dept = (item.departamento || "").toLowerCase();
    const cat = (item.categoria || "").toLowerCase();
    const nome = (item.nome || "").toLowerCase();

    let estoqueSlug = "cozinha";

    if (dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome)) {
      estoqueSlug = "limpeza";
      limpezaCont++;
    } else if (dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|filme pvc|aluminio)/.test(nome)) {
      estoqueSlug = "embalagens";
      embalagensCont++;
    } else if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante|absolut)/.test(nome)) {
      estoqueSlug = "bar";
      barCont++;
    } else {
      estoqueSlug = "cozinha";
      cozinhaCont++;
    }

    // Insert or update estoque_itens
    await supabase.from("estoque_itens").upsert({
      unidade_id: unidadId,
      estoque_id: estoqueSlug,
      insumo_id: item.id,
      quantidade_atual: item.quantidade_atual || 0,
      estoque_minimo: item.estoque_minimo || null,
      estoque_maximo: item.estoque_maximo || null,
      custo_unitario: item.custo_unitario || item.custo_compra || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "estoque_id,insumo_id" });

    // Insert or update estoque_atual
    await supabase.from("estoque_atual").upsert({
      unidade_id: unidadId,
      insumo_id: item.id,
      quantidade_atual: item.quantidade_atual || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "unidade_id,insumo_id" });
  }

  console.log(`Sucesso! Insumos vinculados aos estoques:`);
  console.log(`- Bar: ${barCont} insumos`);
  console.log(`- Cozinha: ${cozinhaCont} insumos`);
  console.log(`- Limpeza: ${limpezaCont} insumos`);
  console.log(`- Embalagens: ${embalagensCont} insumos`);
}

executar();
