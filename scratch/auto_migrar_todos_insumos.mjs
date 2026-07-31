import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let envText = "";
try {
  envText = fs.readFileSync(".env.local", "utf8");
} catch {}

const envVars = {};
envText.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    envVars[k] = v;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarTudo() {
  console.log("1. Atualizando 'fardo' para 'lata' nos insumos e itens de estoque...");
  
  // Update insumos where unidade_comercial is fardo
  await supabase.from("insumos").update({ unidade_comercial: "lata" }).ilike("unidade_comercial", "%fardo%");
  await supabase.from("insumos").update({ embalagem: "lata" }).ilike("embalagem", "%fardo%");

  console.log("2. Buscando insumos e estoques...");
  const { data: insumos, error: errInsumos } = await supabase.from("insumos").select("*");
  if (errInsumos) {
    console.error("Erro ao buscar insumos:", errInsumos);
    return;
  }
  console.log(`Encontrados ${insumos.length} insumos no total.`);

  const { data: estoques, error: errEstoques } = await supabase.from("estoques").select("*");
  if (errEstoques) {
    console.error("Erro ao buscar estoques:", errEstoques);
    return;
  }
  console.log(`Encontrados ${estoques.length} estoques.`);

  let vinculados = 0;

  for (const item of insumos) {
    const unidadId = item.unidade_id;
    if (!unidadId) continue;

    const estoquesDaUnidade = estoques.filter(e => e.unidade_id === unidadId);
    if (!estoquesDaUnidade.length) continue;

    const dept = (item.departamento || "").toLowerCase();
    const cat = (item.categoria || "").toLowerCase();
    const nome = (item.nome || "").toLowerCase();

    let estoqueAlvo = null;

    // 1. Limpeza
    if (dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("limpeza") || e.tipo === "limpeza");
    }
    // 2. Embalagens
    else if (dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|filme pvc|aluminio)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("embalag") || e.tipo === "embalagens");
    }
    // 3. Bar
    else if (dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|vermute|bitter|espumante|absolut)/.test(nome)) {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("bar") || e.tipo === "bebidas");
    }
    // 4. Cozinha (fallback)
    else {
      estoqueAlvo = estoquesDaUnidade.find(e => (e.slug || e.nome || "").toLowerCase().includes("cozinha") || e.tipo === "alimentos");
    }

    if (!estoqueAlvo) {
      estoqueAlvo = estoquesDaUnidade[0];
    }

    if (estoqueAlvo) {
      const { error: errItem } = await supabase.from("estoque_itens").upsert({
        unidade_id: unidadId,
        estoque_id: estoqueAlvo.id,
        insumo_id: item.id,
        quantidade_atual: item.quantidade_atual || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "estoque_id,insumo_id" });

      if (!errItem) vinculados++;

      await supabase.from("estoque_atual").upsert({
        unidade_id: unidadId,
        insumo_id: item.id,
        quantidade_atual: item.quantidade_atual || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "unidade_id,insumo_id" }).catch(() => {});
    }
  }

  console.log(`Concluído! ${vinculados} insumos vinculados com sucesso aos estoques da sua unidade!`);
}

migrarTudo();
